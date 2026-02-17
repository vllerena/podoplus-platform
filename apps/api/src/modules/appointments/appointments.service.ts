import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
  Inject,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import { HoldsService } from "../holds/holds.service";
import { RealtimeService } from "../realtime/realtime.service";

export enum AppointmentStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  CHECKED_IN = "CHECKED_IN",
  IN_SERVICE = "IN_SERVICE",
  COMPLETED = "COMPLETED",
  RESCHEDULED = "RESCHEDULED",
  CANCELED = "CANCELED",
  NO_SHOW = "NO_SHOW",
}

export interface AppointmentResponse {
  id: string;
  branch_id: string;
  customer_id: string;
  service_id: string;
  start_at: string;
  start_date: string;
  start_time: string;
  end_at: string;
  end_date: string;
  end_time: string;
  status: AppointmentStatus;
  source: "RECEPTION" | "PORTAL" | "STAFF" | "SYSTEM";
  notes?: string;
  cancel_reason?: string;
  rescheduled_from_id?: string;
  rescheduled_to_id?: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger("AppointmentsService");

  private readonly CLIENT_CANCEL_LIMIT_HOURS = 6;
  private readonly CLIENT_RESCHEDULE_LIMIT_HOURS = 6;
  private readonly NO_SHOW_GRACE_MIN = 15;

  constructor(
    private prisma: PrismaService,
    private rbacService: RbacService,
    private holdsService: HoldsService,
    private realtimeService?: RealtimeService
  ) {}

  /**
   * Confirma una cita usando un hold existente
   */
  async confirmAppointmentWithHold(
    holdId: string,
    customerId: string,
    branchId: string,
    serviceId: string,
    startAt: Date,
    notes?: string,
    source: string = "RECEPTION",
    createdBy?: string,
    idempotencyKey?: string
  ): Promise<AppointmentResponse> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Cliente ${customerId} no encontrado`);
    }

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException(`Servicio ${serviceId} no encontrado`);
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw new NotFoundException(`Rama ${branchId} no encontrada`);
    }

    const hold = await this.holdsService.getHold(holdId);
    if (!hold) {
      throw new BadRequestException("Hold no encontrado o expirado");
    }

    const holdStartAt = new Date(hold.start_at);
    const holdEndAt = new Date(hold.end_at);

    const tolerance = 1000;
    const timeDiffStart = Math.abs(holdStartAt.getTime() - startAt.getTime());

    if (timeDiffStart > tolerance) {
      throw new BadRequestException(
        `Hold no corresponde a este horario. Hold: ${hold.start_at}, Enviado: ${startAt.toISOString()}`
      );
    }

    const endAt = holdEndAt;

    const capacityInfo = await this.getEffectiveCapacityForSlot(
      branchId,
      startAt
    );

    const occupiedCount = await this.prisma.appointment.count({
      where: {
        branchId,
        status: {
          in: [
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.CHECKED_IN,
            AppointmentStatus.IN_SERVICE,
          ],
        },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });

    if (occupiedCount >= capacityInfo.totalCapacity) {
      throw new ConflictException("No hay cupo disponible");
    }

    const appointment = await this.prisma.$transaction(
      async (tx) => {
        if (idempotencyKey) {
          const existing = await tx.appointment.findFirst({
            where: {
              customerId,
              branchId,
              startAt,
            },
          });

          if (existing) {
            this.logger.warn(`Cita duplicada (idempotency): ${idempotencyKey}`);
            return existing;
          }
        }

        const apt = await tx.appointment.create({
          data: {
            branchId,
            customerId,
            serviceId,
            startAt,
            endAt,
            status: AppointmentStatus.CONFIRMED,
            source,
            notes: notes || null,
            createdById: createdBy || null,
          },
        });

        await tx.appointmentStatusHistory.create({
          data: {
            appointmentId: apt.id,
            fromStatus: null,
            toStatus: AppointmentStatus.CONFIRMED,
            changedByType: "USER",
            reason: "Cita confirmada desde hold",
          },
        });

        return apt;
      },
      {
        isolationLevel: "Serializable",
      }
    );

    await this.holdsService.releaseHold(holdId);

    if (this.realtimeService) {
      this.realtimeService.notifyAppointmentCreated({
        id: appointment.id,
        branch_id: appointment.branchId,
        customer_id: appointment.customerId,
        service_id: appointment.serviceId,
        start_at: this.formatDateTime(appointment.startAt),
        start_date: this.formatDateOnly(appointment.startAt),
        start_time: this.formatTimeOnly(appointment.startAt),
        end_at: this.formatDateTime(appointment.endAt),
        end_date: this.formatDateOnly(appointment.endAt),
        end_time: this.formatTimeOnly(appointment.endAt),
        status: appointment.status,
        created_at: this.formatDateOnly(appointment.createdAt),
      });
    }

    this.logger.log(
      `Cita confirmada desde hold: ${appointment.id} (Hold: ${holdId})`
    );

    return this.formatAppointment(appointment);
  }

  /**
   * Crear cita directamente (sin hold)
   */
  async createAppointment(
    branchId: string,
    customerId: string,
    serviceId: string,
    startAt: Date,
    status: AppointmentStatus = AppointmentStatus.CONFIRMED,
    notes?: string,
    source: "RECEPTION" | "PORTAL" | "STAFF" = "RECEPTION",
    createdById?: string
  ): Promise<AppointmentResponse> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      throw new NotFoundException(`Cliente ${customerId} no encontrado`);
    }

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) {
      throw new NotFoundException(`Servicio ${serviceId} no encontrado`);
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch) {
      throw new NotFoundException(`Sede ${branchId} no encontrada`);
    }

    const endAt = new Date(
      startAt.getTime() +
        (service.durationMinutes + service.bufferMinutes) * 60000
    );

    try {
      const appointment = await this.prisma.$transaction(async (tx) => {
        const capacityInfo = await this.getEffectiveCapacityForSlot(
          branchId,
          startAt,
          tx
        );

        const occupiedCount = await tx.appointment.count({
          where: {
            branchId,
            status: {
              in: [
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.CHECKED_IN,
                AppointmentStatus.IN_SERVICE,
              ],
            },
            startAt: { lt: endAt },
            endAt: { gt: startAt },
          },
        });

        if (occupiedCount >= capacityInfo.totalCapacity) {
          throw new ConflictException("No hay cupo disponible");
        }

        const newAppointment = await tx.appointment.create({
          data: {
            branchId,
            customerId,
            serviceId,
            startAt,
            endAt,
            status,
            source,
            notes: notes || null,
            createdById: createdById || null,
          },
        });

        await tx.appointmentStatusHistory.create({
          data: {
            appointmentId: newAppointment.id,
            fromStatus: null,
            toStatus: status,
            changedByType: "USER",
            reason: "Cita creada",
          },
        });

        return newAppointment;
      });

      if (this.realtimeService) {
        this.realtimeService.notifyAppointmentCreated({
          id: appointment.id,
          branch_id: appointment.branchId,
          customer_id: appointment.customerId,
          service_id: appointment.serviceId,
          start_at: this.formatDateTime(appointment.startAt),
          start_date: this.formatDateOnly(appointment.startAt),
          start_time: this.formatTimeOnly(appointment.startAt),
          end_at: this.formatDateTime(appointment.endAt),
          end_date: this.formatDateOnly(appointment.endAt),
          end_time: this.formatTimeOnly(appointment.endAt),
          status: appointment.status,
          created_at: this.formatDateOnly(appointment.createdAt),
        });
      }

      this.logger.log(`Cita creada: ${appointment.id}`);
      return this.formatAppointment(appointment);
    } catch (error) {
      this.logger.error(`Error creando cita: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reprogramar cita
   */
  async rescheduleAppointment(
    appointmentId: string,
    newStartAt: Date,
    holdId?: string,
    reason?: string,
    changedBy?: string
  ): Promise<AppointmentResponse> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException(`Cita ${appointmentId} no encontrada`);
    }

    if (appointment.status !== AppointmentStatus.CONFIRMED) {
      throw new BadRequestException(
        "Solo se puede reprogramar citas CONFIRMED"
      );
    }

    const service = await this.prisma.service.findUnique({
      where: { id: appointment.serviceId },
    });

    const newEndAt = new Date(
      newStartAt.getTime() +
        (service.durationMinutes + service.bufferMinutes) * 60000
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const oldAppointment = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.RESCHEDULED,
        },
      });

      const newAppointment = await tx.appointment.create({
        data: {
          branchId: appointment.branchId,
          customerId: appointment.customerId,
          serviceId: appointment.serviceId,
          startAt: newStartAt,
          endAt: newEndAt,
          status: AppointmentStatus.CONFIRMED,
          source: appointment.source,
          notes: appointment.notes,
          rescheduledFromId: appointmentId,
          createdById: changedBy || null,
        },
      });

      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId,
          fromStatus: AppointmentStatus.CONFIRMED,
          toStatus: AppointmentStatus.RESCHEDULED,
          changedByType: "USER",
          reason: reason || "Cita reprogramada",
        },
      });

      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId: newAppointment.id,
          fromStatus: null,
          toStatus: AppointmentStatus.CONFIRMED,
          changedByType: "USER",
          reason: `Reprogramada desde ${appointmentId}`,
        },
      });

      return newAppointment;
    });

    if (holdId) {
      await this.holdsService.releaseHold(holdId);
    }

    if (this.realtimeService) {
      this.realtimeService.notifyAppointmentStatusChanged({
        id: appointmentId,
        branch_id: appointment.branchId,
        customer_id: appointment.customerId,
        previous_status: AppointmentStatus.CONFIRMED,
        new_status: AppointmentStatus.RESCHEDULED,
        changed_at: new Date().toISOString(),
        reason: reason || "Cita reprogramada",
      });

      this.realtimeService.notifyAppointmentCreated({
        id: result.id,
        branch_id: result.branchId,
        customer_id: result.customerId,
        service_id: result.serviceId,
        start_at: this.formatDateTime(result.startAt),
        start_date: this.formatDateOnly(result.startAt),
        start_time: this.formatTimeOnly(result.startAt),
        end_at: this.formatDateTime(result.endAt),
        end_date: this.formatDateOnly(result.endAt),
        end_time: this.formatTimeOnly(result.endAt),
        status: result.status,
        created_at: this.formatDateOnly(result.createdAt),
      });
    }

    this.logger.log(`Cita reprogramada: ${appointmentId} -> ${result.id}`);
    return this.formatAppointment(result);
  }

  /**
   * Cancelar cita
   */
  async cancelAppointment(
    appointmentId: string,
    reason: string,
    changedBy?: string
  ): Promise<AppointmentResponse> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException(`Cita ${appointmentId} no encontrada`);
    }

    if (appointment.status === AppointmentStatus.CANCELED) {
      throw new BadRequestException("La cita ya está cancelada");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.CANCELED,
          cancelReason: reason,
        },
      });

      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId,
          fromStatus: appointment.status,
          toStatus: AppointmentStatus.CANCELED,
          changedByType: "USER",
          reason: reason,
        },
      });

      return updated;
    });

    if (this.realtimeService) {
      this.realtimeService.notifyAppointmentStatusChanged({
        id: appointmentId,
        branch_id: appointment.branchId,
        customer_id: appointment.customerId,
        previous_status: appointment.status,
        new_status: AppointmentStatus.CANCELED,
        changed_at: new Date().toISOString(),
        reason,
      });
    }

    this.logger.log(`Cita cancelada: ${appointmentId}`);
    return this.formatAppointment(result);
  }

  /**
   * Check-in
   */
  async checkInAppointment(
    appointmentId: string
  ): Promise<AppointmentResponse> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException(`Cita ${appointmentId} no encontrada`);
    }

    if (appointment.status !== AppointmentStatus.CONFIRMED) {
      throw new BadRequestException(
        "Solo se puede hacer check-in en CONFIRMED"
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.CHECKED_IN },
      });

      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId,
          fromStatus: AppointmentStatus.CONFIRMED,
          toStatus: AppointmentStatus.CHECKED_IN,
          changedByType: "USER",
          reason: "Cliente llegó",
        },
      });

      return updated;
    });

    if (this.realtimeService) {
      this.realtimeService.notifyAppointmentStatusChanged({
        id: appointmentId,
        branch_id: appointment.branchId,
        customer_id: appointment.customerId,
        previous_status: AppointmentStatus.CONFIRMED,
        new_status: AppointmentStatus.CHECKED_IN,
        changed_at: new Date().toISOString(),
        reason: "Cliente llegó",
      });
    }

    this.logger.log(`Check-in: cita ${appointmentId}`);
    return this.formatAppointment(result);
  }

  /**
   * Iniciar servicio
   */
  async startServiceAppointment(
    appointmentId: string
  ): Promise<AppointmentResponse> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) {
      throw new NotFoundException(`Cita ${appointmentId} no encontrada`);
    }

    if (appointment.status !== AppointmentStatus.CHECKED_IN) {
      throw new BadRequestException(
        "Solo se puede iniciar servicio en citas CHECKED_IN"
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.IN_SERVICE },
      });

      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId,
          fromStatus: AppointmentStatus.CHECKED_IN,
          toStatus: AppointmentStatus.IN_SERVICE,
          changedByType: "USER",
          reason: "Iniciada atención",
        },
      });

      return updated;
    });

    if (this.realtimeService) {
      this.realtimeService.notifyAppointmentStatusChanged({
        id: appointmentId,
        branch_id: appointment.branchId,
        customer_id: appointment.customerId,
        previous_status: AppointmentStatus.CHECKED_IN,
        new_status: AppointmentStatus.IN_SERVICE,
        changed_at: new Date().toISOString(),
        reason: "Iniciada atención",
      });
    }

    this.logger.log(`Iniciar servicio: cita ${appointmentId}`);
    return this.formatAppointment(result);
  }

  /**
   * Completar cita
   */
  async completeAppointment(
    appointmentId: string
  ): Promise<AppointmentResponse> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) {
      throw new NotFoundException(`Cita ${appointmentId} no encontrada`);
    }

    if (appointment.status !== AppointmentStatus.IN_SERVICE) {
      throw new BadRequestException("Solo se puede completar citas IN_SERVICE");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.COMPLETED },
      });

      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId,
          fromStatus: AppointmentStatus.IN_SERVICE,
          toStatus: AppointmentStatus.COMPLETED,
          changedByType: "USER",
          reason: "Atención completada",
        },
      });

      return updated;
    });

    if (this.realtimeService) {
      this.realtimeService.notifyAppointmentStatusChanged({
        id: appointmentId,
        branch_id: appointment.branchId,
        customer_id: appointment.customerId,
        previous_status: AppointmentStatus.IN_SERVICE,
        new_status: AppointmentStatus.COMPLETED,
        changed_at: new Date().toISOString(),
        reason: "Atención completada",
      });
    }

    this.logger.log(`Cita completada: ${appointmentId}`);
    return this.formatAppointment(result);
  }

  /**
   * Marcar NO_SHOW
   */
  async markNoShow(appointmentId: string): Promise<AppointmentResponse> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) {
      throw new NotFoundException(`Cita ${appointmentId} no encontrada`);
    }

    if (appointment.status !== AppointmentStatus.CONFIRMED) {
      throw new BadRequestException(
        "Solo se puede marcar NO_SHOW citas CONFIRMED"
      );
    }

    const now = new Date();
    const graceTime = new Date(
      appointment.startAt.getTime() + this.NO_SHOW_GRACE_MIN * 60 * 1000
    );

    if (now < graceTime) {
      throw new BadRequestException(
        `Aún está dentro del grace period. Intenta después de ${graceTime.toISOString()}`
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.NO_SHOW },
      });

      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId,
          fromStatus: AppointmentStatus.CONFIRMED,
          toStatus: AppointmentStatus.NO_SHOW,
          changedByType: "SYSTEM",
          reason: "Cliente no asistió",
        },
      });

      return updated;
    });

    if (this.realtimeService) {
      this.realtimeService.notifyAppointmentStatusChanged({
        id: appointmentId,
        branch_id: appointment.branchId,
        customer_id: appointment.customerId,
        previous_status: AppointmentStatus.CONFIRMED,
        new_status: AppointmentStatus.NO_SHOW,
        changed_at: new Date().toISOString(),
        reason: "Cliente no asistió",
      });
    }

    this.logger.log(`NO_SHOW: cita ${appointmentId}`);
    return this.formatAppointment(result);
  }

  /**
   * Obtener citas
   */
  async getAppointments(
    branchId: string,
    from: Date,
    to: Date,
    status?: AppointmentStatus,
    customerId?: string
  ) {
    const where: any = {
      branchId,
      startAt: { gte: from },
      endAt: { lte: to },
    };

    if (status) {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    const appointments = await this.prisma.appointment.findMany({
      where,
      orderBy: { startAt: "asc" },
      include: {
        customer: true,
        service: true,
      },
    });

    return appointments.map((a) => this.formatAppointment(a));
  }

  /**
   * Obtener cita por ID
   */
  async getAppointmentById(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        customer: true,
        service: true,
        statusHistory: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException(`Cita ${appointmentId} no encontrada`);
    }

    return {
      ...this.formatAppointment(appointment),
      history: appointment.statusHistory,
    };
  }

  /**
   * Calcular capacidad
   */
  private async getEffectiveCapacityForSlot(
    branchId: string,
    slotStart: Date,
    tx?: any
  ): Promise<{ totalCapacity: number; occupiedSlots: number }> {
    const db = tx || this.prisma;

    const branch = await db.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw new NotFoundException(`Sede ${branchId} no encontrada`);
    }

    return {
      totalCapacity: branch.defaultCapacity,
      occupiedSlots: 0,
    };
  }

  /**
   * Formatear cita
   */
  private formatAppointment(appointment: any): AppointmentResponse {
    return {
      id: appointment.id,
      branch_id: appointment.branchId,
      customer_id: appointment.customerId,
      service_id: appointment.serviceId,
      start_at: this.formatDateTime(appointment.startAt),
      start_date: this.formatDateOnly(appointment.startAt),
      start_time: this.formatTimeOnly(appointment.startAt),
      end_at: this.formatDateTime(appointment.endAt),
      end_date: this.formatDateOnly(appointment.endAt),
      end_time: this.formatTimeOnly(appointment.endAt),
      status: appointment.status as AppointmentStatus,
      source: appointment.source,
      notes: appointment.notes,
      cancel_reason: appointment.cancelReason,
      rescheduled_from_id: appointment.rescheduledFromId,
      rescheduled_to_id: appointment.rescheduledToId,
      created_at: this.formatDateOnly(appointment.createdAt),
      updated_at: this.formatDateOnly(appointment.updatedAt),
    };
  }

  private formatDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private formatTimeOnly(date: Date): string {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  private formatDateTime(date: Date): string {
    return `${this.formatDateOnly(date)} ${this.formatTimeOnly(date)}`;
  }
}

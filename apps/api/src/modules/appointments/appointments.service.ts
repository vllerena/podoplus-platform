import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { HoldsService } from "../holds/holds.service";
import { RealtimeService } from "../realtime/realtime.service";
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../email/email.service";
import { NotificationsService } from "../notifications/notifications.service";
import { timeStringToMinutes } from "../../utils/timezone";

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

/** Statuses from which a cancellation is allowed */
const CANCELABLE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
];

/** Statuses from which a reschedule is allowed */
const RESCHEDULABLE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
];

export interface AppointmentResponse {
  id: string;
  branch_id: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  service_id: string;
  service_name?: string;
  service_color?: string;
  service_duration_minutes?: number;
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
  rescheduled_to_id?:   string;
  rescheduled_reason?:  string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger("AppointmentsService");

  private readonly NO_SHOW_GRACE_MIN = 15;

  constructor(
    private prisma: PrismaService,
    private holdsService: HoldsService,
    @Optional() private realtimeService?: RealtimeService,
    @Optional() private auditService?: AuditService,
    @Optional() private emailService?: EmailService,
    @Optional() private notificationsService?: NotificationsService,
  ) {}

  // ─────────────────────────────────────────────────────────────────
  // CONFIRM WITH HOLD
  // ─────────────────────────────────────────────────────────────────

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
    source: "RECEPTION" | "PORTAL" | "STAFF" = "RECEPTION",
    createdBy?: string,
    idempotencyKey?: string,
  ): Promise<AppointmentResponse> {
    // Parallel lookups
    const [customer, service, branch] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: customerId } }),
      this.prisma.service.findUnique({ where: { id: serviceId } }),
      this.prisma.branch.findUnique({ where: { id: branchId } }),
    ]);

    if (!customer) {
      throw new NotFoundException(`Cliente ${customerId} no encontrado`);
    }
    if (customer.deletedAt) {
      throw new BadRequestException(`El cliente ${customerId} está eliminado`);
    }
    if (!service) {
      throw new NotFoundException(`Servicio ${serviceId} no encontrado`);
    }
    if (!service.isActive) {
      throw new BadRequestException(`El servicio ${serviceId} no está activo`);
    }
    if (!branch) {
      throw new NotFoundException(`Sede ${branchId} no encontrada`);
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
        `Hold no corresponde a este horario. Hold: ${hold.start_at}, Enviado: ${startAt.toISOString()}`,
      );
    }

    const endAt = holdEndAt;

    const appointment = await this.prisma.$transaction(
      async (tx) => {
        if (idempotencyKey) {
          const existing = await tx.appointment.findFirst({
            where: { customerId, branchId, startAt },
          });

          if (existing) {
            this.logger.warn(`Cita duplicada (idempotency): ${idempotencyKey}`);
            return existing;
          }
        }

        const capacityInfo = await this.getEffectiveCapacityForSlot(
          branchId,
          startAt,
          tx,
        );

        const occupiedCount = await tx.appointment.count({
          where: {
            branchId,
            status: {
              in: [
                AppointmentStatus.PENDING,
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
            changedById: createdBy || null,
            reason: "Cita confirmada desde hold",
          },
        });

        return apt;
      },
      { isolationLevel: "Serializable" },
    );

    await this.holdsService.releaseHold(holdId);

    this.auditService?.log({
      actorType: "USER",
      actorId: createdBy,
      branchId: appointment.branchId,
      action: "appointment.created",
      entityType: "appointment",
      entityId: appointment.id,
      metadata: {
        customerId,
        serviceId,
        startAt: appointment.startAt,
        source,
        holdId,
      },
    });

    this.notificationsService?.notify({
      userId: createdBy,
      type: "appointment",
      title: "Cita agendada",
      body: `Cita confirmada para el ${this.formatDateOnly(appointment.startAt)} a las ${this.formatTimeOnly(appointment.startAt)}`,
      entityType: "appointment",
      entityId: appointment.id,
    });

    if (customer?.email && this.emailService) {
      this.emailService
        .sendTransactionalEmail(
          customer.email,
          "Tu cita ha sido confirmada",
          `Hola ${customer.firstName ?? "cliente"},\n\nTu cita para el ${this.formatDateOnly(appointment.startAt)} a las ${this.formatTimeOnly(appointment.startAt)} ha sido confirmada en ${branch.name}.\n\nGracias por elegir Podoplus.`,
          `<p>Hola ${customer.firstName ?? "cliente"},</p>
           <p>Tu cita para el <strong>${this.formatDateOnly(appointment.startAt)}</strong> a las <strong>${this.formatTimeOnly(appointment.startAt)}</strong> ha sido confirmada en <strong>${branch.name}</strong>.</p>
           <p>Gracias por elegir Podoplus.</p>`,
        )
        .catch((err) =>
          this.logger.warn(
            `No se pudo enviar email de confirmación de cita: ${err.message}`,
          ),
        );
    }

    this.realtimeService?.notifyAppointmentCreated({
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
      created_at: this.formatDateTime(appointment.createdAt),
    });

    this.logger.log(
      `Cita confirmada desde hold: ${appointment.id} (Hold: ${holdId})`,
    );

    return this.formatAppointment(appointment, customer, service);
  }

  // ─────────────────────────────────────────────────────────────────
  // CREATE DIRECT
  // ─────────────────────────────────────────────────────────────────

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
    createdById?: string,
  ): Promise<AppointmentResponse> {
    // Parallel lookups
    const [customer, service, branch] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: customerId } }),
      this.prisma.service.findUnique({ where: { id: serviceId } }),
      this.prisma.branch.findUnique({ where: { id: branchId } }),
    ]);

    if (!customer) {
      throw new NotFoundException(`Cliente ${customerId} no encontrado`);
    }
    if (customer.deletedAt) {
      throw new BadRequestException(`El cliente ${customerId} está eliminado`);
    }
    if (!service) {
      throw new NotFoundException(`Servicio ${serviceId} no encontrado`);
    }
    if (!service.isActive) {
      throw new BadRequestException(`El servicio ${serviceId} no está activo`);
    }
    if (!branch) {
      throw new NotFoundException(`Sede ${branchId} no encontrada`);
    }

    const endAt = new Date(
      startAt.getTime() +
        (service.durationMinutes + service.bufferMinutes) * 60000,
    );

    try {
      const appointment = await this.prisma.$transaction(async (tx) => {
        const capacityInfo = await this.getEffectiveCapacityForSlot(
          branchId,
          startAt,
          tx,
        );

        const occupiedCount = await tx.appointment.count({
          where: {
            branchId,
            status: {
              in: [
                AppointmentStatus.PENDING,
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
            changedById: createdById || null,
            reason: "Cita creada",
          },
        });

        return newAppointment;
      });

      this.realtimeService?.notifyAppointmentCreated({
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
        created_at: this.formatDateTime(appointment.createdAt),
      });

      this.auditService?.log({
        actorType: "USER",
        actorId: createdById,
        branchId,
        action: "appointment.created",
        entityType: "appointment",
        entityId: appointment.id,
        metadata: {
          customerId,
          serviceId,
          startAt: appointment.startAt,
          source,
        },
      });

      this.logger.log(`Cita creada: ${appointment.id}`);
      return this.formatAppointment(appointment, customer, service);
    } catch (error) {
      this.logger.error(`Error creando cita: ${error.message}`);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // RESCHEDULE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Reprogramar cita — permite PENDING y CONFIRMED
   */
  async rescheduleAppointment(
    appointmentId: string,
    newStartAt: Date,
    holdId?: string,
    reason?: string,
    actorId?: string,
  ): Promise<AppointmentResponse> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException(`Cita ${appointmentId} no encontrada`);
    }

    if (
      !RESCHEDULABLE_STATUSES.includes(appointment.status as AppointmentStatus)
    ) {
      throw new BadRequestException(
        `Solo se puede reprogramar citas en estado ${RESCHEDULABLE_STATUSES.join(" o ")}. Estado actual: ${appointment.status}`,
      );
    }

    const service = await this.prisma.service.findUnique({
      where: { id: appointment.serviceId },
    });

    if (!service) {
      throw new NotFoundException(
        `Servicio ${appointment.serviceId} no encontrado`,
      );
    }

    const newEndAt = new Date(
      newStartAt.getTime() +
        (service.durationMinutes + service.bufferMinutes) * 60000,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const capacityInfo = await this.getEffectiveCapacityForSlot(
        appointment.branchId,
        newStartAt,
        tx,
      );

      const occupiedCount = await tx.appointment.count({
        where: {
          branchId: appointment.branchId,
          id: { not: appointmentId },
          status: {
            in: [
              AppointmentStatus.PENDING,
              AppointmentStatus.CONFIRMED,
              AppointmentStatus.CHECKED_IN,
              AppointmentStatus.IN_SERVICE,
            ],
          },
          startAt: { lt: newEndAt },
          endAt: { gt: newStartAt },
        },
      });

      if (occupiedCount >= capacityInfo.totalCapacity) {
        throw new ConflictException(
          "No hay cupo disponible en el nuevo horario",
        );
      }

      // Mark original as RESCHEDULED — persist reason directly on the record
      await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status:            AppointmentStatus.RESCHEDULED,
          rescheduledReason: reason ?? null,
        },
      });

      // Create the new appointment
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
          createdById: actorId || null,
        },
      });

      // Back-fill rescheduledToId on the original (consolidated in one update)
      await tx.appointment.update({
        where: { id: appointmentId },
        data:  { rescheduledToId: newAppointment.id },
      });

      // History: original → RESCHEDULED
      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId,
          fromStatus: appointment.status,
          toStatus: AppointmentStatus.RESCHEDULED,
          changedByType: "USER",
          changedById: actorId || null,
          reason: reason || "Cita reprogramada",
        },
      });

      // History: new → CONFIRMED
      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId: newAppointment.id,
          fromStatus: null,
          toStatus: AppointmentStatus.CONFIRMED,
          changedByType: "USER",
          changedById: actorId || null,
          reason: `Reprogramada desde ${appointmentId}`,
        },
      });

      return newAppointment;
    });

    if (holdId) {
      await this.holdsService.releaseHold(holdId);
    }

    this.realtimeService?.notifyAppointmentStatusChanged({
      id: appointmentId,
      branch_id: appointment.branchId,
      customer_id: appointment.customerId,
      previous_status: appointment.status,
      new_status: AppointmentStatus.RESCHEDULED,
      changed_at: new Date().toISOString(),
      reason: reason || "Cita reprogramada",
    });

    this.realtimeService?.notifyAppointmentCreated({
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
      created_at: this.formatDateTime(result.createdAt),
    });

    this.notificationsService?.notify({
      userId: actorId,
      type: "appointment",
      title: "Cita reprogramada",
      body: `Cita reprogramada para el ${this.formatDateOnly(result.startAt)} a las ${this.formatTimeOnly(result.startAt)}`,
      entityType: "appointment",
      entityId: appointment.id,
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      branchId: appointment.branchId,
      action: "appointment.rescheduled",
      entityType: "appointment",
      entityId: appointmentId,
      reason: reason ?? "Cita reprogramada",
      metadata: { newAppointmentId: result.id, newStartAt: result.startAt },
    });

    this.logger.log(`Cita reprogramada: ${appointmentId} -> ${result.id}`);
    return this.formatAppointment(result);
  }

  // ─────────────────────────────────────────────────────────────────
  // CANCEL
  // ─────────────────────────────────────────────────────────────────

  /**
   * Cancelar cita — solo PENDING, CONFIRMED, CHECKED_IN
   */
  async cancelAppointment(
    appointmentId: string,
    reason: string,
    actorId?: string,
  ): Promise<AppointmentResponse> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException(`Cita ${appointmentId} no encontrada`);
    }

    if (
      !CANCELABLE_STATUSES.includes(appointment.status as AppointmentStatus)
    ) {
      throw new BadRequestException(
        `No se puede cancelar una cita en estado ${appointment.status}. Solo se permite en: ${CANCELABLE_STATUSES.join(", ")}`,
      );
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.CANCELED,
          cancelReason: reason,
          canceledByType: "USER",
          canceledById: actorId || null,
          canceledAt: now,
        },
      });

      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId,
          fromStatus: appointment.status,
          toStatus: AppointmentStatus.CANCELED,
          changedByType: "USER",
          changedById: actorId || null,
          reason,
        },
      });

      return updated;
    });

    this.realtimeService?.notifyAppointmentStatusChanged({
      id: appointmentId,
      branch_id: appointment.branchId,
      customer_id: appointment.customerId,
      previous_status: appointment.status,
      new_status: AppointmentStatus.CANCELED,
      changed_at: now.toISOString(),
      reason,
    });

    this.notificationsService?.notify({
      userId: actorId,
      type: "appointment",
      title: "Cita cancelada",
      body: `La cita del ${this.formatDateOnly(appointment.startAt)} fue cancelada${reason ? `: ${reason}` : ""}`,
      entityType: "appointment",
      entityId: appointment.id,
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      branchId: appointment.branchId,
      action: "appointment.canceled",
      entityType: "appointment",
      entityId: appointmentId,
      reason,
      metadata: { previousStatus: appointment.status },
    });

    this.logger.log(`Cita cancelada: ${appointmentId}`);
    return this.formatAppointment(result);
  }

  // ─────────────────────────────────────────────────────────────────
  // CHECK-IN
  // ─────────────────────────────────────────────────────────────────

  /**
   * Check-in — debe ser CONFIRMED
   */
  async checkInAppointment(
    appointmentId: string,
    actorId?: string,
  ): Promise<AppointmentResponse> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException(`Cita ${appointmentId} no encontrada`);
    }

    if (appointment.status !== AppointmentStatus.CONFIRMED) {
      throw new BadRequestException(
        "Solo se puede hacer check-in en CONFIRMED",
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
          changedById: actorId || null,
          reason: "Cliente llegó",
        },
      });

      return updated;
    });

    this.realtimeService?.notifyAppointmentStatusChanged({
      id: appointmentId,
      branch_id: appointment.branchId,
      customer_id: appointment.customerId,
      previous_status: AppointmentStatus.CONFIRMED,
      new_status: AppointmentStatus.CHECKED_IN,
      changed_at: new Date().toISOString(),
      reason: "Cliente llegó",
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      branchId: appointment.branchId,
      action: "appointment.checked_in",
      entityType: "appointment",
      entityId: appointmentId,
    });

    this.logger.log(`Check-in: cita ${appointmentId}`);
    return this.formatAppointment(result);
  }

  // ─────────────────────────────────────────────────────────────────
  // START SERVICE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Iniciar servicio — debe ser CHECKED_IN
   */
  async startServiceAppointment(
    appointmentId: string,
    actorId?: string,
  ): Promise<AppointmentResponse> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) {
      throw new NotFoundException(`Cita ${appointmentId} no encontrada`);
    }

    if (appointment.status !== AppointmentStatus.CHECKED_IN) {
      throw new BadRequestException(
        "Solo se puede iniciar servicio en citas CHECKED_IN",
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
          changedById: actorId || null,
          reason: "Iniciada atención",
        },
      });

      return updated;
    });

    this.realtimeService?.notifyAppointmentStatusChanged({
      id: appointmentId,
      branch_id: appointment.branchId,
      customer_id: appointment.customerId,
      previous_status: AppointmentStatus.CHECKED_IN,
      new_status: AppointmentStatus.IN_SERVICE,
      changed_at: new Date().toISOString(),
      reason: "Iniciada atención",
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      branchId: appointment.branchId,
      action: "appointment.started",
      entityType: "appointment",
      entityId: appointmentId,
    });

    this.logger.log(`Iniciar servicio: cita ${appointmentId}`);
    return this.formatAppointment(result);
  }

  // ─────────────────────────────────────────────────────────────────
  // COMPLETE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Completar cita — debe ser IN_SERVICE
   */
  async completeAppointment(
    appointmentId: string,
    actorId?: string,
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
          changedById: actorId || null,
          reason: "Atención completada",
        },
      });

      return updated;
    });

    this.realtimeService?.notifyAppointmentStatusChanged({
      id: appointmentId,
      branch_id: appointment.branchId,
      customer_id: appointment.customerId,
      previous_status: AppointmentStatus.IN_SERVICE,
      new_status: AppointmentStatus.COMPLETED,
      changed_at: new Date().toISOString(),
      reason: "Atención completada",
    });

    if (appointment.createdById) {
      this.notificationsService?.notify({
        userId: appointment.createdById,
        type: "appointment",
        title: "Cita completada",
        body: `La cita del ${this.formatDateOnly(appointment.startAt)} fue marcada como completada`,
        entityType: "appointment",
        entityId: appointmentId,
      });
    }

    this.auditService?.log({
      actorType: "USER",
      actorId,
      branchId: appointment.branchId,
      action: "appointment.completed",
      entityType: "appointment",
      entityId: appointmentId,
    });

    this.logger.log(`Cita completada: ${appointmentId}`);
    return this.formatAppointment(result);
  }

  // ─────────────────────────────────────────────────────────────────
  // NO-SHOW
  // ─────────────────────────────────────────────────────────────────

  /**
   * Marcar NO_SHOW — debe ser CONFIRMED + pasado el grace period
   */
  async markNoShow(
    appointmentId: string,
    actorId?: string,
  ): Promise<AppointmentResponse> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) {
      throw new NotFoundException(`Cita ${appointmentId} no encontrada`);
    }

    if (appointment.status !== AppointmentStatus.CONFIRMED) {
      throw new BadRequestException(
        "Solo se puede marcar NO_SHOW citas CONFIRMED",
      );
    }

    const now = new Date();
    const graceTime = new Date(
      appointment.startAt.getTime() + this.NO_SHOW_GRACE_MIN * 60 * 1000,
    );

    if (now < graceTime) {
      throw new BadRequestException(
        `Aún está dentro del grace period. Intenta después de ${graceTime.toISOString()}`,
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
          changedById: actorId || null,
          reason: "Cliente no asistió",
        },
      });

      return updated;
    });

    this.realtimeService?.notifyAppointmentStatusChanged({
      id: appointmentId,
      branch_id: appointment.branchId,
      customer_id: appointment.customerId,
      previous_status: AppointmentStatus.CONFIRMED,
      new_status: AppointmentStatus.NO_SHOW,
      changed_at: new Date().toISOString(),
      reason: "Cliente no asistió",
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      branchId: appointment.branchId,
      action: "appointment.no_show",
      entityType: "appointment",
      entityId: appointmentId,
      reason: "Cliente no asistió",
    });

    this.logger.log(`NO_SHOW: cita ${appointmentId}`);
    return this.formatAppointment(result);
  }

  // ─────────────────────────────────────────────────────────────────
  // QUERIES
  // ─────────────────────────────────────────────────────────────────

  /**
   * Obtener citas de una sede en un rango de fechas.
   * Devuelve todas las citas que se solapan con el rango [from, to).
   */
  async getAppointments(
    branchId: string | undefined,
    from: Date,
    to: Date,
    status?: AppointmentStatus,
    customerId?: string,
  ) {
    const where: any = {
      startAt: { lt: to },
      endAt: { gt: from },
    };

    // branchId es opcional: si se omite, se devuelven citas de todas las sedes
    // (usado en el dashboard de administración global)
    if (branchId) {
      where.branchId = branchId;
    }

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

    return appointments.map((a) =>
      this.formatAppointment(a, a.customer, a.service),
    );
  }

  /**
   * Obtener cita por ID (con historial)
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
      ...this.formatAppointment(
        appointment,
        appointment.customer,
        appointment.service,
      ),
      history: appointment.statusHistory,
    };
  }

  /**
   * Obtener historial de estados de una cita
   */
  async getAppointmentHistory(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) {
      throw new NotFoundException(`Cita ${appointmentId} no encontrada`);
    }

    const history = await this.prisma.appointmentStatusHistory.findMany({
      where: { appointmentId },
      orderBy: { createdAt: "asc" },
    });

    return history.map((h) => ({
      id: h.id,
      from_status: h.fromStatus,
      to_status: h.toStatus,
      changed_by_type: h.changedByType,
      changed_by_id: h.changedById,
      reason: h.reason,
      created_at: this.formatDateTime(h.createdAt),
    }));
  }

  /**
   * Obtener citas del día actual para una sede (con info de cliente y servicio)
   */
  async getTodayAppointments(branchId: string, serviceId?: string) {
    // Wall-clock UTC strategy: times stored literally as UTC.
    // "Today" must use Lima's calendar date (UTC-5) so that bookings
    // like "11 PM Lima" (stored as 23:00 UTC) are correctly included.
    const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;
    const now = new Date();
    const nowLima = new Date(now.getTime() - LIMA_OFFSET_MS);
    const todayStart = new Date(
      Date.UTC(
        nowLima.getUTCFullYear(),
        nowLima.getUTCMonth(),
        nowLima.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const todayEnd = new Date(
      Date.UTC(
        nowLima.getUTCFullYear(),
        nowLima.getUTCMonth(),
        nowLima.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    const where: any = {
      branchId,
      startAt: { gte: todayStart, lte: todayEnd },
      status: {
        notIn: [AppointmentStatus.CANCELED, AppointmentStatus.RESCHEDULED],
      },
    };

    if (serviceId) {
      where.serviceId = serviceId;
    }

    const appointments = await this.prisma.appointment.findMany({
      where,
      orderBy: { startAt: "asc" },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            color: true,
            durationMinutes: true,
          },
        },
      },
    });

    return {
      date: this.formatDateOnly(todayStart),
      branch_id: branchId,
      total: appointments.length,
      appointments: appointments.map((a) =>
        this.formatAppointment(a, a.customer, a.service),
      ),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // CAPACITY RULES
  // ─────────────────────────────────────────────────────────────────

  /**
   * Calcula la capacidad efectiva para un slot, respetando BranchCapacityRule.
   *
   * Prioridad:
   *  1. Regla exacta de fecha (scopeType=DATE) — mayor prioridad
   *  2. Regla de día de la semana (scopeType=WEEKDAY_RANGE) con rango horario
   *  3. defaultCapacity de la sede
   */
  private async getEffectiveCapacityForSlot(
    branchId: string,
    slotStart: Date,
    tx?: any,
  ): Promise<{ totalCapacity: number; occupiedSlots: number }> {
    const db = tx || this.prisma;

    const branch = await db.branch.findUnique({ where: { id: branchId } });

    if (!branch) {
      throw new NotFoundException(`Sede ${branchId} no encontrada`);
    }

    // Las reglas de capacidad son sólo lectura — siempre usamos this.prisma
    // para no depender del tx (que en tests no tiene branchCapacityRule mockeado)
    const rules =
      (await this.prisma.branchCapacityRule.findMany({
        where: { branchId, isActive: true },
        orderBy: { priority: "desc" },
      })) ?? [];

    if (rules.length === 0) {
      return { totalCapacity: branch.defaultCapacity, occupiedSlots: 0 };
    }

    const slotDayOfWeek = slotStart.getUTCDay(); // 0=domingo
    const slotMinutes =
      slotStart.getUTCHours() * 60 + slotStart.getUTCMinutes();

    // 1. Buscar regla exacta de fecha (DATE)
    const slotDateStr = this.formatDateOnly(slotStart);
    const dateRule = rules.find((r: any) => {
      if (r.scopeType !== "DATE" || !r.date) return false;
      return this.formatDateOnly(new Date(r.date)) === slotDateStr;
    });

    if (dateRule) {
      // Verificar rango horario si existe
      if (dateRule.startTime && dateRule.endTime) {
        const ruleStart = timeStringToMinutes(dateRule.startTime);
        const ruleEnd = timeStringToMinutes(dateRule.endTime);
        if (slotMinutes >= ruleStart && slotMinutes < ruleEnd) {
          return { totalCapacity: dateRule.capacity, occupiedSlots: 0 };
        }
      } else {
        return { totalCapacity: dateRule.capacity, occupiedSlots: 0 };
      }
    }

    // 2. Buscar regla de día de semana (WEEKDAY_RANGE)
    const weekdayRule = rules.find((r: any) => {
      if (r.scopeType !== "WEEKDAY_RANGE" || r.weekday !== slotDayOfWeek)
        return false;
      if (!r.startTime || !r.endTime) return true; // aplica todo el día
      const ruleStart = timeStringToMinutes(r.startTime);
      const ruleEnd = timeStringToMinutes(r.endTime);
      return slotMinutes >= ruleStart && slotMinutes < ruleEnd;
    });

    if (weekdayRule) {
      return { totalCapacity: weekdayRule.capacity, occupiedSlots: 0 };
    }

    // 3. Fallback a defaultCapacity
    return { totalCapacity: branch.defaultCapacity, occupiedSlots: 0 };
  }

  // ─────────────────────────────────────────────────────────────────
  // FORMATTING
  // ─────────────────────────────────────────────────────────────────

  private formatAppointment(
    appointment: any,
    customer?: any,
    service?: any,
  ): AppointmentResponse {
    const response: AppointmentResponse = {
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
      cancel_reason:        appointment.cancelReason,
      rescheduled_from_id:  appointment.rescheduledFromId,
      rescheduled_to_id:    appointment.rescheduledToId,
      rescheduled_reason:   appointment.rescheduledReason ?? undefined,
      created_at:           this.formatDateTime(appointment.createdAt),
      updated_at:           this.formatDateTime(appointment.updatedAt),
    };

    // Enrich with customer data if available
    if (customer) {
      response.customer_name =
        `${customer.firstName} ${customer.lastName}`.trim();
      response.customer_phone = customer.phone ?? undefined;
    }

    // Enrich with service data if available
    if (service) {
      response.service_name = service.name;
      response.service_color = service.color ?? undefined;
      response.service_duration_minutes = service.durationMinutes;
    }

    return response;
  }

  private formatDateOnly(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private formatTimeOnly(date: Date): string {
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  private formatDateTime(date: Date): string {
    return `${this.formatDateOnly(date)} ${this.formatTimeOnly(date)}`;
  }
}

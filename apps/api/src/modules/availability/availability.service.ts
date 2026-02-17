import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import { SlotGeneratorService } from "./services/slot-generator.service";
import { CapacityService } from "./services/capacity.service";
import { ScheduleResolverService } from "./services/schedule-resolver.service";
import { AvailabilitySlot } from "./types/availability.types";

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger("AvailabilityService");

  constructor(
    private prisma: PrismaService,
    private rbacService: RbacService,
    private slotGeneratorService: SlotGeneratorService,
    private capacityService: CapacityService,
    private scheduleResolverService: ScheduleResolverService
  ) {}

  /**
   * Convierte una fecha ISO (YYYY-MM-DD) a Date respetando timezone
   */
  private parseLocalDate(dateString: string, timezone: string): Date {
    // dateString viene como "2026-01-20" (sin zona horaria)
    // Lo interpretamos como medianoche en el timezone de la sede
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day, 0, 0, 0, 0);
    return date;
  }

  /**
   * Convierte una fecha a string HH:mm en timezone local
   */
  private formatTimeLocal(date: Date): string {
    return `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes()
    ).padStart(2, "0")}`;
  }

  /**
   * Obtiene disponibilidad para un rango de fechas y servicio
   */
  async getAvailability(
    branchId: string,
    serviceId: string,
    from: string,
    to: string,
    userId: string
  ) {
    // Validar acceso
    const hasAccess = await this.rbacService.hasAccessToBranch(
      userId,
      branchId
    );
    if (!hasAccess) {
      throw new ForbiddenException("No tienes acceso a esta sede");
    }

    // Validar que existe la sede
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw new NotFoundException(`Sede con ID ${branchId} no encontrada`);
    }

    // Validar que existe el servicio
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException(`Servicio con ID ${serviceId} no encontrado`);
    }

    // Parsear fechas respetando timezone de la sede
    const fromDate = this.parseLocalDate(from, branch.timezone);
    const toDate = this.parseLocalDate(to, branch.timezone);

    if (fromDate > toDate) {
      throw new BadRequestException("from debe ser menor o igual que to");
    }

    // Construir schedules para el rango
    const daySchedules =
      await this.scheduleResolverService.buildDaySchedulesForRange(
        branchId,
        fromDate,
        toDate,
        branch.timezone
      );

    if (daySchedules.length === 0) {
      return {
        branchId,
        branchName: branch.name,
        branchTimezone: branch.timezone,
        serviceId,
        serviceName: service.name,
        serviceDuration: service.durationMinutes,
        serviceDurationWithBuffer:
          service.durationMinutes + service.bufferMinutes,
        dateRange: {
          from: from,
          to: to,
        },
        capacity: {
          totalCapacity: branch.defaultCapacity,
          occupiedSlots: 0,
          availableSlots: 0,
        },
        slots: [],
        message: "No hay horarios disponibles en el rango especificado",
      };
    }

    // Generar slots base
    const baseSlots = this.slotGeneratorService.generateSlotsForDateRange(
      fromDate,
      toDate,
      serviceId,
      service.durationMinutes,
      service.bufferMinutes,
      daySchedules
    );

    // Enriquecer slots con información de capacidad
    const enrichedSlots: AvailabilitySlot[] = [];

    for (const slot of baseSlots) {
      const capacityInfo = await this.capacityService.getCapacityInfo(
        branchId,
        slot.startAt,
        slot.endAt,
        0 // TODO: contar holds activos desde Redis cuando esté implementado
      );

      enrichedSlots.push({
        startAt: slot.startAt,
        endAt: slot.endAt,
        startAtLocal: this.formatTimeLocal(slot.startAt),
        endAtLocal: this.formatTimeLocal(slot.endAt),
        totalCapacity: capacityInfo.totalCapacity,
        availableCapacity: capacityInfo.availableCapacity,
        isAvailable: capacityInfo.availableCapacity > 0,
      });
    }

    // Filtrar solo slots disponibles
    const availableSlots = enrichedSlots.filter((slot) => slot.isAvailable);

    // Agrupar por fecha para respuesta mejorada
    const slotsByDate = new Map<string, AvailabilitySlot[]>();
    for (const slot of availableSlots) {
      const dateKey = slot.startAt.toISOString().split("T")[0];
      if (!slotsByDate.has(dateKey)) {
        slotsByDate.set(dateKey, []);
      }
      slotsByDate.get(dateKey)!.push(slot);
    }

    // Convertir a array ordenado
    const slotsByDateArray = Array.from(slotsByDate.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, slots]) => ({
        date,
        slots: slots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime()),
      }));

    // Obtener info del horario del primer día para contexto
    const firstDaySchedule = daySchedules[0];
    const scheduleInfo = firstDaySchedule
      ? {
          startHour: firstDaySchedule.startTime,
          endHour: firstDaySchedule.endTime,
          blocks: firstDaySchedule.blocks.map((b) => ({
            startTime: this.formatTimeLocal(b.startAt),
            endTime: this.formatTimeLocal(b.endAt),
            type: b.type,
            title: b.title,
          })),
        }
      : null;

    this.logger.log(
      `Disponibilidad calculada: ${availableSlots.length} slots disponibles de ${enrichedSlots.length} totales`
    );

    // Response mejorado
    return {
      branchId,
      branchName: branch.name,
      branchTimezone: branch.timezone,
      serviceId,
      serviceName: service.name,
      serviceDuration: service.durationMinutes,
      serviceDurationWithBuffer:
        service.durationMinutes + service.bufferMinutes,
      dateRange: {
        from,
        to,
      },
      schedule: scheduleInfo,
      capacity: {
        totalCapacity: branch.defaultCapacity,
        occupiedSlots: enrichedSlots.length - availableSlots.length,
        availableSlots: availableSlots.length,
      },
      totalDays: slotsByDateArray.length,
      byDate: slotsByDateArray,
    };
  }

  /**
   * Obtiene disponibilidad agrupada por fecha (formato simplificado)
   */
  async getAvailabilityGroupedByDate(
    branchId: string,
    serviceId: string,
    from: string,
    to: string,
    userId: string
  ) {
    return this.getAvailability(branchId, serviceId, from, to, userId);
  }
}

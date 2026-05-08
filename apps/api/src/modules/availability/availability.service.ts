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

const MAX_RANGE_DAYS = 31;

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

  /** Parses "YYYY-MM-DD" as local midnight, avoids UTC drift. */
  private parseLocalDate(dateString: string): Date {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  /**
   * "YYYY-MM-DD" desde un timestamp naive Lima (campo UTC = hora Lima).
   * Usa getUTC* para leer la fecha naive sin aplicar el offset de zona.
   */
  private localDateStr(d: Date): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }

  /**
   * "HH:mm" desde un timestamp naive Lima (campo UTC = hora Lima).
   * Usa getUTC* para leer la hora naive sin aplicar el offset de zona.
   */
  private formatTimeLocal(date: Date): string {
    return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
  }

  /**
   * Obtiene disponibilidad para un rango de fechas y servicio.
   * Optimizado: pre-carga appointments y capacity rules en 3 queries totales
   * (en lugar de N+1 por slot).
   */
  async getAvailability(
    branchId: string,
    serviceId: string,
    from: string,
    to: string,
    userId: string
  ) {
    // 1. Validar acceso
    const hasAccess = await this.rbacService.hasAccessToBranch(userId, branchId);
    if (!hasAccess) throw new ForbiddenException("No tienes acceso a esta sede");

    // 2. Cargar branch y service en paralelo
    const [branch, service] = await Promise.all([
      this.prisma.branch.findUnique({ where: { id: branchId } }),
      this.prisma.service.findUnique({ where: { id: serviceId } }),
    ]);
    if (!branch)   throw new NotFoundException(`Sede con ID ${branchId} no encontrada`);
    if (!service)  throw new NotFoundException(`Servicio con ID ${serviceId} no encontrado`);

    // 3. Parsear fechas (medianoche local — sin UTC drift)
    const fromDate = this.parseLocalDate(from);
    const toDate   = this.parseLocalDate(to);

    if (fromDate > toDate) throw new BadRequestException("from debe ser menor o igual que to");

    const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
    if (diffDays > MAX_RANGE_DAYS) {
      throw new BadRequestException(`El rango máximo es ${MAX_RANGE_DAYS} días`);
    }

    // 4. Construir schedules para el rango
    const daySchedules = await this.scheduleResolverService.buildDaySchedulesForRange(
      branchId, fromDate, toDate, branch.timezone
    );

    if (daySchedules.length === 0) {
      return {
        branchId, branchName: branch.name, branchTimezone: branch.timezone,
        serviceId, serviceName: service.name,
        serviceDuration: service.durationMinutes,
        serviceDurationWithBuffer: service.durationMinutes + service.bufferMinutes,
        dateRange: { from, to },
        capacity: { totalCapacity: branch.defaultCapacity, occupiedSlots: 0, availableSlots: 0 },
        slots: [],
        message: "No hay horarios disponibles en el rango especificado",
      };
    }

    // 5. Generar slots base
    const baseSlots = this.slotGeneratorService.generateSlotsForDateRange(
      fromDate, toDate, serviceId, service.durationMinutes, service.bufferMinutes, daySchedules
    );

    // 6. Pre-cargar datos de capacidad en UNA sola ronda (elimina N+1)
    const preload = await this.capacityService.preloadForRange(branchId, fromDate, toDate);

    // 7. Enriquecer slots con capacidad (sync, sin DB)
    const enrichedSlots: AvailabilitySlot[] = baseSlots.map((slot) => {
      const cap = this.capacityService.computeSlotCapacity(slot.startAt, slot.endAt, preload);
      return {
        startAt:           slot.startAt,
        endAt:             slot.endAt,
        startAtLocal:      this.formatTimeLocal(slot.startAt),
        endAtLocal:        this.formatTimeLocal(slot.endAt),
        totalCapacity:     cap.totalCapacity,
        availableCapacity: cap.availableCapacity,
        isAvailable:       cap.availableCapacity > 0,
      };
    });

    // 8. Conteo de disponibles (para el resumen)
    const availableSlots = enrichedSlots.filter((s) => s.isAvailable);

    // Calcular resumen de capacidad con unidades homogéneas (spots de cita).
    // Incluye TODOS los enrichedSlots del rango (disponibles y completos).
    // totalCapacity = occupiedSlots + availableSlots  ← siempre se cumple.
    const totalSpots    = enrichedSlots.reduce((s, x) => s + x.totalCapacity, 0);
    const occupiedSpots = enrichedSlots.reduce((s, x) => s + (x.totalCapacity - x.availableCapacity), 0);
    const freeSpots     = totalSpots - occupiedSpots;

    // 9. Agrupar TODOS los slots por fecha (disponibles e indisponibles).
    // El frontend filtra por isAvailable si necesita solo los reservables.
    const slotsByDate = new Map<string, AvailabilitySlot[]>();
    for (const slot of enrichedSlots) {          // ← todos, no solo availableSlots
      const dateKey = this.localDateStr(slot.startAt);
      if (!slotsByDate.has(dateKey)) slotsByDate.set(dateKey, []);
      slotsByDate.get(dateKey)!.push(slot);
    }

    const slotsByDateArray = Array.from(slotsByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, slots]) => ({
        date,
        slots: slots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime()),
      }));

    // 10. Info del primer día para contexto
    const firstDay = daySchedules[0];
    const scheduleInfo = firstDay ? {
      startHour: firstDay.startTime,
      endHour:   firstDay.endTime,
      blocks: firstDay.blocks.map((b) => ({
        startTime: this.formatTimeLocal(b.startAt),
        endTime:   this.formatTimeLocal(b.endAt),
        type:      b.type,
        title:     b.title,
      })),
    } : null;

    this.logger.log(
      `Disponibilidad: ${availableSlots.length} slots disponibles de ${enrichedSlots.length} totales ` +
      `(${baseSlots.length} generados, ${daySchedules.length} días con horario)`
    );

    return {
      branchId, branchName: branch.name, branchTimezone: branch.timezone,
      serviceId, serviceName: service.name,
      serviceDuration: service.durationMinutes,
      serviceDurationWithBuffer: service.durationMinutes + service.bufferMinutes,
      dateRange: { from, to },
      schedule: scheduleInfo,
      // capacity: unidades homogéneas (spots de appointment, no conteo de slots)
      // totalCapacity = totalSlots × capacidadPorSlot
      // occupiedSpots + freeSpots = totalCapacity  ← siempre se cumple
      capacity: {
        totalCapacity: totalSpots,
        occupiedSlots: occupiedSpots,
        availableSlots: freeSpots,
      },
      totalDays: slotsByDateArray.length,
      byDate: slotsByDateArray,
    };
  }

}

import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CapacityInfo } from "../types/availability.types";

export interface CapacityPreload {
  appointments: Array<{ startAt: Date; endAt: Date }>;
  rules: Array<{
    scopeType: string;
    date: Date | null;
    weekday: number | null;
    startTime: string | null;
    endTime: string | null;
    capacity: number;
    priority: number;
  }>;
  defaultCapacity: number;
}

@Injectable()
export class CapacityService {
  private readonly logger = new Logger("CapacityService");

  constructor(private prisma: PrismaService) {}

  /**
   * Obtiene la capacidad efectiva para una fecha/hora específica
   */
  async getEffectiveCapacity(
    branchId: string,
    slotStart: Date
  ): Promise<number> {
    // NAIVE LIMA: slotStart es hora Lima en campo UTC → usar getUTC* para
    // extraer la fecha y hora Lima correctas sin aplicar offset de zona.

    // 1. Buscar override específico por fecha
    const dateException = await this.prisma.branchCapacityRule.findFirst({
      where: {
        branchId,
        scopeType: "DATE",
        date: {
          gte: new Date(Date.UTC(slotStart.getUTCFullYear(), slotStart.getUTCMonth(), slotStart.getUTCDate())),
          lt:  new Date(Date.UTC(slotStart.getUTCFullYear(), slotStart.getUTCMonth(), slotStart.getUTCDate() + 1)),
        },
        isActive: true,
      },
      orderBy: { priority: "desc" },
    });

    if (dateException) {
      return dateException.capacity;
    }

    // 2. Buscar por rango semanal (weekday y hora en naive Lima = getUTC*)
    const weekday = slotStart.getUTCDay();
    const timeStr = `${String(slotStart.getUTCHours()).padStart(2, "0")}:${String(
      slotStart.getUTCMinutes()
    ).padStart(2, "0")}`;

    const weekdayException = await this.prisma.branchCapacityRule.findFirst({
      where: {
        branchId,
        scopeType: "WEEKDAY_RANGE",
        weekday,
        startTime: { lte: timeStr },
        endTime: { gte: timeStr },
        isActive: true,
      },
      orderBy: { priority: "desc" },
    });

    if (weekdayException) {
      return weekdayException.capacity;
    }

    // 3. Usar capacidad por defecto de la sede
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { defaultCapacity: true },
    });

    return branch?.defaultCapacity || 6;
  }

  /**
   * Cuenta citas que solapan un rango horario.
   * COMPLETED también se considera ocupado: el cupo ya fue consumido (útil
   * para mostrar la ocupación real de días pasados o del día actual).
   * Solo CANCELED y RESCHEDULED liberan el cupo.
   */
  async countOccupiedSlots(
    branchId: string,
    slotStart: Date,
    slotEnd: Date
  ): Promise<number> {
    const count = await this.prisma.appointment.count({
      where: {
        branchId,
        status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_SERVICE", "COMPLETED"] },
        startAt: { lt: slotEnd },
        endAt: { gt: slotStart },
      },
    });

    return count;
  }

  /**
   * Obtiene información completa de capacidad para un slot
   */
  async getCapacityInfo(
    branchId: string,
    slotStart: Date,
    slotEnd: Date,
    activeHolds: number = 0
  ): Promise<CapacityInfo> {
    const totalCapacity = await this.getEffectiveCapacity(branchId, slotStart);
    const occupiedSlots = await this.countOccupiedSlots(
      branchId,
      slotStart,
      slotEnd
    );

    const availableCapacity = totalCapacity - occupiedSlots - activeHolds;

    return {
      totalCapacity,
      occupiedSlots,
      activeHolds,
      availableCapacity: Math.max(0, availableCapacity),
    };
  }

  /**
   * Pre-carga en UNA sola ronda de queries todos los datos necesarios para
   * calcular la capacidad de todos los slots en un rango de fechas.
   * Usar junto con computeSlotCapacity() para eliminar el N+1 por slot.
   *
   * ESTRATEGIA NAIVE LIMA: los timestamps en la BD son hora Lima almacenada
   * en el campo UTC (naive).  Los slots también se generan como naive.
   * Por eso los límites del query deben ser naive UTC (00:00Z – 23:59Z del día
   * Lima), no local midnight (UTC 05:00 con servidor Lima TZ).
   */
  async preloadForRange(
    branchId: string,
    from: Date,
    to: Date
  ): Promise<CapacityPreload> {
    // Usar getFullYear/Month/Date (hora local Lima del servidor) para extraer
    // la fecha Lima correcta, luego construir el rango naive con Date.UTC.
    const fromNaive = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0));
    const toEnd     = new Date(Date.UTC(to.getFullYear(),   to.getMonth(),   to.getDate(),   23, 59, 59, 999));

    const [appointments, rules, branch] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          branchId,
          // COMPLETED también ocupa cupo (el tiempo ya fue consumido).
          // Solo CANCELED y RESCHEDULED liberan el cupo disponible.
          status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_SERVICE", "COMPLETED"] },
          startAt: { lt: toEnd },
          endAt:   { gt: fromNaive },
        },
        select: { startAt: true, endAt: true },
      }),
      this.prisma.branchCapacityRule.findMany({
        where:   { branchId, isActive: true },
        orderBy: { priority: "desc" },
        select:  { scopeType: true, date: true, weekday: true, startTime: true, endTime: true, capacity: true, priority: true },
      }),
      this.prisma.branch.findUnique({
        where:  { id: branchId },
        select: { defaultCapacity: true },
      }),
    ]);

    return {
      appointments,
      rules,
      defaultCapacity: branch?.defaultCapacity ?? 6,
    };
  }

  /**
   * Calcula la capacidad para un slot usando datos pre-cargados (sin DB).
   * Elimina el N+1: llámalo en un .map() después de preloadForRange().
   */
  computeSlotCapacity(
    slotStart: Date,
    slotEnd: Date,
    preload: CapacityPreload,
    activeHolds = 0
  ): CapacityInfo {
    const totalCapacity = this.resolveCapacitySync(slotStart, preload.rules, preload.defaultCapacity);
    const occupiedSlots = preload.appointments.filter(
      (a) => a.startAt < slotEnd && a.endAt > slotStart
    ).length;
    const availableCapacity = Math.max(0, totalCapacity - occupiedSlots - activeHolds);
    return { totalCapacity, occupiedSlots, activeHolds, availableCapacity };
  }

  private resolveCapacitySync(
    slotStart: Date,
    rules: CapacityPreload["rules"],
    defaultCapacity: number
  ): number {
    // NAIVE LIMA: slotStart es hora Lima en campo UTC → usar getUTC* para leer
    // la fecha y hora Lima sin aplicar el offset de zona del servidor.
    const slotDayStart = Date.UTC(slotStart.getUTCFullYear(), slotStart.getUTCMonth(), slotStart.getUTCDate());
    const slotDayEnd   = Date.UTC(slotStart.getUTCFullYear(), slotStart.getUTCMonth(), slotStart.getUTCDate() + 1);

    // 1. DATE override
    const dateRule = rules
      .filter((r) => r.scopeType === "DATE" && r.date !== null &&
        r.date.getTime() >= slotDayStart && r.date.getTime() < slotDayEnd)
      .sort((a, b) => b.priority - a.priority)[0];
    if (dateRule) return dateRule.capacity;

    // 2. WEEKDAY_RANGE override — weekday y hora también en naive Lima (UTC)
    const weekday = slotStart.getUTCDay();
    const timeStr = `${String(slotStart.getUTCHours()).padStart(2, "0")}:${String(slotStart.getUTCMinutes()).padStart(2, "0")}`;
    const weekdayRule = rules
      .filter((r) => r.scopeType === "WEEKDAY_RANGE" && r.weekday === weekday &&
        r.startTime !== null && r.endTime !== null &&
        r.startTime! <= timeStr && r.endTime! >= timeStr)
      .sort((a, b) => b.priority - a.priority)[0];
    if (weekdayRule) return weekdayRule.capacity;

    return defaultCapacity;
  }
}

import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CapacityInfo } from "../types/availability.types";

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
    // 1. Buscar override específico por fecha
    const dateException = await this.prisma.branchCapacityRule.findFirst({
      where: {
        branchId,
        scopeType: "DATE",
        date: {
          gte: new Date(
            slotStart.getFullYear(),
            slotStart.getMonth(),
            slotStart.getDate()
          ),
          lt: new Date(
            slotStart.getFullYear(),
            slotStart.getMonth(),
            slotStart.getDate() + 1
          ),
        },
        isActive: true,
      },
      orderBy: { priority: "desc" },
    });

    if (dateException) {
      return dateException.capacity;
    }

    // 2. Buscar por rango semanal
    const weekday = slotStart.getDay();
    const timeStr = `${String(slotStart.getHours()).padStart(2, "0")}:${String(
      slotStart.getMinutes()
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
   * Cuenta citas confirmadas que solapan un rango horario
   */
  async countOccupiedSlots(
    branchId: string,
    slotStart: Date,
    slotEnd: Date
  ): Promise<number> {
    const count = await this.prisma.appointment.count({
      where: {
        branchId,
        status: {
          in: ["CONFIRMED", "CHECKED_IN", "IN_SERVICE"],
        },
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
}

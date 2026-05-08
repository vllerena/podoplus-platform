import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  DaySchedule,
  EffectiveSchedule,
  BlockedRange,
} from "../types/availability.types";

@Injectable()
export class ScheduleResolverService {
  private readonly logger = new Logger("ScheduleResolverService");

  constructor(private prisma: PrismaService) {}

  /**
   * Obtiene el horario efectivo para una fecha específica
   * Resuelve: override específico → horario semanal → error
   */
  async getEffectiveSchedule(
    branchId: string,
    date: Date
  ): Promise<EffectiveSchedule> {
    const dayOfWeek = date.getDay();

    // 1. Buscar exception específico
    const exception = await this.prisma.branchScheduleException.findUnique({
      where: {
        branchId_date: {
          branchId,
          date: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        },
      },
    });

    if (exception) {
      return {
        type: "exception",
        startTime: exception.startTime,
        endTime: exception.endTime,
        reason: exception.reason,
      };
    }

    // 2. Buscar por weekday
    const weekdaySchedule = await this.prisma.branchHour.findFirst({
      where: {
        branchId,
        weekday: dayOfWeek,
        isActive: true,
      },
    });

    if (weekdaySchedule) {
      return {
        type: "weekly",
        startTime: weekdaySchedule.startTime,
        endTime: weekdaySchedule.endTime,
      };
    }

    throw new BadRequestException(
      `La sede ${branchId} no tiene horario definido para ${date.toISOString().split("T")[0]}`
    );
  }

  /**
   * Obtiene los bloqueos para una fecha
   */
  async getBlocksForDate(
    branchId: string,
    date: Date
  ): Promise<BlockedRange[]> {
    const dayOfWeek = date.getDay();

    // 1. Bloqueos puntuales (específicos por fecha)
    const dateSpecificBlocks = await this.prisma.branchBlock.findMany({
      where: {
        branchId,
        isRecurring: false,
        startAt: {
          gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
        },
      },
    });

    // 2. Bloqueos recurrentes (por weekday/hora)
    const recurringBlocks = await this.prisma.branchBlock.findMany({
      where: {
        branchId,
        isRecurring: true,
        weekday: dayOfWeek,
      },
    });

    // Convertir bloqueos recurrentes a instancias de hoy.
    // Usar setUTCHours para generar timestamps naive Lima,
    // consistente con slots y appointments.
    const recurringBlockInstances = recurringBlocks.map((block) => {
      const [startHour, startMin] = (block.startTime || "00:00")
        .split(":")
        .map(Number);
      const [endHour, endMin] = (block.endTime || "23:59")
        .split(":")
        .map(Number);

      const blockStart = new Date(date);
      blockStart.setUTCHours(startHour, startMin, 0, 0);

      const blockEnd = new Date(date);
      blockEnd.setUTCHours(endHour, endMin, 0, 0);

      return {
        startAt: blockStart,
        endAt: blockEnd,
        type: block.type,
        title: block.title,
      };
    });

    return [...dateSpecificBlocks, ...recurringBlockInstances];
  }

  /**
   * Construye el schedule completo de un día
   */
  async buildDaySchedule(branchId: string, date: Date): Promise<DaySchedule> {
    const schedule = await this.getEffectiveSchedule(branchId, date);
    const blocks = await this.getBlocksForDate(branchId, date);

    return {
      date: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      dayOfWeek: date.getDay(),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      blocks,
    };
  }

  /**
   * Construye schedules para un rango de fechas
   * ARREGLO: Maneja correctamente el timezone
   */
  async buildDaySchedulesForRange(
    branchId: string,
    from: Date,
    to: Date,
    timezone: string = "America/Lima"
  ): Promise<DaySchedule[]> {
    const schedules: DaySchedule[] = [];

    // Convertir fechas a medianoche en el timezone de la sede
    let currentDate = new Date(from);
    currentDate.setHours(0, 0, 0, 0);

    const endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999);

    while (currentDate <= endDate) {
      try {
        const daySchedule = await this.buildDaySchedule(
          branchId,
          new Date(currentDate)
        );
        schedules.push(daySchedule);
      } catch (error) {
        this.logger.warn(
          `No hay horario para ${currentDate.toISOString().split("T")[0]}: ${(error as Error).message}`
        );
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return schedules;
  }
}

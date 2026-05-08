import { Injectable, Logger } from "@nestjs/common";
import { AvailabilitySlot, DaySchedule } from "../types/availability.types";

const SLOT_GRANULARITY_MINUTES = 30; // Cambio: 15 → 30 minutos

@Injectable()
export class SlotGeneratorService {
  private readonly logger = new Logger("SlotGeneratorService");

  /**
   * Genera slots de 30 minutos para un rango de fechas
   */
  generateSlotsForDateRange(
    from: Date,
    to: Date,
    serviceId: string,
    serviceDurationMinutes: number,
    bufferMinutes: number,
    daySchedules: DaySchedule[]
  ): AvailabilitySlot[] {
    const slots: AvailabilitySlot[] = [];

    // Iterar por cada día en el rango
    let currentDate = new Date(from);
    currentDate.setHours(0, 0, 0, 0);

    const endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999);

    while (currentDate <= endDate) {
      const dateStr = this.localDateStr(currentDate);
      const daySchedule = daySchedules.find(
        (ds) => this.localDateStr(ds.date) === dateStr
      );

      if (daySchedule) {
        const daySlots = this.generateSlotsForDay(
          daySchedule,
          serviceDurationMinutes,
          bufferMinutes
        );
        slots.push(...daySlots);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return slots;
  }

  /**
   * Genera slots para un día específico.
   *
   * ESTRATEGIA NAIVE LIMA: los timestamps de los slots se construyen con
   * setUTCHours() para que queden almacenados como hora Lima en el campo UTC,
   * igual que los appointments (parseLocalDate usa Date.UTC).
   * Ejemplo: Lima 16:00 → slot.startAt = "2026-05-04T16:00:00.000Z" (naive).
   * Así la comparación de solapamiento en CapacityService es directa (UTC vs UTC).
   */
  private generateSlotsForDay(
    daySchedule: DaySchedule,
    serviceDurationMinutes: number,
    bufferMinutes: number
  ): AvailabilitySlot[] {
    const slots: AvailabilitySlot[] = [];
    const totalDuration = serviceDurationMinutes + bufferMinutes;

    // Parsear horarios
    const [startHour, startMin] = daySchedule.startTime.split(":").map(Number);
    const [endHour, endMin] = daySchedule.endTime.split(":").map(Number);

    // Usar setUTCHours para construir timestamps naive Lima:
    // el campo UTC almacena directamente la hora Lima (sin offset de zona).
    let slotStart = new Date(daySchedule.date);
    slotStart.setUTCHours(startHour, startMin, 0, 0);

    const dayEnd = new Date(daySchedule.date);
    dayEnd.setUTCHours(endHour, endMin, 0, 0);

    // Generar slots cada 30 minutos (cambio de 15)
    while (slotStart.getTime() + totalDuration * 60000 <= dayEnd.getTime()) {
      const slotEnd = new Date(slotStart.getTime() + totalDuration * 60000);

      // Verificar que el slot no intersecta con bloqueos
      const isBlocked = daySchedule.blocks.some((block) => {
        return (
          slotStart.getTime() < block.endAt.getTime() &&
          slotEnd.getTime() > block.startAt.getTime()
        );
      });

      if (!isBlocked) {
        slots.push({
          startAt: new Date(slotStart),
          endAt: new Date(slotEnd),
          startAtLocal: "", // Se calcula después
          endAtLocal: "", // Se calcula después
          availableCapacity: 0, // Se calcula después
          totalCapacity: 0, // Se calcula después
          isAvailable: false, // Se calcula después
        });
      }

      // Avanzar al siguiente slot (30 minutos en lugar de 15)
      slotStart.setMinutes(slotStart.getMinutes() + SLOT_GRANULARITY_MINUTES);
    }

    return slots;
  }

  private localDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}

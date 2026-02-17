export interface AvailabilitySlot {
  startAt: Date;
  endAt: Date;
  startAtLocal: string; // HH:mm en timezone local
  endAtLocal: string; // HH:mm en timezone local
  availableCapacity: number;
  totalCapacity: number;
  isAvailable: boolean;
}

export interface EffectiveSchedule {
  startTime: string;
  endTime: string;
  type: "weekly" | "exception";
  reason?: string;
}

export interface DaySchedule {
  date: Date;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  blocks: BlockedRange[];
}

export interface BlockedRange {
  startAt: Date;
  endAt: Date;
  type: string;
  title: string;
}

export interface CapacityInfo {
  totalCapacity: number;
  occupiedSlots: number;
  activeHolds: number;
  availableCapacity: number;
}

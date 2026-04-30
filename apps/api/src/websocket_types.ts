export enum WebSocketEvent {
  // Hold events
  HOLD_CREATED = "hold:created",
  HOLD_RENEWED = "hold:renewed",
  HOLD_RELEASED = "hold:released",
  HOLD_EXPIRED = "hold:expired",

  // Appointment events
  APPOINTMENT_CREATED = "appointment:created",
  APPOINTMENT_CONFIRMED = "appointment:confirmed",
  APPOINTMENT_CHECKED_IN = "appointment:checked_in",
  APPOINTMENT_IN_SERVICE = "appointment:in_service",
  APPOINTMENT_COMPLETED = "appointment:completed",
  APPOINTMENT_CANCELED = "appointment:canceled",
  APPOINTMENT_RESCHEDULED = "appointment:rescheduled",
  APPOINTMENT_NO_SHOW = "appointment:no_show",

  // Sale events
  SALE_CREATED = "sale:created",
  SALE_VOIDED = "sale:voided",

  // Availability events
  AVAILABILITY_UPDATED = "availability:updated",
  SLOT_AVAILABLE = "slot:available",
  SLOT_HELD = "slot:held",
  SLOT_RELEASED = "slot:released",

  // Connection events
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  ERROR = "error",
}

export interface WebSocketPayload<T = any> {
  event: WebSocketEvent;
  timestamp: string;
  data: T;
  branchId?: string;
  userId?: string;
}

export interface HoldCreatedPayload {
  hold_id: string;
  branch_id: string;
  service_id: string;
  start_at: string;
  start_date: string;
  start_time: string;
  end_at: string;
  end_date: string;
  end_time: string;
  expires_at: string;
  expires_in_seconds: number;
  holder_type: "USER" | "CUSTOMER";
  holder_id: string;
}

export interface HoldReleasedPayload {
  hold_id: string;
  branch_id: string;
  released_at: string;
  reason?: string;
}

export interface AppointmentCreatedPayload {
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
  status: string;
  created_at: string;
}

export interface AppointmentStatusChangedPayload {
  id: string;
  branch_id: string;
  customer_id: string;
  previous_status: string;
  new_status: string;
  changed_at: string;
  reason?: string;
}

export interface SaleCreatedPayload {
  id: string;
  branch_id: string;
  customer_id?: string;
  appointment_id?: string;
  total_amount: string;
  payment_method: string;
  status: string;
  items_count: number;
  created_at: string;
}

export interface AvailabilityUpdatedPayload {
  branch_id: string;
  service_id: string;
  start_date: string;
  available_slots: number;
  last_updated: string;
}

export const WebSocketRooms = {
  BRANCH: "branch:",
  CUSTOMER: "customer:",
  RECEPTION: "reception:",
  ADMIN: "admin:",
} as const;

export const getRoom = (
  type: "branch" | "customer" | "reception" | "admin",
  id: string
): string => {
  const prefix: Record<string, string> = {
    branch: WebSocketRooms.BRANCH,
    customer: WebSocketRooms.CUSTOMER,
    reception: WebSocketRooms.RECEPTION,
    admin: WebSocketRooms.ADMIN,
  };
  return `${prefix[type]}${id}`;
};

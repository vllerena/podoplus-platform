// Tipos para eventos WebSocket en tiempo real

import { UUID, ISODateTime } from "./01_common.types";

// ===== EVENT NAMES =====
export enum RealtimeEventName {
  SLOT_HOLD = "slot:hold",
  SLOT_RELEASE = "slot:release",
  APPOINTMENT_CREATED = "appointment:created",
  APPOINTMENT_UPDATED = "appointment:updated",
  SYNC_REQUEST = "sync:request",
  SYNC_RESPONSE = "sync:response",
  SALE_CREATED = "sale:created",
  CASH_OPENED = "cash:opened",
  CASH_CLOSED = "cash:closed",
  WHATSAPP_STATUS = "whatsapp:status",
  SYSTEM_PING = "system:ping",
  SYSTEM_PONG = "system:pong",
}

// ===== BASE ENVELOPE =====
export interface RealtimeEnvelope<TPayload = any> {
  event_id: UUID;
  ts: ISODateTime;
  name: RealtimeEventName;
  branch_id?: UUID;
  payload: TPayload;
}

// ===== HOLD PAYLOADS =====
export interface SlotHoldPayload {
  hold_id: UUID;
  branch_id: UUID;
  start_at: ISODateTime;
  end_at: ISODateTime;
  service_id: UUID;
  holder_type: "USER" | "CUSTOMER";
  expires_at: ISODateTime;
}

export interface SlotReleasePayload {
  hold_id: UUID;
  branch_id: UUID;
  start_at: ISODateTime;
  end_at: ISODateTime;
}

// ===== APPOINTMENT PAYLOADS =====
export interface AppointmentSlim {
  id: UUID;
  branch_id: UUID;
  customer_id: UUID;
  service_id: UUID;
  start_at: ISODateTime;
  end_at: ISODateTime;
  status: string;
  source: string;
}

export interface AppointmentCreatedPayload {
  appointment: AppointmentSlim;
}

export interface AppointmentUpdatedPayload {
  appointment_id: UUID;
  changes: Record<string, { from: any; to: any }>;
  appointment: Partial<AppointmentSlim>;
}

// ===== SYNC PAYLOADS =====
export interface SyncRequestPayload {
  branch_id: UUID;
  from: ISODateTime;
  to: ISODateTime;
}

export interface SyncResponsePayload {
  branch_id: UUID;
  appointments: AppointmentSlim[];
  holds: Array<{
    hold_id: UUID;
    start_at: ISODateTime;
    end_at: ISODateTime;
    expires_at: ISODateTime;
  }>;
  blocks: Array<{
    id: UUID;
    start_at: ISODateTime;
    end_at: ISODateTime;
    type: string;
  }>;
}

// ===== SALE PAYLOADS =====
export interface SaleCreatedPayload {
  sale_id: UUID;
  branch_id: UUID;
  total_amount: number;
  status: string;
}

// ===== CASH PAYLOADS =====
export interface CashOpenedPayload {
  cash_register_id: UUID;
  branch_id: UUID;
  opened_at: ISODateTime;
  opening_balance: number;
}

export interface CashClosedPayload {
  cash_register_id: UUID;
  branch_id: UUID;
  closed_at: ISODateTime;
  closing_balance: number;
}

// ===== WHATSAPP PAYLOADS =====
export interface WhatsappStatusPayload {
  message_log_id: UUID;
  branch_id: UUID;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED";
  error?: string;
}

// ===== SYSTEM PAYLOADS =====
export interface SystemPingPayload {
  timestamp: ISODateTime;
}

export interface SystemPongPayload {
  timestamp: ISODateTime;
  latency_ms: number;
}

// ===== HELPER TYPES =====
export type RealtimeEvent =
  | RealtimeEnvelope<SlotHoldPayload>
  | RealtimeEnvelope<SlotReleasePayload>
  | RealtimeEnvelope<AppointmentCreatedPayload>
  | RealtimeEnvelope<AppointmentUpdatedPayload>
  | RealtimeEnvelope<SyncRequestPayload>
  | RealtimeEnvelope<SyncResponsePayload>
  | RealtimeEnvelope<SaleCreatedPayload>
  | RealtimeEnvelope<CashOpenedPayload>
  | RealtimeEnvelope<CashClosedPayload>
  | RealtimeEnvelope<WhatsappStatusPayload>
  | RealtimeEnvelope<SystemPingPayload>
  | RealtimeEnvelope<SystemPongPayload>;
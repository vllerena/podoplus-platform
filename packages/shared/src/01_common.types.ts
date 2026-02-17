// Types compartidos para toda la aplicación

// ===== COMMON TYPES =====
export type UUID = string;
export type ISODateTime = string; // ISO8601 with timezone

// ===== APPOINTMENT TYPES =====
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

export enum AppointmentSource {
  RECEPTION = "RECEPTION",
  PORTAL = "PORTAL",
  STAFF = "STAFF",
  SYSTEM = "SYSTEM",
}

export interface Appointment {
  id: UUID;
  branchId: UUID;
  customerId: UUID;
  serviceId: UUID;
  startAt: ISODateTime;
  endAt: ISODateTime;
  status: AppointmentStatus;
  source: AppointmentSource;
  notes?: string;
  cancelReason?: string;
  canceledByType?: "USER" | "CUSTOMER" | "SYSTEM";
  canceledById?: UUID;
  canceledAt?: ISODateTime;
  rescheduledFromId?: UUID;
  rescheduledToId?: UUID;
  createdById?: UUID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ===== CUSTOMER TYPES =====
export interface Customer {
  id: UUID;
  documentType: string; // DNI, CE, PASSPORT
  documentNumber?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  birthDate?: ISODateTime;
  gender?: string;
  notes?: string;
  whatsappOptIn: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ===== BRANCH TYPES =====
export interface Branch {
  id: UUID;
  code?: string;
  name: string;
  address?: string;
  district?: string;
  city?: string;
  phone?: string;
  isActive: boolean;
  defaultCapacity: number;
  timezone: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ===== SERVICE TYPES =====
export interface Service {
  id: UUID;
  name: string;
  description?: string;
  durationMinutes: number;
  bufferMinutes: number;
  basePrice: number;
  isActive: boolean;
  allowSelfService: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ===== USER & ROLE TYPES =====
export interface User {
  id: UUID;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Role {
  id: UUID;
  code: string;
  name: string;
  description?: string;
}

// ===== HOLD TYPES (Redis) =====
export interface Hold {
  id: UUID;
  branchId: UUID;
  startAt: ISODateTime;
  endAt: ISODateTime;
  serviceId: UUID;
  holderType: "USER" | "CUSTOMER";
  holderId: UUID;
  createdAt: ISODateTime;
  expiresAt: ISODateTime;
}

// ===== AVAILABILITY TYPES =====
export interface AvailabilitySlot {
  startAt: ISODateTime;
  endAt: ISODateTime;
  availableCapacity: number;
  totalCapacity: number;
}

// ===== CASH REGISTER TYPES =====
export interface CashRegister {
  id: UUID;
  branchId: UUID;
  openedById: UUID;
  openedAt: ISODateTime;
  openingBalance: number;
  closedById?: UUID;
  closedAt?: ISODateTime;
  status: "OPEN" | "CLOSED";
  notes?: string;
}

// ===== SALE TYPES =====
export interface Sale {
  id: UUID;
  branchId: UUID;
  customerId?: UUID;
  appointmentId?: UUID;
  cashRegisterId?: UUID;
  totalAmount: number;
  discountAmount: number;
  paymentMethod: "CASH" | "CARD" | "YAPE" | "PLIN" | "TRANSFER" | "MIXED";
  status: "PAID" | "REFUNDED" | "VOIDED";
  createdAt: ISODateTime;
}

// ===== PLAN & SUBSCRIPTION TYPES =====
export interface Plan {
  id: UUID;
  name: string;
  description?: string;
  price: number;
  durationDays: number;
  includedSessions: number;
  isActive: boolean;
}

export interface CustomerSubscription {
  id: UUID;
  customerId: UUID;
  planId: UUID;
  branchId: UUID;
  status: "ACTIVE" | "PAUSED" | "CANCELED" | "EXPIRED";
  startDate: ISODateTime;
  endDate: ISODateTime;
  remainingSessions: number;
}

// ===== AUDIT TYPES =====
export interface AuditLog {
  id: UUID;
  actorType: "USER" | "SYSTEM";
  actorId?: UUID;
  branchId?: UUID;
  action: string;
  entityType: string;
  entityId: string;
  reason?: string;
  createdAt: ISODateTime;
}
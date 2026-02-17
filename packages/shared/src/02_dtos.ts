// Data Transfer Objects para Request/Response

import { UUID } from "./01_common.types";

// ===== APPOINTMENT DTOs =====
export interface CreateAppointmentDTO {
  branchId: UUID;
  customerId: UUID;
  serviceId: UUID;
  startAt: string; // ISO DateTime
  notes?: string;
  source: "RECEPTION" | "PORTAL";
}

export interface ConfirmAppointmentDTO {
  holdId?: UUID;
  branchId: UUID;
  serviceId: UUID;
  startAt: string;
  customerId: UUID;
  notes?: string;
  idempotencyKey?: string;
}

export interface RescheduleAppointmentDTO {
  appointmentId: UUID;
  newStartAt: string;
  reason?: string;
}

export interface CancelAppointmentDTO {
  appointmentId: UUID;
  reason: string;
  canceledByUserId?: UUID;
}

export interface CheckInDTO {
  appointmentId: UUID;
}

export interface StartServiceDTO {
  appointmentId: UUID;
}

export interface CompleteAppointmentDTO {
  appointmentId: UUID;
}

// ===== CUSTOMER DTOs =====
export interface CreateCustomerDTO {
  documentType: string;
  documentNumber?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  gender?: string;
}

export interface UpdateCustomerDTO {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  whatsappOptIn?: boolean;
}

// ===== HOLD DTOs =====
export interface CreateHoldDTO {
  branchId: UUID;
  serviceId: UUID;
  startAt: string;
  endAt: string;
  holderType: "USER" | "CUSTOMER";
  holderId: UUID;
}

export interface CreateHoldResponseDTO {
  holdId: UUID;
  expiresAt: string;
  expiresIn: number; // segundos
}

// ===== AVAILABILITY DTOs =====
export interface GetAvailabilityDTO {
  branchId: UUID;
  serviceId: UUID;
  from: string; // ISO date
  to: string; // ISO date
}

// ===== CASH REGISTER DTOs =====
export interface OpenCashRegisterDTO {
  branchId: UUID;
  openingBalance: number;
}

export interface CloseCashRegisterDTO {
  cashRegisterId: UUID;
  closingBalance: number;
  notes?: string;
}

export interface AddCashMovementDTO {
  cashRegisterId: UUID;
  type: "IN" | "OUT";
  amount: number;
  reason: string;
}

// ===== SALE DTOs =====
export interface CreateSaleDTO {
  branchId: UUID;
  customerId?: UUID;
  appointmentId?: UUID;
  cashRegisterId?: UUID;
  items: SaleItemDTO[];
  discountAmount?: number;
  paymentMethod: string;
  idempotencyKey?: string;
}

export interface SaleItemDTO {
  itemType: "PRODUCT" | "SERVICE" | "PLAN";
  productId?: UUID;
  serviceId?: UUID;
  planId?: UUID;
  quantity: number;
  unitPrice: number;
}

export interface VoidSaleDTO {
  saleId: UUID;
  reason: string;
}

// ===== BRANCH DTOs =====
export interface CreateBranchDTO {
  code?: string;
  name: string;
  address?: string;
  district?: string;
  city?: string;
  phone?: string;
  defaultCapacity: number;
  timezone: string;
}

export interface UpdateBranchDTO {
  name?: string;
  address?: string;
  phone?: string;
  defaultCapacity?: number;
  timezone?: string;
}

// ===== SERVICE DTOs =====
export interface CreateServiceDTO {
  name: string;
  description?: string;
  durationMinutes: number;
  bufferMinutes?: number;
  basePrice: number;
  allowSelfService: boolean;
}

export interface UpdateServiceDTO {
  name?: string;
  description?: string;
  basePrice?: number;
  isActive?: boolean;
}

// ===== PLAN DTOs =====
export interface CreatePlanDTO {
  name: string;
  description?: string;
  price: number;
  durationDays: number;
  includedSessions: number;
}

export interface AssignPlanDTO {
  customerId: UUID;
  planId: UUID;
  branchId: UUID;
}

// ===== SCHEDULE DTOs =====
export interface SetBranchHoursDTO {
  branchId: UUID;
  hours: BranchHourDTO[];
}

export interface BranchHourDTO {
  weekday: number; // 0-6
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isActive: boolean;
}

export interface CreateBlockDTO {
  branchId: UUID;
  type: string; // LUNCH, HOLIDAY, etc
  title: string;
  startAt: string;
  endAt: string;
  isRecurring?: boolean;
}

// ===== INVENTORY DTOs =====
export interface CreateInventoryMovementDTO {
  branchId: UUID;
  productId: UUID;
  type: string; // PURCHASE_IN, SALE_OUT, ADJUSTMENT, etc
  quantity: number;
  reason?: string;
}

// ===== AUTH DTOs =====
export interface LoginDTO {
  email: string;
  password: string;
}

export interface LoginResponseDTO {
  accessToken: string;
  refreshToken: string;
  user: {
    id: UUID;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
  };
}

export interface RefreshTokenDTO {
  refreshToken: string;
}

export interface RequestOtpDTO {
  phone: string;
}

export interface VerifyOtpDTO {
  phone: string;
  otp: string;
}
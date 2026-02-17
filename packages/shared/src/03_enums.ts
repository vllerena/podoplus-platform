// Enumeraciones globales

export enum RoleCode {
  SUPER_ADMIN = "SUPER_ADMIN",
  GENERAL_MANAGER = "GENERAL_MANAGER",
  OPS_MANAGER = "OPS_MANAGER",
  SUPERVISOR = "SUPERVISOR",
  SUPERVISOR_ASSISTANT = "SUPERVISOR_ASSISTANT",
  LOGISTICS = "LOGISTICS",
  QUALITY = "QUALITY",
  ACCOUNTING_HR = "ACCOUNTING_HR",
  RECEPTIONIST = "RECEPTIONIST",
  CUSTOMER = "CUSTOMER",
}

export enum PermissionCode {
  // Appointments
  APPOINTMENT_CREATE = "appointment.create",
  APPOINTMENT_READ = "appointment.read",
  APPOINTMENT_UPDATE = "appointment.update",
  APPOINTMENT_DELETE = "appointment.delete",
  APPOINTMENT_CHECKIN = "appointment.checkin",

  // Customers
  CUSTOMER_CREATE = "customer.create",
  CUSTOMER_READ = "customer.read",
  CUSTOMER_UPDATE = "customer.update",
  CUSTOMER_DELETE = "customer.delete",

  // Sales
  SALE_CREATE = "sale.create",
  SALE_READ = "sale.read",
  SALE_VOID = "sale.void",

  // Cash
  CASH_OPEN = "cash.open",
  CASH_CLOSE = "cash.close",
  CASH_READ = "cash.read",

  // Inventory
  INVENTORY_READ = "inventory.read",
  INVENTORY_ADJUST = "inventory.adjust",
  INVENTORY_TRANSFER = "inventory.transfer",

  // Plans
  PLAN_CREATE = "plan.create",
  PLAN_READ = "plan.read",
  PLAN_ASSIGN = "plan.assign",

  // Reports
  REPORT_READ = "report.read",
  REPORT_EXPORT = "report.export",

  // Settings
  SETTINGS_READ = "settings.read",
  SETTINGS_UPDATE = "settings.update",

  // Users & Roles
  USER_MANAGE = "user.manage",
  ROLE_MANAGE = "role.manage",
}

export enum AppointmentStatusEnum {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  CHECKED_IN = "CHECKED_IN",
  IN_SERVICE = "IN_SERVICE",
  COMPLETED = "COMPLETED",
  RESCHEDULED = "RESCHEDULED",
  CANCELED = "CANCELED",
  NO_SHOW = "NO_SHOW",
}

export enum CashRegisterStatus {
  OPEN = "OPEN",
  CLOSED = "CLOSED",
}

export enum SaleStatus {
  PAID = "PAID",
  REFUNDED = "REFUNDED",
  VOIDED = "VOIDED",
}

export enum PaymentMethod {
  CASH = "CASH",
  CARD = "CARD",
  YAPE = "YAPE",
  PLIN = "PLIN",
  TRANSFER = "TRANSFER",
  MIXED = "MIXED",
}

export enum SubscriptionStatus {
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  CANCELED = "CANCELED",
  EXPIRED = "EXPIRED",
}

export enum InventoryMovementType {
  PURCHASE_IN = "PURCHASE_IN",
  SALE_OUT = "SALE_OUT",
  ADJUSTMENT = "ADJUSTMENT",
  TRANSFER_OUT = "TRANSFER_OUT",
  TRANSFER_IN = "TRANSFER_IN",
  RETURN_IN = "RETURN_IN",
}

export enum BlockType {
  LUNCH = "LUNCH",
  HOLIDAY = "HOLIDAY",
  MAINTENANCE = "MAINTENANCE",
  EVENT = "EVENT",
  CUSTOM = "CUSTOM",
}

export enum DocumentType {
  DNI = "DNI",
  CE = "CE",
  PASSPORT = "PASSPORT",
}

export enum Gender {
  MALE = "M",
  FEMALE = "F",
  OTHER = "O",
}

// Constantes globales
export const SLOT_GRANULARITY_MIN = 15;
export const HOLD_TTL_SEC = 90;
export const NO_SHOW_GRACE_MIN = 15;
export const MAX_HOLD_PER_USER_PER_BRANCH = 1;
export const MAX_HOLD_EXTEND_SEC = 180;

export const DEFAULT_CLIENT_CANCEL_LIMIT_HOURS = 6;
export const DEFAULT_CLIENT_RESCHEDULE_LIMIT_HOURS = 6;
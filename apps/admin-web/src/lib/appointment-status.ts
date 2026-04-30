export type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "IN_SERVICE"
  | "COMPLETED"
  | "RESCHEDULED"
  | "CANCELED"
  | "NO_SHOW";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING:     "Pendiente",
  CONFIRMED:   "Confirmada",
  CHECKED_IN:  "En espera",
  IN_SERVICE:  "En servicio",
  COMPLETED:   "Completada",
  RESCHEDULED: "Reprogramada",
  CANCELED:    "Cancelada",
  NO_SHOW:     "No asistió",
};

export const STATUS_COLOR: Record<AppointmentStatus, string> = {
  PENDING:     "bg-yellow-100 text-yellow-800 border-yellow-200",
  CONFIRMED:   "bg-blue-100 text-blue-800 border-blue-200",
  CHECKED_IN:  "bg-purple-100 text-purple-800 border-purple-200",
  IN_SERVICE:  "bg-indigo-100 text-indigo-800 border-indigo-200",
  COMPLETED:   "bg-green-100 text-green-800 border-green-200",
  RESCHEDULED: "bg-orange-100 text-orange-800 border-orange-200",
  CANCELED:    "bg-red-100 text-red-800 border-red-200",
  NO_SHOW:     "bg-gray-100 text-gray-600 border-gray-200",
};

export const STATUS_DOT: Record<AppointmentStatus, string> = {
  PENDING:     "bg-yellow-400",
  CONFIRMED:   "bg-blue-500",
  CHECKED_IN:  "bg-purple-500",
  IN_SERVICE:  "bg-indigo-500",
  COMPLETED:   "bg-green-500",
  RESCHEDULED: "bg-orange-500",
  CANCELED:    "bg-red-500",
  NO_SHOW:     "bg-gray-400",
};

/** Returns the primary action available for a given status */
export type AppointmentAction =
  | "confirm"
  | "check-in"
  | "start"
  | "complete"
  | "reschedule"
  | "cancel"
  | "no-show"
  | null;

export const PRIMARY_ACTION: Record<AppointmentStatus, AppointmentAction> = {
  PENDING:     "confirm",
  CONFIRMED:   "check-in",
  CHECKED_IN:  "start",
  IN_SERVICE:  "complete",
  COMPLETED:   null,
  RESCHEDULED: null,
  CANCELED:    null,
  NO_SHOW:     null,
};

export const PRIMARY_ACTION_LABEL: Record<string, string> = {
  "confirm":   "Confirmar",
  "check-in":  "Check-in",
  "start":     "Iniciar",
  "complete":  "Completar",
  "reschedule":"Reprogramar",
  "cancel":    "Cancelar",
  "no-show":   "No asistió",
};

/** Status groups for filtering */
export const ACTIVE_STATUSES: AppointmentStatus[] = [
  "PENDING", "CONFIRMED", "CHECKED_IN", "IN_SERVICE",
];

export const TERMINAL_STATUSES: AppointmentStatus[] = [
  "COMPLETED", "CANCELED", "NO_SHOW", "RESCHEDULED",
];

export function isActive(status: AppointmentStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

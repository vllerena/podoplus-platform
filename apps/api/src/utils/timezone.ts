/**
 * Utilidades para manejo de timezone America/Lima
 *
 * ESTRATEGIA:
 * - Las fechas se almacenan como Date objects
 * - Siempre se interpretan en timezone America/Lima (sin conversión)
 * - Se comparan directamente sin ajustes de offset
 */

/**
 * Formatea una fecha a formato amigable YYYY-MM-DD
 */
export function formatDateOnly(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formatea una hora a formato amigable HH:mm
 */
export function formatTimeOnly(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Formatea fecha y hora juntas YYYY-MM-DD HH:mm
 */
export function formatDateTime(date: Date | string): string {
  const dateStr = formatDateOnly(date);
  const timeStr = formatTimeOnly(date);
  return `${dateStr} ${timeStr}`;
}

/**
 * Convierte un string de formato amigable a Date
 * Formato esperado: "2026-01-20" o "2026-01-20 10:00"
 *
 * IMPORTANTE:
 * El valor se crea como UTC internamente pero se interpreta como
 * si fuera la hora LOCAL que el usuario ingresó.
 * No hay conversión de timezone - se almacena literalmente.
 *
 * Ejemplo:
 * Input: "2026-01-20 10:00"
 * Output: Date(2026, 0, 20, 10, 0) = "2026-01-20T10:00:00.000Z"
 */
export function parseLocalDate(dateString: string): Date {
  const parts = dateString.trim().split(" ");
  const datePart = parts[0]; // "2026-01-20"
  const timePart = parts[1] || "00:00"; // "10:00"

  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);

  // Crear directamente como UTC sin ajustes
  // De esta forma "2026-01-20 10:00" se almacena como 2026-01-20T10:00:00Z
  const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));

  return date;
}

/**
 * Convierte un string de hora HH:mm a minutos desde medianoche
 */
export function timeStringToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Convierte minutos desde medianoche a string HH:mm
 */
export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * Obtiene el número de día de la semana (0=domingo, 6=sábado)
 */
export function getDayOfWeek(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.getUTCDay();
}

/**
 * Obtiene nombre del día en español
 */
export function getDayName(dayOfWeek: number): string {
  const days = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];
  return days[dayOfWeek];
}

/**
 * Obtiene nombre del mes en español
 */
export function getMonthName(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const months = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  return months[d.getUTCMonth()];
}

/**
 * Formatea fecha en formato amigable: "Lunes, 20 de Enero de 2026"
 */
export function formatFriendlyDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const dayName = getDayName(d.getUTCDay());
  const dayNum = d.getUTCDate();
  const monthName = getMonthName(d);
  const year = d.getUTCFullYear();
  return `${dayName}, ${dayNum} de ${monthName} de ${year}`;
}

/**
 * Validar que una fecha sea válida
 */
export function isValidDate(dateString: string): boolean {
  try {
    const date = parseLocalDate(dateString);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
}

/**
 * Obtiene la fecha actual en formato amigable
 */
export function getCurrentDateString(): string {
  const now = new Date();
  return formatDateOnly(now);
}

/**
 * Obtiene la hora actual en formato amigable
 */
export function getCurrentTimeString(): string {
  const now = new Date();
  return formatTimeOnly(now);
}

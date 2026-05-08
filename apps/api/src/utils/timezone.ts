/**
 * Utilidades para manejo de timezone America/Lima
 *
 * ESTRATEGIA "NAIVE LIMA":
 * - Los timestamps se almacenan como tiempo Lima local en el campo UTC de la BD.
 *   Ejemplo: 10:00 Lima → almacenado como "2026-05-05T10:00:00.000Z" (sin offset).
 * - Para leer la hora correcta se usan getUTCHours/getUTCDate/etc. (= hora naive).
 * - parseLocalDate almacena con Date.UTC → preserva exactamente la hora recibida.
 * - El slot generator usa setHours() local (servidor UTC) → genera naive automáticamente.
 */

/**
 * Formatea una fecha a formato amigable YYYY-MM-DD (naive Lima desde campo UTC)
 */
export function formatDateOnly(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const year  = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day   = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formatea una hora a formato amigable HH:mm (naive Lima desde campo UTC)
 */
export function formatTimeOnly(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const hours   = String(d.getUTCHours()).padStart(2, "0");
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
 * Convierte un string de formato "YYYY-MM-DD HH:mm" a Date naive Lima.
 * Formato esperado: "2026-01-20" o "2026-01-20 10:00"
 *
 * ESTRATEGIA NAIVE LIMA: los valores HH:mm representan la hora Lima local.
 * Date.UTC los almacena sin ajuste → la BD guarda "10:00" para Lima 10:00.
 * getUTCHours() sobre ese valor devuelve 10 → se lee correctamente como naive.
 *
 * Ejemplo:
 *   Slot: startAt = "2026-05-05T10:00:00.000Z"  (Lima 10:00, naive)
 *   Frontend envía: start_date="2026-05-05", start_time="10:00"  ← Lima local
 *   parseLocalDate("2026-05-05 10:00") = 2026-05-05T10:00:00Z    ← naive ✓
 */
export function parseLocalDate(dateString: string): Date {
  const parts = dateString.trim().split(" ");
  const datePart = parts[0]; // "2026-05-04"
  const timePart = parts[1] || "00:00"; // "21:00"

  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes]   = timePart.split(":").map(Number);

  // Date.UTC garantiza que se almacene exactamente el valor recibido, sin ajuste.
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
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
 * Obtiene el número de día de la semana (0=domingo, 6=sábado) desde campo UTC naive
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
 * Formatea fecha en formato amigable: "Lunes, 20 de Enero de 2026" (naive Lima)
 */
export function formatFriendlyDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const dayName   = getDayName(d.getUTCDay());
  const dayNum    = d.getUTCDate();
  const monthName = getMonthName(d);
  const year      = d.getUTCFullYear();
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

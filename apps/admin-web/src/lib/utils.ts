import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "PEN"): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

// Los timestamps se almacenan en "naive Lima" (la hora Lima guardada en el campo UTC).
// timeZone: "UTC" muestra el valor UTC directamente, que coincide con la hora Lima.
export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "UTC",
    day:   "2-digit",
    month: "2-digit",
    year:  "numeric",
    ...opts,
  }).format(new Date(date));
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "UTC",
    hour:   "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

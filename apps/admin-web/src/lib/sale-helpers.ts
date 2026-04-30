import type { SaleStatus, PaymentMethod } from "@/hooks/use-sales";

// ── Status ────────────────────────────────────────────────────────────────────

export const STATUS_LABEL: Record<SaleStatus, string> = {
  PENDING:  "Pendiente",
  PAID:     "Pagada",
  VOIDED:   "Anulada",
  REFUNDED: "Reembolsada",
};

export const STATUS_COLOR: Record<SaleStatus, string> = {
  PENDING:  "bg-yellow-100 text-yellow-800",
  PAID:     "bg-green-100  text-green-800",
  VOIDED:   "bg-red-100    text-red-800",
  REFUNDED: "bg-purple-100 text-purple-800",
};

// ── Payment method ────────────────────────────────────────────────────────────

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  CASH:     "Efectivo",
  CARD:     "Tarjeta",
  YAPE:     "Yape",
  PLIN:     "Plin",
  TRANSFER: "Transferencia",
  MIXED:    "Mixto",
};

export const PAYMENT_ICON: Record<PaymentMethod, string> = {
  CASH:     "💵",
  CARD:     "💳",
  YAPE:     "📱",
  PLIN:     "📱",
  TRANSFER: "🏦",
  MIXED:    "🔀",
};

// ── Item type ─────────────────────────────────────────────────────────────────

export const ITEM_TYPE_LABEL: Record<string, string> = {
  PRODUCT: "Producto",
  SERVICE: "Servicio",
  PLAN:    "Plan",
};

// ── Money helpers ─────────────────────────────────────────────────────────────

export function fmt(amount: string | number | undefined): string {
  if (amount === undefined || amount === null) return "S/ 0.00";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return `S/ ${n.toFixed(2)}`;
}

export function fmtDate(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function fmtDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

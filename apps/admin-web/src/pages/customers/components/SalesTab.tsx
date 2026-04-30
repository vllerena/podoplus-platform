import { ShoppingBag, ChevronDown, ChevronUp } from "lucide-react";
import { Badge, Skeleton } from "@podoplus/ui";
import { useCustomerSales, type CustomerSale } from "@/hooks/use-customers";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Props {
  customerId: string;
}

const SALE_STATUS_STYLES: Record<string, string> = {
  PAID:      "bg-green-100  text-green-800",
  PENDING:   "bg-yellow-100 text-yellow-800",
  VOIDED:    "bg-gray-100   text-gray-700",
  REFUNDED:  "bg-orange-100 text-orange-800",
  CANCELED:  "bg-red-100    text-red-800",
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH:          "Efectivo",
  CARD:          "Tarjeta",
  TRANSFER:      "Transferencia",
  YAPE:          "Yape",
  PLIN:          "Plin",
  OTHER:         "Otro",
};

function fmt(date?: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function SaleRow({ sale }: { sale: CustomerSale }) {
  const [expanded, setExpanded] = useState(false);
  const statusStyle = SALE_STATUS_STYLES[sale.status] ?? "bg-gray-100 text-gray-700";
  const itemsSummary = sale.items.length === 1
    ? sale.items[0].name
    : `${sale.items.length} ítems`;

  return (
    <>
      <tr
        className={cn("border-b hover:bg-muted/30 transition-colors cursor-pointer", expanded && "bg-muted/20")}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3 text-sm">{fmt(sale.createdAt)}</td>
        <td className="px-4 py-3 text-sm">
          <span className="truncate max-w-[160px] block">{itemsSummary}</span>
        </td>
        <td className="px-4 py-3 text-sm font-medium">
          S/ {parseFloat(String(sale.total)).toFixed(2)}
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod}
        </td>
        <td className="px-4 py-3 text-sm">
          {sale.branchName ?? "—"}
        </td>
        <td className="px-4 py-3">
          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", statusStyle)}>
            {sale.status}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          {sale.items.length > 0 && (
            expanded
              ? <ChevronUp className="h-4 w-4 text-muted-foreground inline" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground inline" />
          )}
        </td>
      </tr>
      {expanded && sale.items.length > 0 && (
        <tr className="border-b bg-muted/10">
          <td colSpan={7} className="px-6 py-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left font-medium pb-1.5">Ítem</th>
                  <th className="text-left font-medium pb-1.5">Tipo</th>
                  <th className="text-right font-medium pb-1.5">Cant.</th>
                  <th className="text-right font-medium pb-1.5">Precio unit.</th>
                  <th className="text-right font-medium pb-1.5">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sale.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-1.5 pr-4">{item.name}</td>
                    <td className="py-1.5 pr-4 text-muted-foreground">{item.itemType}</td>
                    <td className="py-1.5 text-right">{item.quantity}</td>
                    <td className="py-1.5 text-right">S/ {parseFloat(String(item.unitPrice)).toFixed(2)}</td>
                    <td className="py-1.5 text-right font-medium">S/ {parseFloat(String(item.subtotal)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

export function SalesTab({ customerId }: Props) {
  const { data: sales = [], isLoading, isError, error } = useCustomerSales(customerId);

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-destructive">
        Error al cargar ventas: {(error as Error)?.message}
      </div>
    );
  }

  if (sales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground rounded-xl border bg-card">
        <ShoppingBag className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">Sin ventas registradas</p>
      </div>
    );
  }

  const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(String(s.total)), 0);

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{sales.length} {sales.length === 1 ? "venta" : "ventas"}</span>
        <span className="font-semibold">Total: S/ {totalRevenue.toFixed(2)}</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ítems</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Método</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sede</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <SaleRow key={sale.id} sale={sale} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

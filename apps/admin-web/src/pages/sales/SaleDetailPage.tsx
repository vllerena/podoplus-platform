import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Ban, RotateCcw, Receipt, Clock } from "lucide-react";
import { Button, Badge, Skeleton, Separator } from "@podoplus/ui";
import { useSale, useSaleHistory } from "@/hooks/use-sales";
import { VoidModal }   from "./components/VoidModal";
import { RefundModal } from "./components/RefundModal";
import {
  STATUS_LABEL, STATUS_COLOR,
  PAYMENT_LABEL, PAYMENT_ICON,
  ITEM_TYPE_LABEL,
  fmt, fmtDateTime,
} from "@/lib/sale-helpers";

export function SaleDetailPage() {
  const { id = "" }  = useParams<{ id: string }>();
  const navigate      = useNavigate();
  const [voidOpen,   setVoidOpen]   = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

  const { data: sale, isLoading }    = useSale(id);
  const { data: history = [] }       = useSaleHistory(id);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Venta no encontrada.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/sales")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>
      </div>
    );
  }

  const canVoid   = sale.status === "PAID";
  const canRefund = sale.status === "PAID";

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/sales")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Ventas
        </Button>
        <div className="flex gap-2">
          {canVoid && (
            <Button
              variant="outline" size="sm"
              className="text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={() => setVoidOpen(true)}
            >
              <Ban className="h-4 w-4 mr-2" />
              Anular
            </Button>
          )}
          {canRefund && (
            <Button variant="outline" size="sm" onClick={() => setRefundOpen(true)}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reembolsar
            </Button>
          )}
        </div>
      </div>

      {/* Header card */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-lg font-bold font-mono">#{sale.id.slice(-12).toUpperCase()}</h1>
            </div>
            <p className="text-sm text-muted-foreground">{fmtDateTime(sale.created_at)}</p>
          </div>
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[sale.status]}`}>
            {STATUS_LABEL[sale.status]}
          </span>
        </div>

        <Separator className="my-4" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <InfoField label="Cliente"     value={sale.customer_name ?? "Sin cliente"} />
          <InfoField label="Método pago" value={`${PAYMENT_ICON[sale.payment_method]} ${PAYMENT_LABEL[sale.payment_method]}`} />
          <InfoField label="Total"       value={fmt(sale.total_amount)} bold />
          {parseFloat(sale.discount_amount) > 0 && (
            <InfoField label="Descuento"  value={fmt(sale.discount_amount)} />
          )}
        </div>

        {sale.notes && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Notas</p>
            <p className="text-sm">{sale.notes}</p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/30">
          <h2 className="text-sm font-semibold">Ítems de la venta</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-5 py-2 text-left font-medium text-muted-foreground">Tipo</th>
              <th className="px-5 py-2 text-left font-medium text-muted-foreground">Descripción</th>
              <th className="px-5 py-2 text-right font-medium text-muted-foreground">Cant.</th>
              <th className="px-5 py-2 text-right font-medium text-muted-foreground">P. Unit.</th>
              <th className="px-5 py-2 text-right font-medium text-muted-foreground">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="px-5 py-3 shrink-0">
                  <Badge variant="outline" className="text-xs font-normal whitespace-nowrap">
                    {ITEM_TYPE_LABEL[item.item_type] ?? item.item_type}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  {item.name
                    ? <span className="font-medium">{item.name}</span>
                    : <span className="font-mono text-xs text-muted-foreground">
                        {item.service_id ?? item.product_id ?? item.plan_id ?? "—"}
                      </span>
                  }
                </td>
                <td className="px-5 py-3 text-right">{item.quantity}</td>
                <td className="px-5 py-3 text-right">{fmt(item.unit_price)}</td>
                <td className="px-5 py-3 text-right font-semibold">{fmt(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/20">
              {parseFloat(sale.discount_amount) > 0 ? (
                <>
                  <td colSpan={4} className="px-5 py-2 text-right text-xs text-muted-foreground">Descuento</td>
                  <td className="px-5 py-2 text-right text-xs text-destructive">- {fmt(sale.discount_amount)}</td>
                </>
              ) : null}
            </tr>
            <tr className="bg-muted/20 border-t">
              <td colSpan={4} className="px-5 py-3 text-right text-sm font-semibold">Total</td>
              <td className="px-5 py-3 text-right text-sm font-bold">{fmt(sale.total_amount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Refund / Void info */}
      {sale.status === "VOIDED" && sale.void_reason && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive mb-1">Motivo de anulación</p>
          <p className="text-muted-foreground">{sale.void_reason}</p>
        </div>
      )}

      {sale.status === "REFUNDED" && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm space-y-1">
          <p className="font-semibold text-purple-800 mb-1">Información de reembolso</p>
          {sale.refund_amount && (
            <p className="text-muted-foreground">Monto: <span className="font-medium">{fmt(sale.refund_amount)}</span></p>
          )}
          {sale.refund_reason && (
            <p className="text-muted-foreground">Motivo: {sale.refund_reason}</p>
          )}
          {sale.refunded_at && (
            <p className="text-muted-foreground">Fecha: {fmtDateTime(sale.refunded_at)}</p>
          )}
        </div>
      )}

      {/* Audit history */}
      {history.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b bg-muted/30 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Historial de operaciones</h2>
          </div>
          <ul className="divide-y">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                <div className="h-2 w-2 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{entry.action}</span>
                  {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {Object.entries(entry.metadata)
                        .filter(([, v]) => v !== null && v !== undefined)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {fmtDateTime(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modals */}
      <VoidModal   sale={voidOpen   ? sale : null} onClose={() => setVoidOpen(false)} />
      <RefundModal sale={refundOpen ? sale : null} onClose={() => setRefundOpen(false)} />
    </div>
  );
}

function InfoField({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 ${bold ? "font-bold text-base" : "font-medium"}`}>{value}</p>
    </div>
  );
}

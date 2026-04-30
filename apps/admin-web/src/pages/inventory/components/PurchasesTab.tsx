import { useState } from "react";
import {
  Plus, ChevronLeft, ChevronRight, ShoppingCart,
  CheckCircle2, Clock, XCircle, Eye, PackagePlus, Ban,
  Building2, Calendar, Hash, Banknote, FileText, Package,
} from "lucide-react";
import {
  Button, Input, Skeleton,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Badge,
} from "@podoplus/ui";
import {
  usePurchases, useReceivePurchase, useCancelPurchase, usePurchase,
  VOUCHER_TYPE_LABEL, type Purchase, type PurchaseStatus, type PurchaseDetail,
} from "@/hooks/use-inventory";
import { useSuppliers } from "@/hooks/use-inventory";
import { CreatePurchaseModal } from "./CreatePurchaseModal";
import { cn } from "@/lib/utils";
import { Label } from "@podoplus/ui";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtMoney(v?: string | null, currency = "PEN") {
  if (!v) return currency === "USD" ? "US$ 0.00" : "S/ 0.00";
  const n = parseFloat(v).toLocaleString("es-PE", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  return currency === "USD" ? `US$ ${n}` : `S/ ${n}`;
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PurchaseStatus, {
  label: string; color: string; bg: string; icon: React.ElementType;
}> = {
  DRAFT:     { label: "Borrador",  color: "text-amber-700",  bg: "bg-amber-50 border-amber-200",  icon: Clock },
  RECEIVED:  { label: "Recibido",  color: "text-green-700",  bg: "bg-green-50 border-green-200",  icon: CheckCircle2 },
  CANCELLED: { label: "Cancelado", color: "text-gray-500",   bg: "bg-gray-100 border-gray-200",   icon: XCircle },
};

function StatusBadge({ status }: { status: PurchaseStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border",
      cfg.color, cfg.bg
    )}>
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  );
}

// ── Invoice-style detail modal ────────────────────────────────────────────────

function InfoCell({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">{label}</p>
      <p className={cn("text-sm font-medium", mono && "font-mono")}>{value ?? "—"}</p>
    </div>
  );
}

function PurchaseDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading } = usePurchase(id);
  const d = data as PurchaseDetail | undefined;
  const currency = d?.currency ?? "PEN";

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      {/* aria-describedby={undefined} suppresses the radix warning since we handle description inline */}
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0" aria-describedby={undefined}>

        {/* ── Invoice header ────────────────────────────── */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Orden de Compra
              </DialogTitle>
              {isLoading ? (
                <Skeleton className="h-4 w-48 mt-1.5" />
              ) : d ? (
                <p className="text-sm text-muted-foreground mt-0.5 font-mono">
                  {VOUCHER_TYPE_LABEL[d.voucher_type] ?? d.voucher_type} · {d.serie}-{d.number}
                </p>
              ) : null}
            </div>
            {!isLoading && d && (
              <div className="shrink-0">
                <StatusBadge status={d.status} />
              </div>
            )}
          </div>
        </DialogHeader>

        {/* ── Scrollable body ──────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {isLoading ? (
            <div className="space-y-4 py-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : d ? (
            <>
              {/* ── Supplier + Order info ────────────── */}
              <div className="grid grid-cols-2 gap-6">
                {/* Left: supplier */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <Building2 className="h-3.5 w-3.5" />
                    Proveedor
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3.5 space-y-2">
                    <p className="font-semibold text-sm">{d.supplier_name ?? "—"}</p>
                    {d.supplier && (
                      <>
                        {d.supplier.document_number && (
                          <p className="text-xs text-muted-foreground font-mono">{d.supplier.document_number}</p>
                        )}
                        {d.supplier.address && (
                          <p className="text-xs text-muted-foreground">{d.supplier.address}</p>
                        )}
                        {d.supplier.phone && (
                          <p className="text-xs text-muted-foreground">{d.supplier.phone}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Right: order metadata */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <FileText className="h-3.5 w-3.5" />
                    Documento
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3.5 grid grid-cols-2 gap-x-4 gap-y-3">
                    <InfoCell label="Tipo" value={VOUCHER_TYPE_LABEL[d.voucher_type] ?? d.voucher_type} />
                    <InfoCell label="Moneda" value={d.currency === "USD" ? "Dólares (USD)" : "Soles (PEN)"} />
                    <InfoCell label="Serie · Número" value={`${d.serie}-${d.number}`} mono />
                    <InfoCell label="Emisión" value={fmtDate(d.emission_date)} />
                    {d.due_date && <InfoCell label="Vencimiento" value={fmtDate(d.due_date)} />}
                    {d.received_at && <InfoCell label="Recibido" value={fmtDateTime(d.received_at)} />}
                  </div>
                </div>
              </div>

              {/* ── Items table ──────────────────────── */}
              {(d.items ?? []).length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
                    <Package className="h-3.5 w-3.5" />
                    Productos ({d.items.length} ítem{d.items.length !== 1 ? "s" : ""})
                  </div>
                  <div className="rounded-xl border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">#</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Producto</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Almacén</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Cant.</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">P. Unit.</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.items.map((item, idx) => (
                          <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5 text-muted-foreground">{idx + 1}</td>
                            <td className="px-4 py-2.5">
                              <p className="font-semibold">{item.product_name ?? "—"}</p>
                              {item.product_sku && (
                                <p className="text-muted-foreground font-mono text-[10px]">{item.product_sku}</p>
                              )}
                              {item.lot && (
                                <p className="text-muted-foreground text-[10px]">Lote: {item.lot}</p>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">{item.branch_name ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                              {parseFloat(item.quantity).toFixed(0)}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              {fmtMoney(item.unit_price, currency)}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                              {fmtMoney(item.total_amount, currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Totals ───────────────────────────── */}
              <div className="flex justify-end">
                <div className="w-64 rounded-xl border bg-muted/20 overflow-hidden">
                  <div className="px-4 py-2 border-b bg-muted/30">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Banknote className="h-3.5 w-3.5" />
                      Resumen
                    </p>
                  </div>
                  <div className="px-4 py-3 space-y-1.5 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal (sin IGV)</span>
                      <span className="tabular-nums font-mono">{fmtMoney(d.subtotal, currency)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>IGV (18%)</span>
                      <span className="tabular-nums font-mono">{fmtMoney(d.tax_amount, currency)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-2 mt-1 text-sm">
                      <span>Total</span>
                      <span className="tabular-nums text-primary">{fmtMoney(d.total_amount, currency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Notes + cancel reason ────────────── */}
              {(d.notes || d.cancel_reason) && (
                <div className="grid grid-cols-2 gap-4">
                  {d.notes && (
                    <div className="rounded-xl border bg-muted/20 p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        Observaciones
                      </p>
                      <p className="text-sm">{d.notes}</p>
                    </div>
                  )}
                  {d.cancel_reason && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 mb-1">
                        Motivo de cancelación
                      </p>
                      <p className="text-sm text-red-700">{d.cancel_reason}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Timestamps ───────────────────────── */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1 border-t">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Creado: {fmtDateTime(d.created_at)}
                </span>
                {d.received_at && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Recibido: {fmtDateTime(d.received_at)}
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">No se pudo cargar el detalle.</p>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/10 shrink-0">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Cancel modal ──────────────────────────────────────────────────────────────

function CancelPurchaseModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const cancel = useCancelPurchase();

  const handleCancel = async () => {
    try {
      await cancel.mutateAsync({ id, reason: reason.trim() || undefined });
      onClose();
    } catch { /* toasted */ }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Cancelar compra</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">
          Esta acción no se puede deshacer. El borrador pasará a estado <strong>Cancelado</strong>.
        </p>
        <div className="space-y-1.5 py-1">
          <Label className="text-xs">Motivo <span className="text-muted-foreground">(opcional)</span></Label>
          <Input
            placeholder="Ej. Compra registrada por error"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={cancel.isPending}>Volver</Button>
          <Button variant="destructive" onClick={handleCancel} disabled={cancel.isPending}>
            {cancel.isPending ? "Cancelando…" : "Confirmar cancelación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

const STATUS_TABS: Array<{ value: PurchaseStatus | "ALL"; label: string }> = [
  { value: "ALL",       label: "Todas" },
  { value: "DRAFT",     label: "Borrador" },
  { value: "RECEIVED",  label: "Recibidas" },
  { value: "CANCELLED", label: "Canceladas" },
];

export function PurchasesTab() {
  const [createOpen,     setCreateOpen]     = useState(false);
  const [statusFilter,   setStatusFilter]   = useState<PurchaseStatus | "ALL">("ALL");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [from,           setFrom]           = useState("");
  const [to,             setTo]             = useState("");
  const [cursor,         setCursor]         = useState<string | undefined>();
  const [stack,          setStack]          = useState<string[]>([]);
  const [detailId,       setDetailId]       = useState<string | null>(null);
  const [cancelId,       setCancelId]       = useState<string | null>(null);

  const receive = useReceivePurchase();
  const { data: suppliers } = useSuppliers();

  const { data, isLoading, isError, error } = usePurchases({
    supplierId: supplierFilter || undefined,
    status:     statusFilter === "ALL" ? undefined : statusFilter,
    from:       from || undefined,
    to:         to   || undefined,
    cursor,
    limit:      50,
  });

  const purchases  = data?.data ?? [];
  const hasNext    = data?.hasNext ?? false;
  const nextCursor = data?.nextCursor;
  const page       = stack.length + 1;

  const resetCursor = () => { setCursor(undefined); setStack([]); };
  const handleNext  = () => { if (!nextCursor) return; setStack((p) => [...p, cursor ?? ""]); setCursor(nextCursor); };
  const handlePrev  = () => { const s = [...stack]; const p = s.pop() ?? undefined; setStack(s); setCursor(p); };

  const hasFilters = !!from || !!to || !!supplierFilter;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Órdenes de compra · el stock se actualiza al <span className="font-medium text-foreground">recibir</span>
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nueva compra
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Status tabs */}
        <div className="flex rounded-lg border overflow-hidden text-xs">
          {STATUS_TABS.map((tab, i) => (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value); resetCursor(); }}
              className={cn(
                "px-3.5 py-1.5 font-medium transition-colors whitespace-nowrap",
                statusFilter === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground",
                i > 0 ? "border-l" : "",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <Select value={supplierFilter} onValueChange={(v) => { setSupplierFilter(v === "_all" ? "" : v); resetCursor(); }}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="Todos los proveedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos los proveedores</SelectItem>
              {(suppliers ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" className="w-36 h-8 text-xs" value={from} onChange={(e) => { setFrom(e.target.value); resetCursor(); }} title="Desde" />
          <Input type="date" className="w-36 h-8 text-xs" value={to}   onChange={(e) => { setTo(e.target.value);   resetCursor(); }} title="Hasta" />
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFrom(""); setTo(""); setSupplierFilter(""); resetCursor(); }}>
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        {isError ? (
          <div className="p-8 text-center text-sm text-destructive">
            Error: {(error as Error)?.message}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Comprobante</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Proveedor</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Emisión</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Ítems</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full rounded" /></td>
                        ))}
                      </tr>
                    ))
                  ) : purchases.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                          <ShoppingCart className="h-10 w-10 mb-3 opacity-20" />
                          <p className="font-medium text-foreground">Sin compras registradas</p>
                          <p className="text-sm mt-1">
                            {statusFilter !== "ALL" || hasFilters
                              ? "Prueba ajustando los filtros"
                              : "Registra la primera compra para actualizar el stock"}
                          </p>
                          {statusFilter === "ALL" && !hasFilters && (
                            <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
                              <Plus className="h-4 w-4 mr-1.5" /> Nueva compra
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    purchases.map((p) => (
                      <PurchaseRow
                        key={p.id}
                        purchase={p}
                        onView={() => setDetailId(p.id)}
                        onReceive={() => receive.mutate(p.id)}
                        onCancel={() => setCancelId(p.id)}
                        isReceiving={receive.isPending}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {(stack.length > 0 || hasNext) && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground bg-muted/20">
                <span className="text-xs">Página {page}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={stack.length === 0} onClick={handlePrev}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                  </Button>
                  <Button variant="outline" size="sm" disabled={!hasNext} onClick={handleNext}>
                    Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <CreatePurchaseModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {detailId && <PurchaseDetailModal id={detailId} onClose={() => setDetailId(null)} />}
      {cancelId  && <CancelPurchaseModal id={cancelId} onClose={() => setCancelId(null)} />}
    </>
  );
}

// ── Purchase row ──────────────────────────────────────────────────────────────

function PurchaseRow({
  purchase, onView, onReceive, onCancel, isReceiving,
}: {
  purchase:    Purchase;
  onView:      () => void;
  onReceive:   () => void;
  onCancel:    () => void;
  isReceiving: boolean;
}) {
  const isDraft    = purchase.status === "DRAFT";
  const cfg        = STATUS_CONFIG[purchase.status];

  return (
    <tr className="border-b hover:bg-muted/30 transition-colors group">
      <td className="px-4 py-3">
        <p className="font-semibold text-xs">{VOUCHER_TYPE_LABEL[purchase.voucher_type] ?? purchase.voucher_type}</p>
        <p className="text-muted-foreground text-xs font-mono">{purchase.serie}-{purchase.number}</p>
      </td>
      <td className="px-4 py-3 text-sm font-medium">{purchase.supplier_name ?? "—"}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {new Date(purchase.emission_date).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" })}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={purchase.status} />
      </td>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-muted text-xs font-semibold tabular-nums">
          {purchase.items_count}
        </span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums font-semibold text-sm">
        {purchase.currency === "USD" ? "US$ " : "S/ "}
        {parseFloat(purchase.total_amount ?? "0").toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={onView}>
            <Eye className="h-3.5 w-3.5" /> Ver
          </Button>
          {isDraft && (
            <>
              <Button
                size="sm" variant="ghost"
                className="h-7 text-xs gap-1 text-green-700 hover:text-green-800 hover:bg-green-50"
                onClick={onReceive}
                disabled={isReceiving}
              >
                <PackagePlus className="h-3.5 w-3.5" /> Recibir
              </Button>
              <Button
                size="sm" variant="ghost"
                className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onCancel}
              >
                <Ban className="h-3.5 w-3.5" /> Cancelar
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

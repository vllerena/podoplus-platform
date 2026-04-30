import { useState } from "react";
import {
  TrendingUp, ShoppingCart, Ban, RotateCcw,
  Plus, ChevronRight, ChevronLeft, Award, Monitor,
} from "lucide-react";
import {
  Button, Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue, Skeleton,
} from "@podoplus/ui";
import {
  useSales, useSaleStats, type Sale, type SaleStatus,
} from "@/hooks/use-sales";
import { useBranchContext }     from "@/hooks/use-branch-context";
import { SaleRow }              from "./components/SaleRow";
import { VoidModal }            from "./components/VoidModal";
import { RefundModal }          from "./components/RefundModal";
import { NewSaleModal }         from "./components/NewSaleModal";
import { PosModal }             from "./components/PosModal";
import { SaleSuccessModal }     from "./components/SaleSuccessModal";
import { STATUS_LABEL, STATUS_COLOR, fmt } from "@/lib/sale-helpers";

// ── Date helpers ──────────────────────────────────────────────────────────────

function today()         { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const DATE_RANGES = [
  { label: "Hoy",      from: today(),     to: today() },
  { label: "7 días",   from: daysAgo(6),  to: today() },
  { label: "30 días",  from: daysAgo(29), to: today() },
  {
    label: "Este mes",
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    to: today(),
  },
];

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, loading }: {
  label:   string;
  value:   string;
  icon:    React.ReactNode;
  color:   string;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        {loading
          ? <Skeleton className="h-5 w-24 mt-1" />
          : <p className="text-lg font-bold">{value}</p>
        }
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SalesPage() {
  const { activeBranchId } = useBranchContext();

  // Filters / pagination
  const [rangeIdx,     setRangeIdx]     = useState(0);
  const [statusFilter, setStatusFilter] = useState<SaleStatus | "ALL">("ALL");
  const [cursor,       setCursor]       = useState<string | undefined>(undefined);
  const [cursorStack,  setCursorStack]  = useState<string[]>([]);

  // Modal states
  const [newSaleOpen,  setNewSaleOpen]  = useState(false);
  const [posOpen,      setPosOpen]      = useState(false);
  const [voidTarget,   setVoidTarget]   = useState<Sale | null>(null);
  const [refundTarget, setRefundTarget] = useState<Sale | null>(null);
  const [successSale,  setSuccessSale]  = useState<Sale | null>(null);

  const range = DATE_RANGES[rangeIdx];

  const { data: salesData, isLoading, isError, error } = useSales({
    branchId: activeBranchId ?? "",
    from:     range.from,
    to:       range.to,
    status:   statusFilter === "ALL" ? undefined : statusFilter as SaleStatus,
    cursor,
    limit:    50,
  });

  const { data: stats, isLoading: statsLoading } = useSaleStats(
    activeBranchId ?? "",
    range.from,
    range.to,
  );

  const sales      = salesData?.data ?? [];
  const nextCursor = salesData?.nextCursor;
  const hasNext    = salesData?.hasNext ?? false;
  const page       = cursorStack.length + 1;

  function handleNextPage() {
    if (!nextCursor) return;
    setCursorStack(prev => [...prev, cursor ?? ""]);
    setCursor(nextCursor);
  }
  function handlePrevPage() {
    const stack = [...cursorStack];
    const prev  = stack.pop() ?? undefined;
    setCursorStack(stack);
    setCursor(prev);
  }

  function handleSaleSuccess(sale: Sale) {
    setSuccessSale(sale);
  }

  const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
    { value: "ALL",      label: "Todos los estados" },
    { value: "PAID",     label: STATUS_LABEL.PAID },
    { value: "PENDING",  label: STATUS_LABEL.PENDING },
    { value: "VOIDED",   label: STATUS_LABEL.VOIDED },
    { value: "REFUNDED", label: STATUS_LABEL.REFUNDED },
  ];

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ventas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registro y seguimiento de comprobantes electrónicos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPosOpen(true)}
            className="gap-2"
          >
            <Monitor className="h-4 w-4" />
            POS
          </Button>
          <Button size="sm" onClick={() => setNewSaleOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva venta
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date range */}
        <div className="flex rounded-md border overflow-hidden">
          {DATE_RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => { setRangeIdx(i); setCursor(undefined); setCursorStack([]); }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                i === rangeIdx
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              } ${i > 0 ? "border-l" : ""}`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Status */}
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as SaleStatus | "ALL");
            setCursor(undefined);
            setCursorStack([]);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      {activeBranchId && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Ingresos netos"
              value={fmt(stats?.net_revenue ?? 0)}
              icon={<TrendingUp className="h-5 w-5 text-green-600" />}
              color="bg-green-50"
              loading={statsLoading}
            />
            <StatCard
              label="Ventas pagadas"
              value={String(stats?.total_sales ?? 0)}
              icon={<ShoppingCart className="h-5 w-5 text-blue-600" />}
              color="bg-blue-50"
              loading={statsLoading}
            />
            <StatCard
              label="Anuladas"
              value={String(stats?.voided_count ?? 0)}
              icon={<Ban className="h-5 w-5 text-red-500" />}
              color="bg-red-50"
              loading={statsLoading}
            />
            <StatCard
              label="Reembolsado"
              value={fmt(stats?.total_refunded ?? 0)}
              icon={<RotateCcw className="h-5 w-5 text-purple-600" />}
              color="bg-purple-50"
              loading={statsLoading}
            />
          </div>

          {/* Top items */}
          {!statsLoading &&
            ((stats?.top_services?.length ?? 0) > 0 ||
             (stats?.top_products?.length ?? 0)  > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(stats?.top_services?.length ?? 0) > 0 && (
                <div className="rounded-xl border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
                    <Award className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Top servicios</h3>
                  </div>
                  <ul className="divide-y">
                    {stats!.top_services.map((s, i) => (
                      <li key={s.service_id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{i + 1}</span>
                        <span className="flex-1 text-sm truncate">{s.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{s.count}x</span>
                        <span className="text-sm font-semibold shrink-0">{fmt(s.revenue)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(stats?.top_products?.length ?? 0) > 0 && (
                <div className="rounded-xl border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
                    <Award className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Top productos</h3>
                  </div>
                  <ul className="divide-y">
                    {stats!.top_products.map((p, i) => (
                      <li key={p.product_id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{i + 1}</span>
                        <span className="flex-1 text-sm truncate">{p.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{p.count}x</span>
                        <span className="text-sm font-semibold shrink-0">{fmt(p.revenue)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {!activeBranchId ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ShoppingCart className="h-10 w-10 mb-3 opacity-30" />
            <p className="font-medium">Selecciona una sede</p>
            <p className="text-sm mt-1">Usa el selector de sede en la barra superior</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-destructive">
            Error: {(error as Error)?.message}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Emisión</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Cliente</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Número</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Estado</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs">T.Gravado</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs">T.IGV</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs">Saldo</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs">Docs / Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <Skeleton className="h-4 w-full" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : sales.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                          <ShoppingCart className="h-10 w-10 mb-3 opacity-30" />
                          <p className="font-medium">Sin ventas en este período</p>
                          <div className="flex gap-2 mt-4">
                            <Button variant="outline" size="sm" onClick={() => setPosOpen(true)}>
                              <Monitor className="h-4 w-4 mr-2" />
                              Abrir POS
                            </Button>
                            <Button size="sm" onClick={() => setNewSaleOpen(true)}>
                              <Plus className="h-4 w-4 mr-2" />
                              Nueva venta
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sales.map(sale => (
                      <SaleRow
                        key={sale.id}
                        sale={sale}
                        onVoid={setVoidTarget}
                        onRefund={setRefundTarget}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {(cursorStack.length > 0 || hasNext) && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                <span>Página {page}</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline" size="sm"
                    disabled={cursorStack.length === 0}
                    onClick={handlePrevPage}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    disabled={!hasNext}
                    onClick={handleNextPage}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <VoidModal
        sale={voidTarget}
        onClose={() => setVoidTarget(null)}
      />
      <RefundModal
        sale={refundTarget}
        onClose={() => setRefundTarget(null)}
      />
      <NewSaleModal
        open={newSaleOpen}
        onClose={() => setNewSaleOpen(false)}
        onSuccess={handleSaleSuccess}
      />
      <PosModal
        open={posOpen}
        onClose={() => setPosOpen(false)}
        onSuccess={handleSaleSuccess}
      />
      <SaleSuccessModal
        sale={successSale}
        onClose={() => setSuccessSale(null)}
      />
    </div>
  );
}

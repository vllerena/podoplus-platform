import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Lock, DollarSign, TrendingUp, TrendingDown,
  Wallet, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2,
  Calendar, User, Clock, FileText, ArrowDownCircle, ArrowUpCircle,
} from "lucide-react";
import { Button, Skeleton } from "@podoplus/ui";
import {
  useRegister, useRegisterSummary, useMovements,
  type MovementType,
} from "@/hooks/use-cash-register";
import { CloseRegisterModal }  from "./components/CloseRegisterModal";
import { ManualMovementModal } from "./components/ManualMovementModal";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v?: string | null) {
  if (v === null || v === undefined) return "—";
  return `S/ ${parseFloat(v).toFixed(2)}`;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDateOnly(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtTimeOnly(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("es-PE", {
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, icon: Icon, iconBg, valueColor,
}: {
  label:      string;
  value:      string;
  sub?:       string;
  icon:       React.ElementType;
  iconBg:     string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-start gap-3">
      <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", iconBg)}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className={cn("text-xl font-bold tracking-tight mt-0.5 tabular-nums", valueColor)}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: {
  icon:  React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b last:border-b-0">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide leading-none mb-0.5">{label}</p>
        <p className="text-xs font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function CashRegisterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [typeFilter,  setTypeFilter]  = useState<MovementType | "ALL">("ALL");
  const [cursor,      setCursor]      = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const [closeModal,    setCloseModal]    = useState(false);
  const [movementModal, setMovementModal] = useState(false);

  const { data: register, isLoading: regLoading, isError: regError } = useRegister(id!);
  const { data: summary,  isLoading: sumLoading  } = useRegisterSummary(id!);

  const { data: movData, isLoading: movLoading } = useMovements({
    registerId: id!,
    type:       typeFilter === "ALL" ? undefined : typeFilter,
    cursor,
    limit:      50,
  });

  const movements  = movData?.data ?? [];
  const nextCursor = movData?.nextCursor;
  const hasNext    = movData?.hasNext ?? false;
  const page       = cursorStack.length + 1;

  const handleNextPage = () => {
    if (!nextCursor) return;
    setCursorStack((prev) => [...prev, cursor ?? ""]);
    setCursor(nextCursor);
  };
  const handlePrevPage = () => {
    const stack = [...cursorStack];
    const prev  = stack.pop() ?? undefined;
    setCursorStack(stack);
    setCursor(prev);
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (regLoading) {
    return (
      <div className="p-6 space-y-5 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="h-64 rounded-xl" />
          <div className="lg:col-span-2"><Skeleton className="h-64 rounded-xl" /></div>
        </div>
      </div>
    );
  }

  if (regError || !register) {
    return (
      <div className="p-6 text-center">
        <p className="text-destructive font-medium">Caja no encontrada.</p>
        <Button variant="ghost" className="mt-3" onClick={() => navigate("/cash-register")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver al listado
        </Button>
      </div>
    );
  }

  const isOpen = register.status === "OPEN";
  const diff   = summary?.difference !== null && summary?.difference !== undefined
    ? parseFloat(summary.difference!)
    : null;

  const totalIn  = parseFloat(register.total_in  ?? summary?.total_in  ?? "0");
  const totalOut = parseFloat(register.total_out ?? summary?.total_out ?? "0");

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 rounded-full shrink-0 mt-0.5"
            onClick={() => navigate("/cash-register")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight">
                Caja — {register.branch_name ?? register.branch_id}
              </h1>
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                isOpen
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              )}>
                {isOpen ? (
                  <><span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> Abierta</>
                ) : (
                  <><Lock className="h-3 w-3" /> Cerrada</>
                )}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              #{register.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>

        {isOpen && (
          <div className="flex gap-2 sm:shrink-0">
            <Button size="sm" variant="outline" onClick={() => setMovementModal(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Movimiento
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setCloseModal(true)}>
              <Lock className="h-4 w-4 mr-1.5" />
              Cerrar caja
            </Button>
          </div>
        )}
      </div>

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Balance actual"
          value={fmt(register.current_balance)}
          sub={isOpen ? "Tiempo real" : "Al cierre"}
          icon={Wallet}
          iconBg="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <MetricCard
          label="Saldo inicial"
          value={fmt(register.opening_balance)}
          sub="Al aperturar"
          icon={DollarSign}
          iconBg="bg-muted text-muted-foreground"
        />
        <MetricCard
          label="Total ingresos"
          value={fmt(register.total_in ?? summary?.total_in)}
          sub={`${summary?.movements_in_count ?? 0} movimientos`}
          icon={TrendingUp}
          iconBg="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          valueColor="text-green-600 dark:text-green-400"
        />
        <MetricCard
          label="Total egresos"
          value={fmt(register.total_out ?? summary?.total_out)}
          sub={`${summary?.movements_out_count ?? 0} movimientos`}
          icon={TrendingDown}
          iconBg="bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400"
          valueColor="text-red-500 dark:text-red-400"
        />
      </div>

      {/* ── Main content: info panel + movements ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* Left: info + cuadre */}
        <div className="space-y-4">

          {/* Register info card */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Información
            </h3>
            <div>
              <InfoRow
                icon={User}
                label="Aperturado por"
                value={register.opened_by?.name ?? "—"}
              />
              <InfoRow
                icon={Calendar}
                label="Fecha de apertura"
                value={
                  <span>
                    {fmtDateOnly(register.opened_at)}{" "}
                    <span className="text-muted-foreground font-normal">
                      {fmtTimeOnly(register.opened_at)}
                    </span>
                  </span>
                }
              />
              {!isOpen && register.closed_by && (
                <>
                  <InfoRow
                    icon={User}
                    label="Cerrado por"
                    value={register.closed_by.name}
                  />
                  <InfoRow
                    icon={Clock}
                    label="Fecha de cierre"
                    value={
                      <span>
                        {fmtDateOnly(register.closed_at)}{" "}
                        <span className="text-muted-foreground font-normal">
                          {fmtTimeOnly(register.closed_at)}
                        </span>
                      </span>
                    }
                  />
                </>
              )}
              {register.notes && (
                <InfoRow
                  icon={FileText}
                  label="Notas"
                  value={register.notes}
                />
              )}
            </div>
          </div>

          {/* Cuadre de caja (closed only) */}
          {!isOpen && (
            <div className={cn(
              "rounded-xl border-2 p-4 space-y-3",
              diff === null          ? "border-border" :
              diff === 0             ? "border-green-400 bg-green-50/40 dark:bg-green-950/20" :
              diff > 0               ? "border-blue-400 bg-blue-50/40 dark:bg-blue-950/20" :
                                       "border-red-400 bg-red-50/40 dark:bg-red-950/20"
            )}>
              {sumLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : summary ? (
                <>
                  <div className="flex items-center gap-2">
                    {diff === 0
                      ? <CheckCircle2 className="h-4.5 w-4.5 text-green-600" />
                      : <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
                    }
                    <h3 className="text-sm font-semibold">Cuadre de caja</h3>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1.5 border-b">
                      <span className="text-muted-foreground">Balance sistema</span>
                      <span className="font-semibold tabular-nums">{fmt(summary.system_balance)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b">
                      <span className="text-muted-foreground">Balance reportado</span>
                      <span className="font-semibold tabular-nums">{fmt(summary.closing_balance_reported)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-muted-foreground">Diferencia</span>
                      <span className={cn(
                        "font-bold text-sm tabular-nums",
                        diff === null  ? "text-foreground" :
                        diff === 0     ? "text-green-600" :
                        diff > 0       ? "text-blue-600"  : "text-red-500"
                      )}>
                        {diff !== null
                          ? `${diff >= 0 ? "+" : ""}S/ ${Math.abs(diff).toFixed(2)}`
                          : "—"
                        }
                      </span>
                    </div>
                  </div>

                  {diff !== null && (
                    <p className={cn(
                      "text-xs font-medium rounded-md px-2.5 py-1.5 text-center",
                      diff === 0
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : diff > 0
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    )}>
                      {diff === 0 ? "✓ Sin diferencia" : diff > 0 ? "Sobrante en caja" : "Faltante en caja"}
                    </p>
                  )}
                </>
              ) : null}
            </div>
          )}

          {/* Net flow card */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Flujo neto
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                {(totalIn + totalOut) > 0 && (
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${(totalIn / (totalIn + totalOut)) * 100}%` }}
                  />
                )}
              </div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                Ingresos
              </span>
              <span className="flex items-center gap-1">
                Egresos
                <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" />
              </span>
            </div>
            <div className="mt-3 pt-3 border-t flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Neto del período</span>
              <span className={cn(
                "text-sm font-bold tabular-nums",
                (totalIn - totalOut) >= 0 ? "text-green-600" : "text-red-500"
              )}>
                {(totalIn - totalOut) >= 0 ? "+" : ""}S/ {Math.abs(totalIn - totalOut).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: movements table */}
        <div className="lg:col-span-2 rounded-xl border bg-card overflow-hidden">
          {/* Table header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b gap-3">
            <h2 className="text-sm font-semibold">Movimientos</h2>
            <div className="flex rounded-lg border overflow-hidden text-xs shrink-0">
              {(["ALL", "IN", "OUT"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTypeFilter(t); setCursor(undefined); setCursorStack([]); }}
                  className={cn(
                    "px-3 py-1.5 font-medium transition-colors whitespace-nowrap",
                    typeFilter === t
                      ? t === "IN"  ? "bg-green-600 text-white"
                      : t === "OUT" ? "bg-red-500 text-white"
                      :               "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground",
                    t !== "ALL" ? "border-l" : ""
                  )}
                >
                  {t === "ALL" ? "Todos" : t === "IN" ? "Ingresos" : "Egresos"}
                </button>
              ))}
            </div>
          </div>

          {/* Table body */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground w-28">Tipo</th>
                  <th className="px-5 py-2.5 text-right text-xs font-medium text-muted-foreground w-32">Monto</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground">Motivo</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground w-36">Registrado por</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground w-36">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {movLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-5 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                          <DollarSign className="h-6 w-6 opacity-40" />
                        </div>
                        <p className="text-sm font-medium">Sin movimientos</p>
                        <p className="text-xs mt-1 text-muted-foreground/70">
                          {typeFilter !== "ALL"
                            ? `No hay ${typeFilter === "IN" ? "ingresos" : "egresos"} registrados`
                            : "No se han registrado movimientos aún"
                          }
                        </p>
                        {isOpen && typeFilter === "ALL" && (
                          <Button
                            size="sm" variant="outline" className="mt-4"
                            onClick={() => setMovementModal(true)}
                          >
                            <Plus className="h-4 w-4 mr-1.5" />
                            Registrar movimiento
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => {
                    const isIn = m.type === "IN";
                    return (
                      <tr key={m.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                            isIn
                              ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                          )}>
                            {isIn
                              ? <ArrowDownCircle className="h-3.5 w-3.5" />
                              : <ArrowUpCircle   className="h-3.5 w-3.5" />
                            }
                            {isIn ? "Ingreso" : "Egreso"}
                          </span>
                        </td>
                        <td className={cn(
                          "px-5 py-3 text-right font-semibold tabular-nums",
                          isIn ? "text-green-600" : "text-red-500"
                        )}>
                          {isIn ? "+" : "−"}S/ {parseFloat(m.amount).toFixed(2)}
                        </td>
                        <td className="px-5 py-3 text-sm text-muted-foreground max-w-xs">
                          <span className="line-clamp-2">{m.reason}</span>
                        </td>
                        <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {m.created_by.name}
                        </td>
                        <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          <div>{fmtDateOnly(m.created_at)}</div>
                          <div className="text-muted-foreground/60">{fmtTimeOnly(m.created_at)}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {(cursorStack.length > 0 || hasNext) && (
            <div className="flex items-center justify-between px-5 py-3 border-t text-xs text-muted-foreground bg-muted/20">
              <span>Página {page}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  disabled={cursorStack.length === 0}
                  onClick={handlePrevPage}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={!hasNext}
                  onClick={handleNextPage}
                >
                  Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {closeModal && (
        <CloseRegisterModal
          register={register}
          open={closeModal}
          onClose={() => setCloseModal(false)}
        />
      )}
      {movementModal && (
        <ManualMovementModal
          registerId={register.id}
          open={movementModal}
          onClose={() => setMovementModal(false)}
        />
      )}
    </div>
  );
}

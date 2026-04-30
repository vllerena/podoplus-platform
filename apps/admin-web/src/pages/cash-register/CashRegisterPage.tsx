import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DollarSign, TrendingUp, TrendingDown, ChevronRight, ChevronLeft,
  Plus, LockOpen, Lock, Clock, ArrowUpRight, ArrowDownRight,
  BarChart3, Wallet,
} from "lucide-react";
import {
  Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton,
} from "@podoplus/ui";
import { useBranchContext } from "@/hooks/use-branch-context";
import { useOpenRegister, useRegisters, type CashRegister } from "@/hooks/use-cash-register";
import { OpenRegisterModal }  from "./components/OpenRegisterModal";
import { CloseRegisterModal } from "./components/CloseRegisterModal";
import { ManualMovementModal } from "./components/ManualMovementModal";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v?: string | null) {
  if (!v) return "S/ 0.00";
  return `S/ ${parseFloat(v).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

// ── Open register panel ───────────────────────────────────────────────────────

function OpenRegisterPanel({
  register,
  onAddMovement,
  onClose,
}: {
  register: CashRegister;
  onAddMovement: () => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const totalIn  = parseFloat(register.total_in  ?? "0");
  const totalOut = parseFloat(register.total_out ?? "0");
  const balance  = parseFloat(register.current_balance ?? "0");

  return (
    <div className="rounded-xl border-2 border-green-400/50 bg-gradient-to-br from-green-50 to-emerald-50/30 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-green-200/60 bg-green-500/5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          <span className="text-sm font-semibold text-green-800">Caja abierta</span>
          <span className="text-xs text-green-700/70">desde {fmtDate(register.opened_at)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 bg-white/80" onClick={onAddMovement}>
            <Plus className="h-3.5 w-3.5" />
            Movimiento
          </Button>
          <Button
            size="sm" variant="outline"
            className="h-7 text-xs gap-1 bg-white/80"
            onClick={() => navigate(`/cash-register/${register.id}`)}
          >
            Ver detalle
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs gap-1 bg-red-600 hover:bg-red-700 text-white border-0"
            onClick={onClose}
          >
            <Lock className="h-3.5 w-3.5" />
            Cerrar caja
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 divide-x divide-green-200/60 px-0">
        {/* Balance actual — highlight */}
        <div className="col-span-1 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-green-700/70 mb-1">
            Balance actual
          </p>
          <p className="text-3xl font-bold text-green-900 tabular-nums leading-tight">
            {fmt(register.current_balance)}
          </p>
          <p className="text-[10px] text-green-700/60 mt-1">En tiempo real</p>
        </div>

        {/* Saldo inicial */}
        <div className="px-5 py-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-white/70 border border-green-200/80 flex items-center justify-center shrink-0">
            <Wallet className="h-4 w-4 text-green-700" />
          </div>
          <div>
            <p className="text-[10px] text-green-700/70 font-medium">Saldo inicial</p>
            <p className="text-base font-bold tabular-nums text-green-900">{fmt(register.opening_balance)}</p>
          </div>
        </div>

        {/* Ingresos */}
        <div className="px-5 py-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-white/70 border border-green-200/80 flex items-center justify-center shrink-0">
            <ArrowDownRight className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] text-green-700/70 font-medium">Ingresos</p>
            <p className="text-base font-bold tabular-nums text-emerald-700">+{fmt(register.total_in)}</p>
          </div>
        </div>

        {/* Egresos */}
        <div className="px-5 py-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-white/70 border border-green-200/80 flex items-center justify-center shrink-0">
            <ArrowUpRight className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <p className="text-[10px] text-green-700/70 font-medium">Egresos</p>
            <p className="text-base font-bold tabular-nums text-red-600">-{fmt(register.total_out)}</p>
          </div>
        </div>
      </div>

      {register.opened_by && (
        <div className="px-5 py-2 border-t border-green-200/60 bg-green-500/5">
          <p className="text-[10px] text-green-700/60">
            Abierta por <span className="font-semibold">{register.opened_by.name}</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ── History row ───────────────────────────────────────────────────────────────

function RegisterRow({ register }: { register: CashRegister }) {
  const navigate = useNavigate();
  const isOpen = register.status === "OPEN";
  const diff   = register.difference !== null && register.difference !== undefined
    ? parseFloat(register.difference)
    : null;

  return (
    <tr
      className="border-b hover:bg-muted/30 transition-colors cursor-pointer group"
      onClick={() => navigate(`/cash-register/${register.id}`)}
    >
      {/* Estado */}
      <td className="px-4 py-3">
        <span className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
          isOpen
            ? "bg-green-100 text-green-700"
            : "bg-gray-100 text-gray-500"
        )}>
          {isOpen
            ? <><span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />Abierta</>
            : <><Lock className="h-3 w-3" />Cerrada</>
          }
        </span>
      </td>

      {/* Apertura */}
      <td className="px-4 py-3">
        <p className="text-sm font-medium">{fmtDateShort(register.opened_at)}</p>
        <p className="text-[10px] text-muted-foreground">
          {new Date(register.opened_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </td>

      {/* Cierre */}
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {register.closed_at ? (
          <>
            <p className="text-sm font-medium text-foreground">{fmtDateShort(register.closed_at)}</p>
            <p className="text-[10px] text-muted-foreground">
              {new Date(register.closed_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </>
        ) : (
          <span className="text-green-600 text-xs font-medium">En curso</span>
        )}
      </td>

      {/* Saldo inicial */}
      <td className="px-4 py-3 text-sm tabular-nums">{fmt(register.opening_balance)}</td>

      {/* Saldo reportado */}
      <td className="px-4 py-3 text-sm tabular-nums text-muted-foreground">
        {register.closing_balance_reported ? fmt(register.closing_balance_reported) : "—"}
      </td>

      {/* Diferencia */}
      <td className="px-4 py-3 text-sm">
        {diff !== null ? (
          <span className={cn(
            "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
            diff === 0
              ? "bg-green-100 text-green-700"
              : diff > 0
                ? "bg-blue-100 text-blue-700"
                : "bg-red-100 text-red-600"
          )}>
            {diff >= 0 ? "+" : ""}S/ {Math.abs(diff).toFixed(2)}
          </span>
        ) : "—"}
      </td>

      {/* Responsable */}
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {register.opened_by?.name ?? "—"}
      </td>

      {/* Arrow */}
      <td className="px-4 py-3 text-right">
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors inline" />
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function CashRegisterPage() {
  const { activeBranchId, activeBranchName } = useBranchContext();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [cursor,       setCursor]       = useState<string | undefined>(undefined);
  const [cursorStack,  setCursorStack]  = useState<string[]>([]);

  const [openModal,     setOpenModal]     = useState(false);
  const [closeModal,    setCloseModal]    = useState(false);
  const [movementModal, setMovementModal] = useState(false);

  const { data: openData, isLoading: openLoading } = useOpenRegister(activeBranchId ?? "");
  const openRegister = openData?.open ? openData.register : null;

  const { data: listData, isLoading: listLoading, isError } = useRegisters({
    branchId: activeBranchId ?? "",
    status:   statusFilter === "ALL" ? undefined : statusFilter,
    cursor,
    limit:    20,
  });

  const registers  = listData?.data ?? [];
  const nextCursor = listData?.nextCursor;
  const hasNext    = listData?.hasNext ?? false;
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

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Caja</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Apertura, cierre y movimientos por sede
          </p>
        </div>
        {activeBranchId && !openRegister && !openLoading && (
          <Button onClick={() => setOpenModal(true)} className="gap-2">
            <LockOpen className="h-4 w-4" />
            Abrir caja
          </Button>
        )}
      </div>

      {/* ── No branch ───────────────────────────────────────────── */}
      {!activeBranchId && (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground rounded-xl border border-dashed">
          <div className="h-14 w-14 rounded-xl bg-muted/50 flex items-center justify-center mb-4">
            <DollarSign className="h-7 w-7 opacity-40" />
          </div>
          <p className="font-semibold text-foreground">Selecciona una sede</p>
          <p className="text-sm mt-1">Usa el selector de sede en la barra superior</p>
        </div>
      )}

      {/* ── Open register loading skeleton ──────────────────────── */}
      {activeBranchId && openLoading && (
        <div className="rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-44" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-7 w-28" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        </div>
      )}

      {/* ── Open register panel ──────────────────────────────────── */}
      {activeBranchId && !openLoading && openRegister && (
        <OpenRegisterPanel
          register={openRegister}
          onAddMovement={() => setMovementModal(true)}
          onClose={() => setCloseModal(true)}
        />
      )}

      {/* ── No open register ─────────────────────────────────────── */}
      {activeBranchId && !openLoading && !openRegister && (
        <div className="rounded-xl border border-dashed px-5 py-4 flex items-center gap-4 text-muted-foreground">
          <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5 opacity-60" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Sin caja abierta</p>
            <p className="text-xs mt-0.5">Abre una caja para registrar movimientos e ingresos</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setOpenModal(true)} className="gap-1.5 shrink-0">
            <LockOpen className="h-4 w-4" />
            Abrir caja
          </Button>
        </div>
      )}

      {/* ── History ──────────────────────────────────────────────── */}
      {activeBranchId && (
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          {/* Table header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Historial de cajas</h2>
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => { setStatusFilter(v); setCursor(undefined); setCursorStack([]); }}
            >
              <SelectTrigger className="w-38 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value="OPEN">Abiertas</SelectItem>
                <SelectItem value="CLOSED">Cerradas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isError ? (
            <div className="p-8 text-center text-sm text-destructive">
              Error al cargar el historial.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Apertura</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Cierre</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Saldo inicial</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Saldo reportado</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Diferencia</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Responsable</th>
                      <th className="px-4 py-2.5 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {listLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b">
                          {Array.from({ length: 8 }).map((_, j) => (
                            <td key={j} className="px-4 py-3">
                              <Skeleton className="h-4 w-full" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : registers.length === 0 ? (
                      <tr>
                        <td colSpan={8}>
                          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                            <DollarSign className="h-9 w-9 mb-3 opacity-20" />
                            <p className="font-medium text-foreground text-sm">Sin cajas en el historial</p>
                            <p className="text-xs mt-1">
                              {statusFilter !== "ALL" ? "Prueba cambiando el filtro de estado" : "Abre la primera caja para comenzar"}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      registers.map((r) => <RegisterRow key={r.id} register={r} />)
                    )}
                  </tbody>
                </table>
              </div>

              {(cursorStack.length > 0 || hasNext) && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
                  <span className="text-xs text-muted-foreground">Página {page}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={cursorStack.length === 0} onClick={handlePrevPage}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={!hasNext} onClick={handleNextPage}>
                      Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────── */}
      {openModal && activeBranchId && (
        <OpenRegisterModal
          branchId={activeBranchId}
          branchName={activeBranchName ?? ""}
          open={openModal}
          onClose={() => setOpenModal(false)}
        />
      )}
      {closeModal && openRegister && (
        <CloseRegisterModal
          register={openRegister}
          open={closeModal}
          onClose={() => setCloseModal(false)}
        />
      )}
      {movementModal && openRegister && (
        <ManualMovementModal
          registerId={openRegister.id}
          open={movementModal}
          onClose={() => setMovementModal(false)}
        />
      )}
    </div>
  );
}

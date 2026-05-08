import { useNavigate } from "react-router-dom";
import {
  CalendarDays, Plus, UserPlus, ShoppingCart,
  CheckCircle2, RotateCcw, XCircle, Clock,
  Receipt, CreditCard, Banknote, Smartphone, Wallet,
  TrendingUp, Users, Building2, RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Button, Skeleton } from "@podoplus/ui";
import { cn } from "@/lib/utils";
import { useAuthStore }      from "@/stores/auth.store";
import { useBranchStore }    from "@/stores/branch.store";
import { useBranchDashboard, type BranchDashboard } from "@/hooks/use-branches";
import { useBranches }       from "@/hooks/use-branches";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);
}

function fmtDate() {
  return new Date().toLocaleDateString("es-PE", {
    weekday: "long", day: "numeric", month: "long",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────

// ── Acciones rápidas ──────────────────────────────────────────────────────────

function QuickActions() {
  const navigate = useNavigate();
  const actions = [
    { label: "Ver calendario",    icon: <CalendarDays size={18} />, path: "/calendar",     bg: "bg-blue-50   hover:bg-blue-100",    border: "border-blue-200",   text: "text-blue-700"   },
    { label: "Nueva cita",        icon: <Plus size={18} />,         path: "/appointments", bg: "bg-violet-50 hover:bg-violet-100",  border: "border-violet-200", text: "text-violet-700" },
    { label: "Nuevo cliente",     icon: <UserPlus size={18} />,     path: "/customers",    bg: "bg-emerald-50 hover:bg-emerald-100",border: "border-emerald-200",text: "text-emerald-700"},
    { label: "Registrar venta",   icon: <ShoppingCart size={18} />, path: "/sales",        bg: "bg-orange-50  hover:bg-orange-100", border: "border-orange-200", text: "text-orange-700" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {actions.map(({ label, icon, path, bg, border, text }) => (
        <button
          key={label}
          onClick={() => navigate(path)}
          className={cn(
            "flex flex-col sm:flex-row items-center gap-2",
            "px-4 py-4 sm:py-3 rounded-xl border font-medium text-sm transition-colors",
            bg, border, text,
          )}
        >
          <span className="shrink-0">{icon}</span>
          <span className="text-center sm:text-left leading-tight">{label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
    </div>
  );
}

// ── Cards de citas ────────────────────────────────────────────────────────────

function ApptStatsBlock({ d }: { d: BranchDashboard }) {
  const a = d.appointments;
  const pctCompleted = a.total > 0 ? Math.round((a.completed / a.total) * 100) : 0;
  const cancelled    = a.cancelled + a.no_show;

  const cards = [
    {
      label:   "Citas hoy",
      value:   a.total,
      icon:    <Clock size={18} className="text-blue-600" />,
      bg:      "bg-blue-50",
      text:    "text-blue-700",
      subtext: "Total agendadas",
    },
    {
      label:   "Completadas",
      value:   a.completed,
      icon:    <CheckCircle2 size={18} className="text-green-600" />,
      bg:      "bg-green-50",
      text:    "text-green-700",
      subtext: a.total > 0 ? `${pctCompleted}% del total` : "—",
    },
    {
      label:   "Reagendadas",
      value:   a.rescheduled,
      icon:    <RotateCcw size={18} className="text-indigo-600" />,
      bg:      "bg-indigo-50",
      text:    "text-indigo-700",
      subtext: "Reprogramadas hoy",
    },
    {
      label:   "Canceladas / No asistió",
      value:   cancelled,
      icon:    <XCircle size={18} className="text-red-500" />,
      bg:      "bg-red-50",
      text:    "text-red-600",
      subtext: "Incluye no asistencias",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, icon, bg, text, subtext }) => (
        <div key={label} className="bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", bg)}>
            {icon}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-3xl font-bold mt-0.5", text)}>{value}</p>
            {subtext && <p className="text-[11px] text-muted-foreground mt-1">{subtext}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Card de citas activas (en curso) ─────────────────────────────────────────

function ActiveApptRow({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span className={cn("h-2 w-2 rounded-full shrink-0", dot)} />
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

// ── Ocupación ─────────────────────────────────────────────────────────────────

function OccupancyCard({ d }: { d: BranchDashboard }) {
  const o = d.occupancy;
  const a = d.appointments;

  const pctColor = o.pct >= 90 ? "bg-red-500" : o.pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  const pctText  = o.pct >= 90 ? "text-red-700" : o.pct >= 70 ? "text-amber-700" : "text-emerald-700";

  return (
    <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-violet-50 flex items-center justify-center">
            <Users size={16} className="text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Ocupación de la sede</p>
            <p className="text-xs text-muted-foreground">Hoy · {d.branch_name}</p>
          </div>
        </div>
        <span className={cn("text-2xl font-black", pctText)}>{o.pct}%</span>
      </div>

      <div className="space-y-1.5">
        <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-700", pctColor)} style={{ width: `${o.pct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{o.occupied_slots} cupos ocupados</span>
          <span className="font-semibold text-emerald-600">{o.available_slots} disponibles</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Total",    value: o.total_slots,     cls: "bg-gray-50 border text-gray-800" },
          { label: "Ocupados", value: o.occupied_slots,  cls: "bg-violet-50 border border-violet-100 text-violet-700" },
          { label: "Libres",   value: o.available_slots, cls: "bg-emerald-50 border border-emerald-100 text-emerald-700" },
        ].map(({ label, value, cls }) => (
          <div key={label} className={cn("rounded-lg px-3 py-2 text-center", cls)}>
            <p className="text-[10px] uppercase tracking-wide opacity-70">{label}</p>
            <p className="text-lg font-bold mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Estado en tiempo real */}
      <div className="space-y-2 pt-1 border-t">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">En curso ahora</p>
        <ActiveApptRow label="En espera"    value={a.checked_in} dot="bg-purple-400" />
        <ActiveApptRow label="En atención"  value={a.in_service} dot="bg-indigo-400" />
        <ActiveApptRow label="Confirmadas"  value={a.confirmed}  dot="bg-blue-400" />
      </div>
    </div>
  );
}

// ── Ventas del día ────────────────────────────────────────────────────────────

function PaymentMethodIcon({ method }: { method: string }) {
  if (method === "CASH")     return <Banknote   size={14} className="text-emerald-600 shrink-0" />;
  if (method === "YAPE" || method === "PLIN") return <Smartphone size={14} className="text-violet-600 shrink-0" />;
  return <CreditCard size={14} className="text-blue-600 shrink-0" />;
}

function SalesCard({ d }: { d: BranchDashboard }) {
  const s = d.sales;
  const cr = d.cash_register;

  return (
    <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <TrendingUp size={16} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Ventas del día</p>
            <p className="text-xs text-muted-foreground">Facturación emitida hoy</p>
          </div>
        </div>
        {/* Estado de caja */}
        {cr ? (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Caja abierta
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted border px-2 py-1 rounded-full">
            Sin caja
          </span>
        )}
      </div>

      <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">Total facturado</p>
          {cr && <p className="text-[10px] text-emerald-600 mt-0.5">Caja: {fmtMoney(cr.balance)}</p>}
        </div>
        <p className="text-2xl font-black text-emerald-700">{fmtMoney(s.total)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-gray-50 px-4 py-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <Receipt size={13} className="text-blue-600 shrink-0" />
            <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">Facturas</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{fmtMoney(s.facturas.total)}</p>
          <p className="text-[11px] text-muted-foreground">{s.facturas.count} emitidas</p>
        </div>
        <div className="rounded-xl border bg-gray-50 px-4 py-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <Wallet size={13} className="text-violet-600 shrink-0" />
            <p className="text-[11px] font-semibold text-violet-700 uppercase tracking-wide">Boletas</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{fmtMoney(s.boletas.total)}</p>
          <p className="text-[11px] text-muted-foreground">{s.boletas.count} emitidas</p>
        </div>
      </div>

      {s.by_payment_method.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Por medio de pago</p>
          <div className="space-y-1.5">
            {s.by_payment_method.map(({ method, label, total, count }) => {
              const pct = s.total > 0 ? Math.round((total / s.total) * 100) : 0;
              return (
                <div key={method} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-gray-700 font-medium">
                      <PaymentMethodIcon method={method} />
                      {label}
                      <span className="text-muted-foreground font-normal">({count} op.)</span>
                    </span>
                    <span className="font-semibold text-gray-800">{fmtMoney(total)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {s.count === 0 && (
        <p className="text-center text-sm text-muted-foreground py-2">
          Sin ventas registradas hoy
        </p>
      )}
    </div>
  );
}

// ── Pantalla: sin sede seleccionada ──────────────────────────────────────────

function NoBranchSelected() {
  const { branches } = useBranches();
  const { setActiveBranch } = useBranchStore();

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-6 p-8">
      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Building2 size={32} className="text-primary/60" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900">Selecciona una sede</h2>
        <p className="text-muted-foreground text-sm mt-1 max-w-xs">
          El Dashboard Sede muestra los KPIs del día para una sucursal específica.
          Elige una sede en el selector del encabezado o usa los accesos directos.
        </p>
      </div>
      {branches && branches.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-md">
          {branches.slice(0, 6).map((b) => (
            <button
              key={b.id}
              onClick={() => setActiveBranch(b.id, b.name)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border bg-white hover:bg-muted/50 text-sm font-medium text-gray-700 transition-colors"
            >
              <Building2 size={14} className="text-primary/60 shrink-0" />
              <span className="truncate">{b.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page principal
// ─────────────────────────────────────────────────────────────────────────────

export function BranchDashboardPage() {
  const user            = useAuthStore((s) => s.user);
  const { activeBranchId, activeBranchName } = useBranchStore();

  const { data, isLoading, isError, error, refetch, isFetching } =
    useBranchDashboard(activeBranchId);

  // Sin sede seleccionada (caso SUPER_ADMIN en "todas las sedes")
  if (!activeBranchId) {
    return <NoBranchSelected />;
  }

  const branchLabel = data?.branch_name ?? activeBranchName ?? "Sede";

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* ── Encabezado ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting()}, {user?.firstName ?? ""}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5 capitalize">{fmtDate()}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Badge de sede */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-semibold text-primary truncate max-w-[200px]">
              {branchLabel}
            </span>
          </div>
          {/* Botón de refresh */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-full"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Actualizar datos"
          >
            <RefreshCw size={14} className={cn(isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* ── Acciones rápidas ──────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Acciones rápidas
        </h2>
        <QuickActions />
      </section>

      {/* ── Contenido principal ───────────────────────────────────── */}
      {isLoading ? (
        <DashboardSkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertCircle size={32} className="text-destructive/60" />
          <p className="text-sm text-muted-foreground">
            {(error as Error)?.message ?? "Error al cargar los datos de la sede"}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : data ? (
        <>
          {/* Citas del día */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Citas de hoy
            </h2>
            <ApptStatsBlock d={data} />
          </section>

          {/* Ocupación + Ventas */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Sede y facturación
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <OccupancyCard d={data} />
              <SalesCard     d={data} />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

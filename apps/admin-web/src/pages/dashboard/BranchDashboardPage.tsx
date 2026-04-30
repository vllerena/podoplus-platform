import { useNavigate } from "react-router-dom";
import {
  CalendarDays, Plus, UserPlus, ShoppingCart,
  CheckCircle2, RotateCcw, XCircle, Clock,
  Receipt, CreditCard, Banknote, Smartphone, Wallet,
  TrendingUp, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";

// ─────────────────────────────────────────────────────────────────────────────
// DEMO DATA — reemplazar con hooks reales cuando el backend esté conectado
// ─────────────────────────────────────────────────────────────────────────────

const FAKE_BRANCH_NAME = "Podoplus San Borja";

// ── Citas del día ─────────────────────────────────────────────────────────────
const FAKE_APPT_STATS = {
  total:       16,
  completed:    5,
  rescheduled:  2,
  cancelled:    1,   // incluye NO_SHOW + CANCELED
};

// ── Ocupación de la sede ──────────────────────────────────────────────────────
const FAKE_OCCUPATION = {
  totalSlots:     18,
  occupiedSlots:  13,
  availableSlots:  5,
  pct:            72,   // Math.round(13/18*100)
};

// ── Ventas del día ────────────────────────────────────────────────────────────
const FAKE_SALES = {
  facturas: { count: 3,  total: 480.00 },
  boletas:  { count: 9,  total: 1360.00 },
  total:                 1840.00,
  byPaymentMethod: [
    { method: "Efectivo",        icon: "cash",   total: 820.00,  count: 6 },
    { method: "Tarjeta débito",  icon: "card",   total: 650.00,  count: 4 },
    { method: "Tarjeta crédito", icon: "card",   total: 270.00,  count: 2 },
    { method: "Yape / Plin",     icon: "mobile", total: 100.00,  count: 1 },
  ],
};

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
  return `S/ ${n.toFixed(2)}`;
}

function fmtDate() {
  return new Date().toLocaleDateString("es-PE", {
    weekday: "long", day: "numeric", month: "long",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────

// ── Bloque 1: Acciones rápidas ────────────────────────────────────────────────

function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    {
      label: "Ver calendario",
      icon:  <CalendarDays size={18} />,
      path:  "/calendar",
      bg:    "bg-blue-50   hover:bg-blue-100",
      border:"border-blue-200",
      text:  "text-blue-700",
    },
    {
      label: "Nueva cita",
      icon:  <Plus size={18} />,
      path:  "/appointments",
      bg:    "bg-violet-50  hover:bg-violet-100",
      border:"border-violet-200",
      text:  "text-violet-700",
    },
    {
      label: "Nuevo cliente",
      icon:  <UserPlus size={18} />,
      path:  "/customers",
      bg:    "bg-emerald-50 hover:bg-emerald-100",
      border:"border-emerald-200",
      text:  "text-emerald-700",
    },
    {
      label: "Registrar venta",
      icon:  <ShoppingCart size={18} />,
      path:  "/sales",
      bg:    "bg-orange-50  hover:bg-orange-100",
      border:"border-orange-200",
      text:  "text-orange-700",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {actions.map(({ label, icon, path, bg, border, text }) => (
        <button
          key={label}
          onClick={() => navigate(path)}
          className={cn(
            "flex flex-col sm:flex-row items-center sm:items-center gap-2",
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

// ── Bloque 2: Cards de citas ──────────────────────────────────────────────────

function ApptStatCard({
  label, value, icon, bg, text, subtext,
}: {
  label:   string;
  value:   number;
  icon:    React.ReactNode;
  bg:      string;
  text:    string;
  subtext?: string;
}) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-3">
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", bg)}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-3xl font-bold mt-0.5", text)}>{value}</p>
        {subtext && (
          <p className="text-[11px] text-muted-foreground mt-1">{subtext}</p>
        )}
      </div>
    </div>
  );
}

function ApptStatsBlock() {
  const s = FAKE_APPT_STATS;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <ApptStatCard
        label="Citas hoy"
        value={s.total}
        icon={<Clock size={18} className="text-blue-600" />}
        bg="bg-blue-50" text="text-blue-700"
        subtext="Total del día"
      />
      <ApptStatCard
        label="Completadas"
        value={s.completed}
        icon={<CheckCircle2 size={18} className="text-green-600" />}
        bg="bg-green-50" text="text-green-700"
        subtext={`${Math.round((s.completed / s.total) * 100)}% del total`}
      />
      <ApptStatCard
        label="Reagendadas"
        value={s.rescheduled}
        icon={<RotateCcw size={18} className="text-indigo-600" />}
        bg="bg-indigo-50" text="text-indigo-700"
        subtext="Reprogramadas hoy"
      />
      <ApptStatCard
        label="Canceladas / No asistió"
        value={s.cancelled}
        icon={<XCircle size={18} className="text-red-500" />}
        bg="bg-red-50" text="text-red-600"
        subtext="Incluye no asistencias"
      />
    </div>
  );
}

// ── Bloque 3: Ocupación ───────────────────────────────────────────────────────

function OccupancyCard() {
  const o = FAKE_OCCUPATION;
  const pctColor =
    o.pct >= 90 ? "bg-red-500" :
    o.pct >= 70 ? "bg-amber-500" :
    "bg-emerald-500";

  const pctText =
    o.pct >= 90 ? "text-red-700" :
    o.pct >= 70 ? "text-amber-700" :
    "text-emerald-700";

  return (
    <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-violet-50 flex items-center justify-center">
            <Users size={16} className="text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Ocupación de la sede</p>
            <p className="text-xs text-muted-foreground">Hoy · {FAKE_BRANCH_NAME}</p>
          </div>
        </div>
        <span className={cn("text-2xl font-black", pctText)}>{o.pct}%</span>
      </div>

      {/* Barra de progreso */}
      <div className="space-y-1.5">
        <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-700", pctColor)}
            style={{ width: `${o.pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{o.occupiedSlots} cupos ocupados</span>
          <span className="font-semibold text-emerald-600">
            {o.availableSlots} disponibles
          </span>
        </div>
      </div>

      {/* Pills de resumen */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-gray-50 border px-3 py-2 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
          <p className="text-lg font-bold text-gray-800 mt-0.5">{o.totalSlots}</p>
        </div>
        <div className="rounded-lg bg-violet-50 border border-violet-100 px-3 py-2 text-center">
          <p className="text-[10px] text-violet-600 uppercase tracking-wide">Ocupados</p>
          <p className="text-lg font-bold text-violet-700 mt-0.5">{o.occupiedSlots}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-center">
          <p className="text-[10px] text-emerald-600 uppercase tracking-wide">Libres</p>
          <p className="text-lg font-bold text-emerald-700 mt-0.5">{o.availableSlots}</p>
        </div>
      </div>
    </div>
  );
}

// ── Bloque 3: Ventas ──────────────────────────────────────────────────────────

function PaymentMethodIcon({ icon }: { icon: string }) {
  if (icon === "cash")   return <Banknote   size={14} className="text-emerald-600 shrink-0" />;
  if (icon === "mobile") return <Smartphone size={14} className="text-violet-600 shrink-0" />;
  return                        <CreditCard size={14} className="text-blue-600 shrink-0" />;
}

function SalesCard() {
  const s = FAKE_SALES;

  return (
    <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
          <TrendingUp size={16} className="text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Ventas del día</p>
          <p className="text-xs text-muted-foreground">Facturación emitida hoy</p>
        </div>
      </div>

      {/* Total grande */}
      <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
          Total facturado
        </p>
        <p className="text-2xl font-black text-emerald-700">{fmtMoney(s.total)}</p>
      </div>

      {/* Facturas vs Boletas */}
      <div className="grid grid-cols-2 gap-3">
        {/* Facturas */}
        <div className="rounded-xl border bg-gray-50 px-4 py-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <Receipt size={13} className="text-blue-600 shrink-0" />
            <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">
              Facturas
            </p>
          </div>
          <p className="text-xl font-bold text-gray-900">{fmtMoney(s.facturas.total)}</p>
          <p className="text-[11px] text-muted-foreground">{s.facturas.count} emitidas</p>
        </div>

        {/* Boletas */}
        <div className="rounded-xl border bg-gray-50 px-4 py-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <Wallet size={13} className="text-violet-600 shrink-0" />
            <p className="text-[11px] font-semibold text-violet-700 uppercase tracking-wide">
              Boletas
            </p>
          </div>
          <p className="text-xl font-bold text-gray-900">{fmtMoney(s.boletas.total)}</p>
          <p className="text-[11px] text-muted-foreground">{s.boletas.count} emitidas</p>
        </div>
      </div>

      {/* Medios de pago */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Por medio de pago
        </p>
        <div className="space-y-1.5">
          {s.byPaymentMethod.map(({ method, icon, total, count }) => {
            const pct = Math.round((total / s.total) * 100);
            return (
              <div key={method} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-gray-700 font-medium">
                    <PaymentMethodIcon icon={icon} />
                    {method}
                    <span className="text-muted-foreground font-normal">
                      ({count} op.)
                    </span>
                  </span>
                  <span className="font-semibold text-gray-800">{fmtMoney(total)}</span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/60"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export function BranchDashboardPage() {
  const user = useAuthStore((s) => s.user);

  // Nombre de la sede del recepcionista (primera rama asignada)
  const branchName = user?.branches?.[0]?.name ?? FAKE_BRANCH_NAME;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* ── Encabezado ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting()}, {user?.firstName ?? ""}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5 capitalize">
            {fmtDate()}
          </p>
        </div>

        {/* Badge de sede */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-semibold text-primary truncate max-w-[200px]">
            {branchName}
          </span>
        </div>
      </div>

      {/* ── Bloque 1: Acciones rápidas ──────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Acciones rápidas
        </h2>
        <QuickActions />
      </section>

      {/* ── Bloque 2: Stats de citas ────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Citas de hoy
        </h2>
        <ApptStatsBlock />
      </section>

      {/* ── Bloque 3: Ocupación + Ventas ────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Sede y facturación
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <OccupancyCard />
          <SalesCard />
        </div>
      </section>

      {/* Demo watermark */}
      <p className="text-center text-xs text-muted-foreground/40 pb-2">
        ⚠️ Modo demo — datos simulados para visualización
      </p>
    </div>
  );
}

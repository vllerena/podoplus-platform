import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays, Clock, CheckCircle2, XCircle,
  TrendingUp, ShoppingCart, Receipt, Layers,
  LockOpen, Lock, TrendingDown, AlertTriangle,
  PackageX, Users, ArrowRight, Plus, CreditCard,
  UserPlus, ChevronUp, ChevronDown, Minus,
} from "lucide-react";
import {
  Button, Skeleton,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@podoplus/ui";
import { formatTime, cn } from "@/lib/utils";
import { useAuthStore }   from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useBranches }    from "@/hooks/use-appointments";
import { useDashboardReport } from "@/hooks/use-reports";
import { useOpenRegister }    from "@/hooks/use-cash-register";

// ─────────────────────────────────────────────────────────────────────────────
// DEMO MODE — poner en `false` cuando el backend tenga datos reales
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_MODE = true;

// ── Fake data ─────────────────────────────────────────────────────────────────

const D = new Date();
const PAD = (n: number) => String(n).padStart(2, "0");
const DT  = (h: number, m = 0) =>
  `${D.getFullYear()}-${PAD(D.getMonth() + 1)}-${PAD(D.getDate())}T${PAD(h)}:${PAD(m)}:00`;

const FAKE_APPOINTMENTS = [
  { id:"fa1",  startAt: DT(8,30),  endAt: DT(9,0),   status:"COMPLETED",  customer:{ firstName:"María",     lastName:"García López"     }, service:{ name:"Podología Clínica",     color:"#6366f1" } },
  { id:"fa2",  startAt: DT(9,0),   endAt: DT(9,30),  status:"COMPLETED",  customer:{ firstName:"Carlos",    lastName:"Rodríguez Díaz"   }, service:{ name:"Tratamiento de Uñas",   color:"#f59e0b" } },
  { id:"fa3",  startAt: DT(9,30),  endAt: DT(10,0),  status:"COMPLETED",  customer:{ firstName:"Ana",       lastName:"Martínez Torres"  }, service:{ name:"Podología Deportiva",   color:"#10b981" } },
  { id:"fa4",  startAt: DT(10,0),  endAt: DT(10,30), status:"COMPLETED",  customer:{ firstName:"Luis",      lastName:"Sánchez Flores"   }, service:{ name:"Pie Diabético",         color:"#ef4444" } },
  { id:"fa5",  startAt: DT(10,30), endAt: DT(11,0),  status:"COMPLETED",  customer:{ firstName:"Rosa",      lastName:"Vargas Mendoza"   }, service:{ name:"Podología Clínica",     color:"#6366f1" } },
  { id:"fa6",  startAt: DT(11,0),  endAt: DT(11,30), status:"IN_SERVICE", customer:{ firstName:"Pedro",     lastName:"Quispe Huanca"    }, service:{ name:"Tratamiento de Hongos", color:"#8b5cf6" } },
  { id:"fa7",  startAt: DT(11,30), endAt: DT(12,0),  status:"CHECKED_IN", customer:{ firstName:"Elena",     lastName:"Castro Ramos"     }, service:{ name:"Podología Clínica",     color:"#6366f1" } },
  { id:"fa8",  startAt: DT(12,0),  endAt: DT(12,30), status:"CONFIRMED",  customer:{ firstName:"Jorge",     lastName:"Lima Palomino"    }, service:{ name:"Verruga Plantar",       color:"#f97316" } },
  { id:"fa9",  startAt: DT(14,0),  endAt: DT(14,30), status:"CONFIRMED",  customer:{ firstName:"Carmen",    lastName:"Chávez Ruiz"      }, service:{ name:"Ortesis y Plantillas",  color:"#0ea5e9" } },
  { id:"fa10", startAt: DT(14,30), endAt: DT(15,0),  status:"CONFIRMED",  customer:{ firstName:"Ricardo",   lastName:"Tello Aguilar"    }, service:{ name:"Podología Clínica",     color:"#6366f1" } },
  { id:"fa11", startAt: DT(15,0),  endAt: DT(15,30), status:"PENDING",    customer:{ firstName:"Sofía",     lastName:"Morales Vega"     }, service:{ name:"Tratamiento de Uñas",   color:"#f59e0b" } },
  { id:"fa12", startAt: DT(15,30), endAt: DT(16,0),  status:"PENDING",    customer:{ firstName:"Alejandro", lastName:"Pérez Torres"     }, service:{ name:"Podología Deportiva",   color:"#10b981" } },
  { id:"fa13", startAt: DT(16,0),  endAt: DT(16,30), status:"PENDING",    customer:{ firstName:"Isabel",    lastName:"Herrera Campos"   }, service:{ name:"Podología Clínica",     color:"#6366f1" } },
  { id:"fa14", startAt: DT(16,30), endAt: DT(17,0),  status:"PENDING",    customer:{ firstName:"Miguel",    lastName:"Ángel Flores"     }, service:{ name:"Pie Diabético",         color:"#ef4444" } },
  { id:"fa15", startAt: DT(17,0),  endAt: DT(17,30), status:"PENDING",    customer:{ firstName:"Lucía",     lastName:"Paredes Salinas"  }, service:{ name:"Podología Clínica",     color:"#6366f1" } },
  { id:"fa16", startAt: DT(17,30), endAt: DT(18,0),  status:"NO_SHOW",    customer:{ firstName:"David",     lastName:"Ramos Gutiérrez"  }, service:{ name:"Verruga Plantar",       color:"#f97316" } },
];

const FAKE_REPORT = {
  sales:               { totalRevenue: 1840.00, totalTransactions: 12, averageTicket: 153.33 },
  activeSubscriptions: 47,
  lowStockAlerts:      3,
  newCustomers:        2,
};

const FAKE_REGISTER = {
  open:     true,
  register: { id:"fake-reg-1", current_balance:"2340.50", total_in:"1840.00", total_out:"120.00" },
};

// Sparkline de ingresos últimos 7 días (% respecto al max)
const WEEKLY_REVENUE = [980, 1240, 1050, 1680, 1320, 1560, 1840];

// ── Helpers ───────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function fmtMoney(n?: number | null) {
  if (n == null) return "S/ 0.00";
  return `S/ ${n.toFixed(2)}`;
}

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

// ── Status maps ───────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  PENDING:     "Pendiente",
  CONFIRMED:   "Confirmada",
  CHECKED_IN:  "En espera",
  IN_SERVICE:  "En servicio",
  COMPLETED:   "Completada",
  CANCELED:    "Cancelada",
  NO_SHOW:     "No asistió",
  RESCHEDULED: "Reprogramada",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING:     "bg-yellow-100 text-yellow-800",
  CONFIRMED:   "bg-blue-100   text-blue-800",
  CHECKED_IN:  "bg-purple-100 text-purple-800",
  IN_SERVICE:  "bg-indigo-100 text-indigo-800",
  COMPLETED:   "bg-green-100  text-green-800",
  CANCELED:    "bg-red-100    text-red-800",
  NO_SHOW:     "bg-gray-100   text-gray-600",
  RESCHEDULED: "bg-orange-100 text-orange-800",
};

// ── Trend chip ────────────────────────────────────────────────────────────────

function TrendChip({ pct, invert = false }: { pct: number; invert?: boolean }) {
  const positive = invert ? pct < 0 : pct > 0;
  const neutral  = pct === 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
      neutral  ? "bg-gray-100 text-gray-500"       :
      positive ? "bg-green-100 text-green-700"     :
                 "bg-red-100 text-red-600",
    )}>
      {neutral ? <Minus size={9} /> : positive ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
      {Math.abs(pct)}% vs ayer
    </span>
  );
}

// ── Sparkline (7-day revenue) ─────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const H = 28, W = 80, step = W / (data.length - 1);
  const points = data
    .map((v, i) => `${i * step},${H - (v / max) * H}`)
    .join(" ");
  return (
    <svg width={W} height={H} className="opacity-60">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  title, value, icon, color, textColor, loading, onClick, trend, sparkline,
}: {
  title:      string;
  value:      string | number;
  icon:       React.ReactNode;
  color:      string;
  textColor:  string;
  loading:    boolean;
  onClick?:   () => void;
  trend?:     { pct: number; invert?: boolean };
  sparkline?: number[];
}) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-3",
        onClick && "cursor-pointer hover:border-primary/40 transition-colors hover:shadow-md",
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", color)}>
          {icon}
        </div>
        {trend && !loading && <TrendChip pct={trend.pct} invert={trend.invert} />}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{title}</p>
          {loading ? (
            <Skeleton className="h-7 w-20 mt-1" />
          ) : (
            <p className={cn("text-2xl font-bold mt-0.5", textColor)}>{value}</p>
          )}
        </div>
        {sparkline && !loading && (
          <div className={cn("shrink-0", textColor)}>
            <Sparkline data={sparkline} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Cash widget ───────────────────────────────────────────────────────────────

function CashWidget({ branchId }: { branchId: string }) {
  const navigate = useNavigate();
  const realQuery = useOpenRegister(DEMO_MODE ? "" : branchId);
  const data = DEMO_MODE ? FAKE_REGISTER : realQuery.data;
  const isLoading = DEMO_MODE ? false : realQuery.isLoading;

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-white shadow-sm p-5 space-y-3">
        <Skeleton className="h-5 w-32" /><Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const isOpen   = data?.open;
  const register = data?.register;

  return (
    <div className="rounded-xl border bg-white shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Caja del día</h3>
        {isOpen ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />Abierta
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <Lock className="h-3.5 w-3.5" />Cerrada
          </span>
        )}
      </div>

      {isOpen && register ? (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-gray-50 border p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Balance</p>
              <p className="text-base font-bold mt-0.5">
                S/ {parseFloat(register.current_balance ?? "0").toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg bg-green-50 border p-2.5">
              <p className="text-[10px] text-green-700 uppercase tracking-wide flex items-center justify-center gap-0.5">
                <TrendingUp className="h-3 w-3" />Ingresos
              </p>
              <p className="text-sm font-semibold text-green-700 mt-0.5">
                +S/ {parseFloat(register.total_in ?? "0").toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg bg-red-50 border p-2.5">
              <p className="text-[10px] text-red-600 uppercase tracking-wide flex items-center justify-center gap-0.5">
                <TrendingDown className="h-3 w-3" />Egresos
              </p>
              <p className="text-sm font-semibold text-red-600 mt-0.5">
                -S/ {parseFloat(register.total_out ?? "0").toFixed(2)}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full"
            onClick={() => navigate(DEMO_MODE ? "#" : `/cash-register/${register.id}`)}>
            Ver detalle de caja <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </Button>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-4 text-muted-foreground gap-3">
          <LockOpen className="h-8 w-8 opacity-25" />
          <p className="text-sm">No hay caja abierta en esta sede</p>
          <Button size="sm" onClick={() => navigate("/cash-register")}>
            <LockOpen className="h-4 w-4 mr-2" />Abrir caja
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Alerts widget ─────────────────────────────────────────────────────────────

function AlertsWidget({
  lowStock, newCustomers, loading,
}: { lowStock: number; newCustomers: number; loading: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-xl border bg-white shadow-sm p-5 space-y-3">
      <h3 className="text-sm font-semibold">Alertas del día</h3>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ) : (
        <div className="space-y-2">
          <button
            onClick={() => navigate("/inventory")}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left",
              lowStock > 0
                ? "border-amber-200 bg-amber-50 hover:bg-amber-100"
                : "border-gray-100 bg-gray-50 hover:bg-gray-100",
            )}
          >
            {lowStock > 0
              ? <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              : <PackageX className="h-5 w-5 text-gray-400 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">
                {lowStock > 0
                  ? `${lowStock} producto${lowStock !== 1 ? "s" : ""} con stock bajo`
                  : "Stock en orden"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {lowStock > 0 ? "Revisar inventario" : "Sin alertas de stock"}
              </p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>

          <button
            onClick={() => navigate("/customers")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-blue-100 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
          >
            <Users className="h-5 w-5 text-blue-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">
                {newCustomers > 0
                  ? `${newCustomers} cliente${newCustomers !== 1 ? "s" : ""} nuevo${newCustomers !== 1 ? "s" : ""} hoy`
                  : "Sin clientes nuevos hoy"}
              </p>
              <p className="text-[10px] text-muted-foreground">Ver clientes</p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>

          {/* Extra: ocupación del día */}
          <div className="px-3 py-2.5 rounded-lg border border-violet-100 bg-violet-50">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-violet-800">Ocupación de hoy</p>
              <p className="text-xs font-bold text-violet-700">78%</p>
            </div>
            <div className="h-1.5 w-full rounded-full bg-violet-200">
              <div className="h-1.5 rounded-full bg-violet-500" style={{ width: "78%" }} />
            </div>
            <p className="text-[10px] text-violet-600 mt-1">14 / 18 slots ocupados</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Quick actions ─────────────────────────────────────────────────────────────

function QuickActions() {
  const navigate = useNavigate();
  const actions = [
    { label: "Nueva cita",    icon: <CalendarDays size={15} />, color: "text-blue-600   bg-blue-50   hover:bg-blue-100   border-blue-200",   path: "/appointments" },
    { label: "Nueva venta",   icon: <ShoppingCart  size={15} />, color: "text-green-600  bg-green-50  hover:bg-green-100  border-green-200",   path: "/sales" },
    { label: "Nuevo cliente", icon: <UserPlus      size={15} />, color: "text-violet-600 bg-violet-50 hover:bg-violet-100 border-violet-200",  path: "/customers" },
    { label: "Cobro rápido",  icon: <CreditCard    size={15} />, color: "text-orange-600 bg-orange-50 hover:bg-orange-100 border-orange-200",  path: "/sales" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {actions.map(({ label, icon, color, path }) => (
        <button
          key={label}
          onClick={() => navigate(path)}
          className={cn(
            "flex items-center gap-2 px-4 py-3 rounded-xl border font-medium text-sm transition-colors",
            color,
          )}
        >
          {icon}{label}
        </button>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  const user     = useAuthStore((s) => s.user);
  const isSuperAdmin = useAuthStore((s) => s.hasRole("SUPER_ADMIN"));

  // Branch store (persisted)
  const { activeBranchId, setActiveBranch } = useBranchStore();

  // Branches accessible to this user
  const { data: allBranches } = useBranches();
  const activeBranches = useMemo(
    () => allBranches?.filter((b) => b.isActive) ?? [],
    [allBranches],
  );

  // Auto-select first branch when branches load and nothing is selected yet
  useEffect(() => {
    if (!activeBranchId && activeBranches.length > 0) {
      setActiveBranch(activeBranches[0].id, activeBranches[0].name);
    }
  }, [activeBranches, activeBranchId, setActiveBranch]);

  const branchId    = activeBranchId ?? "";
  const branchName  = activeBranches.find((b) => b.id === branchId)?.name ?? "";
  const showSelector = activeBranches.length > 1;

  // ── Appointments ────────────────────────────────────────────────
  const appointments   = DEMO_MODE ? FAKE_APPOINTMENTS : [];
  const loadingAppts   = false;
  const todayCount     = appointments.length;
  const completedCount = appointments.filter((a) => a.status === "COMPLETED").length;
  const pendingCount   = appointments.filter((a) =>
    ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"].includes(a.status)
  ).length;
  const noShowCount    = appointments.filter((a) => a.status === "NO_SHOW").length;

  // ── KPIs ────────────────────────────────────────────────────────
  const realReport = useDashboardReport({ branchId, from: TODAY, to: TODAY }, !DEMO_MODE && !!branchId);
  const dashReport = DEMO_MODE ? FAKE_REPORT : realReport.data;
  const loadingDash = DEMO_MODE ? false : realReport.isLoading;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Greeting + Branch selector ────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting()}, {user?.firstName ?? ""}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5 capitalize">
            {new Date().toLocaleDateString("es-PE", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </p>
        </div>

        {showSelector && (
          <Select
            value={branchId || "_all"}
            onValueChange={(v) => {
              if (v === "_all") {
                setActiveBranch(null);
              } else {
                const b = activeBranches.find((x) => x.id === v);
                setActiveBranch(v, b?.name ?? null);
              }
            }}
          >
            <SelectTrigger className="w-56 shrink-0">
              <SelectValue placeholder="Seleccionar sede…" />
            </SelectTrigger>
            <SelectContent>
              {isSuperAdmin && <SelectItem value="_all">Todas las sedes</SelectItem>}
              {activeBranches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── Acciones rápidas ───────────────────────────────────── */}
      <QuickActions />

      {/* ── Appointment stats (4 cards) ────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Citas hoy"
          value={todayCount}
          icon={<CalendarDays size={18} className="text-blue-600" />}
          color="bg-blue-50" textColor="text-blue-700"
          loading={loadingAppts}
          trend={{ pct: 17 }}
          onClick={() => navigate("/appointments")}
        />
        <StatCard
          title="Completadas"
          value={completedCount}
          icon={<CheckCircle2 size={18} className="text-green-600" />}
          color="bg-green-50" textColor="text-green-700"
          loading={loadingAppts}
          trend={{ pct: 8 }}
        />
        <StatCard
          title="Pendientes / En curso"
          value={pendingCount}
          icon={<Clock size={18} className="text-yellow-600" />}
          color="bg-yellow-50" textColor="text-yellow-700"
          loading={loadingAppts}
        />
        <StatCard
          title="No asistieron"
          value={noShowCount}
          icon={<XCircle size={18} className="text-red-500" />}
          color="bg-red-50" textColor="text-red-600"
          loading={loadingAppts}
          trend={{ pct: -50, invert: true }}
        />
      </div>

      {/* ── Business KPIs ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Ingresos netos hoy"
          value={fmtMoney(dashReport?.sales.totalRevenue)}
          icon={<TrendingUp size={18} className="text-emerald-600" />}
          color="bg-emerald-50" textColor="text-emerald-700"
          loading={loadingDash}
          trend={{ pct: 18 }}
          sparkline={WEEKLY_REVENUE}
          onClick={() => navigate("/sales")}
        />
        <StatCard
          title="Ventas hoy"
          value={dashReport?.sales.totalTransactions ?? 0}
          icon={<ShoppingCart size={18} className="text-blue-600" />}
          color="bg-blue-50" textColor="text-blue-700"
          loading={loadingDash}
          trend={{ pct: 9 }}
          onClick={() => navigate("/sales")}
        />
        <StatCard
          title="Ticket promedio"
          value={fmtMoney(dashReport?.sales.averageTicket)}
          icon={<Receipt size={18} className="text-violet-600" />}
          color="bg-violet-50" textColor="text-violet-700"
          loading={loadingDash}
          trend={{ pct: 5 }}
        />
        <StatCard
          title="Suscripciones activas"
          value={dashReport?.activeSubscriptions ?? 0}
          icon={<Layers size={18} className="text-orange-600" />}
          color="bg-orange-50" textColor="text-orange-700"
          loading={loadingDash}
          trend={{ pct: 12 }}
          onClick={() => navigate("/subscriptions")}
        />
      </div>

      {/* ── Cash + Alerts ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CashWidget branchId={branchId} />
        <AlertsWidget
          lowStock={dashReport?.lowStockAlerts ?? 0}
          newCustomers={dashReport?.newCustomers ?? 0}
          loading={loadingDash}
        />
      </div>

      {/* ── Today's appointments table ─────────────────────────── */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Citas de hoy</h2>
            {branchName && (
              <p className="text-xs text-muted-foreground mt-0.5">{branchName}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{todayCount} citas</span>
            <Button variant="outline" size="sm" onClick={() => navigate("/appointments")}>
              Ver calendario <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {loadingAppts ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CalendarDays size={36} className="mb-3 opacity-25" />
            <p className="text-sm font-medium">No hay citas programadas para hoy</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/appointments")}>
              Ir al calendario
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Hora</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Servicio</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {appointments.map((appt: any) => {
                  const cust  = appt.customer;
                  const svc   = appt.service;
                  const inits = cust ? initials(cust.firstName, cust.lastName) : "?";
                  return (
                    <tr
                      key={appt.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate("/appointments")}
                    >
                      <td className="px-5 py-3 text-gray-700 font-medium whitespace-nowrap">
                        {formatTime(appt.startAt)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                            style={{ backgroundColor: svc?.color ?? "#6B7280" }}
                          >
                            {inits}
                          </span>
                          <span className="text-gray-900 font-medium">
                            {cust ? `${cust.firstName} ${cust.lastName}` : "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          {svc?.color && (
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: svc.color }}
                            />
                          )}
                          <span className="text-gray-600 truncate max-w-[160px]">
                            {svc?.name ?? "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap",
                          STATUS_COLOR[appt.status] ?? "bg-gray-100 text-gray-600",
                        )}>
                          {STATUS_LABEL[appt.status] ?? appt.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {DEMO_MODE && (
        <p className="text-center text-xs text-muted-foreground/50 pb-2">
          ⚠️ Modo demo — datos simulados para visualización
        </p>
      )}
    </div>
  );
}

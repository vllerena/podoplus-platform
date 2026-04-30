import { useState } from "react";
import {
  BarChart3, TrendingUp, TrendingDown, Users, Calendar, Package,
  DollarSign, Download, RefreshCw, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Minus, Sparkles,
} from "lucide-react";
import { Button, Skeleton } from "@podoplus/ui";
import { useBranches }      from "@/hooks/use-appointments";
import { useBranchContext } from "@/hooks/use-branch-context";
import {
  useDashboardReport, useOperationsReport, useSalesReport,
  useNoShowReport, useInventoryReport, useCustomersReport,
  buildCsvUrl, type ReportParams,
  type DashboardReport, type OperationsReport, type SalesReport,
  type NoShowReport, type InventoryReport, type CustomersReport,
} from "@/hooks/use-reports";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// DEMO MODE — set to false once the backend returns real data
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_MODE = true;

// ── Fake data ─────────────────────────────────────────────────────────────────

const FAKE_DASHBOARD: DashboardReport = {
  appointments: { total: 487, completed: 418, cancelled: 41, noShow: 22, pending: 6 },
  sales:        { totalRevenue: 39_840.00, totalTransactions: 418, averageTicket: 95.31 },
  activeSubscriptions: 52,
  lowStockAlerts:      3,
  newCustomers:        43,
};

const FAKE_OPERATIONS: OperationsReport = {
  occupancyRate: 0.858,
  totalSlots:    487,
  usedSlots:     418,
  byStatus: { completed: 418, cancelled: 41, noShow: 22, confirmed: 4, pending: 2 },
  topService: { id: "svc1", name: "Podología General", count: 189 },
  bySource:  { manual: 294, selfService: 124 },
};

// 30-day revenue series (Mon–Sun pattern, S/ daily)
const REV_BY_DAY = [
  980, 1_120, 1_350, 1_480, 1_200, 450, 320,
  1_100, 1_280, 1_350, 1_420, 1_190, 480, 350,
  1_250, 1_380, 1_420, 1_510, 1_300, 520, 380,
  1_180, 1_420, 1_490, 1_560, 1_350, 580, 410,
  1_280, 1_410,
];

const FAKE_SALES: SalesReport = {
  totalRevenue:      39_840.00,
  totalTransactions: 418,
  averageTicket:     95.31,
  refunds:           5,
  refundAmount:      380.00,
  byPaymentMethod: [
    { method: "Efectivo",   amount: 18_920, count: 199 },
    { method: "Tarjeta",    amount: 13_280, count: 142 },
    { method: "Yape / Plin", amount:  7_640, count:  77 },
  ],
  topProducts: [
    { id: "p1", name: "Crema Hidratante 250 ml",  quantity: 91, revenue: 2_730 },
    { id: "p2", name: "Plantillas Ortopédicas",   quantity: 48, revenue: 3_840 },
    { id: "p3", name: "Spray Antifúngico 150 ml", quantity: 37, revenue:   999 },
    { id: "p4", name: "Lima Podológica Pro",       quantity: 29, revenue:   580 },
    { id: "p5", name: "Separadores de Dedos",      quantity: 24, revenue:   264 },
  ],
  topServices: [
    { id: "s1", name: "Podología General",      quantity: 189, revenue: 18_900 },
    { id: "s2", name: "Tratamiento de Hongos",  quantity:  82, revenue:  9_020 },
    { id: "s3", name: "Pie Diabético",          quantity:  51, revenue:  7_140 },
    { id: "s4", name: "Onicomicosis",           quantity:  44, revenue:  5_280 },
    { id: "s5", name: "Quiropodia",             quantity:  52, revenue:  4_160 },
  ],
  revenueByDay: REV_BY_DAY.map((amount, i) => ({
    date: (() => { const d = new Date(); d.setDate(d.getDate() - (29 - i)); return d.toISOString().slice(0, 10); })(),
    amount,
  })),
};

const FAKE_CUSTOMERS: CustomersReport = {
  newCustomers:       43,
  recurringCustomers: 375,
  totalCustomers:     418,
  retentionRate:      0.898,
  topSpenders: [
    { customerId: "c1", name: "María Quispe Flores",     totalSpent: 1_240 },
    { customerId: "c2", name: "Carmen López Rivas",      totalSpent: 1_080 },
    { customerId: "c3", name: "Rosa Mamani Condori",     totalSpent:   960 },
    { customerId: "c4", name: "Ana Huanca Vargas",       totalSpent:   840 },
    { customerId: "c5", name: "Luisa Torres Mendoza",    totalSpent:   780 },
  ],
  topVisitors: [
    { customerId: "c1", name: "María Quispe Flores",    visits: 13 },
    { customerId: "c6", name: "Patricia Chávez Díaz",   visits: 11 },
    { customerId: "c2", name: "Carmen López Rivas",     visits: 11 },
    { customerId: "c7", name: "Gloria Sánchez Medina",  visits:  9 },
    { customerId: "c3", name: "Rosa Mamani Condori",    visits:  9 },
  ],
};

const FAKE_NOSHOW: NoShowReport = {
  totalNoShows:       22,
  totalCancellations: 41,
  noShowRate:         0.0452,
  cancellationRate:   0.0842,
  recurringNoShows: [
    { customerId: "x1", customerName: "Jorge Huamán Pérez",   count: 3 },
    { customerId: "x2", customerName: "Luis Ramos Castro",    count: 2 },
    { customerId: "x3", customerName: "Carlos Vega Salinas",  count: 2 },
  ],
  topCancellationReasons: [
    { reason: "Cambio de planes",    count: 18 },
    { reason: "Emergencia personal", count: 11 },
    { reason: "Viaje",               count:  7 },
    { reason: "No especificado",     count:  5 },
  ],
};

const FAKE_INVENTORY: InventoryReport = {
  totalProducts:    42,
  totalStockValue:  8_960.00,
  lowStockProducts: [
    { id: "i1", name: "Spray Antifúngico 150 ml", stock: 4,  threshold: 10 },
    { id: "i2", name: "Separadores de Dedos",     stock: 6,  threshold: 15 },
    { id: "i3", name: "Lima Podológica Pro",       stock: 3,  threshold: 8  },
  ],
  outOfStockProducts: [
    { id: "i4", name: "Vendas Elásticas 7 cm" },
  ],
  topMovements: [
    { id: "i5", name: "Crema Hidratante 250 ml",  totalOut: 91 },
    { id: "i1", name: "Spray Antifúngico 150 ml", totalOut: 37 },
    { id: "i6", name: "Gasas Estériles 10x10",    totalOut: 34 },
    { id: "i2", name: "Separadores de Dedos",      totalOut: 24 },
    { id: "i7", name: "Solución Desinfectante",    totalOut: 21 },
  ],
};

// ── Trend comparisons vs prior period (hardcoded for demo) ────────────────────
const DEMO_TRENDS = {
  revenue:       +14.3,
  completed:     +11.8,
  avgTicket:      +6.2,
  newCustomers:  +31.4,
  subscriptions:  +8.3,
  lowStock:         0,
  noShow:        -18.2,
  cancellations:  -9.5,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtS(v: number | undefined) {
  if (v === undefined || v === null) return "—";
  return `S/ ${v.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtN(v: number | undefined) {
  if (v === undefined || v === null) return "—";
  return v.toLocaleString("es-PE");
}
function fmtPct(v: number | undefined) {
  if (v === undefined || v === null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { label: "Hoy",     from: () => todayStr(),  to: () => todayStr() },
  { label: "7 días",  from: () => daysAgo(6),  to: () => todayStr() },
  { label: "30 días", from: () => daysAgo(29), to: () => todayStr() },
  { label: "90 días", from: () => daysAgo(89), to: () => todayStr() },
];

// ── Visual components ─────────────────────────────────────────────────────────

/** Trend chip: green for positive, red for negative */
function TrendChip({ value, invert = false }: { value: number; invert?: boolean }) {
  if (value === 0) return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
      <Minus size={10} /> 0%
    </span>
  );
  const positive = invert ? value < 0 : value > 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5",
      positive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
               : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    )}>
      {positive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

/** Mini SVG bar chart */
function MiniBarChart({ data, color = "#7c3aed", height = 40 }: {
  data:    number[];
  color?:  string;
  height?: number;
}) {
  if (!data.length) return null;
  const max = Math.max(...data);
  const w   = 6;
  const gap = 3;
  const totalW = data.length * (w + gap) - gap;
  return (
    <svg width={totalW} height={height} className="shrink-0">
      {data.map((v, i) => {
        const barH = max > 0 ? Math.max(2, (v / max) * height) : 2;
        return (
          <rect
            key={i}
            x={i * (w + gap)}
            y={height - barH}
            width={w}
            height={barH}
            rx={2}
            fill={color}
            opacity={0.75 + (i / data.length) * 0.25}
          />
        );
      })}
    </svg>
  );
}

/** Horizontal progress bar */
function ProgressBar({ value, max, color = "bg-primary", label, sublabel }: {
  value:    number;
  max:      number;
  color?:   string;
  label:    string;
  sublabel?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground font-medium">{label}</span>
        <span className="text-muted-foreground">{sublabel ?? `${pct.toFixed(0)}%`}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Donut ring for a single percentage */
function DonutRing({ pct, color = "#7c3aed", size = 72 }: {
  pct:   number;
  color?: string;
  size?:  number;
}) {
  const r   = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor"
              strokeWidth={8} className="text-muted" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
              strokeWidth={8} strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`} />
    </svg>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  title, value, icon: Icon, iconColor, sub, loading, trend, invertTrend,
}: {
  title:        string;
  value:        string;
  icon:         React.ElementType;
  iconColor:    string;
  sub?:         string;
  loading?:     boolean;
  trend?:       number;
  invertTrend?: boolean;
}) {
  const bgColor = iconColor
    .replace("text-", "bg-")
    .replace("600", "100")
    .replace("dark:text-", "dark:bg-");

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground leading-tight">{title}</p>
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", bgColor + "/15")}>
          <Icon size={15} className={iconColor} />
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      )}
      <div className="flex items-center gap-2 min-h-[16px]">
        {sub && !loading && (
          <p className="text-xs text-muted-foreground">{sub}</p>
        )}
        {trend !== undefined && !loading && (
          <TrendChip value={trend} invert={invertTrend} />
        )}
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, icon: Icon, csvUrl }: {
  title:   string;
  icon:    React.ElementType;
  csvUrl?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <Icon size={15} className="text-primary" />
        <h2 className="font-semibold text-foreground text-sm">{title}</h2>
      </div>
      {csvUrl && !DEMO_MODE && (
        <a href={csvUrl} download
           className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
          <Download size={12} /> Exportar CSV
        </a>
      )}
      {DEMO_MODE && (
        <span className="text-[10px] text-muted-foreground/60 italic">datos demo</span>
      )}
    </div>
  );
}

// ── Simple table ──────────────────────────────────────────────────────────────

function SimpleTable({ headers, rows, loading, barCol }: {
  headers:  string[];
  rows:     (string | number | React.ReactNode)[][];
  loading?: boolean;
  barCol?:  number; // index of column to render as bar
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {headers.map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {headers.map((_, j) => (
                    <td key={j} className="px-3 py-3"><Skeleton className="h-4 w-full max-w-[120px]" /></td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length}
                    className="px-3 py-10 text-center text-xs text-muted-foreground">
                  Sin datos para el período seleccionado
                </td>
              </tr>
            ) : rows.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2.5 text-sm text-foreground">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type TabId = "overview" | "operations" | "sales" | "customers" | "noshow" | "inventory";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "overview",   label: "Resumen",     icon: BarChart3 },
  { id: "operations", label: "Operaciones", icon: Calendar },
  { id: "sales",      label: "Ventas",      icon: DollarSign },
  { id: "customers",  label: "Clientes",    icon: Users },
  { id: "noshow",     label: "No-show",     icon: AlertTriangle },
  { id: "inventory",  label: "Inventario",  icon: Package },
];

// ── Status badges ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    completed:  { label: "Completada",  cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    cancelled:  { label: "Cancelada",   cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    noShow:     { label: "No-show",     cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    pending:    { label: "Pendiente",   cls: "bg-muted text-muted-foreground" },
    confirmed:  { label: "Confirmada",  cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  };
  const m = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold", m.cls)}>
      {m.label}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const [tab,    setTab]    = useState<TabId>("overview");
  const [from,   setFrom]   = useState(daysAgo(29));
  const [to,     setTo]     = useState(todayStr());
  const [preset, setPreset] = useState(2); // "30 días"

  const { activeBranchId }      = useBranchContext();
  const { data: branches = [] } = useBranches();
  const resolvedBranchId        = activeBranchId || branches[0]?.id || "";

  const params: ReportParams = { branchId: resolvedBranchId, from, to };
  const enabled = !DEMO_MODE && !!resolvedBranchId;

  // Hooks always called (rules of hooks) — disabled in DEMO_MODE
  const { data: rawDash,   isLoading: loadDash }    = useDashboardReport(params, enabled);
  const { data: rawOps,    isLoading: loadOps }     = useOperationsReport(params, enabled && tab === "operations");
  const { data: rawSales,  isLoading: loadSales }   = useSalesReport(params, enabled && tab === "sales");
  const { data: rawCust,   isLoading: loadCust }    = useCustomersReport(params, enabled && tab === "customers");
  const { data: rawNoShow, isLoading: loadNoShow }  = useNoShowReport(params, enabled && tab === "noshow");
  const { data: rawInv,    isLoading: loadInv }     = useInventoryReport(params, enabled && tab === "inventory");

  // Resolved data — fake in DEMO_MODE, real otherwise
  const dashboard  = DEMO_MODE ? FAKE_DASHBOARD  : rawDash;
  const operations = DEMO_MODE ? FAKE_OPERATIONS : rawOps;
  const sales      = DEMO_MODE ? FAKE_SALES      : rawSales;
  const customers  = DEMO_MODE ? FAKE_CUSTOMERS  : rawCust;
  const noShow     = DEMO_MODE ? FAKE_NOSHOW     : rawNoShow;
  const inventory  = DEMO_MODE ? FAKE_INVENTORY  : rawInv;

  // Loading flags — always false in DEMO_MODE
  const ld  = DEMO_MODE ? false : loadDash;
  const lo  = DEMO_MODE ? false : loadOps;
  const ls  = DEMO_MODE ? false : loadSales;
  const lc  = DEMO_MODE ? false : loadCust;
  const lns = DEMO_MODE ? false : loadNoShow;
  const li  = DEMO_MODE ? false : loadInv;

  const applyPreset = (i: number) => {
    setPreset(i);
    setFrom(PRESETS[i].from());
    setTo(PRESETS[i].to());
  };

  // Revenue trend bars (weekly aggregation, last 4 weeks)
  const weeklyRev = DEMO_MODE
    ? [
        REV_BY_DAY.slice(0, 7).reduce((a, b) => a + b, 0),
        REV_BY_DAY.slice(7, 14).reduce((a, b) => a + b, 0),
        REV_BY_DAY.slice(14, 21).reduce((a, b) => a + b, 0),
        REV_BY_DAY.slice(21).reduce((a, b) => a + b, 0),
      ]
    : [];

  const paymentTotal = (sales?.byPaymentMethod ?? []).reduce((a, m) => a + m.amount, 0);

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
            {DEMO_MODE && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border border-violet-200 dark:border-violet-800">
                <Sparkles size={9} /> DEMO
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Análisis y métricas del centro podológico
          </p>
        </div>
        {!DEMO_MODE && (
          <Button variant="outline" size="sm" className="gap-2">
            <Download size={14} /> Exportar
          </Button>
        )}
      </div>

      {/* Filtros globales */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-border bg-card">
        <div className="flex gap-1">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => applyPreset(i)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                preset === i
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="h-5 border-l border-border" />

        <div className="flex items-center gap-2 text-sm">
          <input
            type="date" value={from} max={to}
            onChange={(e) => { setFrom(e.target.value); setPreset(-1); }}
            className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
          <span className="text-muted-foreground text-xs">→</span>
          <input
            type="date" value={to} min={from} max={todayStr()}
            onChange={(e) => { setTo(e.target.value); setPreset(-1); }}
            className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── RESUMEN ── */}
      {tab === "overview" && (
        <div className="space-y-5">
          {/* KPIs row 1 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              title="Ingresos totales"
              value={fmtS(dashboard?.sales?.totalRevenue)}
              icon={DollarSign} iconColor="text-green-600"
              sub={`${fmtN(dashboard?.sales?.totalTransactions)} transacciones`}
              loading={ld} trend={DEMO_MODE ? DEMO_TRENDS.revenue : undefined}
            />
            <KpiCard
              title="Citas completadas"
              value={fmtN(dashboard?.appointments?.completed)}
              icon={Calendar} iconColor="text-primary"
              sub={`de ${fmtN(dashboard?.appointments?.total)} en total`}
              loading={ld} trend={DEMO_MODE ? DEMO_TRENDS.completed : undefined}
            />
            <KpiCard
              title="Ticket promedio"
              value={fmtS(dashboard?.sales?.averageTicket)}
              icon={TrendingUp} iconColor="text-blue-600"
              loading={ld} trend={DEMO_MODE ? DEMO_TRENDS.avgTicket : undefined}
            />
            <KpiCard
              title="Nuevos clientes"
              value={fmtN(dashboard?.newCustomers)}
              icon={Users} iconColor="text-violet-600"
              loading={ld} trend={DEMO_MODE ? DEMO_TRENDS.newCustomers : undefined}
            />
          </div>

          {/* KPIs row 2 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              title="Suscripciones activas"
              value={fmtN(dashboard?.activeSubscriptions)}
              icon={RefreshCw} iconColor="text-cyan-600"
              loading={ld} trend={DEMO_MODE ? DEMO_TRENDS.subscriptions : undefined}
            />
            <KpiCard
              title="Alertas stock bajo"
              value={fmtN(dashboard?.lowStockAlerts)}
              icon={Package} iconColor="text-amber-600"
              loading={ld}
            />
            <KpiCard
              title="No-shows"
              value={fmtN(dashboard?.appointments?.noShow)}
              icon={AlertTriangle} iconColor="text-red-600"
              loading={ld} trend={DEMO_MODE ? DEMO_TRENDS.noShow : undefined} invertTrend
            />
            <KpiCard
              title="Cancelaciones"
              value={fmtN(dashboard?.appointments?.cancelled)}
              icon={ArrowDownRight} iconColor="text-orange-600"
              loading={ld} trend={DEMO_MODE ? DEMO_TRENDS.cancellations : undefined} invertTrend
            />
          </div>

          {/* Revenue trend chart */}
          {DEMO_MODE && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={15} className="text-primary" />
                  <h2 className="font-semibold text-foreground text-sm">Tendencia de ingresos (últimas 4 semanas)</h2>
                </div>
                <span className="text-xs text-muted-foreground">por semana</span>
              </div>
              <div className="flex items-end gap-4">
                {weeklyRev.map((v, i) => {
                  const max = Math.max(...weeklyRev);
                  const h   = Math.max(8, (v / max) * 100);
                  const labels = ["Sem 1", "Sem 2", "Sem 3", "Sem 4"];
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">
                        {fmtS(v)}
                      </span>
                      <div className="w-full flex items-end" style={{ height: 80 }}>
                        <div
                          className="w-full rounded-t-lg bg-primary/80 transition-all"
                          style={{ height: `${h}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{labels[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Appointments breakdown */}
          {dashboard && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={15} className="text-primary" />
                <h2 className="font-semibold text-foreground text-sm">Distribución de citas</h2>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: "Completadas", value: dashboard.appointments.completed, color: "bg-green-500", total: dashboard.appointments.total },
                  { label: "Canceladas",  value: dashboard.appointments.cancelled, color: "bg-red-400",   total: dashboard.appointments.total },
                  { label: "No-shows",    value: dashboard.appointments.noShow,    color: "bg-amber-400", total: dashboard.appointments.total },
                  { label: "Pendientes",  value: dashboard.appointments.pending,   color: "bg-muted-foreground/40", total: dashboard.appointments.total },
                ].map(({ label, value, color, total }) => (
                  <ProgressBar
                    key={label}
                    label={label}
                    value={value}
                    max={total}
                    color={color}
                    sublabel={`${fmtN(value)} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── OPERACIONES ── */}
      {tab === "operations" && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard title="Ocupación"    value={fmtPct(operations?.occupancyRate)}     icon={BarChart3}      iconColor="text-primary"    loading={lo} />
            <KpiCard title="Completadas"  value={fmtN(operations?.byStatus?.completed)} icon={Calendar}       iconColor="text-green-600"  loading={lo} />
            <KpiCard title="Canceladas"   value={fmtN(operations?.byStatus?.cancelled)} icon={ArrowDownRight} iconColor="text-red-600"    loading={lo} />
            <KpiCard title="No-show"      value={fmtN(operations?.byStatus?.noShow)}    icon={AlertTriangle}  iconColor="text-amber-600"  loading={lo} />
          </div>

          {/* Occupancy ring + breakdown */}
          {operations && (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Occupancy visual */}
              <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-6">
                <div className="relative shrink-0">
                  <DonutRing pct={operations.occupancyRate} size={88} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-foreground">
                      {(operations.occupancyRate * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Tasa de ocupación</p>
                  <p className="text-sm font-semibold text-foreground">
                    {fmtN(operations.usedSlots)} / {fmtN(operations.totalSlots)} turnos usados
                  </p>
                  <p className="text-xs text-muted-foreground">en el período seleccionado</p>
                </div>
              </div>

              {/* Status breakdown */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Estado de citas</p>
                {[
                  { label: "Completadas", value: operations.byStatus.completed, color: "bg-green-500" },
                  { label: "Canceladas",  value: operations.byStatus.cancelled, color: "bg-red-400"   },
                  { label: "No-shows",    value: operations.byStatus.noShow,    color: "bg-amber-400" },
                  { label: "Confirmadas", value: operations.byStatus.confirmed, color: "bg-blue-400"  },
                  { label: "Pendientes",  value: operations.byStatus.pending,   color: "bg-muted-foreground/40" },
                ].map(({ label, value, color }) => (
                  <ProgressBar
                    key={label}
                    label={label}
                    value={value}
                    max={operations.totalSlots}
                    color={color}
                    sublabel={fmtN(value)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Top service banner */}
          {operations?.topService && (
            <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <TrendingUp size={18} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Servicio más demandado</p>
                <p className="font-semibold text-foreground">{operations.topService.name}</p>
                <p className="text-sm text-muted-foreground">{operations.topService.count} citas en el período</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">{fmtN(operations.topService.count)}</p>
                <p className="text-[10px] text-muted-foreground">citas</p>
              </div>
            </div>
          )}

          {/* Source breakdown */}
          <div>
            <SectionHeader title="Citas por origen" icon={Calendar} />
            {operations && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                {[
                  { label: "Agenda manual",  value: operations.bySource.manual,      color: "bg-primary" },
                  { label: "Reserva online", value: operations.bySource.selfService,  color: "bg-cyan-500" },
                ].map(({ label, value, color }) => (
                  <ProgressBar
                    key={label}
                    label={label}
                    value={value}
                    max={operations.usedSlots}
                    color={color}
                    sublabel={`${fmtN(value)} (${operations.usedSlots > 0 ? ((value / operations.usedSlots) * 100).toFixed(1) : 0}%)`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── VENTAS ── */}
      {tab === "sales" && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard title="Ingresos"        value={fmtS(sales?.totalRevenue)}      icon={DollarSign}     iconColor="text-green-600" loading={ls} trend={DEMO_MODE ? DEMO_TRENDS.revenue : undefined} />
            <KpiCard title="Transacciones"   value={fmtN(sales?.totalTransactions)} icon={BarChart3}       iconColor="text-primary"   loading={ls} />
            <KpiCard title="Ticket promedio" value={fmtS(sales?.averageTicket)}     icon={TrendingUp}      iconColor="text-blue-600"  loading={ls} trend={DEMO_MODE ? DEMO_TRENDS.avgTicket : undefined} />
            <KpiCard
              title="Reembolsos"
              value={fmtS(sales?.refundAmount)}
              icon={ArrowDownRight} iconColor="text-red-600"
              sub={`${fmtN(sales?.refunds)} operaciones`}
              loading={ls}
            />
          </div>

          {/* Revenue bar chart */}
          {DEMO_MODE && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign size={15} className="text-green-600" />
                <h2 className="font-semibold text-foreground text-sm">Ingresos diarios — últimos 30 días</h2>
              </div>
              <div className="flex items-end gap-[2px] h-20">
                {REV_BY_DAY.map((v, i) => {
                  const max = Math.max(...REV_BY_DAY);
                  const h   = Math.max(2, (v / max) * 100);
                  return (
                    <div
                      key={i}
                      title={`S/ ${v.toLocaleString()}`}
                      className="flex-1 rounded-sm transition-all cursor-default"
                      style={{
                        height:      `${h}%`,
                        background:  `hsl(var(--primary) / ${0.4 + (h / 100) * 0.6})`,
                      }}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Hace 30 días</span>
                <span>Hoy</span>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {/* Payment methods */}
            <div>
              <SectionHeader title="Métodos de pago" icon={DollarSign} csvUrl={buildCsvUrl("sales", params)} />
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                {(sales?.byPaymentMethod ?? []).map((m, i) => {
                  const colors = ["bg-primary", "bg-blue-500", "bg-cyan-500"];
                  return (
                    <div key={m.method} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground font-medium">{m.method}</span>
                        <span className="text-muted-foreground">
                          {fmtS(m.amount)}
                          {" "}
                          <span className="text-[10px]">
                            ({paymentTotal > 0 ? ((m.amount / paymentTotal) * 100).toFixed(1) : 0}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", colors[i] ?? "bg-primary")}
                          style={{ width: `${paymentTotal > 0 ? (m.amount / paymentTotal) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">{fmtN(m.count)} transacciones</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top products */}
            <div>
              <SectionHeader title="Top productos vendidos" icon={Package} />
              <SimpleTable
                headers={["Producto", "Uds.", "Ingresos"]}
                rows={(sales?.topProducts ?? []).slice(0, 5).map((p) => [
                  p.name, fmtN(p.quantity), fmtS(p.revenue),
                ])}
                loading={ls}
              />
            </div>
          </div>

          {/* Top services */}
          <div>
            <SectionHeader title="Top servicios" icon={TrendingUp} />
            <SimpleTable
              headers={["Servicio", "Citas", "Ingresos", "% del total"]}
              rows={(sales?.topServices ?? []).slice(0, 5).map((s) => [
                s.name,
                fmtN(s.quantity),
                fmtS(s.revenue),
                sales?.totalRevenue ? `${((s.revenue / sales.totalRevenue) * 100).toFixed(1)}%` : "—",
              ])}
              loading={ls}
            />
          </div>
        </div>
      )}

      {/* ── CLIENTES ── */}
      {tab === "customers" && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard title="Nuevos clientes"  value={fmtN(customers?.newCustomers)}       icon={Users}      iconColor="text-primary"    loading={lc} trend={DEMO_MODE ? DEMO_TRENDS.newCustomers : undefined} />
            <KpiCard title="Recurrentes"       value={fmtN(customers?.recurringCustomers)} icon={RefreshCw}  iconColor="text-green-600"  loading={lc} />
            <KpiCard title="Total clientes"    value={fmtN(customers?.totalCustomers)}     icon={Users}      iconColor="text-violet-600" loading={lc} />
            <KpiCard title="Tasa de retención" value={fmtPct(customers?.retentionRate)}    icon={TrendingUp} iconColor="text-blue-600"   loading={lc} />
          </div>

          {/* Retention visual */}
          {customers && (
            <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-6">
              <div className="relative shrink-0">
                <DonutRing pct={customers.retentionRate} color="#10b981" size={88} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-base font-bold text-green-600">
                    {(customers.retentionRate * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-xs text-muted-foreground">Retención de pacientes</p>
                <ProgressBar
                  label="Clientes recurrentes"
                  value={customers.recurringCustomers}
                  max={customers.totalCustomers}
                  color="bg-green-500"
                  sublabel={`${fmtN(customers.recurringCustomers)} de ${fmtN(customers.totalCustomers)}`}
                />
                <ProgressBar
                  label="Clientes nuevos"
                  value={customers.newCustomers}
                  max={customers.totalCustomers}
                  color="bg-primary"
                  sublabel={`${fmtN(customers.newCustomers)} de ${fmtN(customers.totalCustomers)}`}
                />
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <SectionHeader title="Mayores gastadores" icon={DollarSign} csvUrl={buildCsvUrl("customers", params)} />
              <SimpleTable
                headers={["Paciente", "Total gastado"]}
                rows={(customers?.topSpenders ?? []).map((c) => [c.name, fmtS(c.totalSpent)])}
                loading={lc}
              />
            </div>
            <div>
              <SectionHeader title="Mayor frecuencia de visita" icon={Calendar} />
              <SimpleTable
                headers={["Paciente", "Visitas"]}
                rows={(customers?.topVisitors ?? []).map((c) => [c.name, fmtN(c.visits)])}
                loading={lc}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── NO-SHOW ── */}
      {tab === "noshow" && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard title="No-shows"          value={fmtN(noShow?.totalNoShows)}        icon={AlertTriangle}  iconColor="text-red-600"    loading={lns} trend={DEMO_MODE ? DEMO_TRENDS.noShow : undefined} invertTrend />
            <KpiCard title="Tasa no-show"      value={fmtPct(noShow?.noShowRate)}        icon={BarChart3}       iconColor="text-red-600"    loading={lns} />
            <KpiCard title="Cancelaciones"     value={fmtN(noShow?.totalCancellations)}  icon={ArrowDownRight} iconColor="text-amber-600"  loading={lns} trend={DEMO_MODE ? DEMO_TRENDS.cancellations : undefined} invertTrend />
            <KpiCard title="Tasa cancelación"  value={fmtPct(noShow?.cancellationRate)}  icon={Minus}           iconColor="text-amber-600"  loading={lns} />
          </div>

          {/* No-show visual */}
          {noShow && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Impacto en citas</p>
                {[
                  { label: "No-shows",     value: noShow.totalNoShows,       color: "bg-red-500"   },
                  { label: "Cancelaciones",value: noShow.totalCancellations,  color: "bg-amber-400" },
                ].map(({ label, value, color }) => {
                  const total = (noShow.totalNoShows + noShow.totalCancellations +
                    (FAKE_DASHBOARD.appointments.completed));
                  return (
                    <ProgressBar
                      key={label}
                      label={label}
                      value={value}
                      max={total}
                      color={color}
                      sublabel={`${fmtN(value)} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`}
                    />
                  );
                })}
              </div>

              <div className="rounded-xl border border-border bg-card p-5 space-y-2">
                <p className="text-xs font-medium text-muted-foreground mb-3">Motivos de cancelación</p>
                {(noShow?.topCancellationReasons ?? []).map((r) => {
                  const total = (noShow?.topCancellationReasons ?? []).reduce((a, b) => a + b.count, 0);
                  return (
                    <ProgressBar
                      key={r.reason}
                      label={r.reason || "No especificado"}
                      value={r.count}
                      max={total}
                      color="bg-amber-400"
                      sublabel={fmtN(r.count)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <SectionHeader title="Pacientes reincidentes" icon={Users} csvUrl={buildCsvUrl("no-show", params)} />
              <SimpleTable
                headers={["Paciente", "Incidencias"]}
                rows={(noShow?.recurringNoShows ?? []).map((c) => [c.customerName, fmtN(c.count)])}
                loading={lns}
              />
            </div>
            <div>
              <SectionHeader title="Motivos de cancelación (detalle)" icon={AlertTriangle} />
              <SimpleTable
                headers={["Motivo", "Cantidad"]}
                rows={(noShow?.topCancellationReasons ?? []).map((r) => [
                  r.reason || "No especificado", fmtN(r.count),
                ])}
                loading={lns}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── INVENTARIO ── */}
      {tab === "inventory" && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard title="Total productos" value={fmtN(inventory?.totalProducts)}             icon={Package}       iconColor="text-primary"    loading={li} />
            <KpiCard title="Valor del stock" value={fmtS(inventory?.totalStockValue)}           icon={DollarSign}    iconColor="text-green-600"  loading={li} />
            <KpiCard title="Stock bajo"      value={fmtN(inventory?.lowStockProducts?.length)}  icon={AlertTriangle} iconColor="text-amber-600"  loading={li} />
            <KpiCard title="Sin stock"       value={fmtN(inventory?.outOfStockProducts?.length)} icon={Package}      iconColor="text-red-600"    loading={li} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Low stock */}
            <div>
              <SectionHeader title="Productos con stock bajo" icon={AlertTriangle} csvUrl={buildCsvUrl("inventory", params)} />
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Producto</th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Nivel</th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {li ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <tr key={i} className="border-b border-border">
                            <td className="px-3 py-3"><Skeleton className="h-4 w-36" /></td>
                            <td className="px-3 py-3"><Skeleton className="h-2 w-24 rounded-full" /></td>
                            <td className="px-3 py-3"><Skeleton className="h-4 w-12" /></td>
                          </tr>
                        ))
                      ) : (inventory?.lowStockProducts ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-8 text-center text-xs text-muted-foreground">
                            Sin productos con stock bajo
                          </td>
                        </tr>
                      ) : (inventory?.lowStockProducts ?? []).map((p) => {
                        const pct = p.threshold > 0 ? Math.min(100, (p.stock / p.threshold) * 100) : 0;
                        return (
                          <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                            <td className="px-3 py-2.5 text-sm text-foreground">{p.name}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={cn("h-full rounded-full", pct < 40 ? "bg-red-500" : "bg-amber-400")}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={cn(
                                "text-xs font-semibold",
                                pct < 40 ? "text-red-600" : "text-amber-600",
                              )}>
                                {p.stock} / {p.threshold}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Top movements */}
            <div>
              <SectionHeader title="Mayor rotación" icon={TrendingUp} />
              <SimpleTable
                headers={["Producto", "Salidas"]}
                rows={(inventory?.topMovements ?? []).map((p) => [p.name, fmtN(p.totalOut)])}
                loading={li}
              />
            </div>
          </div>

          {/* Out of stock */}
          {(inventory?.outOfStockProducts ?? []).length > 0 && (
            <div>
              <SectionHeader title="Sin stock — requiere reposición inmediata" icon={Package} />
              <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 p-4">
                <div className="flex flex-wrap gap-2">
                  {(inventory?.outOfStockProducts ?? []).map((p) => (
                    <span key={p.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium">
                      <Package size={11} /> {p.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

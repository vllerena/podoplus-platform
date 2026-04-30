import { useState, useMemo } from "react";
import {
  Plus, Search, ToggleLeft, ToggleRight, Edit2,
  CreditCard, CheckCircle2, XCircle, Tag, Package,
  CalendarDays, Layers,
} from "lucide-react";
import { Button, Input, Badge, Skeleton } from "@podoplus/ui";
import {
  usePlans, useActivatePlan, useDeactivatePlan,
  type Plan, type PlanType,
} from "@/hooks/use-plans";
import { useAuthStore } from "@/stores/auth.store";
import { PlanDrawer } from "./components/PlanDrawer";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type CategoryFilter = "ALL" | "PLAN" | "PAQUETE";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(v: string | number): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? "S/ 0" : `S/ ${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

function fmtDuration(days: number): string {
  if (days === 365) return "1 año";
  if (days === 730) return "2 años";
  if (days % 365 === 0) return `${days / 365} años`;
  if (days === 180) return "6 meses";
  if (days === 90)  return "3 meses";
  if (days === 30)  return "1 mes";
  if (days % 30 === 0) return `${days / 30} meses`;
  return `${days} días`;
}

function pricePerSession(plan: Plan): string | null {
  if (plan.includedSessions === "unlimited" || plan.includedSessions === 0) return null;
  const price    = parseFloat(plan.price);
  const sessions = plan.includedSessions as number;
  if (!sessions || isNaN(price)) return null;
  const pps = price / sessions;
  return `S/ ${pps % 1 === 0 ? pps.toFixed(0) : pps.toFixed(0)}/ses.`;
}

/** Detecta si el plan es un "paquete" por su nombre. */
function getPlanCategory(plan: Plan): "PAQUETE" | "PLAN" {
  return plan.name.toUpperCase().startsWith("PAQUETE") ? "PAQUETE" : "PLAN";
}

const PLAN_TYPE_LABEL: Record<PlanType, string> = {
  SESSION: "Por sesiones",
  DATE:    "Por fecha",
  HYBRID:  "Sesiones + fecha",
};

const PLAN_TYPE_COLOR: Record<PlanType, string> = {
  SESSION: "bg-blue-50 text-blue-700 border-blue-200",
  DATE:    "bg-purple-50 text-purple-700 border-purple-200",
  HYBRID:  "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, color, loading,
}: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; color: string; loading: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", color)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        {loading
          ? <Skeleton className="h-5 w-16 mt-1" />
          : (
            <div className="flex items-baseline gap-1.5">
              <p className="text-lg font-bold leading-tight">{value}</p>
              {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
            </div>
          )
        }
      </div>
    </div>
  );
}

// ── Plan Card ─────────────────────────────────────────────────────────────────

function PlanCard({
  plan, canAdmin, onEdit, onToggle, isToggling,
}: {
  plan:       Plan;
  canAdmin:   boolean;
  onEdit:     (p: Plan) => void;
  onToggle:   (p: Plan) => void;
  isToggling: boolean;
}) {
  const accentColor  = plan.color ?? "#6366f1";
  const category     = getPlanCategory(plan);
  const pps          = pricePerSession(plan);
  const validity     = fmtDuration(plan.durationDays);
  const sessions     = plan.includedSessions;
  const sessionLabel = sessions === "unlimited"
    ? "Ilimitadas"
    : `${sessions} sesión${sessions !== 1 ? "es" : ""}`;

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-card overflow-hidden transition-all duration-200 flex flex-col",
        plan.isActive
          ? "hover:shadow-lg hover:-translate-y-0.5 hover:border-border/80"
          : "opacity-55 grayscale-[30%]",
      )}
    >
      {/* Accent bar */}
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: accentColor }} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm leading-snug truncate" title={plan.name}>
              {plan.name}
            </h3>
            {plan.description && (
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                {plan.description}
              </p>
            )}
          </div>
          <span className={cn(
            "shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border",
            category === "PAQUETE"
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-sky-50 text-sky-700 border-sky-200",
          )}>
            {category === "PAQUETE"
              ? <Package size={9} />
              : <Tag size={9} />
            }
            {category === "PAQUETE" ? "Paquete" : "Plan"}
          </span>
        </div>

        {/* Price — prominent */}
        <div className="flex items-end justify-between gap-2">
          <span
            className="text-2xl font-extrabold tracking-tight leading-none"
            style={{ color: accentColor }}
          >
            {fmtPrice(plan.price)}
          </span>
          {pps && (
            <span className="text-[11px] text-muted-foreground font-medium bg-muted/60 rounded-md px-1.5 py-0.5">
              {pps}
            </span>
          )}
        </div>

        {/* Details pills */}
        <div className="flex flex-wrap gap-1.5">
          {/* Sessions */}
          <span className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-[11px] font-medium text-foreground">
            <Layers size={11} className="text-muted-foreground" />
            {sessionLabel}
          </span>

          {/* Validity */}
          <span className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-[11px] font-medium text-foreground">
            <CalendarDays size={11} className="text-muted-foreground" />
            {validity}
          </span>

          {/* Type */}
          <span className={cn(
            "inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-semibold",
            PLAN_TYPE_COLOR[plan.planType],
          )}>
            {PLAN_TYPE_LABEL[plan.planType]}
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 mt-auto border-t border-border/60">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border",
            plan.isActive
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-muted text-muted-foreground border-muted-foreground/20",
          )}>
            <span className={cn(
              "h-1.5 w-1.5 rounded-full",
              plan.isActive ? "bg-green-500" : "bg-muted-foreground/40",
            )} />
            {plan.isActive ? "Activo" : "Inactivo"}
          </span>

          {canAdmin && (
            <div className="flex items-center gap-0.5">
              <Button
                size="sm" variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                title="Editar"
                onClick={() => onEdit(plan)}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm" variant="ghost"
                className={cn(
                  "h-7 w-7 p-0",
                  plan.isActive
                    ? "text-muted-foreground hover:text-destructive"
                    : "text-muted-foreground hover:text-primary",
                )}
                title={plan.isActive ? "Desactivar plan" : "Activar plan"}
                disabled={isToggling}
                onClick={() => onToggle(plan)}
              >
                {plan.isActive
                  ? <ToggleLeft  className="h-4 w-4" />
                  : <ToggleRight className="h-4 w-4" />
                }
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Skeleton Card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Skeleton className="h-1 w-full rounded-none" />
      <div className="p-4 space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-7 w-2/5" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="h-6 w-24 rounded-md" />
        </div>
        <Skeleton className="h-px w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-5 w-14 rounded-full" />
          <div className="flex gap-1">
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  icon, label, count, color,
}: {
  icon: React.ReactNode; label: string; count: number; color: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", color)}>
        {icon}
      </div>
      <span className="font-semibold text-sm text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">({count})</span>
      <div className="flex-1 h-px bg-border/50 ml-1" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function PlansPage() {
  const [search,     setSearch]     = useState("");
  const [showAll,    setShowAll]    = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editPlan,   setEditPlan]   = useState<Plan | null>(null);
  const [catFilter,  setCatFilter]  = useState<CategoryFilter>("ALL");

  const canAdmin = useAuthStore((s) =>
    s.hasPermission?.("plan.manage") ||
    s.hasAnyRole?.(["SUPER_ADMIN", "GENERAL_MANAGER"]) ||
    true
  );

  const { data: plans = [], isLoading } = usePlans();
  const activateMut   = useActivatePlan();
  const deactivateMut = useDeactivatePlan();
  const isToggling    = activateMut.isPending || deactivateMut.isPending;

  // Stats
  const stats = useMemo(() => {
    const total    = plans.length;
    const active   = plans.filter((p) => p.isActive).length;
    const packages = plans.filter((p) => getPlanCategory(p) === "PAQUETE").length;
    const regularPlans = total - packages;

    // Average price per session (active SESSION/HYBRID only)
    const withSessions = plans.filter(
      (p) => p.isActive && p.includedSessions !== "unlimited" && (p.includedSessions as number) > 0,
    );
    const avgPps = withSessions.length
      ? withSessions.reduce((acc, p) => {
          return acc + parseFloat(p.price) / (p.includedSessions as number);
        }, 0) / withSessions.length
      : 0;

    return { total, active, inactive: total - active, packages, regularPlans, avgPps };
  }, [plans]);

  // Filtered + sorted list
  const { planSection, packageSection } = useMemo(() => {
    let list = plans;
    if (!showAll)              list = list.filter((p) => p.isActive);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false),
      );
    }

    const allPlans    = list.filter((p) => getPlanCategory(p) === "PLAN")
      .sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    const allPackages = list.filter((p) => getPlanCategory(p) === "PAQUETE")
      .sort((a, b) => {
        const sa = a.includedSessions === "unlimited" ? 9999 : (a.includedSessions as number);
        const sb = b.includedSessions === "unlimited" ? 9999 : (b.includedSessions as number);
        return sa - sb;
      });

    return {
      planSection:    catFilter === "PAQUETE" ? [] : allPlans,
      packageSection: catFilter === "PLAN"    ? [] : allPackages,
    };
  }, [plans, showAll, search, catFilter]);

  const totalFiltered = planSection.length + packageSection.length;

  const openCreate = () => { setEditPlan(null); setDrawerOpen(true); };
  const openEdit   = (p: Plan) => { setEditPlan(p); setDrawerOpen(true); };
  const handleToggle = (p: Plan) => {
    if (p.isActive) deactivateMut.mutate(p.id);
    else activateMut.mutate(p.id);
  };

  const hasFilters = !!(search || catFilter !== "ALL" || showAll);

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary shrink-0" />
            Planes y Paquetes
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestiona los planes de suscripción y paquetes de sesiones disponibles
          </p>
        </div>
        {canAdmin && (
          <Button size="sm" onClick={openCreate} className="shrink-0">
            <Plus className="h-4 w-4 mr-1.5" />
            Nuevo plan
          </Button>
        )}
      </div>

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total registrados"
          value={String(stats.total)}
          icon={<CreditCard className="h-5 w-5 text-indigo-600" />}
          color="bg-indigo-50"
          loading={isLoading}
        />
        <StatCard
          label="Planes activos"
          value={String(stats.active)}
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          color="bg-green-50"
          loading={isLoading}
        />
        <StatCard
          label="Paquetes"
          value={String(stats.packages)}
          icon={<Package className="h-5 w-5 text-amber-600" />}
          color="bg-amber-50"
          loading={isLoading}
        />
        <StatCard
          label="Precio prom. / ses."
          value={stats.avgPps > 0 ? `S/ ${stats.avgPps.toFixed(0)}` : "—"}
          icon={<Tag className="h-5 w-5 text-sky-600" />}
          color="bg-sky-50"
          loading={isLoading}
        />
      </div>

      {/* ── Filters ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-44 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 h-9"
            placeholder="Buscar plan o paquete…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1">
          {(["ALL", "PLAN", "PAQUETE"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors h-9",
                catFilter === c
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {c === "ALL"     && "Todos"}
              {c === "PLAN"    && <><Tag size={11} /> Planes</>}
              {c === "PAQUETE" && <><Package size={11} /> Paquetes</>}
            </button>
          ))}
        </div>

        {/* Show inactive toggle */}
        <button
          onClick={() => setShowAll((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors h-9 ml-auto",
            showAll
              ? "bg-primary/10 border-primary/30 text-primary"
              : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          {showAll ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
          {showAll ? "Ocultar inactivos" : "Mostrar inactivos"}
        </button>
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-6">
          <div>
            <Skeleton className="h-7 w-40 mb-4 rounded-lg" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          </div>
          <div>
            <Skeleton className="h-7 w-36 mb-4 rounded-lg" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          </div>
        </div>
      ) : totalFiltered === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border rounded-xl bg-card">
          <CreditCard className="h-12 w-12 mb-3 opacity-20" />
          <p className="font-medium text-base">
            {search ? `Sin resultados para "${search}"` : "Sin planes registrados"}
          </p>
          <p className="text-sm mt-1 opacity-70">
            {!search && !hasFilters && "Crea el primer plan para comenzar a asignar suscripciones"}
          </p>
          {canAdmin && !search && !hasFilters && (
            <Button className="mt-5" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Crear primer plan
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-8">

          {/* ── Sección Planes ── */}
          {planSection.length > 0 && (
            <div>
              <SectionHeader
                icon={<Tag size={14} className="text-sky-600" />}
                label="Planes"
                count={planSection.length}
                color="bg-sky-50"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {planSection.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    canAdmin={canAdmin}
                    onEdit={openEdit}
                    onToggle={handleToggle}
                    isToggling={isToggling}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Sección Paquetes ── */}
          {packageSection.length > 0 && (
            <div>
              <SectionHeader
                icon={<Package size={14} className="text-amber-600" />}
                label="Paquetes de sesiones"
                count={packageSection.length}
                color="bg-amber-50"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {packageSection.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    canAdmin={canAdmin}
                    onEdit={openEdit}
                    onToggle={handleToggle}
                    isToggling={isToggling}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Footer note */}
          <p className="text-xs text-muted-foreground">
            {totalFiltered} plan{totalFiltered !== 1 ? "es" : ""}
            {" "}({planSection.length} plan{planSection.length !== 1 ? "es" : ""}, {packageSection.length} paquete{packageSection.length !== 1 ? "s" : ""})
            {!showAll && stats.inactive > 0 && (
              <span className="ml-2 text-muted-foreground/70">
                · {stats.inactive} inactivo{stats.inactive !== 1 ? "s" : ""} oculto{stats.inactive !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
      )}

      {/* ── Drawer ─────────────────────────────────────────────────── */}
      <PlanDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        plan={editPlan}
      />
    </div>
  );
}

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, ChevronLeft, ChevronRight, MoreHorizontal,
  PauseCircle, PlayCircle, XCircle, RefreshCw, Layers,
  CheckCircle2, Clock3, AlertCircle, Ban,
} from "lucide-react";
import {
  Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Skeleton, Input,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@podoplus/ui";
import {
  useSubscriptions, usePlans, useResumeSubscription, useRenewSubscription,
  type Subscription, type SubscriptionStatus,
} from "@/hooks/use-plans";
import { useBranchContext } from "@/hooks/use-branch-context";
import { useDebounce }  from "@/hooks/use-debounce";
import { AssignSubscriptionModal } from "./components/AssignSubscriptionModal";
import { PauseSubscriptionModal }  from "./components/PauseSubscriptionModal";
import { CancelSubscriptionModal } from "./components/CancelSubscriptionModal";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SubscriptionStatus, {
  label: string; color: string; dot: string; badge: string;
}> = {
  ACTIVE:   { label: "Activa",    color: "bg-green-100 text-green-800",   dot: "bg-green-500",  badge: "text-green-700" },
  PAUSED:   { label: "Pausada",   color: "bg-yellow-100 text-yellow-800", dot: "bg-yellow-500", badge: "text-yellow-700" },
  EXPIRED:  { label: "Expirada",  color: "bg-gray-100 text-gray-600",     dot: "bg-gray-400",   badge: "text-gray-500" },
  CANCELED: { label: "Cancelada", color: "bg-red-100 text-red-700",       dot: "bg-red-500",    badge: "text-red-600" },
};

const PLAN_TYPE_LABEL: Record<string, string> = {
  SESSION: "Sesiones",
  DATE:    "Tiempo",
  HYBRID:  "Híbrido",
};

const PLAN_TYPE_COLOR: Record<string, string> = {
  SESSION: "bg-blue-100 text-blue-700",
  DATE:    "bg-purple-100 text-purple-700",
  HYBRID:  "bg-orange-100 text-orange-700",
};

// ── Status stat card ──────────────────────────────────────────────────────────

interface StatCardProps {
  label:   string;
  count:   number;
  icon:    React.ElementType;
  active:  boolean;
  accent:  string;   // tailwind bg colour for the icon background
  onClick: () => void;
}

function StatCard({ label, count, icon: Icon, active, accent, onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 text-left transition-all duration-150 w-full flex items-start gap-3",
        active
          ? "border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20"
          : "bg-card hover:border-muted-foreground/25 hover:shadow-sm",
      )}
    >
      <div className={cn("rounded-lg p-2 shrink-0", accent)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{count}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </button>
  );
}

// ── Subscription row ──────────────────────────────────────────────────────────

function SubscriptionRow({
  sub,
  onPause,
  onCancel,
  onResume,
  onRenew,
}: {
  sub:     Subscription;
  onPause:  (s: Subscription) => void;
  onCancel: (s: Subscription) => void;
  onResume: (id: string) => void;
  onRenew:  (id: string) => void;
}) {
  const navigate  = useNavigate();
  const cfg       = STATUS_CONFIG[sub.status];
  const canPause  = sub.status === "ACTIVE";
  const canResume = sub.status === "PAUSED";
  const canCancel = sub.status === "ACTIVE" || sub.status === "PAUSED";
  const canRenew  = sub.status === "EXPIRED" || sub.status === "ACTIVE";

  const sessionsDisplay =
    sub.remainingSessions === "unlimited"
      ? "∞"
      : `${sub.remainingSessions}`;

  const sessionsColor =
    sub.remainingSessions === "unlimited"
      ? "text-purple-600"
      : typeof sub.remainingSessions === "number" && sub.remainingSessions <= 2
        ? "text-red-600 font-semibold"
        : typeof sub.remainingSessions === "number" && sub.remainingSessions <= 4
          ? "text-amber-600"
          : "text-green-700";

  const isExpired = sub.status === "EXPIRED";
  const isNearEnd = !isExpired && sub.status === "ACTIVE" &&
    new Date(sub.endDate) <= new Date(Date.now() + 7 * 86400000);

  return (
    <tr
      className="border-b transition-colors hover:bg-muted/40 cursor-pointer group"
      onClick={() => navigate(`/customers/${sub.customerId}`)}
    >
      {/* Cliente */}
      <td className="px-4 py-3">
        <p className="text-sm font-medium group-hover:text-primary transition-colors">
          {sub.customerName || "—"}
        </p>
      </td>

      {/* Plan */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {sub.planColor && (
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: sub.planColor }}
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate max-w-[160px]">{sub.planName}</p>
            <span className={cn(
              "inline-flex text-[10px] px-1.5 py-0.5 rounded font-medium",
              PLAN_TYPE_COLOR[sub.planType] ?? "bg-gray-100 text-gray-600"
            )}>
              {PLAN_TYPE_LABEL[sub.planType] ?? sub.planType}
            </span>
          </div>
        </div>
      </td>

      {/* Estado */}
      <td className="px-4 py-3">
        <span className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
          cfg.color
        )}>
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />
          {cfg.label}
        </span>
      </td>

      {/* Sesiones restantes */}
      <td className="px-4 py-3 text-sm">
        {sub.planType === "DATE" ? (
          <span className="text-purple-600 font-medium text-base">∞</span>
        ) : (
          <div>
            <span className={cn("text-base font-semibold", sessionsColor)}>
              {sessionsDisplay}
            </span>
            <span className="text-xs text-muted-foreground ml-1">ses.</span>
          </div>
        )}
      </td>

      {/* Vigencia */}
      <td className="px-4 py-3 text-sm">
        <p className="text-xs text-muted-foreground">{fmtDate(sub.startDate)}</p>
        <p className={cn(
          "text-xs font-medium",
          isExpired  ? "text-red-500" :
          isNearEnd  ? "text-amber-600" :
          ""
        )}>
          {isExpired ? "Venció " : "Hasta "}{fmtDate(sub.endDate)}
          {isNearEnd && <span className="ml-1 text-[10px]">⚠</span>}
        </p>
      </td>

      {/* Acciones */}
      <td
        className="px-4 py-3 text-right"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {canResume && (
              <DropdownMenuItem onClick={() => onResume(sub.id)}>
                <PlayCircle className="mr-2 h-4 w-4 text-green-600" />
                Reanudar
              </DropdownMenuItem>
            )}
            {canPause && (
              <DropdownMenuItem onClick={() => onPause(sub)}>
                <PauseCircle className="mr-2 h-4 w-4 text-amber-600" />
                Pausar
              </DropdownMenuItem>
            )}
            {canRenew && (
              <DropdownMenuItem onClick={() => onRenew(sub.id)}>
                <RefreshCw className="mr-2 h-4 w-4 text-blue-600" />
                Renovar
              </DropdownMenuItem>
            )}
            {canCancel && <DropdownMenuSeparator />}
            {canCancel && (
              <DropdownMenuItem
                onClick={() => onCancel(sub)}
                className="text-destructive focus:text-destructive"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancelar suscripción
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const STATUS_TABS: Array<{ value: SubscriptionStatus | "ALL"; label: string }> = [
  { value: "ALL",      label: "Todas" },
  { value: "ACTIVE",   label: "Activas" },
  { value: "PAUSED",   label: "Pausadas" },
  { value: "EXPIRED",  label: "Expiradas" },
  { value: "CANCELED", label: "Canceladas" },
];

export function SubscriptionsPage() {
  const { activeBranchId } = useBranchContext();
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | "ALL">("ALL");
  const [planFilter,   setPlanFilter]   = useState("");
  const [search,       setSearch]       = useState("");
  const [cursor,       setCursor]       = useState<string | undefined>(undefined);
  const [cursorStack,  setCursorStack]  = useState<string[]>([]);

  const [modalOpen,    setModalOpen]    = useState(false);
  const [pauseTarget,  setPauseTarget]  = useState<Subscription | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Subscription | null>(null);

  const debouncedSearch = useDebounce(search, 250);

  const resume = useResumeSubscription();
  const renew  = useRenewSubscription();

  const { data: plans } = usePlans(true);

  // ── Stats: separate query with no status filter ──────────────────────────
  const { data: allData } = useSubscriptions({
    branchId: activeBranchId || undefined,
    limit:    1,   // we only need totals — backend returns total count
  });

  const { data: activeData }   = useSubscriptions({ branchId: activeBranchId || undefined, status: "ACTIVE",   limit: 1 });
  const { data: pausedData }   = useSubscriptions({ branchId: activeBranchId || undefined, status: "PAUSED",   limit: 1 });
  const { data: expiredData }  = useSubscriptions({ branchId: activeBranchId || undefined, status: "EXPIRED",  limit: 1 });
  const { data: canceledData } = useSubscriptions({ branchId: activeBranchId || undefined, status: "CANCELED", limit: 1 });

  const stats = {
    total:    allData?.total    ?? 0,
    active:   activeData?.total  ?? 0,
    paused:   pausedData?.total  ?? 0,
    expired:  expiredData?.total ?? 0,
    canceled: canceledData?.total ?? 0,
  };

  // ── Main list query ──────────────────────────────────────────────────────
  const { data: subsData, isLoading, isError, error } = useSubscriptions({
    branchId: activeBranchId || undefined,
    status:   statusFilter === "ALL" ? undefined : statusFilter,
    planId:   planFilter || undefined,
    cursor,
    limit:    30,
  });

  const allSubs    = subsData?.data ?? [];
  const total      = subsData?.total ?? 0;
  const nextCursor = subsData?.nextCursor;
  const hasNext    = subsData?.hasNext ?? false;
  const page       = cursorStack.length + 1;

  // Client-side search filter (by customer name / plan name)
  const subscriptions = useMemo(() => {
    if (!debouncedSearch) return allSubs;
    const q = debouncedSearch.toLowerCase();
    return allSubs.filter((s) =>
      (s.customerName ?? "").toLowerCase().includes(q) ||
      (s.planName     ?? "").toLowerCase().includes(q)
    );
  }, [allSubs, debouncedSearch]);

  const resetCursor = () => { setCursor(undefined); setCursorStack([]); };

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

  const handleStatusFilter = (s: SubscriptionStatus | "ALL") => {
    setStatusFilter(s);
    resetCursor();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suscripciones</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Planes asignados a pacientes · válidos en todas las sedes
          </p>
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Asignar plan
        </Button>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Activas"
          count={stats.active}
          icon={CheckCircle2}
          active={statusFilter === "ACTIVE"}
          accent="bg-green-100 text-green-700"
          onClick={() => handleStatusFilter(statusFilter === "ACTIVE" ? "ALL" : "ACTIVE")}
        />
        <StatCard
          label="Pausadas"
          count={stats.paused}
          icon={Clock3}
          active={statusFilter === "PAUSED"}
          accent="bg-yellow-100 text-yellow-700"
          onClick={() => handleStatusFilter(statusFilter === "PAUSED" ? "ALL" : "PAUSED")}
        />
        <StatCard
          label="Expiradas"
          count={stats.expired}
          icon={AlertCircle}
          active={statusFilter === "EXPIRED"}
          accent="bg-gray-100 text-gray-600"
          onClick={() => handleStatusFilter(statusFilter === "EXPIRED" ? "ALL" : "EXPIRED")}
        />
        <StatCard
          label="Canceladas"
          count={stats.canceled}
          icon={Ban}
          active={statusFilter === "CANCELED"}
          accent="bg-red-100 text-red-600"
          onClick={() => handleStatusFilter(statusFilter === "CANCELED" ? "ALL" : "CANCELED")}
        />
      </div>

      {/* ── Filters bar ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status tabs */}
        <div className="flex rounded-lg border overflow-hidden">
          {STATUS_TABS.map((tab, i) => (
            <button
              key={tab.value}
              onClick={() => handleStatusFilter(tab.value)}
              className={cn(
                "px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
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

        <div className="flex items-center gap-2 ml-auto">
          {/* Plan filter */}
          <Select
            value={planFilter}
            onValueChange={(v) => { setPlanFilter(v === "_all" ? "" : v); resetCursor(); }}
          >
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="Todos los planes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos los planes</SelectItem>
              {plans?.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
          <Input
            className="w-52 h-8 text-xs"
            placeholder="Buscar paciente o plan…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        {/* Count bar */}
        {!isLoading && total > 0 && (
          <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-1 text-xs text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />
            <span>
              {total} suscripción{total !== 1 ? "es" : ""}
              {statusFilter !== "ALL" && (
                <span className="ml-1 text-foreground font-medium">
                  · {STATUS_CONFIG[statusFilter as SubscriptionStatus]?.label}
                </span>
              )}
            </span>
            {debouncedSearch && subscriptions.length !== allSubs.length && (
              <span className="ml-1">· {subscriptions.length} coincidencias</span>
            )}
          </div>
        )}

        {isError ? (
          <div className="p-8 text-center text-sm text-destructive">
            Error al cargar suscripciones: {(error as Error)?.message}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Paciente</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Plan</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Sesiones</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Vigencia</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <Skeleton className="h-4 w-full rounded" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : subscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                          <Layers className="h-10 w-10 mb-3 opacity-20" />
                          <p className="font-medium text-foreground">Sin suscripciones</p>
                          <p className="text-sm mt-1">
                            {statusFilter !== "ALL" || planFilter || debouncedSearch
                              ? "Prueba ajustando los filtros"
                              : "Aún no hay planes asignados a pacientes"}
                          </p>
                          {statusFilter === "ALL" && !planFilter && !debouncedSearch && (
                            <Button
                              className="mt-4"
                              size="sm"
                              onClick={() => setModalOpen(true)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Asignar primer plan
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    subscriptions.map((sub) => (
                      <SubscriptionRow
                        key={sub.id}
                        sub={sub}
                        onPause={setPauseTarget}
                        onCancel={setCancelTarget}
                        onResume={(id) => resume.mutate(id)}
                        onRenew={(id)  => renew.mutate(id)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {(cursorStack.length > 0 || hasNext) && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground bg-muted/20">
                <span className="text-xs">Página {page}</span>
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

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <AssignSubscriptionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
      <PauseSubscriptionModal
        subscription={pauseTarget}
        onClose={() => setPauseTarget(null)}
      />
      <CancelSubscriptionModal
        subscription={cancelTarget}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  );
}

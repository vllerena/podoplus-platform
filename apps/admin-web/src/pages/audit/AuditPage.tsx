import { useState, useMemo, useEffect } from "react";
import {
  Shield, Search, ChevronLeft, ChevronRight,
  User, Cpu, Calendar, Filter,
  ChevronDown, ChevronUp, Copy, Check, Building2, RefreshCw,
} from "lucide-react";
import {
  Button, Input, Label,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Skeleton,
} from "@podoplus/ui";
import { cn } from "@/lib/utils";
import { useAuditLogs, type AuditLogEntry, type AuditFilters } from "@/hooks/use-audit";
import { useBranches }     from "@/hooks/use-branches";
import { useBranchContext } from "@/hooks/use-branch-context";
import { useAuthStore }    from "@/stores/auth.store";
import { useUsers }        from "@/hooks/use-users";

// ── Constantes ────────────────────────────────────────────────────────────────

const LIMIT = 50;

const ENTITY_TYPES = [
  { value: "appointment",   label: "Cita" },
  { value: "customer",      label: "Cliente" },
  { value: "sale",          label: "Venta" },
  { value: "cash_register", label: "Caja" },
  { value: "subscription",  label: "Suscripción" },
  { value: "plan",          label: "Plan" },
  { value: "user",          label: "Usuario" },
  { value: "inventory",     label: "Inventario" },
  { value: "product",       label: "Producto" },
  { value: "service",       label: "Servicio" },
  { value: "branch",        label: "Sede" },
];

// Colores y etiquetas por verbo de acción
const ACTION_CONFIG: Record<string, { color: string; label: string }> = {
  created:     { color: "bg-green-100 text-green-700",     label: "Creado" },
  updated:     { color: "bg-blue-100 text-blue-700",       label: "Actualizado" },
  deleted:     { color: "bg-red-100 text-red-700",         label: "Eliminado" },
  confirmed:   { color: "bg-teal-100 text-teal-700",       label: "Confirmado" },
  completed:   { color: "bg-emerald-100 text-emerald-700", label: "Completado" },
  canceled:    { color: "bg-red-100 text-red-600",         label: "Cancelado" },
  rescheduled: { color: "bg-amber-100 text-amber-700",     label: "Reprogramado" },
  no_show:     { color: "bg-orange-100 text-orange-700",   label: "No se presentó" },
  voided:      { color: "bg-red-100 text-red-700",         label: "Anulado" },
  refunded:    { color: "bg-purple-100 text-purple-700",   label: "Reembolsado" },
  assigned:    { color: "bg-violet-100 text-violet-700",   label: "Asignado" },
  consumed:    { color: "bg-indigo-100 text-indigo-700",   label: "Consumido" },
  renewed:     { color: "bg-cyan-100 text-cyan-700",       label: "Renovado" },
  paused:      { color: "bg-yellow-100 text-yellow-700",   label: "Pausado" },
  resumed:     { color: "bg-lime-100 text-lime-700",       label: "Reanudado" },
  opened:      { color: "bg-green-100 text-green-700",     label: "Abierto" },
  closed:      { color: "bg-slate-100 text-slate-700",     label: "Cerrado" },
  adjusted:    { color: "bg-orange-100 text-orange-700",   label: "Ajustado" },
  login:       { color: "bg-blue-100 text-blue-700",       label: "Login" },
  logout:      { color: "bg-slate-100 text-slate-600",     label: "Logout" },
  checked_in:  { color: "bg-teal-100 text-teal-700",       label: "Check-in" },
  in_service:  { color: "bg-blue-100 text-blue-700",       label: "En servicio" },
  managed:     { color: "bg-blue-100 text-blue-700",       label: "Gestionado" },
};

function getActionConfig(action: string) {
  const verb = action.split(".")[1] ?? action;
  return ACTION_CONFIG[verb] ?? { color: "bg-muted text-muted-foreground", label: verb };
}

const ENTITY_LABEL: Record<string, string> = Object.fromEntries(
  ENTITY_TYPES.map((e) => [e.value, e.label])
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtRelative(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "Ahora";
  if (mins  < 60) return `Hace ${mins}m`;
  if (hours < 24) return `Hace ${hours}h`;
  if (days  < 7)  return `Hace ${days}d`;
  return fmtDate(iso);
}

// ── CopyId ────────────────────────────────────────────────────────────────────

function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="group inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      title={`Copiar ID: ${id}`}
    >
      <span className="truncate max-w-[80px]">{id.slice(0, 8)}…</span>
      {copied
        ? <Check size={10} className="text-green-500 shrink-0" />
        : <Copy  size={10} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      }
    </button>
  );
}

// ── MetadataPanel ─────────────────────────────────────────────────────────────

function MetadataPanel({ metadata }: { metadata?: Record<string, unknown> }) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return <p className="text-xs text-muted-foreground italic">Sin metadata adicional</p>;
  }
  return (
    <pre className="text-[11px] leading-relaxed bg-muted/40 border border-border rounded-lg p-3 overflow-x-auto text-foreground">
      {JSON.stringify(metadata, null, 2)}
    </pre>
  );
}

// ── AuditRow ──────────────────────────────────────────────────────────────────

function AuditRow({
  log,
  branchMap,
  isExpanded,
  onToggle,
}: {
  log:        AuditLogEntry;
  branchMap:  Map<string, string>;
  isExpanded: boolean;
  onToggle:   () => void;
}) {
  const actionCfg   = getActionConfig(log.action);
  const entityLabel = ENTITY_LABEL[log.entity_type] ?? log.entity_type;
  const branchName  = log.branch_id ? (branchMap.get(log.branch_id) ?? "—") : "—";
  const hasDetail   = !!(log.metadata && Object.keys(log.metadata).length > 0) || !!log.reason;

  // Split action into entity prefix + verb  e.g. "appointment.created" → "appointment" + "created"
  const [actionEntity, actionVerb] = log.action.includes(".")
    ? log.action.split(".", 2)
    : [null, log.action];

  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          "border-b border-border/50 transition-colors cursor-pointer",
          isExpanded ? "bg-primary/[0.03]" : "hover:bg-muted/30",
        )}
      >
        {/* Fecha */}
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-foreground">
              {fmtRelative(log.created_at)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {fmtDateTime(log.created_at)}
            </span>
          </div>
        </td>

        {/* Actor */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn(
              "h-6 w-6 rounded-full flex items-center justify-center shrink-0",
              log.actor_type === "USER" ? "bg-primary/10" : "bg-muted"
            )}>
              {log.actor_type === "USER"
                ? <User size={12} className="text-primary" />
                : <Cpu  size={12} className="text-muted-foreground" />
              }
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate text-foreground">
                {log.actor_name || (log.actor_type === "SYSTEM" ? "Sistema" : "Usuario")}
              </p>
              {log.actor_id && <CopyId id={log.actor_id} />}
            </div>
          </div>
        </td>

        {/* Acción */}
        <td className="px-4 py-3">
          <div className="flex flex-col gap-0.5" title={log.action}>
            <span className={cn(
              "inline-flex items-center self-start rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
              actionCfg.color,
            )}>
              {actionCfg.label}
            </span>
            {actionEntity && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {actionEntity}
              </span>
            )}
          </div>
        </td>

        {/* Entidad */}
        <td className="px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-foreground">{entityLabel}</span>
            <CopyId id={log.entity_id} />
          </div>
        </td>

        {/* Sede */}
        <td className="px-4 py-3">
          <span className="text-xs text-muted-foreground">{branchName}</span>
        </td>

        {/* Razón */}
        <td className="px-4 py-3 max-w-[160px]">
          <span className="text-xs text-muted-foreground truncate block">
            {log.reason || "—"}
          </span>
        </td>

        {/* Expand */}
        <td className="px-3 py-3 text-right">
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className={cn(
              "p-1 rounded-md transition-colors",
              isExpanded
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:bg-muted",
              !hasDetail && "opacity-30 cursor-default"
            )}
            disabled={!hasDetail}
            title={hasDetail ? (isExpanded ? "Ocultar detalle" : "Ver detalle") : "Sin detalle"}
          >
            {isExpanded
              ? <ChevronUp   size={14} />
              : <ChevronDown size={14} />
            }
          </button>
        </td>
      </tr>

      {/* Fila expandida — metadata + razón completa */}
      {isExpanded && (
        <tr className="bg-primary/[0.02]">
          <td colSpan={7} className="px-6 py-4">
            <div className="space-y-3">
              {log.reason && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Razón
                  </p>
                  <p className="text-sm text-foreground">{log.reason}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Metadata
                </p>
                <MetadataPanel metadata={log.metadata} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-border/50">
      <td className="px-4 py-3"><Skeleton className="h-8 w-28" /></td>
      <td className="px-4 py-3"><Skeleton className="h-6 w-32" /></td>
      <td className="px-4 py-3"><Skeleton className="h-5 w-24 rounded-full" /></td>
      <td className="px-4 py-3"><Skeleton className="h-6 w-24" /></td>
      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
      <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
      <td className="px-3 py-3"><Skeleton className="h-6 w-6 rounded-md ml-auto" /></td>
    </tr>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export function AuditPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);

  // Contexto global de sede
  const { activeBranchId } = useBranchContext();

  // Filtros — estados de los inputs
  const [entityType,   setEntityType]   = useState("");
  const [actionInput,  setActionInput]  = useState(""); // valor inmediato del input
  const [action,       setAction]       = useState(""); // valor debounced que va a la query
  const [actorId,      setActorId]      = useState("");
  const [from,         setFrom]         = useState("");
  const [to,           setTo]           = useState("");
  const [page,         setPage]         = useState(1);

  // Fila expandida
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Debounce del campo Acción (400 ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setAction(actionInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [actionInput]);

  // Reset de página cuando cambia la sede global
  useEffect(() => { setPage(1); }, [activeBranchId]);

  // Mapa de sede para mostrar nombres en la tabla
  const { data: branches = [] } = useBranches();
  const branchMap = useMemo(
    () => new Map(branches.map((b) => [b.id, b.name])),
    [branches]
  );

  // Lista de usuarios para el filtro de actor
  const { data: usersResult } = useUsers({ limit: 500, isActive: true });
  const users = usersResult?.data ?? [];

  const filters: AuditFilters = useMemo(() => ({
    branchId:   activeBranchId || undefined,
    entityType: entityType     || undefined,
    action:     action         || undefined,
    actorId:    actorId        || undefined,
    from:       from           || undefined,
    to:         to             || undefined,
    limit:  LIMIT,
    offset: (page - 1) * LIMIT,
  }), [activeBranchId, entityType, action, actorId, from, to, page]);

  const { data, isLoading, isFetching, isError } = useAuditLogs(filters);

  const logs       = data?.data       ?? [];
  const total      = data?.total      ?? 0;
  const totalPages = Math.max(1, Math.ceil((total ?? 0) / LIMIT));

  const resetFilters = () => {
    setEntityType("");
    setActionInput(""); setAction("");
    setActorId(""); setFrom(""); setTo("");
    setPage(1);
  };

  const hasFilters = !!(entityType || actionInput || actorId || from || to);

  // Guard de permiso
  if (!hasPermission("audit.read")) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3 text-muted-foreground">
        <Shield size={32} className="opacity-30" />
        <p className="text-sm">No tienes permiso para acceder al registro de auditoría.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield size={22} className="text-primary shrink-0" />
            Auditoría
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Historial completo de acciones realizadas en el sistema
          </p>
        </div>

        {isFetching && !isLoading && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 shrink-0">
            <RefreshCw size={12} className="animate-spin" />
            Actualizando…
          </div>
        )}
      </div>

      {/* ── Filtros ── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Filtros
          </span>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">

          {/* Tipo de entidad */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Entidad</Label>
            <Select
              value={entityType || "__all__"}
              onValueChange={(v) => { setEntityType(v === "__all__" ? "" : v); setPage(1); }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {ENTITY_TYPES.map((e) => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Acción — con debounce */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Acción</Label>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={actionInput}
                onChange={(e) => setActionInput(e.target.value)}
                placeholder="ej. created, updated…"
                className="h-8 text-xs pl-7"
              />
            </div>
          </div>

          {/* Actor — select de usuarios */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Actor</Label>
            <Select
              value={actorId || "__all__"}
              onValueChange={(v) => { setActorId(v === "__all__" ? "" : v); setPage(1); }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="__all__">Todos los actores</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Desde */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Desde</Label>
            <div className="relative">
              <Calendar size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={from}
                onChange={(e) => { setFrom(e.target.value); setPage(1); }}
                className="h-8 text-xs pl-7"
              />
            </div>
          </div>

          {/* Hasta */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Hasta</Label>
            <div className="relative">
              <Calendar size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={to}
                onChange={(e) => { setTo(e.target.value); setPage(1); }}
                className="h-8 text-xs pl-7"
              />
            </div>
          </div>
        </div>

        {/* Chips de filtros activos */}
        {hasFilters && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {entityType && (
              <ActiveFilterChip
                label={`Entidad: ${ENTITY_LABEL[entityType] ?? entityType}`}
                onRemove={() => { setEntityType(""); setPage(1); }}
              />
            )}
            {actionInput && (
              <ActiveFilterChip
                label={`Acción: ${actionInput}`}
                onRemove={() => { setActionInput(""); setAction(""); setPage(1); }}
              />
            )}
            {actorId && (
              <ActiveFilterChip
                label={`Actor: ${users.find((u) => u.id === actorId)?.firstName ?? actorId.slice(0, 8)}`}
                onRemove={() => { setActorId(""); setPage(1); }}
              />
            )}
            {from && (
              <ActiveFilterChip
                label={`Desde: ${from}`}
                onRemove={() => { setFrom(""); setPage(1); }}
              />
            )}
            {to && (
              <ActiveFilterChip
                label={`Hasta: ${to}`}
                onRemove={() => { setTo(""); setPage(1); }}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Tabla ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">

        {/* Subheader */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Registros</span>
            {data && total != null && (
              <span className="text-xs text-muted-foreground">
                — {total.toLocaleString("es-PE")} en total
              </span>
            )}
          </div>
          {data && total != null && total > 0 && (
            <span className="text-xs text-muted-foreground">
              Página {page} de {totalPages}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Fecha
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Actor
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Acción
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Entidad
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Sede
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Razón
                </th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Shield size={28} className="opacity-25" />
                      <p className="text-sm">Error al cargar los registros</p>
                      <p className="text-xs">Verifica tu conexión e intenta de nuevo</p>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Shield size={28} className="opacity-25" />
                      <p className="text-sm font-medium">Sin registros</p>
                      <p className="text-xs">
                        {hasFilters
                          ? "Prueba ajustando los filtros"
                          : "No hay actividad registrada aún"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <AuditRow
                    key={log.id}
                    log={log}
                    branchMap={branchMap}
                    isExpanded={expandedId === log.id}
                    onToggle={() => setExpandedId((prev) => (prev === log.id ? null : log.id))}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Paginación ── */}
        {!isLoading && total != null && total > LIMIT && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
            <p className="text-xs text-muted-foreground">
              Mostrando {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} de {total.toLocaleString("es-PE")} registros
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={14} />
              </Button>

              {/* Números de página — máx 5 visibles */}
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const mid = Math.min(Math.max(page, 3), totalPages - 2);
                const p   = totalPages <= 5 ? i + 1 : mid - 2 + i;
                if (p < 1 || p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    disabled={isFetching}
                    className={cn(
                      "h-7 w-7 rounded-md text-xs font-medium transition-colors",
                      p === page
                        ? "bg-primary text-white"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {p}
                  </button>
                );
              })}

              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Leyenda de acciones ── */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Building2 size={12} /> Leyenda de acciones
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ACTION_CONFIG).map(([key, cfg]) => (
            <span
              key={key}
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                cfg.color
              )}
            >
              {cfg.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ActiveFilterChip ──────────────────────────────────────────────────────────

function ActiveFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-medium">
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 rounded-full hover:bg-primary/20 transition-colors p-0.5 leading-none"
        aria-label="Quitar filtro"
      >
        ×
      </button>
    </span>
  );
}

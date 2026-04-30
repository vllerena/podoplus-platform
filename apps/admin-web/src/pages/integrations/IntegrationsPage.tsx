import { useState, useMemo } from "react";
import {
  Plug, MessageCircle, FileText, CheckCircle2, AlertCircle,
  Clock, XCircle, ChevronLeft, ChevronRight, Phone, User,
  Calendar, Filter, RefreshCw, Wifi, WifiOff,
  ChevronDown, ChevronUp, Info, Send,
  Copy, Check, Eye, EyeOff, ExternalLink, Building2,
  ShieldAlert,
} from "lucide-react";
import {
  Button, Input, Label, Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue, Skeleton, Badge,
} from "@podoplus/ui";
import { cn } from "@/lib/utils";
import {
  useIntegrationsStatus, useWhatsappStats, useWhatsappLogs,
  useWhatsappTemplates, useSendWhatsappMessage,
  type WhatsappLogEntry, type WhatsappLogFilters, type IntegrationStatus,
} from "@/hooks/use-integrations";
import { useBranchContext } from "@/hooks/use-branch-context";
import { useAuthStore }     from "@/stores/auth.store";
import { useBranch }        from "@/hooks/use-branches";
import { useBusinessUnit }  from "@/hooks/use-business-units";

// ── Constantes ────────────────────────────────────────────────────────────────

const LIMIT = 50;

const WA_STATUSES = [
  { value: "QUEUED",    label: "En cola",    color: "bg-slate-100 text-slate-700" },
  { value: "SENT",      label: "Enviado",    color: "bg-blue-100 text-blue-700" },
  { value: "DELIVERED", label: "Entregado",  color: "bg-teal-100 text-teal-700" },
  { value: "READ",      label: "Leído",      color: "bg-green-100 text-green-700" },
  { value: "FAILED",    label: "Fallido",    color: "bg-red-100 text-red-700" },
];

const STATUS_MAP = Object.fromEntries(WA_STATUSES.map((s) => [s.value, s]));

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
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
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

function maskToken(token: string) {
  if (token.length <= 14) return "•".repeat(token.length);
  return token.slice(0, 8) + "•".repeat(Math.max(token.length - 14, 6)) + token.slice(-6);
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title="Copiar"
      className={cn(
        "h-7 px-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs flex items-center gap-1",
        copied && "text-green-600 hover:text-green-600",
        className,
      )}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

// ── IntegrationStatusBadge ────────────────────────────────────────────────────

function IntStatusBadge({ status }: { status: IntegrationStatus }) {
  const cfg = {
    live:           { label: "En producción", color: "bg-green-100 text-green-700",  icon: Wifi },
    simulated:      { label: "Simulado",       color: "bg-amber-100 text-amber-700",  icon: WifiOff },
    not_configured: { label: "No configurado", color: "bg-muted text-muted-foreground", icon: WifiOff },
  }[status];
  const Icon = cfg.icon;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
      cfg.color
    )}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", color)}>
          <Icon size={16} />
        </div>
      </div>
    </div>
  );
}

// ── WaLogRow ──────────────────────────────────────────────────────────────────

function WaLogRow({
  log,
  isExpanded,
  onToggle,
}: {
  log:        WhatsappLogEntry;
  isExpanded: boolean;
  onToggle:   () => void;
}) {
  const statusCfg = STATUS_MAP[log.status] ?? { label: log.status, color: "bg-muted text-muted-foreground" };
  const hasDetail = !!(log.messageBody || log.errorMessage || log.providerMessageId);

  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          "border-b border-border/50 transition-colors cursor-pointer",
          isExpanded ? "bg-primary/[0.03]" : "hover:bg-muted/30"
        )}
      >
        {/* Fecha */}
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium">{fmtRelative(log.createdAt)}</span>
            <span className="text-[10px] text-muted-foreground">{fmtDateTime(log.createdAt)}</span>
          </div>
        </td>

        {/* Teléfono */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Phone size={12} className="text-muted-foreground shrink-0" />
            <span className="text-xs font-mono">{log.toPhone}</span>
          </div>
        </td>

        {/* Cliente */}
        <td className="px-4 py-3">
          {log.customerName ? (
            <div className="flex items-center gap-1.5">
              <User size={12} className="text-muted-foreground shrink-0" />
              <span className="text-xs truncate max-w-[120px]">{log.customerName}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>

        {/* Template */}
        <td className="px-4 py-3">
          <span className="text-xs text-muted-foreground font-mono">
            {log.templateName || log.messageType || "—"}
          </span>
        </td>

        {/* Sede */}
        <td className="px-4 py-3">
          <span className="text-xs text-muted-foreground">{log.branchName || "—"}</span>
        </td>

        {/* Estado */}
        <td className="px-4 py-3">
          <span className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
            statusCfg.color
          )}>
            {statusCfg.label}
          </span>
        </td>

        {/* Expand */}
        <td className="px-3 py-3 text-right">
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            disabled={!hasDetail}
            className={cn(
              "p-1 rounded-md transition-colors",
              isExpanded
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:bg-muted",
              !hasDetail && "opacity-30 cursor-default"
            )}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </td>
      </tr>

      {/* Fila expandida */}
      {isExpanded && (
        <tr className="bg-primary/[0.02]">
          <td colSpan={7} className="px-6 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {log.messageBody && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Mensaje
                  </p>
                  <p className="text-foreground leading-relaxed bg-muted/30 rounded-lg p-2.5">
                    {log.messageBody}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                {log.providerMessageId && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      ID del proveedor
                    </p>
                    <p className="font-mono text-foreground">{log.providerMessageId}</p>
                  </div>
                )}
                {log.sentAt && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Enviado a las
                    </p>
                    <p className="text-foreground">{fmtDateTime(log.sentAt)}</p>
                  </div>
                )}
                {log.errorMessage && (
                  <div>
                    <p className="text-[10px] font-semibold text-destructive uppercase tracking-wide">
                      Error
                    </p>
                    <p className="text-destructive bg-destructive/5 rounded-lg p-2">{log.errorMessage}</p>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── SkeletonRow ───────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-border/50">
      {[28, 24, 32, 28, 20, 16, 8].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className={`h-5 w-${w}`} />
        </td>
      ))}
    </tr>
  );
}

// ── WhatsappSection ───────────────────────────────────────────────────────────

function WhatsappSection({ integrationStatus }: { integrationStatus: IntegrationStatus }) {
  const { activeBranchId } = useBranchContext();
  const [status,   setStatus]   = useState("");
  const [from,     setFrom]     = useState("");
  const [to,       setTo]       = useState("");
  const [page,     setPage]     = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Reset page when global branch changes
  const prevBranchRef = useState(activeBranchId);
  if (prevBranchRef[0] !== activeBranchId) { prevBranchRef[0] = activeBranchId; setPage(1); }

  const { data: stats } = useWhatsappStats(activeBranchId ?? undefined);

  const logFilters: WhatsappLogFilters = useMemo(() => ({
    branchId: activeBranchId || undefined,
    status:   status         || undefined,
    from:     from           || undefined,
    to:       to             || undefined,
    limit:    LIMIT,
    offset:   (page - 1) * LIMIT,
  }), [activeBranchId, status, from, to, page]);

  const { data: logsPage, isLoading, isFetching } = useWhatsappLogs(logFilters);

  const logs       = logsPage?.data  ?? [];
  const total      = logsPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil((total ?? 0) / LIMIT));

  const successRate = useMemo(() => {
    if (!stats || stats.total === 0) return null;
    const sent = (stats.byStatus["SENT"] ?? 0) + (stats.byStatus["DELIVERED"] ?? 0) + (stats.byStatus["READ"] ?? 0);
    return Math.round((sent / stats.total) * 100);
  }, [stats]);

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
            <MessageCircle size={18} className="text-green-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">WhatsApp Business</h2>
            <p className="text-xs text-muted-foreground">
              Notificaciones y recordatorios a clientes
            </p>
          </div>
        </div>
        <IntStatusBadge status={integrationStatus} />
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 border-b border-border">
          <StatCard
            label="Total mensajes"
            value={stats.total.toLocaleString("es-PE")}
            icon={MessageCircle}
            color="bg-blue-100 text-blue-600"
          />
          <StatCard
            label="Enviados hoy"
            value={stats.sentToday}
            icon={CheckCircle2}
            color="bg-green-100 text-green-600"
          />
          <StatCard
            label="Fallidos hoy"
            value={stats.failedToday}
            icon={XCircle}
            color="bg-red-100 text-red-600"
          />
          <StatCard
            label="Tasa de éxito"
            value={successRate !== null ? `${successRate}%` : "—"}
            sub="sobre total histórico"
            icon={CheckCircle2}
            color="bg-emerald-100 text-emerald-600"
          />
        </div>
      )}

      {/* Estado por tipo */}
      {stats && Object.keys(stats.byStatus).length > 0 && (
        <div className="px-4 py-3 border-b border-border flex flex-wrap gap-2">
          {WA_STATUSES.map((s) => {
            const count = stats.byStatus[s.value] ?? 0;
            if (count === 0) return null;
            return (
              <span key={s.value} className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                s.color
              )}>
                {s.label}: {count.toLocaleString("es-PE")}
              </span>
            );
          })}
        </div>
      )}

      {/* Filtros */}
      <div className="px-4 py-3 border-b border-border bg-muted/10">
        <div className="flex items-center gap-2 mb-2.5">
          <Filter size={12} className="text-muted-foreground" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Filtrar registros
          </span>
          {isFetching && !isLoading && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
              <RefreshCw size={11} className="animate-spin" /> Actualizando
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Estado</Label>
            <Select value={status || "__all__"} onValueChange={(v) => { setStatus(v === "__all__" ? "" : v); setPage(1); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {WA_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-8 text-xs" />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Fecha", "Teléfono", "Cliente", "Template", "Sede", "Estado", ""].map((h, i) => (
                <th key={i} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-14 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <MessageCircle size={28} className="opacity-25" />
                    <p className="text-sm font-medium">Sin mensajes</p>
                    <p className="text-xs">No hay registros con los filtros aplicados</p>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <WaLogRow
                  key={log.id}
                  log={log}
                  isExpanded={expanded === log.id}
                  onToggle={() => setExpanded((p) => p === log.id ? null : log.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {!isLoading && total != null && total > LIMIT && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
          <p className="text-xs text-muted-foreground">
            {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} de {total.toLocaleString("es-PE")}
          </p>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-7 px-2" disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={14} />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const mid = Math.min(Math.max(page, 3), totalPages - 2);
              const p   = totalPages <= 5 ? i + 1 : mid - 2 + i;
              if (p < 1 || p > totalPages) return null;
              return (
                <button key={p} onClick={() => setPage(p)} disabled={isFetching}
                  className={cn("h-7 w-7 rounded-md text-xs font-medium transition-colors",
                    p === page ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}>
                  {p}
                </button>
              );
            })}
            <Button variant="outline" size="sm" className="h-7 px-2" disabled={page >= totalPages || isFetching}
              onClick={() => setPage((p) => p + 1)}>
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Panel de envío manual simulado */}
      <SendTestPanel branchId={activeBranchId ?? ""} />
    </section>
  );
}

// ── SendTestPanel ─────────────────────────────────────────────────────────────

function SendTestPanel({ branchId }: { branchId: string }) {
  const [open,        setOpen]        = useState(false);
  const [messageType, setMessageType] = useState<"TEXT" | "TEMPLATE">("TEMPLATE");
  const [templateName, setTemplateName] = useState("");
  const [variables,   setVariables]   = useState<Record<string, string>>({});
  const [messageBody, setMessageBody] = useState("");
  const [toPhone,     setToPhone]     = useState("");

  const { data: templates = [] } = useWhatsappTemplates();
  const sendMutation             = useSendWhatsappMessage();

  const selectedTemplate = templates.find((t) => t.name === templateName);

  const preview = useMemo(() => {
    if (messageType === "TEXT") return messageBody;
    if (!selectedTemplate) return "";
    let p = selectedTemplate.preview;
    for (const [k, v] of Object.entries(variables)) {
      p = p.replaceAll(`{{${k}}}`, v || `{{${k}}}`);
    }
    return p;
  }, [messageType, messageBody, selectedTemplate, variables]);

  const canSend =
    !!branchId &&
    !!toPhone &&
    (messageType === "TEXT" ? !!messageBody : !!templateName);

  const handleSend = () => {
    sendMutation.mutate({
      toPhone,
      branchId,
      messageType,
      templateName: messageType === "TEMPLATE" ? templateName : undefined,
      messageBody:  messageType === "TEXT"     ? messageBody  : undefined,
      variables:    messageType === "TEMPLATE" ? variables    : undefined,
    });
  };

  return (
    <div className="border-t border-border">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-5 py-3 text-sm font-medium text-left hover:bg-muted/30 transition-colors"
      >
        <Send size={14} className="text-green-600 shrink-0" />
        <span className="text-foreground">Probar envío manual</span>
        <span className="ml-2 text-[10px] text-muted-foreground font-normal">
          Simula el envío sin llamar la API de Meta
        </span>
        {open
          ? <ChevronUp   size={13} className="ml-auto text-muted-foreground" />
          : <ChevronDown size={13} className="ml-auto text-muted-foreground" />
        }
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 space-y-4 bg-muted/10">
          {/* Row 1: phone + tipo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Teléfono destino (E.164)</Label>
              <Input
                placeholder="+51987654321"
                value={toPhone}
                onChange={(e) => setToPhone(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de mensaje</Label>
              <Select
                value={messageType}
                onValueChange={(v) => setMessageType(v as "TEXT" | "TEMPLATE")}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEMPLATE">Template</SelectItem>
                  <SelectItem value="TEXT">Texto libre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Template selector + variables */}
          {messageType === "TEMPLATE" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Template</Label>
                <Select
                  value={templateName}
                  onValueChange={(v) => { setTemplateName(v); setVariables({}); }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Seleccionar template…" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.displayName}
                        <span className="ml-1.5 text-[10px] text-muted-foreground">{t.description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate && selectedTemplate.variables.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedTemplate.variables.map((v) => (
                    <div key={v.index} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        {`{{${v.index}}}`} <span className="text-foreground">{v.label}</span>
                      </Label>
                      <Input
                        placeholder={v.example}
                        value={variables[String(v.index)] ?? ""}
                        onChange={(e) =>
                          setVariables((prev) => ({ ...prev, [String(v.index)]: e.target.value }))
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Texto libre */}
          {messageType === "TEXT" && (
            <div className="space-y-1">
              <Label className="text-xs">Mensaje</Label>
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={3}
                placeholder="Escribe tu mensaje aquí…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/25 resize-none"
              />
            </div>
          )}

          {/* Vista previa */}
          {preview && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3">
              <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide mb-1">
                Vista previa del mensaje
              </p>
              <p className="text-xs text-green-900 leading-relaxed">{preview}</p>
            </div>
          )}

          {/* Alerta si no hay sede */}
          {!branchId && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle size={13} />
              Selecciona una sede en la barra superior para habilitar el envío.
            </p>
          )}

          <Button
            size="sm"
            onClick={handleSend}
            disabled={sendMutation.isPending || !canSend}
            className="w-full sm:w-auto"
          >
            {sendMutation.isPending ? (
              <><RefreshCw size={13} className="animate-spin mr-2" />Enviando…</>
            ) : (
              <><Send size={13} className="mr-2" />Enviar simulado</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── CredentialField ────────────────────────────────────────────────────────────

function CredentialField({
  label, value, secret = false,
}: { label: string; value: string; secret?: boolean }) {
  const [visible, setVisible] = useState(false);
  const display = secret && !visible ? maskToken(value) : value;

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 font-mono text-xs text-foreground break-all">
        <span className="flex-1 select-all">{display}</span>
        <div className="flex items-center gap-1 shrink-0">
          {secret && (
            <button
              onClick={() => setVisible((v) => !v)}
              title={visible ? "Ocultar" : "Mostrar"}
              className="h-7 px-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {visible ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          )}
          <CopyButton value={value} />
        </div>
      </div>
    </div>
  );
}

// ── ApiReferenceAccordion ─────────────────────────────────────────────────────

function ApiReferenceAccordion({ endpoint, token }: { endpoint: string; token: string }) {
  const [open, setOpen] = useState(false);

  const docTypes = [
    {
      label: "Boleta de Venta",
      tipo: "03",
      serie: "B001",
      afectacion: "10 (gravado con IGV)",
    },
    {
      label: "Factura",
      tipo: "01",
      serie: "F001",
      afectacion: "10 (gravado con IGV)",
    },
  ];

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Info size={14} className="text-blue-500" />
          Referencia rápida de API
        </span>
        {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t bg-muted/20 p-4 space-y-4">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Endpoint (POST)
            </p>
            <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 font-mono text-xs break-all">
              <span className="text-blue-600 font-semibold mr-1">POST</span>
              <span className="flex-1 text-foreground">{endpoint}</span>
              <CopyButton value={`POST ${endpoint}`} />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Header de autorización
            </p>
            <div className="rounded-lg border bg-background px-3 py-2 font-mono text-xs">
              <span className="text-muted-foreground">Authorization: </span>
              <span className="text-foreground">Bearer {maskToken(token)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Tipos de documento
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {docTypes.map((dt) => (
                <div key={dt.tipo} className="rounded-lg border bg-background p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <FileText size={12} className="text-blue-500" />{dt.label}
                  </p>
                  <div className="space-y-0.5 text-[11px]">
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-32">codigo_tipo_documento</span>
                      <span className="font-mono font-semibold text-foreground">{dt.tipo}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-32">serie_documento</span>
                      <span className="font-mono font-semibold text-foreground">{dt.serie}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-32">codigo_tipo_operacion</span>
                      <span className="font-mono font-semibold text-foreground">0101</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-32">codigo_tipo_moneda</span>
                      <span className="font-mono font-semibold text-foreground">PEN</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-32">afectación IGV</span>
                      <span className="font-mono font-semibold text-foreground">{dt.afectacion}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 space-y-1">
            <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">Cálculo de IGV (18%)</p>
            <ul className="text-[11px] text-amber-800 space-y-0.5">
              <li>• <span className="font-semibold">valor_unitario</span> = precio sin IGV</li>
              <li>• <span className="font-semibold">precio_unitario</span> = valor_unitario × 1.18</li>
              <li>• <span className="font-semibold">total_base_igv</span> = valor_unitario × cantidad</li>
              <li>• <span className="font-semibold">total_igv</span> = total_base_igv × 0.18</li>
              <li>• <span className="font-semibold">total_item</span> = total_base_igv + total_igv</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SunatSection ──────────────────────────────────────────────────────────────

function SunatSection() {
  const { activeBranchId } = useBranchContext();
  const isSuperAdmin       = useAuthStore((s) => s.hasRole("SUPER_ADMIN"));

  // Obtener el branch activo para saber a qué businessUnit pertenece
  const { data: branch, isLoading: loadingBranch } = useBranch(activeBranchId ?? undefined);

  // Obtener la businessUnit con el config de SUNAT (sunatEndpoint + sunatToken)
  const businessUnitId = branch?.businessUnitId ?? null;
  const { data: businessUnit, isLoading: loadingBU } = useBusinessUnit(businessUnitId ?? undefined);

  const isLoading = loadingBranch || loadingBU;

  // Derivar estado
  const hasSunatConfig = !!(businessUnit?.sunatEndpoint && businessUnit?.sunatToken);
  const sunatStatus: IntegrationStatus = !activeBranchId
    ? "not_configured"
    : !businessUnitId
    ? "not_configured"
    : hasSunatConfig
    ? "live"
    : "not_configured";

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <FileText size={18} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">SUNAT — Facturación electrónica</h2>
            <p className="text-xs text-muted-foreground">
              Emisión de boletas y facturas electrónicas
            </p>
          </div>
        </div>
        <IntStatusBadge status={sunatStatus} />
      </div>

      {/* Cuerpo */}
      <div className="p-5 space-y-5">

        {/* Sin sede seleccionada */}
        {!activeBranchId && (
          <div className="flex flex-col items-center text-center gap-3 py-8">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
              <Building2 size={22} className="text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Selecciona una sede</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Escoge una sede en la barra superior para ver la configuración de facturación electrónica de su empresa.
              </p>
            </div>
          </div>
        )}

        {/* Con sede — loading */}
        {activeBranchId && isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        )}

        {/* Con sede — sin empresa asignada */}
        {activeBranchId && !isLoading && !businessUnitId && (
          <div className="flex flex-col items-center text-center gap-3 py-8">
            <div className="h-12 w-12 rounded-2xl bg-amber-100 flex items-center justify-center">
              <ShieldAlert size={22} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Sede sin empresa asignada</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Esta sede no tiene una razón social (empresa) asociada. Asígnala en Configuración → Empresas.
              </p>
            </div>
            <a href="/settings" className="text-xs text-primary hover:underline flex items-center gap-1">
              Ir a Configuración <ExternalLink size={11} />
            </a>
          </div>
        )}

        {/* Con sede + empresa — sin SUNAT configurado */}
        {activeBranchId && !isLoading && businessUnitId && !hasSunatConfig && (
          <div className="flex flex-col items-center text-center gap-4 py-6">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
              <FileText size={22} className="text-muted-foreground/50" />
            </div>
            <div>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Building2 size={13} className="text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground">{businessUnit?.name}</p>
              </div>
              <p className="text-sm font-semibold text-foreground">Facturación no configurada</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Agrega el Endpoint y Token del PSE/OSE en los datos de la empresa para habilitar la emisión de comprobantes.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-left max-w-sm w-full">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Info size={11} /> Para activar
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Ir a Configuración → Empresas</li>
                <li>• Editar «{businessUnit?.name}»</li>
                <li>• Completar Endpoint y Token SUNAT</li>
              </ul>
            </div>
            {isSuperAdmin && (
              <a href="/settings" className="text-xs text-primary hover:underline flex items-center gap-1">
                Ir a Configuración <ExternalLink size={11} />
              </a>
            )}
          </div>
        )}

        {/* Con sede + empresa + SUNAT configurado ✓ */}
        {activeBranchId && !isLoading && businessUnitId && hasSunatConfig && businessUnit && (
          <div className="space-y-5">

            {/* Empresa */}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-100">
              <Building2 size={14} className="text-blue-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-blue-600 font-semibold uppercase tracking-wide">Empresa</p>
                <p className="text-sm font-semibold text-foreground">{businessUnit.name}</p>
                {businessUnit.ruc && (
                  <p className="text-xs text-muted-foreground">RUC {businessUnit.ruc}</p>
                )}
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 px-2.5 py-1 text-[11px] font-semibold shrink-0">
                <Wifi size={10} /> Activo
              </span>
            </div>

            {/* Credenciales */}
            <div className="space-y-3">
              <CredentialField
                label="Endpoint (URL del PSE/OSE)"
                value={businessUnit.sunatEndpoint!}
              />
              <CredentialField
                label="Token de autorización (Bearer)"
                value={businessUnit.sunatToken!}
                secret
              />
            </div>

            {/* Referencia API */}
            <ApiReferenceAccordion
              endpoint={businessUnit.sunatEndpoint!}
              token={businessUnit.sunatToken!}
            />

            {/* Nota próxima funcionalidad */}
            <div className="flex items-start gap-2.5 rounded-lg border border-dashed bg-muted/30 px-4 py-3">
              <Clock size={14} className="text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-foreground">Módulo Ventas POS — Próximamente</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Desde el módulo de Ventas POS podrás emitir boletas y facturas electrónicas usando esta configuración.
                </p>
              </div>
            </div>

            {isSuperAdmin && (
              <p className="text-[11px] text-muted-foreground text-right">
                Para cambiar las credenciales ve a{" "}
                <a href="/settings" className="text-primary hover:underline">
                  Configuración → Empresas
                </a>
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export function IntegrationsPage() {
  const hasPermission      = useAuthStore((s) => s.hasPermission);
  const { activeBranchId } = useBranchContext();
  const { data: status, isLoading: statusLoading } = useIntegrationsStatus();

  // Derivar el estado SUNAT para el summary card desde la sede activa
  const { data: branch }  = useBranch(activeBranchId ?? undefined);
  const { data: buDetail } = useBusinessUnit(branch?.businessUnitId ?? undefined);
  const sunatSummaryStatus: IntegrationStatus =
    buDetail?.sunatEndpoint && buDetail?.sunatToken ? "live" : "not_configured";

  if (!hasPermission("whatsapp.read")) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3 text-muted-foreground">
        <Plug size={32} className="opacity-30" />
        <p className="text-sm">No tienes permiso para acceder a las integraciones.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Plug size={22} className="text-primary shrink-0" />
          Integraciones
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Estado y registros de las integraciones externas del sistema
        </p>
      </div>

      {/* ── Resumen de estados ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
            <MessageCircle size={16} className="text-green-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">WhatsApp Business</p>
            <p className="text-xs text-muted-foreground">Meta Cloud API</p>
          </div>
          {statusLoading
            ? <Skeleton className="h-7 w-24 rounded-full" />
            : <IntStatusBadge status={status?.whatsapp ?? "not_configured"} />
          }
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <FileText size={16} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">SUNAT</p>
            <p className="text-xs text-muted-foreground">
              Facturación electrónica
              {branch?.businessUnit?.name && (
                <span className="ml-1 text-foreground/70">· {branch.businessUnit.name}</span>
              )}
            </p>
          </div>
          <IntStatusBadge status={sunatSummaryStatus} />
        </div>
      </div>

      {/* ── Sección WhatsApp ── */}
      <WhatsappSection integrationStatus={status?.whatsapp ?? "simulated"} />

      {/* ── Sección SUNAT ── */}
      <SunatSection />
    </div>
  );
}

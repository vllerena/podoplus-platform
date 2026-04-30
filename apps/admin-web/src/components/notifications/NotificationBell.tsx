import { useState, useRef, useEffect } from "react";
import {
  Bell, Check, CheckCheck, Trash2, X,
  Calendar, DollarSign, Package, RefreshCw, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useUnreadCount, useNotifications, useMarkAsRead,
  useMarkAllAsRead, useDeleteNotification,
  type AppNotification, type NotificationType,
} from "@/hooks/use-notifications";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);

  if (mins  < 1)   return "ahora";
  if (mins  < 60)  return `hace ${mins}m`;
  if (hours < 24)  return `hace ${hours}h`;
  if (days  < 7)   return `hace ${days}d`;
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

// ── Icono por tipo ────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<NotificationType, { icon: React.ElementType; color: string; bg: string }> = {
  appointment:   { icon: Calendar,   color: "text-primary",    bg: "bg-primary/10" },
  sale:          { icon: DollarSign, color: "text-green-600",  bg: "bg-green-100" },
  subscription:  { icon: RefreshCw,  color: "text-violet-600", bg: "bg-violet-100" },
  cash_register: { icon: Package,    color: "text-amber-600",  bg: "bg-amber-100" },
  system:        { icon: Info,       color: "text-blue-600",   bg: "bg-blue-100" },
};

function NotifIcon({ type }: { type: NotificationType }) {
  const cfg  = TYPE_CONFIG[type] ?? TYPE_CONFIG.system;
  const Icon = cfg.icon;
  return (
    <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", cfg.bg)}>
      <Icon size={14} className={cfg.color} />
    </div>
  );
}

// ── Fila de notificación ──────────────────────────────────────────────────────

function NotifRow({
  notif,
  onRead,
  onDelete,
}: {
  notif:    AppNotification;
  onRead:   (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors relative",
        !notif.isRead && "bg-primary/[0.03]"
      )}
    >
      {/* Punto "no leído" */}
      {!notif.isRead && (
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
      )}

      <NotifIcon type={notif.type} />

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm leading-tight", !notif.isRead ? "font-semibold text-foreground" : "text-foreground/80")}>
          {notif.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
          {notif.body}
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          {fmtRelative(notif.createdAt)}
        </p>
      </div>

      {/* Acciones hover */}
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {!notif.isRead && (
          <button
            onClick={() => onRead(notif.id)}
            title="Marcar como leída"
            className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <Check size={12} />
          </button>
        )}
        <button
          onClick={() => onDelete(notif.id)}
          title="Eliminar"
          className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Badge de conteo ───────────────────────────────────────────────────────────

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref             = useRef<HTMLDivElement>(null);

  const { data: unreadCount = 0 }   = useUnreadCount();
  const { data: result, isLoading } = useNotifications({ limit: 30 });
  const markRead    = useMarkAsRead();
  const markAllRead = useMarkAllAsRead();
  const deleteNotif = useDeleteNotification();

  const notifications = result?.data ?? [];

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return ()  => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // Marcar visibles como leídas al abrir (solo las no leídas)
  const handleOpen = () => {
    setOpen((v) => !v);
  };

  const handleMarkRead = (id: string) => {
    markRead.mutate(id);
  };

  const handleMarkAll = () => {
    markAllRead.mutate();
  };

  const handleDelete = (id: string) => {
    deleteNotif.mutate(id);
  };

  return (
    <div ref={ref} className="relative">
      {/* Botón campana */}
      <button
        onClick={handleOpen}
        className={cn(
          "relative p-2 rounded-lg text-muted-foreground transition-colors focus-brand",
          open
            ? "bg-primary/10 text-primary"
            : "hover:bg-muted hover:text-foreground"
        )}
        aria-label="Notificaciones"
      >
        <Bell size={18} />
        <UnreadBadge count={unreadCount} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-border bg-background shadow-xl z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Notificaciones</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5">
                  {unreadCount} nueva{unreadCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAll}
                  title="Marcar todas como leídas"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/5"
                >
                  <CheckCheck size={12} />
                  <span className="hidden sm:inline">Leer todo</span>
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border/50">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Bell size={20} className="text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-foreground">Sin notificaciones</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Aquí aparecerán citas, ventas y avisos del sistema
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotifRow
                  key={n.id}
                  notif={n}
                  onRead={handleMarkRead}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border bg-muted/20 text-center">
              <p className="text-[11px] text-muted-foreground">
                Mostrando {notifications.length} de {result?.total ?? notifications.length} notificaciones
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

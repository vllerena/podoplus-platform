import { useRef, useState, useEffect } from "react";
import { Menu, Building2, ChevronDown, Check, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore }      from "@/stores/auth.store";
import { useBranchContext }  from "@/hooks/use-branch-context";
import { NotificationBell } from "@/components/notifications/NotificationBell";

interface HeaderProps {
  onMenuClick: () => void;
}

// ── Branch Switcher ───────────────────────────────────────────────────────────

function BranchSwitcher() {
  const { activeBranchId, activeBranchLabel, branches, isSuperAdmin, canSwitch, setActiveBranch } =
    useBranchContext();

  const [open, setOpen]   = useState(false);
  const ref               = useRef<HTMLDivElement>(null);

  // Cierra el dropdown al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Si el usuario solo tiene una sede y no es SUPER_ADMIN, muestra la etiqueta sin dropdown
  if (!canSwitch) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 text-muted-foreground text-xs font-medium">
        <Building2 size={13} className="shrink-0" />
        <span className="truncate max-w-[140px]">{activeBranchLabel}</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative hidden sm:block">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
          "border border-border bg-white hover:bg-muted/60",
          open && "bg-muted/60 border-primary/30 text-primary",
          !open && "text-[#5e5873]",
        )}
      >
        {activeBranchId
          ? <Building2 size={13} className="shrink-0 text-primary/80" />
          : <Globe     size={13} className="shrink-0 text-primary/80" />
        }
        <span className="truncate max-w-[150px]">{activeBranchLabel}</span>
        <ChevronDown
          size={12}
          className={cn("shrink-0 transition-transform text-muted-foreground", open && "rotate-180")}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            "absolute right-0 top-full mt-1.5 z-50 min-w-[200px] max-w-[280px]",
            "bg-white border border-border rounded-xl shadow-lg py-1 overflow-hidden",
          )}
        >
          {/* Encabezado */}
          <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Sucursal activa
          </p>

          {/* Opción: Todas las sedes (solo SUPER_ADMIN) */}
          {isSuperAdmin && (
            <button
              onClick={() => { setActiveBranch(null); setOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                activeBranchId === null
                  ? "bg-primary/8 text-primary font-semibold"
                  : "text-[#5e5873] hover:bg-muted",
              )}
            >
              <Globe size={14} className={cn("shrink-0", activeBranchId === null ? "text-primary" : "text-muted-foreground")} />
              <span className="flex-1 text-left truncate">Todas las sedes</span>
              {activeBranchId === null && <Check size={13} className="shrink-0 text-primary" />}
            </button>
          )}

          {/* Divisor si hay opción "todas" */}
          {isSuperAdmin && branches.length > 0 && (
            <div className="mx-2 my-1 border-t border-border" />
          )}

          {/* Lista de sucursales */}
          <div className="max-h-[240px] overflow-y-auto">
            {branches.map((b) => (
              <button
                key={b.id}
                onClick={() => { setActiveBranch(b.id, b.name); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                  activeBranchId === b.id
                    ? "bg-primary/8 text-primary font-semibold"
                    : "text-[#5e5873] hover:bg-muted",
                )}
              >
                <Building2 size={14} className={cn("shrink-0", activeBranchId === b.id ? "text-primary" : "text-muted-foreground")} />
                <span className="flex-1 text-left truncate">{b.name}</span>
                {activeBranchId === b.id && <Check size={13} className="shrink-0 text-primary" />}
              </button>
            ))}

            {branches.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground italic">
                Sin sucursales asignadas
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

export function Header({ onMenuClick }: HeaderProps) {
  const user = useAuthStore((s) => s.user);

  return (
    <header className="h-[60px] border-b border-border bg-white flex items-center px-4 gap-3 shrink-0">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-brand"
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Branch switcher */}
      <BranchSwitcher />

      {/* Notifications */}
      <NotificationBell />

      {/* User badge */}
      {user && (
        <div className="flex items-center gap-2.5 pl-1">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold text-foreground leading-tight">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {user.roles?.[0]?.replace(/_/g, " ") ?? "Usuario"}
            </p>
          </div>
          <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">
              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
            </span>
          </div>
        </div>
      )}
    </header>
  );
}

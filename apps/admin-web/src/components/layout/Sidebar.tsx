import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, CalendarDays, ClipboardList, Users, ShoppingCart, DollarSign,
  Package, BarChart3, Settings, Scissors, UserCog, LogOut, X, UserCircle, Box, CreditCard, Layers,
  EyeOff, Eye, SlidersHorizontal, ShieldCheck, Plug, Store, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import { apiLogout } from "@/lib/auth";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface SidebarProps {
  collapsed:  boolean;
  mobileOpen: boolean;
  onToggle:   () => void;
  onClose:    () => void;
}

interface NavItemDef {
  label:       string;
  to:          string;
  icon:        React.ElementType;
  end?:        boolean;
  /**
   * Códigos de permiso requeridos (lógica OR — basta con tener uno).
   * Undefined = siempre visible.
   */
  permissions?: string[];
  /**
   * Roles requeridos (lógica OR — basta con tener uno).
   * Se combina con permissions en AND: (permissions OR) AND (roles OR).
   * Undefined = sin restricción de rol.
   */
  roles?: string[];
}

// ── Navegación ────────────────────────────────────────────────────────────────

const navItems: NavItemDef[] = [
  { label: "Dashboard",       to: "/",                  icon: LayoutDashboard, end: true },
  { label: "Dashboard Sede",  to: "/branch-dashboard",  icon: Store,           roles: ["RECEPTIONIST", "SUPER_ADMIN"] },
  { label: "Citas",           to: "/appointments",      icon: ClipboardList,   permissions: ["appointment.read"] },
  { label: "Calendario", to: "/calendar",      icon: CalendarDays,    permissions: ["appointment.read"] },
  { label: "Clientes",   to: "/customers",     icon: Users,           permissions: ["customer.read"] },
  { label: "Ventas",        to: "/sales",         icon: ShoppingCart,    permissions: ["sale.read"] },
  { label: "Caja",          to: "/cash-register", icon: DollarSign,      permissions: ["cash.read", "cash_register.read"] },
  { label: "Inventario",    to: "/inventory",     icon: Package,         permissions: ["inventory.read", "inventory.manage"] },
  { label: "Suscripciones", to: "/subscriptions", icon: Layers,          permissions: ["subscription.read", "plan.read"] },
  { label: "Reportes",      to: "/reports",       icon: BarChart3,       permissions: ["report.read"] },
];

const settingsItems: NavItemDef[] = [
  { label: "Servicios",     to: "/services",  icon: Scissors,     permissions: ["service.read", "service.manage"] },
  { label: "Productos",     to: "/products",  icon: Box,          permissions: ["product.read", "product.manage"] },
  { label: "Planes",        to: "/plans",     icon: CreditCard,   permissions: ["plan.read", "plan.manage"] },
  { label: "Proveedores",   to: "/suppliers", icon: Building2,    permissions: ["inventory.read", "inventory.manage"] },
  { label: "Usuarios",      to: "/users",     icon: UserCog,      permissions: ["user.manage"] },
  { label: "Auditoría",     to: "/audit",         icon: ShieldCheck,  permissions: ["audit.read"] },
  { label: "Integraciones", to: "/integrations", icon: Plug,         permissions: ["whatsapp.read"] },
  { label: "Mi perfil",     to: "/profile",       icon: UserCircle },
  { label: "Configuración", to: "/settings",  icon: Settings,     permissions: ["settings.read", "settings.update"] },
];

// ── Componente de item ────────────────────────────────────────────────────────

function NavItem({
  to, icon: Icon, label, end, collapsed, editMode, hidden, onToggleHide,
}: {
  to: string; icon: React.ElementType; label: string; end?: boolean;
  collapsed: boolean; editMode?: boolean; hidden?: boolean;
  onToggleHide?: () => void;
}) {
  if (editMode) {
    // En modo edición se muestra como botón toggle (no navega)
    return (
      <button
        onClick={onToggleHide}
        className={cn(
          "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-all duration-150",
          hidden
            ? "text-muted-foreground/50 bg-muted/40 hover:bg-muted"
            : "text-[#5e5873] hover:bg-muted hover:text-foreground",
          collapsed && "justify-center px-2"
        )}
      >
        <Icon
          size={18}
          className={cn(
            "shrink-0 transition-colors",
            hidden ? "text-muted-foreground/40" : "text-[#5e5873] group-hover:text-foreground"
          )}
        />
        {!collapsed && (
          <>
            <span className={cn("truncate flex-1 text-left", hidden && "line-through opacity-50")}>
              {label}
            </span>
            {hidden
              ? <EyeOff size={13} className="ml-auto shrink-0 text-muted-foreground/50" />
              : <Eye    size={13} className="ml-auto shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            }
          </>
        )}
      </button>
    );
  }

  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
          isActive
            ? "bg-primary/10 text-primary font-semibold"
            : "text-[#5e5873] hover:bg-muted hover:text-foreground",
          collapsed && "justify-center px-2"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={18}
            className={cn(
              "shrink-0 transition-colors",
              isActive ? "text-primary" : "text-[#5e5873] group-hover:text-foreground"
            )}
          />
          {!collapsed && <span className="truncate">{label}</span>}
          {/* Active indicator bar */}
          {isActive && !collapsed && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </>
      )}
    </NavLink>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar({ collapsed, mobileOpen, onToggle, onClose }: SidebarProps) {
  const navigate         = useNavigate();
  const clearAuth        = useAuthStore((s) => s.clearAuth);
  const user             = useAuthStore((s) => s.user);
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);
  const hasAnyRole       = useAuthStore((s) => s.hasAnyRole);
  const hiddenModules    = useAuthStore((s) => s.hiddenModules);
  const toggleModule     = useAuthStore((s) => s.toggleModule);

  const [editMode, setEditMode] = useState(false);

  /** Ítem accesible según permisos Y roles (independiente de si está oculto) */
  const canSee = (item: NavItemDef) => {
    const permOk = !item.permissions || hasAnyPermission(item.permissions);
    const roleOk = !item.roles       || hasAnyRole(item.roles);
    return permOk && roleOk;
  };

  /** Ítem visible en navegación normal (accesible + no oculto) */
  const isVisible = (item: NavItemDef) =>
    canSee(item) && !hiddenModules.includes(item.to);

  /** Ítems accesibles para el modo edición (muestra todos los que tiene permiso) */
  const accessibleNavItems      = navItems.filter(canSee);
  const accessibleSettingsItems = settingsItems.filter(canSee);

  /** Ítems visibles para navegación normal */
  const visibleNavItems      = navItems.filter(isVisible);
  const visibleSettingsItems = settingsItems.filter(isVisible);

  /** Solo mostrar botón de edición si el usuario tiene más de 1 ítem accesible */
  const canEditModules =
    accessibleNavItems.length + accessibleSettingsItems.length > 1;

  const handleLogout = async () => {
    await apiLogout(); // Blacklistea tokens en el servidor
    clearAuth();       // Limpia estado local + localStorage
    navigate("/login", { replace: true });
  };

  const content = (
    <aside
      className={cn(
        "flex flex-col h-full bg-white border-r border-border transition-all duration-300",
        collapsed ? "w-[64px]" : "w-[256px]"
      )}
    >
      {/* ── Logo ── */}
      <div
        className={cn(
          "flex items-center border-b border-border shrink-0",
          collapsed ? "h-[60px] justify-center px-2" : "h-[60px] px-4 gap-3"
        )}
      >
        {collapsed ? (
          /* Solo ícono cuando está colapsado */
          <button onClick={onToggle} className="focus-brand rounded-lg">
            <img
              src="/logo-icon.png"
              alt="Podoplus"
              className="h-8 w-8 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).nextElementSibling?.removeAttribute("hidden");
              }}
            />
            <span hidden className="text-lg font-bold text-primary">P</span>
          </button>
        ) : (
          <>
            <button
              onClick={onToggle}
              className="flex items-center gap-2 focus-brand rounded-lg flex-1 min-w-0"
            >
              <img
                src="/logo.png"
                alt="Podoplus"
                className="h-9 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).nextElementSibling?.removeAttribute("hidden");
                }}
              />
              {/* Fallback si no hay logo */}
              <span hidden className="flex items-center gap-2">
                <span className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0">P</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground leading-tight">PODOPLUS</p>
                  <p className="text-[10px] text-muted-foreground leading-tight tracking-wide">CENTRO PODOLÓGICO</p>
                </div>
              </span>
            </button>
            {/* Botón cerrar en mobile */}
            <button
              onClick={onClose}
              className="md:hidden ml-auto p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
            >
              <X size={16} />
            </button>
          </>
        )}
      </div>

      {/* ── Navegación principal ── */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {/* Header sección + botón editar módulos */}
        {!collapsed && (
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Principal
            </p>
            {canEditModules && (
              <button
                onClick={() => setEditMode((v) => !v)}
                title={editMode ? "Salir de edición" : "Mostrar/ocultar módulos"}
                className={cn(
                  "p-1 rounded-md transition-colors text-muted-foreground",
                  editMode
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted hover:text-foreground"
                )}
              >
                <SlidersHorizontal size={12} />
              </button>
            )}
          </div>
        )}

        {/* En modo edición se muestran TODOS los accesibles con toggle; en normal solo los visibles */}
        {(editMode ? accessibleNavItems : visibleNavItems).map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            end={item.end}
            collapsed={collapsed}
            editMode={editMode}
            hidden={hiddenModules.includes(item.to)}
            onToggleHide={() => toggleModule(item.to)}
          />
        ))}

        <div className={cn("my-3 border-t border-border", collapsed && "mx-1")} />

        {!collapsed && (
          <p className="px-3 mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Configuración
          </p>
        )}

        {(editMode ? accessibleSettingsItems : visibleSettingsItems).map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            collapsed={collapsed}
            editMode={editMode}
            hidden={hiddenModules.includes(item.to)}
            onToggleHide={() => toggleModule(item.to)}
          />
        ))}

        {/* Banner informativo en modo edición */}
        {editMode && !collapsed && (
          <div className="mt-3 mx-1 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
            <p className="text-[10px] text-primary/80 leading-relaxed">
              Haz clic en un módulo para mostrarlo u ocultarlo del menú.
            </p>
          </div>
        )}
      </nav>

      {/* ── Usuario + cerrar sesión ── */}
      <div className="border-t border-border p-3 shrink-0">
        {!collapsed && user && (
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 px-1 mb-2 rounded-lg p-1.5 -mx-0.5 transition-colors",
                isActive ? "bg-primary/5" : "hover:bg-muted",
              )
            }
          >
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary">
                {user.firstName.charAt(0)}{user.lastName.charAt(0)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate leading-tight">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[10px] text-muted-foreground truncate leading-tight">
                {user.roles?.[0]?.replace(/_/g, " ") ?? "Usuario"}
              </p>
            </div>
          </NavLink>
        )}

        <button
          onClick={handleLogout}
          title={collapsed ? "Cerrar sesión" : undefined}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-[#5e5873] hover:bg-red-50 hover:text-red-600 transition-colors font-medium",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full">
        {content}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={onClose}
          />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden w-[256px] flex">
            {/* Force non-collapsed for mobile drawer */}
            <aside className="flex flex-col h-full w-full bg-white border-r border-border">
              {/* Logo */}
              <div className="flex items-center h-[60px] px-4 gap-3 border-b border-border">
                <img
                  src="/logo.png"
                  alt="Podoplus"
                  className="h-9 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <button
                  onClick={onClose}
                  className="ml-auto p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              {/* Nav */}
              <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
                <p className="px-3 mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Principal</p>
                {visibleNavItems.map((item) => (
                  <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} end={item.end} collapsed={false} />
                ))}
                <div className="my-3 border-t border-border" />
                <p className="px-3 mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Configuración</p>
                {visibleSettingsItems.map((item) => (
                  <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} collapsed={false} />
                ))}
              </nav>
              {/* User */}
              <div className="border-t border-border p-3">
                {user && (
                  <div className="flex items-center gap-2.5 px-1 mb-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{user.firstName} {user.lastName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{user.roles?.[0]?.replace(/_/g, " ") ?? "Usuario"}</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-[#5e5873] hover:bg-red-50 hover:text-red-600 transition-colors font-medium"
                >
                  <LogOut size={16} />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </aside>
          </div>
        </>
      )}
    </>
  );
}

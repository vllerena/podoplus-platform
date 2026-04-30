import { useState } from "react";
import {
  Scissors, Plus, Search, Clock, DollarSign,
  ToggleLeft, ToggleRight, Tag, Edit2,
  Building2, Pencil, Trash2, Check, X,
  Loader2, ChevronDown, ChevronUp, Package,
  CalendarCheck, Zap, Users,
} from "lucide-react";
import { Button, Input, Skeleton } from "@podoplus/ui";
import {
  useServices, useServiceCategories,
  useActivateService, useDeactivateService,
  useCreateCategory, useUpdateCategory, useDeleteCategory,
  type Service, type ServiceCategory,
} from "@/hooks/use-services";
import { useAuthStore } from "@/stores/auth.store";
import { useDebounce } from "@/hooks/use-debounce";
import { ServiceDrawer } from "./components/ServiceDrawer";
import { ServicePricesDialog } from "./components/ServicePricesDialog";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(v: number | string | null | undefined) {
  if (v === null || v === undefined) return "S/ 0.00";
  return `S/ ${parseFloat(String(v)).toFixed(2)}`;
}

function fmtDuration(mins: number | string | null | undefined) {
  const n = Number(mins) || 0;
  if (n === 0) return null; // instant — caller handles it
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ── Type filter values ────────────────────────────────────────────────────────

type TypeFilter = "ALL" | "APPOINTMENT" | "INSTANT";

// ── Color dot ─────────────────────────────────────────────────────────────────

function ColorDot({ color }: { color: string | null }) {
  return (
    <span
      className="h-3 w-3 rounded-full border border-white shadow-sm shrink-0"
      style={{ background: color ?? "#45AEBA" }}
    />
  );
}

// ── Service row (table) ───────────────────────────────────────────────────────

function ServiceRow({
  service,
  canAdmin,
  onEdit,
  onToggle,
  onPrices,
}: {
  service:  Service;
  canAdmin: boolean;
  onEdit:   (s: Service) => void;
  onToggle: (s: Service) => void;
  onPrices: (s: Service) => void;
}) {
  const isInstant = Number(service.durationMinutes) === 0;
  const durationLabel = fmtDuration(service.durationMinutes);

  return (
    <tr
      className={cn(
        "group border-b border-border transition-colors hover:bg-muted/30",
        !service.isActive && "opacity-50"
      )}
    >
      {/* Name + category */}
      <td className="py-3 pl-4 pr-3">
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: (service.color ?? "#45AEBA") + "22" }}
          >
            {isInstant
              ? <Package size={15} style={{ color: service.color ?? "#45AEBA" }} />
              : <Scissors size={15} style={{ color: service.color ?? "#45AEBA" }} />
            }
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-foreground leading-tight">
                {service.name}
              </span>
              {!service.isActive && (
                <span className="text-[10px] rounded-full bg-muted text-muted-foreground px-1.5 py-0.5 font-medium">
                  Inactivo
                </span>
              )}
              {service.allowSelfService && (
                <span className="text-[10px] rounded-full bg-primary/10 text-primary px-1.5 py-0.5 font-medium">
                  Online
                </span>
              )}
            </div>
            {service.category && (
              <div className="flex items-center gap-1 mt-0.5">
                <ColorDot color={service.category.color} />
                <span className="text-[11px] text-muted-foreground">{service.category.name}</span>
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Type badge */}
      <td className="py-3 px-3 hidden sm:table-cell">
        {isInstant ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5">
            <Zap size={10} className="shrink-0" />
            Sin cita
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5">
            <CalendarCheck size={10} className="shrink-0" />
            Con cita
          </span>
        )}
      </td>

      {/* Duration */}
      <td className="py-3 px-3 hidden md:table-cell">
        {isInstant ? (
          <span className="text-xs text-muted-foreground italic">—</span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock size={12} className="shrink-0" />
            {durationLabel}
            {Number(service.bufferMinutes) > 0 && (
              <span className="text-[10px] text-muted-foreground/60">
                +{service.bufferMinutes}min
              </span>
            )}
          </span>
        )}
      </td>

      {/* Price */}
      <td className="py-3 px-3">
        <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
          <DollarSign size={13} className="text-muted-foreground shrink-0" />
          {fmtPrice(service.basePrice)}
        </span>
      </td>

      {/* Actions */}
      {canAdmin && (
        <td className="py-3 pl-3 pr-4">
          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(service)}
              title="Editar"
            >
              <Edit2 size={13} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
              onClick={() => onPrices(service)}
              title="Precios por sucursal"
            >
              <Building2 size={13} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "h-7 w-7 p-0",
                service.isActive
                  ? "text-muted-foreground hover:text-destructive"
                  : "text-muted-foreground hover:text-green-600"
              )}
              onClick={() => onToggle(service)}
              title={service.isActive ? "Desactivar" : "Activar"}
            >
              {service.isActive
                ? <ToggleLeft size={14} />
                : <ToggleRight size={14} />
              }
            </Button>
          </div>
        </td>
      )}
    </tr>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-border">
      <td className="py-3 pl-4 pr-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
      </td>
      <td className="py-3 px-3 hidden sm:table-cell"><Skeleton className="h-5 w-16 rounded-full" /></td>
      <td className="py-3 px-3 hidden md:table-cell"><Skeleton className="h-3 w-14" /></td>
      <td className="py-3 px-3"><Skeleton className="h-4 w-16" /></td>
    </tr>
  );
}

// ── Category manager ──────────────────────────────────────────────────────────

function CategoryManager() {
  const { data: categories = [], isLoading } = useServiceCategories();
  const createMut = useCreateCategory();
  const updateMut = useUpdateCategory();
  const deleteMut = useDeleteCategory();

  const [expanded,   setExpanded]   = useState(false);
  const [newName,    setNewName]    = useState("");
  const [newColor,   setNewColor]   = useState("#45AEBA");
  const [editId,     setEditId]     = useState<string | null>(null);
  const [editName,   setEditName]   = useState("");
  const [editColor,  setEditColor]  = useState("#45AEBA");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createMut.mutateAsync({ name, color: newColor });
      setNewName("");
      setNewColor("#45AEBA");
    } catch { /* toasted */ }
  };

  const startEdit = (c: ServiceCategory) => {
    setEditId(c.id);
    setEditName(c.name);
    setEditColor(c.color);
  };

  const cancelEdit = () => setEditId(null);

  const handleUpdate = async () => {
    if (!editId) return;
    try {
      await updateMut.mutateAsync({ id: editId, body: { name: editName.trim() || undefined, color: editColor } });
      setEditId(null);
    } catch { /* toasted */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMut.mutateAsync(id);
      setConfirmDel(null);
    } catch { /* toasted */ }
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header / toggle */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Tag size={16} className="text-violet-600" />
          <span className="text-sm font-semibold text-foreground">Categorías de servicios</span>
          <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
            {categories.length}
          </span>
        </div>
        {expanded
          ? <ChevronUp size={16} className="text-muted-foreground" />
          : <ChevronDown size={16} className="text-muted-foreground" />
        }
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 space-y-3 pt-3">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
            </div>
          ) : categories.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Sin categorías creadas aún.</p>
          ) : (
            <div className="space-y-1.5">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-background">
                  {editId === c.id ? (
                    <>
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="h-7 w-8 rounded cursor-pointer border border-input shrink-0"
                      />
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 text-xs flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter")  handleUpdate();
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <Button size="sm" className="h-7 w-7 p-0 shrink-0" onClick={handleUpdate} disabled={updateMut.isPending} title="Guardar">
                        {updateMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0 text-muted-foreground" onClick={cancelEdit} title="Cancelar">
                        <X size={12} />
                      </Button>
                    </>
                  ) : confirmDel === c.id ? (
                    <>
                      <span className="flex-1 text-xs text-destructive font-medium">¿Eliminar "{c.name}"?</span>
                      <Button size="sm" variant="destructive" className="h-7 text-xs px-2 shrink-0" onClick={() => handleDelete(c.id)} disabled={deleteMut.isPending}>
                        {deleteMut.isPending ? <Loader2 size={12} className="animate-spin" /> : "Sí, eliminar"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0 text-muted-foreground" onClick={() => setConfirmDel(null)}>
                        <X size={12} />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="h-4 w-4 rounded-full shrink-0 border border-white shadow-sm" style={{ background: c.color }} />
                      <span className="flex-1 text-sm text-foreground truncate">{c.name}</span>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => startEdit(c)} title="Editar">
                        <Pencil size={12} />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDel(c.id)} title="Eliminar">
                        <Trash2 size={12} />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add new */}
          <div className="flex items-center gap-2 pt-1 border-t">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="h-8 w-9 rounded cursor-pointer border border-input shrink-0"
              title="Color de la categoría"
            />
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nueva categoría..."
              className="h-8 text-xs flex-1"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
            <Button size="sm" className="h-8 shrink-0 text-xs" onClick={handleCreate} disabled={createMut.isPending || !newName.trim()}>
              {createMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Filter pill ───────────────────────────────────────────────────────────────

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/70"
      )}
    >
      {children}
    </button>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export function ServicesPage() {
  const canAdmin = useAuthStore(
    (s) =>
      s.hasPermission("settings.update") ||
      s.hasAnyRole(["SUPER_ADMIN", "GENERAL_MANAGER"]),
  );

  const [search,        setSearch]        = useState("");
  const [catFilter,     setCatFilter]     = useState<string>("ALL");
  const [typeFilter,    setTypeFilter]    = useState<TypeFilter>("ALL");
  const [showAll,       setShowAll]       = useState(false);
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [editService,   setEditService]   = useState<Service | null>(null);
  const [pricesService, setPricesService] = useState<Service | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data: services = [], isLoading } = useServices({ all: true });
  const { data: categories = [] }          = useServiceCategories();
  const activateMut   = useActivateService();
  const deactivateMut = useDeactivateService();

  // ── Derived stats ──────────────────────────────────────────────────────────
  const activeServices   = services.filter((s) => s.isActive);
  const instantServices  = services.filter((s) => Number(s.durationMinutes) === 0);
  const scheduledServices = services.filter((s) => Number(s.durationMinutes) > 0);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = services.filter((s) => {
    if (!showAll && !s.isActive) return false;
    if (catFilter !== "ALL" && s.categoryId !== catFilter) return false;
    if (typeFilter === "INSTANT"     && Number(s.durationMinutes) !== 0) return false;
    if (typeFilter === "APPOINTMENT" && Number(s.durationMinutes) === 0) return false;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      return s.name.toLowerCase().includes(q) || (s.internalCode ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const handleToggle = async (s: Service) => {
    if (!canAdmin) return;
    try {
      if (s.isActive) await deactivateMut.mutateAsync(s.id);
      else            await activateMut.mutateAsync(s.id);
    } catch { /* toasted in hook */ }
  };

  const openCreate = () => { setEditService(null); setDrawerOpen(true); };
  const openEdit   = (s: Service) => { setEditService(s); setDrawerOpen(true); };
  const openPrices = (s: Service) => setPricesService(s);

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Servicios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Catálogo de servicios y tratamientos del centro
          </p>
        </div>
        {canAdmin && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nuevo servicio
          </Button>
        )}
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total servicios",
            value: services.length,
            icon: Scissors,
            color: "text-primary",
            bg: "bg-primary/10",
          },
          {
            label: "Activos",
            value: activeServices.length,
            icon: Users,
            color: "text-green-600",
            bg: "bg-green-50 dark:bg-green-900/20",
          },
          {
            label: "Con cita",
            value: scheduledServices.filter((s) => s.isActive).length,
            icon: CalendarCheck,
            color: "text-blue-600",
            bg: "bg-blue-50 dark:bg-blue-900/20",
          },
          {
            label: "Sin cita (instantáneos)",
            value: instantServices.filter((s) => s.isActive).length,
            icon: Zap,
            color: "text-amber-600",
            bg: "bg-amber-50 dark:bg-amber-900/20",
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-xl border bg-card p-3 flex items-center gap-3">
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", bg, color)}>
              <Icon size={16} />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">

        {/* Search + show inactive */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nombre o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer ml-auto whitespace-nowrap">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Mostrar inactivos
          </label>
        </div>

        {/* Type + category pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type filters */}
          <FilterPill active={typeFilter === "ALL"}         onClick={() => setTypeFilter("ALL")}>
            Todos ({services.filter(s => showAll || s.isActive).length})
          </FilterPill>
          <FilterPill active={typeFilter === "APPOINTMENT"} onClick={() => setTypeFilter("APPOINTMENT")}>
            <span className="flex items-center gap-1">
              <CalendarCheck size={10} />
              Con cita ({scheduledServices.filter(s => showAll || s.isActive).length})
            </span>
          </FilterPill>
          <FilterPill active={typeFilter === "INSTANT"}     onClick={() => setTypeFilter("INSTANT")}>
            <span className="flex items-center gap-1">
              <Zap size={10} />
              Sin cita ({instantServices.filter(s => showAll || s.isActive).length})
            </span>
          </FilterPill>

          {/* Separator */}
          {categories.length > 0 && (
            <span className="h-4 w-px bg-border mx-1" />
          )}

          {/* Category filters */}
          {categories.map((c) => (
            <FilterPill
              key={c.id}
              active={catFilter === c.id}
              onClick={() => setCatFilter(catFilter === c.id ? "ALL" : c.id)}
            >
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                {c.name}
              </span>
            </FilterPill>
          ))}
        </div>
      </div>

      {/* ── Services table ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="py-2.5 pl-4 pr-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Servicio
              </th>
              <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                Tipo
              </th>
              <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                Duración
              </th>
              <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Precio
              </th>
              {canAdmin && (
                <th className="py-2.5 pl-3 pr-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                      <Scissors className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {debouncedSearch ? "Sin resultados" : "Sin servicios"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {debouncedSearch
                          ? `No hay servicios que coincidan con "${debouncedSearch}"`
                          : "Crea el primer servicio del catálogo"}
                      </p>
                    </div>
                    {!debouncedSearch && canAdmin && (
                      <Button size="sm" onClick={openCreate}>
                        <Plus className="h-4 w-4 mr-1.5" />
                        Nuevo servicio
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <ServiceRow
                  key={s.id}
                  service={s}
                  canAdmin={canAdmin}
                  onEdit={openEdit}
                  onToggle={handleToggle}
                  onPrices={openPrices}
                />
              ))
            )}
          </tbody>
        </table>

        {/* Footer count */}
        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "servicio" : "servicios"}
              {filtered.length < services.length && (
                <span> · {services.length} en total</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* ── Category manager — solo admins ─────────────────────────────────── */}
      {canAdmin && <CategoryManager />}

      {/* ── Drawer crear/editar ────────────────────────────────────────────── */}
      <ServiceDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        service={editService}
      />

      {/* ── Dialog precios por sucursal ────────────────────────────────────── */}
      {pricesService && (
        <ServicePricesDialog
          open={!!pricesService}
          onClose={() => setPricesService(null)}
          service={pricesService}
        />
      )}
    </div>
  );
}

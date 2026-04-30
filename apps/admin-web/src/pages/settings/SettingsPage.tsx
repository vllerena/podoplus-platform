import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Settings, Building2, Clock, Shield, Plus, Edit2,
  ToggleLeft, ToggleRight, Loader2, Save, Trash2,
  ChevronDown, ChevronUp, MapPin, Phone, Mail,
  Lock, X, Check, AlertTriangle, ExternalLink, Megaphone, Briefcase,
  Globe, Navigation, Hash, Timer, Users,
} from "lucide-react";
import {
  Button, Input, Label, Skeleton, toast,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@podoplus/ui";
import {
  useMarketingChannels, useCreateMarketingChannel, useDeleteMarketingChannel,
} from "@/hooks/use-customers";
import { useAuthStore } from "@/stores/auth.store";
import {
  useBranches, useBranchHours, useCreateBranch, useUpdateBranch,
  useToggleBranch, useDeleteBranch, useSaveHours,
  BRANCH_TIMEZONES,
  type Branch, type LocalHour,
} from "@/hooks/use-branches";
import {
  useRbacRoles, useRbacPermissions,
  useAssignPermission, useRevokePermission,
  type RbacRole, type Permission,
} from "@/hooks/use-rbac";
import { useBusinessUnits } from "@/hooks/use-business-units";
import { cn } from "@/lib/utils";
import { BusinessUnitsPanel } from "./BusinessUnitsPanel";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const DEFAULT_HOURS: LocalHour[] = Array.from({ length: 7 }, (_, i) => ({
  weekday:   i,
  startTime: "08:00",
  endTime:   "18:00",
  isClosed:  i === 0,
}));

function toOptionalFloat(v: unknown) {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

// ── Branch form schema ────────────────────────────────────────────────────────

const branchSchema = z.object({
  name:            z.string().min(2, "Mínimo 2 caracteres").max(100),
  address:         z.string().max(300).optional().or(z.literal("")),
  district:        z.string().max(100).optional().or(z.literal("")),
  city:            z.string().max(100).optional().or(z.literal("")),
  phone:           z.string().max(20).optional().or(z.literal("")),
  email:           z.string().email("Email inválido").optional().or(z.literal("")),
  googleMapsUrl:   z.string().url("URL inválida").optional().or(z.literal("")),
  latitude:        z.preprocess(toOptionalFloat, z.number().min(-90).max(90).optional()),
  longitude:       z.preprocess(toOptionalFloat, z.number().min(-180).max(180).optional()),
  defaultCapacity: z.coerce.number().int().min(1).max(50).default(6),
  timezone:        z.string().default("America/Lima"),
  attachedCode:    z.string().max(20).optional().or(z.literal("")),
  businessUnitId:  z.string().optional().or(z.literal("")),
});
type BranchFormData = z.infer<typeof branchSchema>;

// ── Select class helper ───────────────────────────────────────────────────────

const selectCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25";

// ── Branch form dialog ────────────────────────────────────────────────────────

function BranchDialog({
  open, onClose, branch,
}: { open: boolean; onClose: () => void; branch: Branch | null }) {
  const createMut = useCreateBranch();
  const updateMut = useUpdateBranch(branch?.id ?? "");
  const { data: units = [] } = useBusinessUnits();
  const isEdit = !!branch;

  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } =
    useForm<BranchFormData>({
      resolver: zodResolver(branchSchema),
      defaultValues: {
        name:            branch?.name            ?? "",
        address:         branch?.address         ?? "",
        district:        branch?.district        ?? "",
        city:            branch?.city            ?? "",
        phone:           branch?.phone           ?? "",
        email:           branch?.email           ?? "",
        googleMapsUrl:   branch?.googleMapsUrl   ?? "",
        latitude:        branch?.latitude        ?? undefined,
        longitude:       branch?.longitude       ?? undefined,
        defaultCapacity: branch?.defaultCapacity ?? 6,
        timezone:        branch?.timezone        ?? "America/Lima",
        attachedCode:    branch?.attachedCode    ?? "",
        businessUnitId:  branch?.businessUnitId  ?? "",
      },
    });

  useEffect(() => {
    if (open) {
      reset({
        name:            branch?.name            ?? "",
        address:         branch?.address         ?? "",
        district:        branch?.district        ?? "",
        city:            branch?.city            ?? "",
        phone:           branch?.phone           ?? "",
        email:           branch?.email           ?? "",
        googleMapsUrl:   branch?.googleMapsUrl   ?? "",
        latitude:        branch?.latitude        ?? undefined,
        longitude:       branch?.longitude       ?? undefined,
        defaultCapacity: branch?.defaultCapacity ?? 6,
        timezone:        branch?.timezone        ?? "America/Lima",
        attachedCode:    branch?.attachedCode    ?? "",
        businessUnitId:  branch?.businessUnitId  ?? "",
      });
    }
  }, [open, branch, reset]);

  const onSubmit = async (vals: BranchFormData) => {
    try {
      const common = {
        name:            vals.name,
        address:         vals.address        || undefined,
        district:        vals.district       || undefined,
        city:            vals.city           || undefined,
        phone:           vals.phone          || undefined,
        email:           vals.email          || undefined,
        googleMapsUrl:   vals.googleMapsUrl  || undefined,
        latitude:        vals.latitude,
        longitude:       vals.longitude,
        defaultCapacity: vals.defaultCapacity,
        timezone:        vals.timezone       || "America/Lima",
        businessUnitId:  vals.businessUnitId || undefined,
      };
      if (isEdit) {
        await updateMut.mutateAsync({
          ...common,
          attachedCode: vals.attachedCode || undefined,
        });
      } else {
        await createMut.mutateAsync(common);
      }
      onClose();
    } catch { /* toasted in hook */ }
  };

  const activeUnits = units.filter((u) => u.isActive);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar sucursal" : "Nueva sucursal"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Modifica los datos de «${branch!.name}».`
              : "Registra una nueva sede del centro."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-1">

          {/* Datos principales */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Datos principales
            </p>
            <div className="space-y-1.5">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input {...register("name")} placeholder="Sede principal" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Hash size={11} className="text-muted-foreground" /> Código de anexo
                </Label>
                <Input {...register("attachedCode")} placeholder="01" maxLength={20} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Building2 size={11} className="text-muted-foreground" /> Empresa
                </Label>
                <select {...register("businessUnitId")} className={selectCls}>
                  <option value="">Sin empresa</option>
                  {activeUnits.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Contacto */}
          <div className="space-y-3 border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Contacto
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Phone size={11} className="text-muted-foreground" /> Teléfono
                </Label>
                <Input {...register("phone")} placeholder="+51 999 999 999" type="tel" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Mail size={11} className="text-muted-foreground" /> Email
                </Label>
                <Input type="email" {...register("email")} placeholder="sede@ejemplo.com" />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
            </div>
          </div>

          {/* Ubicación */}
          <div className="space-y-3 border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Ubicación
            </p>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <MapPin size={11} className="text-muted-foreground" /> Dirección
              </Label>
              <Input {...register("address")} placeholder="Av. Ejemplo 123" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Distrito</Label>
                <Input {...register("district")} placeholder="Miraflores" />
              </div>
              <div className="space-y-1.5">
                <Label>Ciudad</Label>
                <Input {...register("city")} placeholder="Lima" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Globe size={11} className="text-muted-foreground" /> Google Maps URL
              </Label>
              <Input {...register("googleMapsUrl")} placeholder="https://maps.google.com/..." />
              {errors.googleMapsUrl && <p className="text-xs text-destructive">{errors.googleMapsUrl.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Navigation size={11} className="text-muted-foreground" /> Latitud
                </Label>
                <Input type="number" step="any" {...register("latitude")} placeholder="-12.046374" />
                {errors.latitude && <p className="text-xs text-destructive">{errors.latitude.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Navigation size={11} className="text-muted-foreground" /> Longitud
                </Label>
                <Input type="number" step="any" {...register("longitude")} placeholder="-77.042793" />
                {errors.longitude && <p className="text-xs text-destructive">{errors.longitude.message}</p>}
              </div>
            </div>
          </div>

          {/* Configuración */}
          <div className="space-y-3 border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Configuración
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Users size={11} className="text-muted-foreground" /> Capacidad simultánea
                </Label>
                <Input type="number" min={1} max={50} {...register("defaultCapacity")} />
                {errors.defaultCapacity && <p className="text-xs text-destructive">{errors.defaultCapacity.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Timer size={11} className="text-muted-foreground" /> Zona horaria
                </Label>
                <select {...register("timezone")} className={selectCls}>
                  {BRANCH_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting || (isEdit && !isDirty)}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear sucursal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Horarios panel ────────────────────────────────────────────────────────────

function HoursPanel({ branchId }: { branchId: string }) {
  const { data: savedHours, isLoading } = useBranchHours(branchId);
  const saveMut = useSaveHours(branchId);
  const [hours, setHours] = useState<LocalHour[]>(DEFAULT_HOURS);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    if (savedHours) {
      setHours(
        DEFAULT_HOURS.map((def) => {
          const found = savedHours.find((h) => h.weekday === def.weekday);
          if (found) return { ...found, isClosed: false };
          return def;
        })
      );
    }
  }, [savedHours]);

  const update = (weekday: number, field: keyof LocalHour, value: string | boolean) => {
    setHours((prev) =>
      prev.map((h) => h.weekday === weekday ? { ...h, [field]: value } : h)
    );
  };

  const handleSave = async () => {
    try {
      await saveMut.mutateAsync(hours);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* toasted in hook */ }
  };

  if (isLoading) return (
    <div className="space-y-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={`hour-skel-${i}`} className="h-10 w-full" />
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      {hours.map((h) => (
        <div key={h.weekday} className={cn(
          "flex items-center gap-3 p-3 rounded-lg border transition-colors",
          h.isClosed ? "bg-muted/30 opacity-60" : "bg-card"
        )}>
          <span className="w-24 text-sm font-medium text-foreground shrink-0">
            {DAY_LABELS[h.weekday]}
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={!h.isClosed}
              onChange={(e) => update(h.weekday, "isClosed", !e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-primary"
            />
            <span className="text-xs text-muted-foreground">{h.isClosed ? "Cerrado" : "Abierto"}</span>
          </label>
          {!h.isClosed && (
            <>
              <input
                type="time"
                value={h.startTime}
                onChange={(e) => update(h.weekday, "startTime", e.target.value)}
                className="rounded-lg border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
              <span className="text-xs text-muted-foreground">—</span>
              <input
                type="time"
                value={h.endTime}
                onChange={(e) => update(h.weekday, "endTime", e.target.value)}
                className="rounded-lg border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
            </>
          )}
        </div>
      ))}

      <div className="flex justify-end pt-1">
        <Button size="sm" onClick={handleSave} disabled={saveMut.isPending}>
          {saveMut.isPending
            ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            : <Save className="mr-2 h-3.5 w-3.5" />
          }
          {saved ? "¡Guardado!" : "Guardar horarios"}
        </Button>
      </div>
    </div>
  );
}

// ── Branch card ───────────────────────────────────────────────────────────────

function BranchCard({
  branch,
  onEdit,
  onDetail,
  isSuperAdmin,
}: {
  branch:       Branch;
  onEdit:       (b: Branch) => void;
  onDetail:     (b: Branch) => void;
  isSuperAdmin: boolean;
}) {
  const [expanded,      setExpanded]      = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toggleMut = useToggleBranch();
  const deleteMut = useDeleteBranch();

  const handleDelete = async () => {
    try {
      await deleteMut.mutateAsync(branch.id);
      setConfirmDelete(false);
    } catch { /* toasted */ }
  };

  return (
    <div className={cn(
      "rounded-2xl border bg-card overflow-hidden transition-all",
      !branch.isActive && "opacity-70",
    )}>
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        {/* Photo / placeholder */}
        {branch.photoUrl ? (
          <img src={branch.photoUrl} alt={branch.name}
            className="h-12 w-12 rounded-xl object-cover shrink-0 ring-1 ring-border" />
        ) : (
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 size={20} className="text-primary" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Name + badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground text-sm leading-tight">{branch.name}</h3>
            <span className={cn(
              "text-[10px] rounded-full px-2 py-0.5 font-semibold shrink-0",
              branch.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground",
            )}>
              {branch.isActive ? "Activa" : "Inactiva"}
            </span>
            {branch.attachedCode && (
              <span className="text-[10px] font-mono bg-muted text-muted-foreground rounded px-1.5 py-0.5 shrink-0">
                Anexo {branch.attachedCode}
              </span>
            )}
          </div>

          {/* Meta info */}
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
            {branch.businessUnit && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Briefcase size={9} />{branch.businessUnit.name}
              </span>
            )}
            {branch.address && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin size={9} />
                {[branch.address, branch.district, branch.city].filter(Boolean).join(", ")}
              </span>
            )}
            {branch.phone && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone size={9} />{branch.phone}
              </span>
            )}
            {branch.email && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail size={9} />{branch.email}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-primary"
            onClick={() => onDetail(branch)} title="Ver detalle">
            <ExternalLink size={13} />
          </Button>
          {isSuperAdmin && (
            <>
              <Button size="sm" variant="ghost" className="h-7 px-2"
                onClick={() => onEdit(branch)} title="Editar">
                <Edit2 size={13} />
              </Button>
              <Button size="sm" variant="ghost"
                className={cn("h-7 px-2", branch.isActive ? "hover:text-destructive" : "hover:text-primary")}
                disabled={toggleMut.isPending}
                onClick={() => toggleMut.mutate({ id: branch.id, active: !branch.isActive })}
                title={branch.isActive ? "Desactivar" : "Activar"}>
                {branch.isActive ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 hover:text-destructive"
                onClick={() => setConfirmDelete(true)} title="Eliminar">
                <Trash2 size={13} />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="px-4 pb-3 flex items-center gap-2 border-t bg-destructive/5">
          <AlertTriangle size={13} className="text-destructive shrink-0" />
          <p className="text-xs text-destructive flex-1">¿Eliminar «{branch.name}»? Esta acción no se puede deshacer.</p>
          <Button size="sm" variant="destructive" className="h-6 px-2 text-xs"
            disabled={deleteMut.isPending} onClick={handleDelete}>
            {deleteMut.isPending ? <Loader2 size={11} className="animate-spin" /> : "Sí, eliminar"}
          </Button>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
            onClick={() => setConfirmDelete(false)}>
            Cancelar
          </Button>
        </div>
      )}

      {/* Horarios expandible */}
      <div className="border-t border-border">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-1.5"><Clock size={12} />Horarios de atención</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {expanded && (
          <div className="px-4 pb-4">
            <HoursPanel branchId={branch.id} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── RBAC Panel ────────────────────────────────────────────────────────────────

function PermissionChip({
  permission, canRevoke, onRevoke, revoking,
}: {
  permission: Permission;
  canRevoke:  boolean;
  onRevoke:   (code: string) => void;
  revoking:   boolean;
}) {
  return (
    <span className="group inline-flex items-center gap-1 text-[11px] bg-primary/5 text-primary border border-primary/20 rounded-md pl-2 pr-1 py-0.5 font-mono">
      {permission.code}
      {canRevoke && (
        <button
          onClick={() => onRevoke(permission.code)}
          disabled={revoking}
          className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive disabled:cursor-not-allowed ml-0.5"
          title={`Quitar ${permission.code}`}
        >
          {revoking ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
        </button>
      )}
    </span>
  );
}

function AssignPermissionRow({
  role, allPermissions, canManage,
}: {
  role:           RbacRole;
  allPermissions: Permission[];
  canManage:      boolean;
}) {
  const [selected, setSelected] = useState("");
  const [open,     setOpen]     = useState(false);
  const assignMut = useAssignPermission();

  const assignedCodes = new Set(role.permissions.map((p) => p.code));
  const available     = allPermissions.filter((p) => !assignedCodes.has(p.code));

  if (!canManage || available.length === 0) return null;

  const handleAssign = async () => {
    if (!selected) return;
    try {
      await assignMut.mutateAsync({ roleId: role.id, permissionCode: selected });
      setSelected("");
      setOpen(false);
    } catch { /* toasted in hook */ }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[11px] border border-dashed border-primary/40 text-primary/70 hover:text-primary hover:border-primary rounded-md px-2 py-0.5 transition-colors"
      >
        <Plus size={10} />
        Agregar permiso
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-1">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        autoFocus
        className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/25"
      >
        <option value="">Selecciona un permiso…</option>
        {available.map((p) => (
          <option key={p.code} value={p.code}>
            {p.code}{p.name ? ` — ${p.name}` : ""}
          </option>
        ))}
      </select>
      <Button size="sm" className="h-7 px-2" onClick={handleAssign} disabled={!selected || assignMut.isPending}>
        {assignMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground" onClick={() => { setOpen(false); setSelected(""); }}>
        <X size={12} />
      </Button>
    </div>
  );
}

function ForbiddenCard({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <Lock className="h-6 w-6 text-destructive" />
      </div>
      <div>
        <p className="font-semibold text-foreground">Acceso restringido</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          {message ?? "No tienes permisos para ver o gestionar esta sección. Contacta a un administrador."}
        </p>
      </div>
    </div>
  );
}

function RbacPanel() {
  const canManage   = useAuthStore((s) => s.canManageRbac());
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: roles, isLoading: loadRoles, error: rolesError } = useRbacRoles();
  const { data: allPermissions = [], isLoading: loadPerms }      = useRbacPermissions();
  const revokeMut = useRevokePermission();

  const is403 = (err: unknown) => (err as any)?.statusCode === 403;

  if (rolesError && is403(rolesError)) {
    return <ForbiddenCard message="Solo SUPER_ADMIN o GENERAL_MANAGER pueden gestionar roles y permisos." />;
  }

  if (loadRoles || loadPerms) return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
    </div>
  );

  const handleRevoke = async (roleId: string, permissionCode: string) => {
    try {
      await revokeMut.mutateAsync({ roleId, permissionCode });
    } catch { /* toasted in hook */ }
  };

  return (
    <div className="space-y-3">
      {!canManage && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Estás viendo los roles en modo de solo lectura. Necesitas el rol <strong>SUPER_ADMIN</strong> o <strong>GENERAL_MANAGER</strong> para modificar permisos.
          </p>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
        <span><strong className="text-foreground">{(roles ?? []).length}</strong> roles configurados</span>
        <span><strong className="text-foreground">{allPermissions.length}</strong> permisos disponibles</span>
      </div>

      {(roles ?? []).map((role) => (
        <div key={role.id} className="rounded-lg border bg-card overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === role.id ? null : role.id)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Shield size={13} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{role.name}</p>
                <p className="text-[11px] text-muted-foreground font-mono">{role.code}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[11px] text-muted-foreground hidden sm:block">
                {role.permissions.length} permiso{role.permissions.length !== 1 ? "s" : ""}
              </span>
              {expanded === role.id
                ? <ChevronUp size={14} className="text-muted-foreground" />
                : <ChevronDown size={14} className="text-muted-foreground" />
              }
            </div>
          </button>

          {expanded === role.id && (
            <div className="px-4 pb-4 border-t border-border">
              <div className="flex flex-wrap gap-1.5 pt-3">
                {role.permissions.length === 0 && !canManage && (
                  <p className="text-xs text-muted-foreground">Sin permisos asignados</p>
                )}
                {role.permissions.map((p) => (
                  <PermissionChip
                    key={`${role.id}-${p.code}`}
                    permission={p}
                    canRevoke={canManage}
                    onRevoke={(code) => handleRevoke(role.id, code)}
                    revoking={revokeMut.isPending}
                  />
                ))}
                <AssignPermissionRow role={role} allPermissions={allPermissions} canManage={canManage} />
              </div>
              {role.description && (
                <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-2">
                  {role.description}
                </p>
              )}
            </div>
          )}
        </div>
      ))}

      {(roles ?? []).length === 0 && (
        <div className="flex flex-col items-center py-12 text-center gap-2">
          <Shield className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No se encontraron roles configurados.</p>
        </div>
      )}
    </div>
  );
}

// ── Marketing Channels Panel ──────────────────────────────────────────────────

function MarketingChannelsPanel() {
  const [newName, setNewName] = useState("");
  const [adding,  setAdding]  = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: channels = [], isLoading } = useMarketingChannels();
  const createMut = useCreateMarketingChannel();
  const deleteMut = useDeleteMarketingChannel();

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createMut.mutateAsync(name);
      setNewName("");
      setAdding(false);
      toast({ title: "Canal creado", description: name });
    } catch { /* toasted in hook */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMut.mutateAsync(id);
      setConfirmId(null);
    } catch { /* toasted in hook */ }
  };

  if (isLoading) return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define los canales por los que los pacientes conocen tu centro (Instagram, Google, Referido, etc.).
          Se usan al registrar o editar un paciente.
        </p>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)} className="shrink-0 ml-4">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Nuevo canal
          </Button>
        )}
      </div>

      {/* Form nueva canal */}
      {adding && (
        <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
          <Input
            ref={inputRef}
            placeholder="Ej: Instagram, Google, Referido..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") { setAdding(false); setNewName(""); }
            }}
            className="flex-1"
          />
          <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || createMut.isPending}>
            {createMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewName(""); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* List */}
      {channels.length === 0 && !adding ? (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border bg-card gap-3">
          <Megaphone className="h-10 w-10 text-muted-foreground/30" />
          <div>
            <p className="font-medium text-foreground">Sin canales de marketing</p>
            <p className="text-sm text-muted-foreground mt-0.5">Crea el primer canal para empezar a registrar cómo te encuentran los pacientes.</p>
          </div>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Nuevo canal
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {channels.map((ch) => (
            <div key={ch.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Megaphone className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{ch.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ch.isActive ? "Activo" : "Inactivo"}
                  </p>
                </div>
              </div>

              {confirmId === ch.id ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-destructive">¿Eliminar?</span>
                  <Button size="sm" variant="destructive" className="h-6 px-2 text-xs"
                    disabled={deleteMut.isPending}
                    onClick={() => handleDelete(ch.id)}>
                    {deleteMut.isPending ? <Loader2 size={11} className="animate-spin" /> : "Sí"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                    onClick={() => setConfirmId(null)}>
                    No
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost"
                  className="h-7 px-2 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => setConfirmId(ch.id)}
                  title="Eliminar canal">
                  <Trash2 size={13} />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type TabId = "business-units" | "branches" | "roles" | "marketing";

const TABS: { id: TabId; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "business-units", label: "Empresas",         icon: Briefcase, desc: "Razones sociales" },
  { id: "branches",       label: "Sucursales",        icon: Building2, desc: "Sedes y horarios" },
  { id: "roles",          label: "Roles y permisos",  icon: Shield,    desc: "RBAC del sistema" },
  { id: "marketing",      label: "Marketing",         icon: Megaphone, desc: "Canales de captación" },
];

// ── Página principal ──────────────────────────────────────────────────────────

export function SettingsPage() {
  const navigate     = useNavigate();
  const [tab,        setTab]        = useState<TabId>("business-units");
  const [branchOpen, setBranchOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);

  const { data: branches = [], isLoading } = useBranches();
  const isSuperAdmin = useAuthStore((s) => s.hasRole("SUPER_ADMIN"));

  const openCreate = () => { setEditBranch(null); setBranchOpen(true); };
  const openEdit   = (b: Branch) => { setEditBranch(b); setBranchOpen(true); };

  const currentTab = TABS.find((t) => t.id === tab)!;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings size={22} className="text-primary" />
          Configuración
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gestión de empresas, sucursales, horarios y permisos del sistema
        </p>
      </div>

      {/* ── Tab navigation ── */}
      <div className="flex gap-1 p-1 bg-muted/60 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
              tab === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50",
            )}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="space-y-4">

        {/* Tab sub-header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <currentTab.icon size={16} className="text-primary" />
            <div>
              <h2 className="font-semibold text-foreground leading-tight">{currentTab.label}</h2>
              <p className="text-xs text-muted-foreground">{currentTab.desc}</p>
            </div>
          </div>
          {/* CTA por tab */}
          {tab === "branches" && isSuperAdmin && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Nueva sucursal
            </Button>
          )}
        </div>

        {/* ── Empresas ── */}
        {tab === "business-units" && <BusinessUnitsPanel />}

        {/* ── Sucursales ── */}
        {tab === "branches" && (
          <>
            {isLoading ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 w-full rounded-2xl" />
                ))}
              </div>
            ) : branches.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] text-center rounded-2xl border bg-card gap-3">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                  <Building2 className="h-7 w-7 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Sin sucursales registradas</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Crea la primera sucursal del centro
                  </p>
                </div>
                {isSuperAdmin && (
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-1.5" /> Nueva sucursal
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {branches.map((b) => (
                  <BranchCard
                    key={b.id}
                    branch={b}
                    onEdit={openEdit}
                    onDetail={(br) => navigate(`/branches/${br.id}`)}
                    isSuperAdmin={isSuperAdmin}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Roles y permisos ── */}
        {tab === "roles" && <RbacPanel />}

        {/* ── Canal de Marketing ── */}
        {tab === "marketing" && <MarketingChannelsPanel />}

      </div>

      {/* ── Dialog sucursal ── */}
      <BranchDialog
        open={branchOpen}
        onClose={() => setBranchOpen(false)}
        branch={editBranch}
      />
    </div>
  );
}

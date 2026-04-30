import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, Building2, MapPin, Phone, Mail, Camera,
  Trash2, Edit2, ToggleLeft, ToggleRight, Plus, Loader2, Save,
  Clock, Calendar, DollarSign, Users, AlertCircle, X, Check,
  Shield, UserCircle, Lock, Globe, Navigation, Hash, Briefcase,
  FileText,
} from "lucide-react";
import {
  Button, Input, Label, Skeleton,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@podoplus/ui";
import {
  useBranch, useBranchStats,
  useBranchHours, useBranchBlocks, useBranchExceptions,
  useBranchServicePrices, useBranchUsers,
  useUpdateBranch, useDeleteBranch, useToggleBranch,
  useUploadBranchPhoto, useDeleteBranchPhoto,
  useSaveHours, useCreateBlock, useDeleteBlock,
  useCreateException, useDeleteException,
  useSetBranchServicePrice, useDeleteBranchServicePrice,
  useAssignUserToBranch, useRemoveUserFromBranch,
  useBranchSeries, useCreateBranchSerie, useDeleteBranchSerie,
  BRANCH_TIMEZONES, TIPO_DOC_CODES, TIPO_DOC_LABELS,
  type LocalHour, type BlockType, type CreateBlockDto, type CreateExceptionDto,
  type UpdateBranchDto, type TipoDocCode,
} from "@/hooks/use-branches";
import { useUsers } from "@/hooks/use-users";
import { useServices } from "@/hooks/use-services";
import { useProducts } from "@/hooks/use-products";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const DEFAULT_HOURS: LocalHour[] = Array.from({ length: 7 }, (_, i) => ({
  weekday:   i,
  startTime: "08:00",
  endTime:   "18:00",
  isClosed:  i === 0,
}));

function toISOLocal(date: string, time: string): string {
  return `${date}T${time}:00`;
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtRevenue(v: number | undefined) {
  if (v === undefined) return "—";
  return `S/ ${parseFloat(String(v)).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}
function fmtPrice(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `S/ ${parseFloat(String(v)).toFixed(2)}`;
}
function fmtCoord(v: number | null, decimals = 6) {
  return v !== null ? v.toFixed(decimals) : "—";
}

// ── Schemas ───────────────────────────────────────────────────────────────────

/** Transforma string vacío o inválido a undefined; de lo contrario a número */
function toOptionalFloat(v: unknown) {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

const editSchema = z.object({
  name:            z.string().min(2, "Mínimo 2 caracteres").max(150),
  address:         z.string().max(300).optional().or(z.literal("")),
  district:        z.string().max(100).optional().or(z.literal("")),
  ubigeo:          z.string().max(10).optional().or(z.literal("")),
  city:            z.string().max(100).optional().or(z.literal("")),
  phone:           z.string().max(20).optional().or(z.literal("")),
  email:           z.string().email("Email inválido").optional().or(z.literal("")),
  googleMapsUrl:   z.string().url("URL inválida").optional().or(z.literal("")),
  latitude:        z.preprocess(toOptionalFloat, z.number().min(-90).max(90).optional()),
  longitude:       z.preprocess(toOptionalFloat, z.number().min(-180).max(180).optional()),
  defaultCapacity: z.coerce.number().int().min(1, "Mínimo 1").max(50, "Máximo 50").default(6),
  timezone:        z.string().default("America/Lima"),
  attachedCode:    z.string().max(20).optional().or(z.literal("")),
});
type EditFormData = z.infer<typeof editSchema>;

const BLOCK_TYPES: { value: BlockType; label: string }[] = [
  { value: "LUNCH",       label: "Almuerzo" },
  { value: "HOLIDAY",     label: "Feriado" },
  { value: "MAINTENANCE", label: "Mantenimiento" },
  { value: "EVENT",       label: "Evento" },
  { value: "CUSTOM",      label: "Personalizado" },
];

const blockSchema = z.object({
  type:      z.enum(["LUNCH", "HOLIDAY", "MAINTENANCE", "EVENT", "CUSTOM"] as const),
  title:     z.string().min(1, "Requerido").max(100),
  date:      z.string().min(1, "Requerido"),
  startTime: z.string().min(1, "Requerido"),
  endTime:   z.string().min(1, "Requerido"),
});
type BlockFormData = z.infer<typeof blockSchema>;

const exceptionSchema = z.object({
  date:      z.string().min(1, "Requerido"),
  startTime: z.string().min(1, "Requerido"),
  endTime:   z.string().min(1, "Requerido"),
  reason:    z.string().max(200).optional().or(z.literal("")),
});
type ExceptionFormData = z.infer<typeof exceptionSchema>;

// ── Series panel ─────────────────────────────────────────────────────────────

function SeriesPanel({ branchId, canEdit }: { branchId: string; canEdit: boolean }) {
  const { data: series = [], isLoading } = useBranchSeries(branchId);
  const createMut = useCreateBranchSerie(branchId);
  const deleteMut = useDeleteBranchSerie(branchId);

  const [addOpen,       setAddOpen]       = useState(false);
  const [newTipo,       setNewTipo]       = useState<TipoDocCode>("03");
  const [newSerie,      setNewSerie]      = useState("");
  const [newConting,    setNewConting]    = useState(false);
  const [deleteTarget,  setDeleteTarget]  = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newSerie.trim()) return;
    await createMut.mutateAsync({ tipoDocumento: newTipo, serie: newSerie.trim().toUpperCase(), contingencia: newConting });
    setNewSerie(""); setNewTipo("03"); setNewConting(false); setAddOpen(false);
  };

  const handleDelete = async (serieId: string) => {
    await deleteMut.mutateAsync(serieId);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Series de documentos</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Series SUNAT configuradas para esta sede
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
            <Plus size={14} /> Nueva serie
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs">Tipo de documento</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs">Número de serie</th>
              <th className="px-4 py-3 text-center font-semibold text-muted-foreground text-xs">D. Contingencia</th>
              {canEdit && <th className="w-24" />}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                  <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-10 mx-auto" /></td>
                  {canEdit && <td />}
                </tr>
              ))
            ) : series.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 4 : 3}>
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <FileText className="h-8 w-8 mb-2 opacity-25" />
                    <p className="text-sm">Sin series configuradas</p>
                    {canEdit && (
                      <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => setAddOpen(true)}>
                        <Plus size={14} /> Agregar primera serie
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              series.map(s => (
                <tr key={s.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-primary text-xs">
                      {TIPO_DOC_LABELS[s.tipoDocumento] ?? s.tipoDocumento}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-sm">{s.serie}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      "inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold",
                      s.contingencia
                        ? "bg-amber-100 text-amber-700"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {s.contingencia ? "SÍ" : "NO"}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 px-3 text-xs"
                        onClick={() => setDeleteTarget(s.id)}
                      >
                        Eliminar
                      </Button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add serie dialog */}
      <Dialog open={addOpen} onOpenChange={v => !v && setAddOpen(false)}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Nueva serie de documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tipo de documento
              </Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={newTipo}
                onChange={e => setNewTipo(e.target.value as TipoDocCode)}
              >
                {TIPO_DOC_CODES.map(code => (
                  <option key={code} value={code}>
                    {TIPO_DOC_LABELS[code] ?? code}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Número de serie
              </Label>
              <Input
                placeholder="Ej: B020, F020, FC20"
                value={newSerie}
                onChange={e => setNewSerie(e.target.value.toUpperCase())}
                className="font-mono"
                maxLength={10}
              />
            </div>
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="contingencia"
                checked={newConting}
                onChange={e => setNewConting(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="contingencia" className="text-sm cursor-pointer">
                Serie de contingencia
              </Label>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={!newSerie.trim() || createMut.isPending}
              onClick={handleAdd}
            >
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Agregar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>¿Eliminar serie?</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Esta acción no se puede deshacer. La serie será eliminada de esta sede.
          </DialogDescription>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={deleteMut.isPending}
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              {deleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type TabId = "general" | "horarios" | "precios" | "usuarios" | "series";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "general",  label: "General",  icon: Building2 },
  { id: "horarios", label: "Horarios", icon: Clock },
  { id: "precios",  label: "Precios",  icon: DollarSign },
  { id: "usuarios", label: "Usuarios", icon: Users },
  { id: "series",   label: "Series",   icon: FileText },
];

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, color, loading,
}: {
  label: string; value: string | number; icon: React.ElementType;
  color: string; loading?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", color + "/10")}>
        <Icon size={18} className={color} />
      </div>
      <div className="min-w-0">
        {loading
          ? <Skeleton className="h-6 w-16 mb-1" />
          : <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
        }
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ── Edit branch dialog ────────────────────────────────────────────────────────

const selectCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25";

function EditBranchDialog({ open, onClose, branchId, defaultValues }: {
  open: boolean; onClose: () => void;
  branchId: string; defaultValues: EditFormData;
}) {
  const updateMut = useUpdateBranch(branchId);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) reset(defaultValues);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = async (vals: EditFormData) => {
    const body: UpdateBranchDto = {
      name:            vals.name,
      address:         vals.address         || undefined,
      district:        vals.district        || undefined,
      city:            vals.city            || undefined,
      phone:           vals.phone           || undefined,
      email:           vals.email           || undefined,
      googleMapsUrl:   vals.googleMapsUrl   || undefined,
      latitude:        vals.latitude        ?? undefined,
      longitude:       vals.longitude       ?? undefined,
      defaultCapacity: vals.defaultCapacity,
      timezone:        vals.timezone,
      attachedCode:    vals.attachedCode    || undefined,
      ubigeo:          vals.ubigeo          || undefined,
    };
    try {
      await updateMut.mutateAsync(body);
      onClose();
    } catch { /* toasted in hook */ }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar sucursal</DialogTitle>
          <DialogDescription>
            Actualiza los datos de contacto, ubicación y configuración de la sede.
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
              <Input {...register("name")} />
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
                  <Navigation size={11} className="text-muted-foreground" /> Ubigeo
                </Label>
                <Input {...register("ubigeo")} placeholder="150120" maxLength={10} />
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
                <Label><Phone size={12} className="inline mr-1" />Teléfono</Label>
                <Input {...register("phone")} />
              </div>
              <div className="space-y-1.5">
                <Label><Mail size={12} className="inline mr-1" />Email</Label>
                <Input type="email" {...register("email")} />
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
              <Label><MapPin size={12} className="inline mr-1" />Dirección</Label>
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
              <Label><Globe size={12} className="inline mr-1" />Google Maps URL</Label>
              <Input {...register("googleMapsUrl")} placeholder="https://maps.google.com/..." />
              {errors.googleMapsUrl && <p className="text-xs text-destructive">{errors.googleMapsUrl.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label><Navigation size={12} className="inline mr-1" />Latitud</Label>
                <Input type="number" step="any" {...register("latitude")} placeholder="-12.046374" />
                {errors.latitude && <p className="text-xs text-destructive">{errors.latitude.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label><Navigation size={12} className="inline mr-1" />Longitud</Label>
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
                <Label>Capacidad simultánea</Label>
                <Input type="number" min={1} max={50} {...register("defaultCapacity")} />
                {errors.defaultCapacity && <p className="text-xs text-destructive">{errors.defaultCapacity.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Zona horaria</Label>
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
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Photo section ─────────────────────────────────────────────────────────────

function PhotoSection({ branchId, photoUrl, name }: {
  branchId: string; photoUrl: string | null; name: string;
}) {
  const fileRef   = useRef<HTMLInputElement>(null);
  const uploadMut = useUploadBranchPhoto(branchId);
  const deleteMut = useDeleteBranchPhoto(branchId);
  const busy      = uploadMut.isPending || deleteMut.isPending;

  // Cache-buster: fuerza al navegador a recargar la imagen tras cada subida,
  // ya que el servidor puede devolver el mismo path URL para la misma sede.
  const [cacheBuster, setCacheBuster] = useState<number>(0);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      await uploadMut.mutateAsync(file, {
        onSuccess: () => setCacheBuster(Date.now()),
      });
    } catch { /* toasted */ }
  };
  const handleDelete = async () => {
    try { await deleteMut.mutateAsync(); } catch { /* toasted */ }
  };

  const imgSrc = photoUrl
    ? cacheBuster ? `${photoUrl}?cb=${cacheBuster}` : photoUrl
    : null;

  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-xl border bg-card">
      <div className="relative shrink-0">
        {imgSrc ? (
          <img src={imgSrc} alt={name}
            className="h-24 w-24 rounded-xl object-cover ring-2 ring-border" />
        ) : (
          <div className="h-24 w-24 rounded-xl bg-primary/10 flex items-center justify-center ring-2 ring-border">
            <Building2 size={32} className="text-primary/60" />
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 rounded-xl bg-black/30 flex items-center justify-center">
            <Loader2 size={20} className="text-white animate-spin" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <p className="text-sm font-medium text-foreground">Foto de sede</p>
        <p className="text-xs text-muted-foreground">JPG, PNG o WEBP · Máx. 5 MB</p>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Camera size={13} className="mr-1.5" />
            {imgSrc ? "Cambiar foto" : "Subir foto"}
          </Button>
          {imgSrc && (
            <Button size="sm" variant="outline"
              className="hover:text-destructive hover:border-destructive"
              onClick={handleDelete} disabled={busy}>
              <Trash2 size={13} className="mr-1.5" />Eliminar
            </Button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
          className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}

// ── Hours panel ───────────────────────────────────────────────────────────────

function HoursPanel({ branchId }: { branchId: string }) {
  const { data: savedHours, isLoading } = useBranchHours(branchId);
  const saveMut = useSaveHours(branchId);
  const [hours, setHours] = useState<LocalHour[]>(DEFAULT_HOURS);

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

  const update = (weekday: number, field: keyof LocalHour, val: string | boolean) =>
    setHours((prev) => prev.map((h) => h.weekday === weekday ? { ...h, [field]: val } : h));

  if (isLoading) return (
    <div className="space-y-2">
      {Array.from({ length: 7 }).map((_, i) => <Skeleton key={`hour-skel-${i}`} className="h-10 w-full" />)}
    </div>
  );

  return (
    <div className="space-y-3">
      {hours.map((h) => (
        <div key={h.weekday} className={cn(
          "flex items-center gap-3 p-3 rounded-lg border transition-colors",
          h.isClosed ? "bg-muted/30 opacity-60" : "bg-card"
        )}>
          <span className="w-24 text-sm font-medium shrink-0">{DAY_LABELS[h.weekday]}</span>
          <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
            <input type="checkbox" checked={!h.isClosed}
              onChange={(e) => update(h.weekday, "isClosed", !e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-primary" />
            <span className="text-xs text-muted-foreground">{h.isClosed ? "Cerrado" : "Abierto"}</span>
          </label>
          {!h.isClosed && (
            <>
              <input type="time" value={h.startTime}
                onChange={(e) => update(h.weekday, "startTime", e.target.value)}
                className="rounded-lg border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/25" />
              <span className="text-xs text-muted-foreground">—</span>
              <input type="time" value={h.endTime}
                onChange={(e) => update(h.weekday, "endTime", e.target.value)}
                className="rounded-lg border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/25" />
            </>
          )}
        </div>
      ))}
      <div className="flex justify-end pt-1">
        <Button size="sm" onClick={async () => {
          try { await saveMut.mutateAsync(hours); } catch { /* toasted */ }
        }} disabled={saveMut.isPending}>
          {saveMut.isPending
            ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            : <Save className="mr-2 h-3.5 w-3.5" />}
          Guardar horarios
        </Button>
      </div>
    </div>
  );
}

// ── Blocks panel ──────────────────────────────────────────────────────────────

function BlocksPanel({ branchId, canEdit }: { branchId: string; canEdit: boolean }) {
  const { data: blocks = [], isLoading } = useBranchBlocks(branchId);
  const createMut = useCreateBlock(branchId);
  const deleteMut = useDeleteBlock(branchId);
  const [showForm, setShowForm] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<BlockFormData>({
    resolver: zodResolver(blockSchema),
    defaultValues: { type: "CUSTOM" },
  });

  const onSubmit = async (vals: BlockFormData) => {
    const body: CreateBlockDto = {
      type:    vals.type,
      title:   vals.title,
      startAt: toISOLocal(vals.date, vals.startTime),
      endAt:   toISOLocal(vals.date, vals.endTime),
    };
    try {
      await createMut.mutateAsync(body);
      reset({ type: "CUSTOM" });
      setShowForm(false);
    } catch { /* toasted */ }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <AlertCircle size={14} className="text-amber-500" />Bloques de horario
        </h3>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            <Plus size={13} className="mr-1.5" />Nuevo bloque
          </Button>
        )}
      </div>

      {showForm && canEdit && (
        <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border border-dashed bg-muted/30 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo *</Label>
              <select {...register("type")}
                className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/25">
                {BLOCK_TYPES.map((bt) => (
                  <option key={bt.value} value={bt.value}>{bt.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Título *</Label>
              <Input {...register("title")} placeholder="Ej. Pausa almuerzo" className="h-8 text-xs" />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Fecha *</Label>
              <Input type="date" {...register("date")} className="h-8 text-xs" />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Inicio *</Label>
              <Input type="time" {...register("startTime")} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fin *</Label>
              <Input type="time" {...register("endTime")} className="h-8 text-xs" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" size="sm" variant="outline" onClick={() => { setShowForm(false); reset({ type: "CUSTOM" }); }}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Guardar
            </Button>
          </div>
        </form>
      )}

      {isLoading
        ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={`block-skel-${i}`} className="h-10 w-full rounded-lg" />)
        : blocks.length === 0
          ? <p className="text-xs text-muted-foreground py-4 text-center">Sin bloques registrados</p>
          : (
            <div className="space-y-2">
              {blocks.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border bg-card text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 shrink-0 uppercase">
                      {BLOCK_TYPES.find((bt) => bt.value === b.type)?.label ?? b.type}
                    </span>
                    <span className="font-medium text-xs text-foreground truncate">{b.title}</span>
                    <span className="text-muted-foreground text-xs shrink-0">{fmtDatetime(b.startAt)} — {fmtDatetime(b.endAt)}</span>
                  </div>
                  {canEdit && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 hover:text-destructive shrink-0 ml-2"
                      disabled={deleteMut.isPending}
                      onClick={async () => { try { await deleteMut.mutateAsync(b.id); } catch { /* */ } }}>
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )
      }
    </div>
  );
}

// ── Exceptions panel ──────────────────────────────────────────────────────────

function ExceptionsPanel({ branchId, canEdit }: { branchId: string; canEdit: boolean }) {
  const { data: exceptions = [], isLoading } = useBranchExceptions(branchId);
  const createMut = useCreateException(branchId);
  const deleteMut = useDeleteException(branchId);
  const [showForm, setShowForm] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ExceptionFormData>({
    resolver: zodResolver(exceptionSchema),
  });

  const onSubmit = async (vals: ExceptionFormData) => {
    const body: CreateExceptionDto = {
      date:      vals.date,
      startTime: vals.startTime,
      endTime:   vals.endTime,
      reason:    vals.reason || undefined,
    };
    try {
      await createMut.mutateAsync(body);
      reset();
      setShowForm(false);
    } catch { /* toasted */ }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Calendar size={14} className="text-blue-500" />Excepciones de horario
        </h3>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            <Plus size={13} className="mr-1.5" />Nueva excepción
          </Button>
        )}
      </div>

      {showForm && canEdit && (
        <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border border-dashed bg-muted/30 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Fecha *</Label>
              <Input type="date" {...register("date")} className="h-8 text-xs" />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Apertura especial *</Label>
              <Input type="time" {...register("startTime")} className="h-8 text-xs" />
              {errors.startTime && <p className="text-xs text-destructive">{errors.startTime.message}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cierre especial *</Label>
              <Input type="time" {...register("endTime")} className="h-8 text-xs" />
              {errors.endTime && <p className="text-xs text-destructive">{errors.endTime.message}</p>}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Motivo</Label>
            <Input {...register("reason")} placeholder="Feriado, mantenimiento, etc." className="h-8 text-xs" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" size="sm" variant="outline" onClick={() => { setShowForm(false); reset(); }}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Guardar
            </Button>
          </div>
        </form>
      )}

      {isLoading
        ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={`exc-skel-${i}`} className="h-10 w-full rounded-lg" />)
        : exceptions.length === 0
          ? <p className="text-xs text-muted-foreground py-4 text-center">Sin excepciones registradas</p>
          : (
            <div className="space-y-2">
              {exceptions.map((ex) => (
                <div key={ex.id} className="flex items-center justify-between p-3 rounded-lg border bg-card text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs bg-muted rounded px-1.5 py-0.5 shrink-0">{fmtDate(ex.date)}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{ex.startTime} — {ex.endTime}</span>
                    {ex.reason && <span className="text-foreground text-xs truncate">{ex.reason}</span>}
                  </div>
                  {canEdit && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 hover:text-destructive shrink-0 ml-2"
                      disabled={deleteMut.isPending}
                      onClick={async () => { try { await deleteMut.mutateAsync(ex.id); } catch { /* */ } }}>
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )
      }
    </div>
  );
}

// ── Price table shared ────────────────────────────────────────────────────────

function PriceTableSkeleton() {
  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="bg-muted/50 px-4 py-2.5 border-b">
        <Skeleton className="h-4 w-48" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={`ps-${i}`} className="flex items-center justify-between px-4 py-3 border-b">
          <Skeleton className="h-4 w-40" />
          <div className="flex gap-6">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Services price table ──────────────────────────────────────────────────────

function ServicesPriceTable({ branchId, canEdit }: { branchId: string; canEdit: boolean }) {
  const { data: allServices = [], isLoading: loadingServices } = useServices({ all: true });
  const { data: prices     = [], isLoading: loadingPrices   } = useBranchServicePrices(branchId);
  const setMut    = useSetBranchServicePrice(branchId);
  const deleteMut = useDeleteBranchServicePrice(branchId);
  const [editing,  setEditing]  = useState<Record<string, string>>({});
  const [filter,   setFilter]   = useState<"all" | "custom">("all");

  const isLoading = loadingServices || loadingPrices;

  const rows = allServices
    .filter((s) => s.isActive)
    .map((s) => {
      const override = prices.find((p) => p.serviceId === s.id);
      return {
        serviceId:   s.id,
        serviceName: s.name,
        category:    (s as any).category?.name ?? null,
        basePrice:   parseFloat(String(s.basePrice)),
        branchPrice: override?.branchPrice ?? null,
      };
    })
    .filter((r) => filter === "all" || r.branchPrice !== null);

  const customCount = allServices.filter((s) => s.isActive)
    .filter((s) => prices.some((p) => p.serviceId === s.id)).length;

  const handleSave = async (serviceId: string) => {
    const price = parseFloat(editing[serviceId]);
    if (isNaN(price) || price < 0) return;
    try {
      await setMut.mutateAsync({ serviceId, price });
      setEditing((prev) => { const n = { ...prev }; delete n[serviceId]; return n; });
    } catch { /* toasted */ }
  };

  const handleReset = async (serviceId: string) => {
    try { await deleteMut.mutateAsync(serviceId); } catch { /* */ }
  };

  if (isLoading) return <PriceTableSkeleton />;

  if (allServices.filter((s) => s.isActive).length === 0) {
    return (
      <div className="rounded-xl border bg-card flex flex-col items-center py-10 gap-2 text-center">
        <DollarSign className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No hay servicios activos en el catálogo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-0.5 bg-muted/60 rounded-lg text-xs">
          {([["all", "Todos"], ["custom", `Personalizados (${customCount})`]] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={cn(
                "px-3 py-1 rounded-md font-medium transition-all",
                filter === val
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {canEdit && (
          <p className="text-xs text-muted-foreground">
            Clic en <Edit2 size={10} className="inline" /> para editar · <Trash2 size={10} className="inline" /> para restablecer al precio base
          </p>
        )}
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Servicio</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground w-28">Precio base</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground w-28">Precio sede</th>
              {canEdit && <th className="px-4 py-2.5 w-20" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 4 : 3} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No hay precios personalizados para esta sede.
                </td>
              </tr>
            ) : rows.map((sp) => {
              const isEditing = sp.serviceId in editing;
              return (
                <tr key={sp.serviceId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground text-sm">{sp.serviceName}</p>
                    {sp.category && (
                      <p className="text-[11px] text-muted-foreground">{sp.category}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-sm tabular-nums">
                    {fmtPrice(sp.basePrice)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {isEditing ? (
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-xs text-muted-foreground">S/</span>
                        <input
                          type="number" step="0.01" min="0"
                          value={editing[sp.serviceId]}
                          onChange={(e) => setEditing((p) => ({ ...p, [sp.serviceId]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")  handleSave(sp.serviceId);
                            if (e.key === "Escape") setEditing((p) => { const n = { ...p }; delete n[sp.serviceId]; return n; });
                          }}
                          autoFocus
                          className="w-20 rounded border border-input bg-background px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-primary/25"
                        />
                      </div>
                    ) : (
                      <span className={cn(
                        "text-sm",
                        sp.branchPrice !== null
                          ? "font-semibold text-primary"
                          : "text-muted-foreground/60",
                      )}>
                        {sp.branchPrice !== null ? fmtPrice(sp.branchPrice) : "—"}
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {isEditing ? (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-primary"
                              disabled={setMut.isPending}
                              onClick={() => handleSave(sp.serviceId)}>
                              {setMut.isPending
                                ? <Loader2 size={12} className="animate-spin" />
                                : <Check size={12} />}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground"
                              onClick={() => setEditing((p) => { const n = { ...p }; delete n[sp.serviceId]; return n; })}>
                              <X size={12} />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 px-2" title="Establecer precio de sede"
                              onClick={() => setEditing((p) => ({ ...p, [sp.serviceId]: String(sp.branchPrice ?? sp.basePrice) }))}>
                              <Edit2 size={12} />
                            </Button>
                            {sp.branchPrice !== null && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 hover:text-destructive"
                                title="Restablecer al precio base"
                                disabled={deleteMut.isPending}
                                onClick={() => handleReset(sp.serviceId)}>
                                <Trash2 size={12} />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Products price table (read-only — catálogo sin override por sede) ──────────

function ProductsPriceTable() {
  const { data: products = [], isLoading } = useProducts({ active: true });

  if (isLoading) return <PriceTableSkeleton />;

  if (products.length === 0) {
    return (
      <div className="rounded-xl border bg-card flex flex-col items-center py-10 gap-2 text-center">
        <DollarSign className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No hay productos activos en el catálogo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 border border-dashed">
        Los productos usan el precio de catálogo (precio de venta). Para precios de sede personalizados, ve al catálogo de productos.
      </p>
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Producto</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground w-20">SKU</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground w-28">Precio costo</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground w-28">Precio venta</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground text-sm">{p.name}</p>
                  {p.description && (
                    <p className="text-[11px] text-muted-foreground truncate max-w-xs">{p.description}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                    {p.sku}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground text-sm tabular-nums">
                  {fmtPrice(parseFloat(p.costPrice))}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span className="font-semibold text-foreground text-sm">
                    {fmtPrice(parseFloat(p.salePrice))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Combined prices panel ─────────────────────────────────────────────────────

function PricesPanel({ branchId, canEdit }: { branchId: string; canEdit: boolean }) {
  type Section = "services" | "products";
  const [section, setSection] = useState<Section>("services");

  return (
    <div className="space-y-4">
      {/* Section switcher */}
      <div className="flex gap-1 p-0.5 bg-muted/60 rounded-lg w-fit">
        {([
          ["services", "Servicios",  DollarSign],
          ["products", "Productos",  DollarSign],
        ] as [Section, string, React.ElementType][]).map(([val, label, Icon]) => (
          <button
            key={val}
            onClick={() => setSection(val)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-all",
              section === val
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {section === "services" && (
        <ServicesPriceTable branchId={branchId} canEdit={canEdit} />
      )}
      {section === "products" && (
        <ProductsPriceTable />
      )}
    </div>
  );
}

// ── Users panel ───────────────────────────────────────────────────────────────

function UsersPanel({ branchId, canEdit }: { branchId: string; canEdit: boolean }) {
  const { data: branchUsers = [], isLoading } = useBranchUsers(branchId);
  const { data: allUsers }                    = useUsers({ limit: 100 });
  const assignMut = useAssignUserToBranch(branchId);
  const removeMut = useRemoveUserFromBranch(branchId);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [showAssign,     setShowAssign]     = useState(false);

  const assignedIds = new Set(branchUsers.map((u) => u.id));
  const available   = (allUsers?.data ?? []).filter((u) => !assignedIds.has(u.id) && u.isActive);

  const handleAssign = async () => {
    if (!selectedUserId) return;
    try {
      await assignMut.mutateAsync(selectedUserId);
      setSelectedUserId("");
      setShowAssign(false);
    } catch { /* toasted */ }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Users size={14} className="text-primary" />Personal asignado
          <span className="ml-1 text-xs font-normal text-muted-foreground">({branchUsers.length})</span>
        </h3>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setShowAssign((v) => !v)}>
            <Plus size={13} className="mr-1.5" />Asignar usuario
          </Button>
        )}
      </div>

      {showAssign && canEdit && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed bg-muted/30">
          <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25">
            <option value="">Selecciona un usuario…</option>
            {available.map((u) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName} — {u.email}</option>
            ))}
          </select>
          <Button size="sm" onClick={handleAssign} disabled={!selectedUserId || assignMut.isPending}>
            {assignMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          </Button>
          <Button size="sm" variant="ghost" className="text-muted-foreground"
            onClick={() => { setShowAssign(false); setSelectedUserId(""); }}>
            <X size={13} />
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`user-skel-${i}`} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      ) : branchUsers.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center gap-2">
          <UserCircle className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Sin personal asignado a esta sede</p>
          {canEdit && (
            <p className="text-xs text-muted-foreground">
              Usa el botón «Asignar usuario» para agregar personal.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {branchUsers.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/20 transition-colors">
              {u.avatarUrl ? (
                <img
                  src={u.avatarUrl}
                  alt={`${u.firstName} ${u.lastName}`}
                  className="h-9 w-9 rounded-full object-cover shrink-0 ring-1 ring-border"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">
                    {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{u.firstName} {u.lastName}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {u.roles.slice(0, 2).map((r, ri) => (
                  <span
                    key={`${u.id}-role-${ri}`}
                    className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5 font-semibold hidden sm:block"
                  >
                    <Shield size={9} className="inline mr-0.5" />
                    {r.code.replace(/_/g, " ")}
                  </span>
                ))}
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 hover:text-destructive"
                    disabled={removeMut.isPending}
                    title="Remover de la sede"
                    onClick={async () => { try { await removeMut.mutateAsync(u.id); } catch { /* */ } }}
                  >
                    <X size={13} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Confirm delete dialog ─────────────────────────────────────────────────────

function ConfirmDeleteDialog({ open, branchName, onClose, onConfirm, loading }: {
  open: boolean; branchName: string; onClose: () => void;
  onConfirm: () => void; loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar sucursal</DialogTitle>
          <DialogDescription>Esta acción es permanente y no se puede deshacer.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro de que deseas eliminar <strong className="text-foreground">{branchName}</strong>?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button variant="destructive" onClick={onConfirm} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Eliminar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export function BranchDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: branch, isLoading, error } = useBranch(id);
  const { data: stats,  isLoading: loadStats } = useBranchStats(id);

  const toggleMut = useToggleBranch();
  const deleteMut = useDeleteBranch();

  const isSuperAdmin = useAuthStore((s) => s.hasRole("SUPER_ADMIN"));

  const [tab,        setTab]        = useState<TabId>("general");
  const [editOpen,   setEditOpen]   = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // ── 403 ──────────────────────────────────────────────────────────────────
  if (error && (error as any).statusCode === 403) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
          <Lock className="h-7 w-7 text-muted-foreground/60" />
        </div>
        <p className="font-semibold text-foreground">Acceso restringido</p>
        <p className="text-sm text-muted-foreground text-center max-w-xs">No tienes acceso a esta sucursal.</p>
        <Button variant="outline" onClick={() => navigate("/settings")}>
          <ArrowLeft size={14} className="mr-1.5" />Volver
        </Button>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-32" />
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-64" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={`stat-skel-${i}`} className="h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Building2 className="h-12 w-12 text-muted-foreground/40" />
        <p className="font-semibold text-foreground">Sucursal no encontrada</p>
        <Button variant="outline" onClick={() => navigate("/settings")}>
          <ArrowLeft size={14} className="mr-1.5" />Volver
        </Button>
      </div>
    );
  }

  const handleToggle = async () => {
    try { await toggleMut.mutateAsync({ id: branch.id, active: !branch.isActive }); }
    catch { /* toasted */ }
  };
  const handleDelete = async () => {
    try { await deleteMut.mutateAsync(branch.id); navigate("/settings"); }
    catch { /* toasted */ }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <button onClick={() => navigate("/settings")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft size={14} />Volver a configuración
      </button>

      {/* ── Header card ── */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <div className="relative shrink-0">
            {branch.photoUrl ? (
              <img src={branch.photoUrl} alt={branch.name}
                className="h-16 w-16 rounded-xl object-cover ring-2 ring-border" />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center ring-2 ring-border">
                <Building2 size={24} className="text-primary/70" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{branch.name}</h1>
              {branch.code && (
                <span className="text-xs font-mono bg-muted text-muted-foreground rounded px-1.5 py-0.5">{branch.code}</span>
              )}
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full text-xs font-semibold px-2.5 py-1",
                branch.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
              )}>
                <span className={cn("h-1.5 w-1.5 rounded-full", branch.isActive ? "bg-green-500" : "bg-gray-400")} />
                {branch.isActive ? "Activa" : "Inactiva"}
              </span>
            </div>
            <div className="mt-2 space-y-0.5">
              {(branch.address || branch.district || branch.city) && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <MapPin size={12} />
                  {[branch.address, branch.district, branch.city].filter(Boolean).join(", ")}
                </p>
              )}
              {branch.phone && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Phone size={12} />{branch.phone}
                </p>
              )}
              {branch.email && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Mail size={12} />{branch.email}
                </p>
              )}
              {branch.googleMapsUrl && (
                <a href={branch.googleMapsUrl} target="_blank" rel="noreferrer"
                  className="text-sm text-primary flex items-center gap-1.5 hover:underline">
                  <Globe size={12} />Ver en Google Maps
                </a>
              )}
            </div>
          </div>

          {isSuperAdmin && (
            <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Edit2 size={13} className="mr-1.5" />Editar
              </Button>
              <Button size="sm" variant="outline"
                className={branch.isActive ? "hover:text-destructive hover:border-destructive" : "hover:text-primary hover:border-primary"}
                onClick={handleToggle} disabled={toggleMut.isPending}>
                {branch.isActive
                  ? <><ToggleLeft size={13} className="mr-1.5" />Desactivar</>
                  : <><ToggleRight size={13} className="mr-1.5" />Activar</>
                }
              </Button>
              <Button size="sm" variant="outline" className="hover:text-destructive hover:border-destructive"
                onClick={() => setDeleteOpen(true)}>
                <Trash2 size={13} className="mr-1.5" />Eliminar
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Citas totales"   value={stats?.totalAppointments ?? "—"}     icon={Calendar}   color="text-primary"    loading={loadStats} />
        <StatCard label="Completadas"     value={stats?.completedAppointments ?? "—"} icon={Check}      color="text-green-600"  loading={loadStats} />
        <StatCard label="Ingresos"        value={fmtRevenue(stats?.totalRevenue)}      icon={DollarSign} color="text-violet-600" loading={loadStats} />
        <StatCard label="Personal activo" value={stats?.activeUsers ?? "—"}            icon={Users}      color="text-blue-600"   loading={loadStats} />
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(({ id: tid, label, icon: Icon }) => (
          <button key={tid} onClick={() => setTab(tid)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              tab === tid ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* ── Tab: General ── */}
      {tab === "general" && (
        <div className="space-y-5">
          {isSuperAdmin && (
            <PhotoSection branchId={branch.id} photoUrl={branch.photoUrl} name={branch.name} />
          )}

          <div className="rounded-xl border bg-card p-5">
            <h2 className="font-semibold text-foreground text-sm mb-4">Información de la sede</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">

              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Nombre</dt>
                <dd className="font-medium text-foreground">{branch.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Estado</dt>
                <dd className={cn("font-medium", branch.isActive ? "text-green-600" : "text-muted-foreground")}>
                  {branch.isActive ? "Activa" : "Inactiva"}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                  <Hash size={9} /> Código interno
                </dt>
                <dd className="font-mono text-xs">{branch.code ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                  <Hash size={9} /> Código de anexo
                </dt>
                <dd className="font-mono text-xs">{branch.attachedCode ?? "—"}</dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                  <Briefcase size={9} /> Empresa (razón social)
                </dt>
                <dd className="text-foreground">{branch.businessUnit?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Capacidad simultánea</dt>
                <dd className="text-foreground">{branch.defaultCapacity} personas</dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                  <MapPin size={9} /> Dirección
                </dt>
                <dd className="text-foreground">{branch.address ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Distrito</dt>
                <dd className="text-foreground">{branch.district ?? "—"}</dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Ciudad</dt>
                <dd className="text-foreground">{branch.city ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Zona horaria</dt>
                <dd className="text-foreground">{branch.timezone}</dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                  <Phone size={9} /> Teléfono
                </dt>
                <dd className="text-foreground">{branch.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                  <Mail size={9} /> Email
                </dt>
                <dd className="text-foreground">{branch.email ?? "—"}</dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Latitud</dt>
                <dd className="font-mono text-xs text-foreground">{fmtCoord(branch.latitude)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Longitud</dt>
                <dd className="font-mono text-xs text-foreground">{fmtCoord(branch.longitude)}</dd>
              </div>

              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                  <Globe size={9} /> Google Maps
                </dt>
                <dd>
                  {branch.googleMapsUrl
                    ? <a href={branch.googleMapsUrl} target="_blank" rel="noreferrer"
                        className="text-primary hover:underline text-xs break-all">{branch.googleMapsUrl}</a>
                    : "—"
                  }
                </dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">ID de sede</dt>
                <dd className="font-mono text-xs bg-muted rounded px-2 py-1 inline-block">{branch.id}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Creada el</dt>
                <dd className="text-foreground">{fmtDate(branch.createdAt.split("T")[0])}</dd>
              </div>

            </dl>
          </div>
        </div>
      )}

      {/* ── Tab: Horarios ── */}
      {tab === "horarios" && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h2 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
              <Clock size={14} className="text-primary" />Horarios de atención
            </h2>
            <HoursPanel branchId={branch.id} />
          </div>
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <BlocksPanel branchId={branch.id} canEdit={isSuperAdmin} />
          </div>
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <ExceptionsPanel branchId={branch.id} canEdit={isSuperAdmin} />
          </div>
        </div>
      )}

      {/* ── Tab: Precios ── */}
      {tab === "precios" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Define precios específicos para esta sede. Si no se establece un precio, se aplica el precio base del servicio.
          </p>
          <PricesPanel branchId={branch.id} canEdit={isSuperAdmin} />
        </div>
      )}

      {/* ── Tab: Usuarios ── */}
      {tab === "usuarios" && (
        <UsersPanel branchId={branch.id} canEdit={isSuperAdmin} />
      )}

      {/* ── Tab: Series ── */}
      {tab === "series" && (
        <SeriesPanel branchId={branch.id} canEdit={isSuperAdmin} />
      )}

      {/* ── Dialogs ── */}
      <EditBranchDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        branchId={branch.id}
        defaultValues={{
          name:            branch.name,
          address:         branch.address       ?? "",
          district:        branch.district      ?? "",
          city:            branch.city          ?? "",
          phone:           branch.phone         ?? "",
          email:           branch.email         ?? "",
          googleMapsUrl:   branch.googleMapsUrl ?? "",
          latitude:        branch.latitude      ?? undefined,
          longitude:       branch.longitude     ?? undefined,
          defaultCapacity: branch.defaultCapacity,
          timezone:        branch.timezone,
          attachedCode:    branch.attachedCode  ?? "",
          ubigeo:          branch.ubigeo        ?? "",
        }}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        branchName={branch.name}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        loading={deleteMut.isPending}
      />
    </div>
  );
}

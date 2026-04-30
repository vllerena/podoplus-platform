import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Building2, Plus, Edit2, Trash2, Loader2, X,
  Globe, Mail, Phone, MapPin, Hash,
  AlertTriangle, ArrowRightLeft, ChevronDown, ChevronUp,
  Camera, Image, FileText, Eye, EyeOff,
} from "lucide-react";
import {
  Button, Input, Label, Skeleton,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@podoplus/ui";
import {
  useBusinessUnits, useBusinessUnit,
  useCreateBusinessUnit, useUpdateBusinessUnit, useDeleteBusinessUnit,
  useUploadBusinessUnitLogo, useDeleteBusinessUnitLogo,
  useUploadBusinessUnitBanner, useDeleteBusinessUnitBanner,
  type BusinessUnit,
} from "@/hooks/use-business-units";
import { useBranches } from "@/hooks/use-branches";
import { api, getErrorMessage } from "@/lib/api";
import { toast } from "@podoplus/ui";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";

// ── Form schema ───────────────────────────────────────────────────────────────

const buSchema = z.object({
  name:          z.string().min(2, "Mínimo 2 caracteres").max(150),
  ruc:           z.string().length(11, "RUC debe tener 11 dígitos").optional().or(z.literal("")),
  address:       z.string().max(300).optional().or(z.literal("")),
  phone:         z.string().max(20).optional().or(z.literal("")),
  email:         z.string().email("Email inválido").optional().or(z.literal("")),
  website:       z.string().url("URL inválida").optional().or(z.literal("")),
  isActive:      z.boolean(),
  sunatEndpoint: z.string().url("URL inválida").max(500).optional().or(z.literal("")),
  sunatToken:    z.string().max(500).optional().or(z.literal("")),
});
type BuFormData = z.infer<typeof buSchema>;

// ── Image upload widget ───────────────────────────────────────────────────────

function BuImageUpload({
  unitId,
  type,
  hasImage,
  label,
}: {
  unitId:   string;
  type:     "logo" | "banner";
  hasImage: boolean;
  label:    string;
}) {
  const fileRef   = useRef<HTMLInputElement>(null);
  const uploadMut = type === "logo"
    ? useUploadBusinessUnitLogo(unitId)
    : useUploadBusinessUnitBanner(unitId);
  const deleteMut = type === "logo"
    ? useDeleteBusinessUnitLogo(unitId)
    : useDeleteBusinessUnitBanner(unitId);

  const busy  = uploadMut.isPending || deleteMut.isPending;
  const imgSrc = hasImage ? `/v1/business-units/${unitId}/${type}` : null;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try { await uploadMut.mutateAsync(file); } catch { /* toasted */ }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1">
        <Image size={11} className="text-muted-foreground" /> {label}
      </Label>

      <div className="flex items-center gap-3">
        {/* Preview */}
        <div className={cn(
          "relative h-16 rounded-lg border overflow-hidden flex items-center justify-center bg-muted/30 shrink-0",
          type === "logo" ? "w-16" : "w-28",
        )}>
          {imgSrc ? (
            <img src={imgSrc} alt={label} className="h-full w-full object-contain" />
          ) : (
            <Image size={18} className="text-muted-foreground/40" />
          )}
          {busy && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <Loader2 size={14} className="text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs px-2.5"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Camera size={11} className="mr-1" />
            {hasImage ? "Cambiar" : "Subir"}
          </Button>
          {hasImage && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2.5 hover:text-destructive hover:border-destructive"
              disabled={busy}
              onClick={() => deleteMut.mutate()}
            >
              <Trash2 size={11} className="mr-1" />
              Eliminar
            </Button>
          )}
          <p className="text-[10px] text-muted-foreground">JPEG, PNG o WEBP · máx. 5 MB</p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

// ── BusinessUnit dialog ───────────────────────────────────────────────────────

function BusinessUnitDialog({
  open, onClose, unit,
}: { open: boolean; onClose: () => void; unit: BusinessUnit | null }) {
  const createMut = useCreateBusinessUnit();
  const updateMut = useUpdateBusinessUnit(unit?.id ?? "");
  const isEdit    = !!unit;
  const [showToken, setShowToken] = useState(false);

  // Fetcha el detalle completo para obtener sunatEndpoint + sunatToken
  // (el listado /v1/business-units no los expone por seguridad)
  const { data: unitDetail } = useBusinessUnit(open && isEdit ? unit?.id : undefined);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting, isDirty } } =
    useForm<BuFormData>({
      resolver: zodResolver(buSchema),
      defaultValues: {
        name:          unit?.name    ?? "",
        ruc:           unit?.ruc     ?? "",
        address:       unit?.address ?? "",
        phone:         unit?.phone   ?? "",
        email:         unit?.email   ?? "",
        website:       unit?.website ?? "",
        isActive:      unit?.isActive ?? true,
        sunatEndpoint: "",
        sunatToken:    "",
      },
    });

  const isActive = watch("isActive");

  // Reset cuando cambia el dialog (abrir/cerrar/cambiar empresa)
  useEffect(() => {
    if (open) {
      setShowToken(false);
      reset({
        name:          unit?.name    ?? "",
        ruc:           unit?.ruc     ?? "",
        address:       unit?.address ?? "",
        phone:         unit?.phone   ?? "",
        email:         unit?.email   ?? "",
        website:       unit?.website ?? "",
        isActive:      unit?.isActive ?? true,
        sunatEndpoint: "",
        sunatToken:    "",
      });
    }
  }, [open, unit, reset]);

  // Cuando llegan las credenciales SUNAT del detalle, rellenar esos campos
  useEffect(() => {
    if (open && isEdit && unitDetail) {
      reset((prev) => ({
        ...prev,
        sunatEndpoint: unitDetail.sunatEndpoint ?? "",
        sunatToken:    unitDetail.sunatToken    ?? "",
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitDetail]);

  const onSubmit = async (vals: BuFormData) => {
    try {
      const payload = {
        name:          vals.name,
        ruc:           vals.ruc           || undefined,
        address:       vals.address       || undefined,
        phone:         vals.phone         || undefined,
        email:         vals.email         || undefined,
        website:       vals.website       || undefined,
        isActive:      vals.isActive,
        sunatEndpoint: vals.sunatEndpoint || undefined,
        sunatToken:    vals.sunatToken    || undefined,
      };
      if (unit) {
        await updateMut.mutateAsync(payload);
      } else {
        await createMut.mutateAsync(payload);
      }
      onClose();
    } catch { /* toasted in hook */ }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{unit ? "Editar empresa" : "Nueva empresa"}</DialogTitle>
          <DialogDescription>
            {unit
              ? `Modifica los datos de «${unit.name}».`
              : "Registra una nueva razón social para organizar las sedes."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-1">

          {/* Datos principales */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Datos principales
            </p>
            <div className="space-y-1.5">
              <Label>Razón social <span className="text-destructive">*</span></Label>
              <Input {...register("name")} placeholder="PODOPLUS S.A.C." />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Hash size={11} className="text-muted-foreground" /> RUC
                </Label>
                <Input {...register("ruc")} placeholder="20605267395" maxLength={11} />
                {errors.ruc && <p className="text-xs text-destructive">{errors.ruc.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Phone size={11} className="text-muted-foreground" /> Teléfono
                </Label>
                <Input {...register("phone")} placeholder="+51 1 234 5678" type="tel" />
              </div>
            </div>
          </div>

          {/* Contacto y ubicación */}
          <div className="space-y-3 border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Contacto y ubicación
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Mail size={11} className="text-muted-foreground" /> Email
                </Label>
                <Input type="email" {...register("email")} placeholder="empresa@ejemplo.com" />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Globe size={11} className="text-muted-foreground" /> Sitio web
                </Label>
                <Input {...register("website")} placeholder="https://podoplus.com" />
                {errors.website && <p className="text-xs text-destructive">{errors.website.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <MapPin size={11} className="text-muted-foreground" /> Dirección fiscal
              </Label>
              <Input {...register("address")} placeholder="Av. Ejemplo 123, Lima" />
            </div>
          </div>

          {/* Recursos visuales */}
          <div className="space-y-3 border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Recursos visuales
            </p>
            {isEdit && unit ? (
              <div className="grid grid-cols-2 gap-4">
                <BuImageUpload
                  unitId={unit.id}
                  type="logo"
                  hasImage={unit.hasLogo}
                  label="Logo"
                />
                <BuImageUpload
                  unitId={unit.id}
                  type="banner"
                  hasImage={unit.hasBanner}
                  label="Banner"
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2.5 border border-dashed">
                Podrás subir el logo y banner después de crear la empresa.
              </p>
            )}
          </div>

          {/* SUNAT — Facturación electrónica */}
          <div className="space-y-3 border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FileText size={11} /> SUNAT — Facturación electrónica
            </p>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Globe size={11} className="text-muted-foreground" /> Endpoint (URL del PSE/OSE)
              </Label>
              <Input
                {...register("sunatEndpoint")}
                autoComplete="url"
                placeholder="https://empresa.sfeperu.com/api/documents"
              />
              {errors.sunatEndpoint && (
                <p className="text-xs text-destructive">{errors.sunatEndpoint.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Hash size={11} className="text-muted-foreground" /> Token de autorización (Bearer)
              </Label>
              <div className="relative">
                <Input
                  {...register("sunatToken")}
                  type={showToken ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Bearer token del PSE/OSE"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              Estas credenciales se usan para emitir boletas y facturas electrónicas desde el módulo de Ventas POS.
            </p>
          </div>

          {/* Estado */}
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Estado
            </p>
            <button
              type="button"
              onClick={() => setValue("isActive", !isActive, { shouldDirty: true })}
              className={cn(
                "flex items-center gap-3 w-full rounded-lg border px-4 py-3 text-left transition-colors",
                isActive
                  ? "border-green-200 bg-green-50 hover:bg-green-100/80"
                  : "border-border bg-muted/30 hover:bg-muted/50",
              )}
            >
              <span className={cn(
                "h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                isActive ? "border-green-500 bg-green-500" : "border-muted-foreground/40 bg-background",
              )}>
                {isActive && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <div className="flex-1">
                <p className={cn("text-sm font-medium", isActive ? "text-green-700" : "text-foreground")}>
                  {isActive ? "Empresa activa" : "Empresa inactiva"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isActive
                    ? "Visible y operativa en el sistema"
                    : "No aparecerá en filtros ni selecciones"}
                </p>
              </div>
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting || (isEdit && !isDirty)}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {unit ? "Guardar cambios" : "Crear empresa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Hook estable para asignar/mover/desasignar sede ───────────────────────────
// Evita el anti-patrón useUpdateBranch(changing-state).

function useAssignBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      branchId,
      businessUnitId,
    }: {
      branchId:       string;
      businessUnitId: string | null;
    }) => {
      const { error } = await api.PATCH("/v1/branches/{id}" as any, {
        params: { path: { id: branchId } } as any,
        body:   { businessUnitId } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error as any));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      qc.invalidateQueries({ queryKey: ["business-units"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error al reasignar sede", description: err.message, variant: "destructive" });
    },
  });
}

// ── BranchRow — con mover y quitar ───────────────────────────────────────────

function BranchRow({
  branch, unitId, isSuperAdmin,
}: { branch: any; unitId: string; isSuperAdmin: boolean }) {
  const [moving,   setMoving]   = useState(false);
  const [targetBU, setTargetBU] = useState("");
  const { data: allUnits = [] } = useBusinessUnits();
  const assignMut = useAssignBranch();

  const otherUnits = allUnits.filter((u) => u.id !== unitId && u.isActive);

  const handleUnassign = async () => {
    await assignMut.mutateAsync({ branchId: branch.id, businessUnitId: null });
  };

  const handleMove = async () => {
    // targetBU="" significa desasignar; cualquier otro ID = mover
    await assignMut.mutateAsync({
      branchId:       branch.id,
      businessUnitId: targetBU || null,
    });
    setMoving(false);
    setTargetBU("");
  };

  if (moving) {
    return (
      <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-amber-50 border border-amber-200">
        <ArrowRightLeft size={12} className="text-amber-600 shrink-0" />
        <select
          value={targetBU}
          onChange={(e) => setTargetBU(e.target.value)}
          className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/25"
          autoFocus
        >
          <option value="">Sin empresa (desasignar)</option>
          {otherUnits.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <Button
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={handleMove}
          disabled={assignMut.isPending}
        >
          {assignMut.isPending ? <Loader2 size={11} className="animate-spin" /> : "Mover"}
        </Button>
        <button
          onClick={() => { setMoving(false); setTargetBU(""); }}
          className="text-muted-foreground hover:text-foreground"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          branch.isActive ? "bg-green-500" : "bg-muted-foreground/40",
        )} />
        <span className="text-xs font-medium truncate">{branch.name}</span>
        {branch.attachedCode && (
          <span className="text-[10px] text-muted-foreground/60 shrink-0">
            Anexo {branch.attachedCode}
          </span>
        )}
      </div>
      {isSuperAdmin && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => setMoving(true)}
            disabled={assignMut.isPending}
            className="text-muted-foreground/50 hover:text-amber-600 transition-colors"
            title="Mover a otra empresa"
          >
            <ArrowRightLeft size={11} />
          </button>
          <button
            onClick={handleUnassign}
            disabled={assignMut.isPending}
            className="text-muted-foreground/50 hover:text-destructive transition-colors"
            title="Quitar de esta empresa"
          >
            {assignMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
          </button>
        </div>
      )}
    </div>
  );
}

// ── AssignBranchRow — asignar huérfana o mover ────────────────────────────────

function AssignBranchRow({ unitId }: { unitId: string }) {
  const [selected, setSelected] = useState("");
  const { data: allBranches = [] } = useBranches();
  const assignMut = useAssignBranch();

  const candidates = allBranches.filter((b) => b.businessUnitId !== unitId);
  if (candidates.length === 0) return null;

  const orphans   = candidates.filter((b) => !b.businessUnitId);
  const fromOther = candidates.filter((b) =>  b.businessUnitId);

  const handleAssign = async () => {
    if (!selected) return;
    try {
      await assignMut.mutateAsync({ branchId: selected, businessUnitId: unitId });
      setSelected("");
    } catch { /* toasted */ }
  };

  return (
    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-dashed border-border/60">
      <Plus size={12} className="text-muted-foreground shrink-0" />
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/25"
      >
        <option value="">Agregar sede a esta empresa…</option>
        {orphans.length > 0 && (
          <optgroup label="Sin empresa (huérfanas)">
            {orphans.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </optgroup>
        )}
        {fromOther.length > 0 && (
          <optgroup label="Mover de otra empresa">
            {fromOther.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} (de: {b.businessUnit?.name ?? "?"})
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <Button
        size="sm"
        className="h-7 px-2.5 text-xs"
        onClick={handleAssign}
        disabled={!selected || assignMut.isPending}
      >
        {assignMut.isPending ? <Loader2 size={11} className="animate-spin" /> : "Asignar"}
      </Button>
    </div>
  );
}

// ── BusinessUnitCard ──────────────────────────────────────────────────────────

function BusinessUnitCard({
  unit, onEdit, isSuperAdmin,
}: { unit: BusinessUnit; onEdit: (u: BusinessUnit) => void; isSuperAdmin: boolean }) {
  const deleteMut = useDeleteBusinessUnit();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { data: allBranches = [] } = useBranches();
  const myBranches = allBranches.filter((b) => b.businessUnitId === unit.id);

  const handleDelete = async () => {
    try { await deleteMut.mutateAsync(unit.id); } catch { /* toasted */ }
  };

  return (
    <div className={cn(
      "rounded-2xl border bg-card overflow-hidden transition-all",
      !unit.isActive && "opacity-60",
    )}>
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        {/* Logo */}
        {unit.hasLogo ? (
          <img
            src={`/v1/business-units/${unit.id}/logo`}
            alt={unit.name}
            className="h-11 w-11 rounded-xl object-contain border bg-white shrink-0"
          />
        ) : (
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 size={20} className="text-primary" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm text-foreground leading-tight">{unit.name}</h3>
            <span className={cn(
              "text-[10px] rounded-full px-2 py-0.5 font-semibold",
              unit.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground",
            )}>
              {unit.isActive ? "Activa" : "Inactiva"}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
            {unit.ruc && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Hash size={9} />RUC {unit.ruc}
              </span>
            )}
            {unit.phone && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone size={9} />{unit.phone}
              </span>
            )}
            {unit.email && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail size={9} />{unit.email}
              </span>
            )}
            {unit.website && (
              <a
                href={unit.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary flex items-center gap-1 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <Globe size={9} />{unit.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {unit.address && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin size={9} />{unit.address}
              </span>
            )}
          </div>
        </div>

        {isSuperAdmin && (
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onEdit(unit)} title="Editar">
              <Edit2 size={13} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              title="Eliminar"
            >
              <Trash2 size={13} />
            </Button>
          </div>
        )}
      </div>

      {/* Banner preview */}
      {unit.hasBanner && (
        <div className="px-4 pb-2">
          <img
            src={`/v1/business-units/${unit.id}/banner`}
            alt="Banner"
            className="w-full h-20 object-cover rounded-lg border"
          />
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="px-4 pb-3 flex items-center gap-2 border-t bg-destructive/5">
          <AlertTriangle size={13} className="text-destructive shrink-0" />
          <p className="text-xs text-destructive flex-1">
            ¿Eliminar «{unit.name}»? Reasigna sus sedes primero.
          </p>
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

      {/* Sedes toggle */}
      <div className="border-t border-border">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Building2 size={11} />
            {myBranches.length} sede{myBranches.length !== 1 ? "s" : ""} asignada{myBranches.length !== 1 ? "s" : ""}
          </span>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-1.5">
            {myBranches.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-lg">
                Sin sedes asignadas
              </p>
            ) : (
              myBranches.map((b) => (
                <BranchRow
                  key={b.id}
                  branch={b}
                  unitId={unit.id}
                  isSuperAdmin={isSuperAdmin}
                />
              ))
            )}
            {isSuperAdmin && <AssignBranchRow unitId={unit.id} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ── OrphanBranchesSection ─────────────────────────────────────────────────────

function OrphanBranchRow({
  branch, units, isSuperAdmin,
}: { branch: any; units: BusinessUnit[]; isSuperAdmin: boolean }) {
  const [selected, setSelected] = useState("");
  const assignMut = useAssignBranch();

  const handleAssign = async () => {
    if (!selected) return;
    try {
      await assignMut.mutateAsync({ branchId: branch.id, businessUnitId: selected });
      setSelected("");
    } catch { /* toasted */ }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border bg-card">
      <div className={cn(
        "h-2 w-2 rounded-full shrink-0",
        branch.isActive ? "bg-green-500" : "bg-muted-foreground/40",
      )} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{branch.name}</p>
        {branch.address && (
          <p className="text-xs text-muted-foreground truncate">{branch.address}</p>
        )}
      </div>
      {isSuperAdmin && (
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/25 max-w-[160px]"
          >
            <option value="">Asignar empresa…</option>
            {units.filter((u) => u.isActive).map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <Button
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={handleAssign}
            disabled={!selected || assignMut.isPending}
          >
            {assignMut.isPending ? <Loader2 size={11} className="animate-spin" /> : "Asignar"}
          </Button>
        </div>
      )}
    </div>
  );
}

function OrphanBranchesSection({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { data: allBranches = [] } = useBranches();
  const { data: allUnits   = [] } = useBusinessUnits();

  const orphans = allBranches.filter((b) => !b.businessUnitId);
  if (orphans.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/40 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-amber-50/80 transition-colors"
      >
        <AlertTriangle size={14} className="text-amber-600 shrink-0" />
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-amber-800">Sedes sin empresa asignada</p>
          <p className="text-xs text-amber-600 mt-0.5">
            {orphans.length} sede{orphans.length !== 1 ? "s" : ""} huérfana{orphans.length !== 1 ? "s" : ""} — no están vinculadas a ninguna razón social
          </p>
        </div>
        <span className="shrink-0 h-5 min-w-5 rounded-full bg-amber-200 text-amber-800 text-[11px] font-bold flex items-center justify-center px-1.5">
          {orphans.length}
        </span>
        {expanded ? <ChevronUp size={13} className="text-amber-600 shrink-0" /> : <ChevronDown size={13} className="text-amber-600 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-amber-200/60">
          <p className="text-xs text-amber-700 pt-3 pb-1">
            {isSuperAdmin
              ? "Asigna cada sede a una empresa usando el selector."
              : "Contacta a un administrador para asignar estas sedes."}
          </p>
          {orphans.map((b) => (
            <OrphanBranchRow
              key={b.id}
              branch={b}
              units={allUnits}
              isSuperAdmin={isSuperAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── BusinessUnitsPanel ────────────────────────────────────────────────────────

export function BusinessUnitsPanel() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUnit,   setEditUnit]   = useState<BusinessUnit | null>(null);
  const isSuperAdmin = useAuthStore((s) => s.hasRole("SUPER_ADMIN"));

  const { data: units = [], isLoading } = useBusinessUnits();

  const openCreate = () => { setEditUnit(null); setDialogOpen(true); };
  const openEdit   = (u: BusinessUnit) => { setEditUnit(u); setDialogOpen(true); };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Gestiona las razones sociales (empresas) de Podoplus y organiza las sedes en cada una.
        </p>
        {isSuperAdmin && (
          <Button size="sm" onClick={openCreate} className="shrink-0">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Nueva empresa
          </Button>
        )}
      </div>

      {units.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border bg-card gap-3">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Sin empresas registradas</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Crea la primera empresa para organizar las sedes.
            </p>
          </div>
          {isSuperAdmin && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Nueva empresa
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {units.map((u) => (
              <BusinessUnitCard key={u.id} unit={u} onEdit={openEdit} isSuperAdmin={isSuperAdmin} />
            ))}
          </div>
          <OrphanBranchesSection isSuperAdmin={isSuperAdmin} />
        </>
      )}

      <BusinessUnitDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        unit={editUnit}
      />
    </div>
  );
}

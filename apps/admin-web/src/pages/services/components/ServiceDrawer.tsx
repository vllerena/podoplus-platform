import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
  Button, Input, Label, Separator,
  toast,
} from "@podoplus/ui";
import {
  Loader2, Upload, Trash2, Scissors, Info,
  Clock, Zap, Package,
} from "lucide-react";
import {
  useCreateService, useUpdateService, useServiceCategories,
  useUploadServiceImage, useDeleteServiceImage,
  type Service, type CreateServiceDto,
} from "@/hooks/use-services";
import { cn } from "@/lib/utils";

// ── Constantes SUNAT ──────────────────────────────────────────────────────────

const UNIT_TYPE_OPTIONS = [
  { value: "ZZ",  label: "ZZ – Servicios (genérico)" },
  { value: "NIU", label: "NIU – Unidad (bienes)" },
  { value: "HUR", label: "HUR – Hora" },
  { value: "MES", label: "MES – Mes" },
] as const;

const IGV_AFFECTATION_OPTIONS = [
  { value: "10", label: "10 – Gravado (18%)" },
  { value: "20", label: "20 – Exonerado" },
  { value: "30", label: "30 – Inafecto" },
  { value: "40", label: "40 – Exportación" },
] as const;

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name:               z.string().min(2, "Mínimo 2 caracteres").max(150),
  description:        z.string().max(2000).optional().or(z.literal("")),
  durationMinutes:    z.coerce.number().int().min(0, "No puede ser negativo").max(480),
  bufferMinutes:      z.coerce.number().int().min(0).max(120).default(0),
  basePrice:          z.coerce.number().min(0),
  allowSelfService:   z.boolean().default(false),
  color:              z.string().optional().or(z.literal("")),
  categoryId:         z.string().optional().or(z.literal("")),
  internalCode:       z.string().max(50).optional().or(z.literal("")),
  // SUNAT
  sunatProductCode:   z.string().max(20).optional().or(z.literal("")),
  unitTypeCode:       z.enum(["ZZ", "NIU", "HUR", "MES"]).default("ZZ"),
  igvAffectationCode: z.enum(["10", "20", "30", "40"]).default("10"),
  hasIgv:             z.boolean().default(true),
});

type FormData = z.infer<typeof schema>;

// ── Image section ─────────────────────────────────────────────────────────────

interface ImageSectionProps {
  serviceId:       string;
  initialHasImage: boolean;
  name:            string;
}

function ServiceImageSection({ serviceId, initialHasImage, name }: ImageSectionProps) {
  const [hasImage,    setHasImage]    = useState(initialHasImage);
  const [cacheBuster, setCacheBuster] = useState(0);

  const uploadMut = useUploadServiceImage(serviceId);
  const deleteMut = useDeleteServiceImage(serviceId);

  const imageUrl = hasImage
    ? `/v1/services/${serviceId}/image${cacheBuster ? `?cb=${cacheBuster}` : ""}`
    : null;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!ALLOWED.includes(file.type)) {
      toast({ title: "Tipo no permitido", description: "Usa JPG, PNG, WEBP o GIF.", variant: "destructive" });
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Archivo muy grande", description: "El tamaño máximo es 5 MB.", variant: "destructive" });
      e.target.value = "";
      return;
    }
    try {
      await uploadMut.mutateAsync(file);
      setHasImage(true);
      setCacheBuster(Date.now());
    } catch { /* toasted */ }
    e.target.value = "";
  };

  const handleDelete = async () => {
    try {
      await deleteMut.mutateAsync();
      setHasImage(false);
      setCacheBuster(0);
    } catch { /* toasted */ }
  };

  return (
    <div className="flex items-center gap-4">
      {/* Preview */}
      <div className="h-16 w-16 rounded-xl border bg-muted flex items-center justify-center overflow-hidden shrink-0">
        {imageUrl
          ? <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
          : <Scissors size={20} className="text-muted-foreground" />
        }
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFile}
            disabled={uploadMut.isPending}
          />
          <Button type="button" size="sm" variant="outline" className="pointer-events-none h-8 text-xs" disabled={uploadMut.isPending} asChild>
            <span>
              {uploadMut.isPending
                ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                : <Upload className="h-3 w-3 mr-1.5" />
              }
              {hasImage ? "Cambiar imagen" : "Subir imagen"}
            </span>
          </Button>
        </label>
        {hasImage && (
          <Button type="button" size="sm" variant="ghost"
            className="h-8 text-xs text-destructive hover:bg-destructive/10"
            onClick={handleDelete} disabled={deleteMut.isPending}
          >
            {deleteMut.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Trash2 className="h-3 w-3 mr-1.5" />}
            Eliminar
          </Button>
        )}
        <p className="text-[10px] text-muted-foreground">JPG, PNG, WEBP · Máx. 5 MB</p>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open:    boolean;
  onClose: () => void;
  service: Service | null;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function ServiceDrawer({ open, onClose, service }: Props) {
  const { data: categories = [] } = useServiceCategories();
  const createMut = useCreateService();
  const updateMut = useUpdateService(service?.id ?? "");

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "", description: "", durationMinutes: 30, bufferMinutes: 0,
      basePrice: 0, allowSelfService: false, color: "#45AEBA",
      categoryId: "", internalCode: "", sunatProductCode: "",
      unitTypeCode: "ZZ", igvAffectationCode: "10", hasIgv: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    reset(service
      ? {
          name:               service.name,
          description:        service.description ?? "",
          durationMinutes:    Number(service.durationMinutes),
          bufferMinutes:      Number(service.bufferMinutes),
          basePrice:          parseFloat(String(service.basePrice)),
          allowSelfService:   service.allowSelfService,
          color:              service.color ?? "#45AEBA",
          categoryId:         service.categoryId ?? "",
          internalCode:       service.internalCode ?? "",
          sunatProductCode:   service.sunatProductCode ?? "",
          unitTypeCode:       (service.unitTypeCode as any) ?? "ZZ",
          igvAffectationCode: (service.igvAffectationCode as any) ?? "10",
          hasIgv:             service.hasIgv ?? true,
        }
      : {
          name: "", description: "", durationMinutes: 30, bufferMinutes: 0,
          basePrice: 0, allowSelfService: false, color: "#45AEBA",
          categoryId: "", internalCode: "", sunatProductCode: "",
          unitTypeCode: "ZZ", igvAffectationCode: "10", hasIgv: true,
        }
    );
  }, [open, service, reset]);

  const onSubmit = async (vals: FormData) => {
    const body: CreateServiceDto = {
      name:               vals.name,
      durationMinutes:    vals.durationMinutes,
      basePrice:          vals.basePrice,
      bufferMinutes:      vals.bufferMinutes ?? 0,
      allowSelfService:   vals.allowSelfService,
      description:        vals.description     || undefined,
      color:              vals.color           || undefined,
      categoryId:         vals.categoryId      || undefined,
      internalCode:       vals.internalCode    || undefined,
      sunatProductCode:   vals.sunatProductCode    || undefined,
      unitTypeCode:       vals.unitTypeCode        || undefined,
      igvAffectationCode: vals.igvAffectationCode  || undefined,
      hasIgv:             vals.hasIgv,
    };
    try {
      if (service) await updateMut.mutateAsync(body);
      else         await createMut.mutateAsync(body);
      onClose();
    } catch { /* toasted */ }
  };

  const allowSelf    = watch("allowSelfService");
  const hasIgv       = watch("hasIgv");
  const color        = watch("color");
  const duration     = watch("durationMinutes");
  const isInstant    = Number(duration) === 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {isInstant
              ? <Package className="h-5 w-5 text-muted-foreground" />
              : <Scissors className="h-5 w-5 text-muted-foreground" />
            }
            {service ? "Editar servicio" : "Nuevo servicio"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {service ? `Editar datos de ${service.name}` : "Registrar un nuevo servicio en el catálogo"}
          </DialogDescription>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <form id="service-form" onSubmit={handleSubmit(onSubmit)}>
            <div className="px-6 py-5 space-y-5">

              {/* ── Imagen (solo edición) ── */}
              {service && (
                <>
                  <ServiceImageSection
                    serviceId={service.id}
                    initialHasImage={service.hasImage}
                    name={service.name}
                  />
                  <Separator />
                </>
              )}

              {/* ── Fila 1: Nombre + Código interno ── */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="svc-name">
                    Nombre <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="svc-name"
                    {...register("name")}
                    placeholder="Ej. Podología General"
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
              </div>

              {/* ── Descripción ── */}
              <div className="space-y-1.5">
                <Label htmlFor="svc-description">
                  Descripción{" "}
                  <span className="text-[11px] text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <textarea
                  id="svc-description"
                  {...register("description")}
                  rows={2}
                  placeholder="Descripción del servicio..."
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 resize-none"
                />
              </div>

              <Separator />

              {/* ── Tipo de servicio: duración + buffer + precio ── */}
              <section className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Tiempo y precio
                </p>

                {/* Badge tipo de servicio */}
                {isInstant ? (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                    <Zap className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      <strong>Sin cita</strong> — duración 0 min. Este servicio no requiere reserva de horario
                      (ej: gift cards, accesorios, separación de cita).
                    </span>
                  </div>
                ) : duration > 0 ? (
                  <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span><strong>Con cita</strong> — requiere reserva de horario en el calendario.</span>
                  </div>
                ) : null}

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="svc-duration">
                      Duración (min) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="svc-duration"
                      type="number"
                      min={0}
                      max={480}
                      {...register("durationMinutes")}
                      placeholder="30"
                    />
                    {errors.durationMinutes && (
                      <p className="text-xs text-destructive">{errors.durationMinutes.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="svc-buffer">
                      Buffer (min)
                    </Label>
                    <Input
                      id="svc-buffer"
                      type="number"
                      min={0}
                      max={120}
                      {...register("bufferMinutes")}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="svc-basePrice">
                      Precio base (S/) <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">S/</span>
                      <Input
                        id="svc-basePrice"
                        type="number"
                        min={0}
                        step="0.01"
                        className="pl-8"
                        {...register("basePrice")}
                        placeholder="0.00"
                      />
                    </div>
                    {errors.basePrice && (
                      <p className="text-xs text-destructive">{errors.basePrice.message}</p>
                    )}
                  </div>
                </div>
              </section>

              <Separator />

              {/* ── Categoría + Color + Código interno ── */}
              <section className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Identificación
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {/* Categoría */}
                  <div className="space-y-1.5">
                    <Label htmlFor="svc-category">Categoría</Label>
                    <select
                      id="svc-category"
                      {...register("categoryId")}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
                    >
                      <option value="">Sin categoría</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Código interno */}
                  <div className="space-y-1.5">
                    <Label htmlFor="svc-internalCode">Código interno</Label>
                    <Input
                      id="svc-internalCode"
                      {...register("internalCode")}
                      placeholder="Ej. SRV-001"
                    />
                  </div>
                </div>

                {/* Color */}
                <div className="space-y-1.5">
                  <Label>Color en el calendario</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={color || "#45AEBA"}
                      onChange={(e) => setValue("color", e.target.value)}
                      className="h-9 w-14 rounded-lg border border-input cursor-pointer shrink-0"
                    />
                    <Input
                      {...register("color")}
                      placeholder="#45AEBA"
                      className="font-mono text-sm flex-1"
                    />
                  </div>
                </div>
              </section>

              <Separator />

              {/* ── Opciones ── */}
              <section className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Opciones
                </p>

                {/* Self-service — solo si tiene duración */}
                {!isInstant && (
                  <label className={cn(
                    "flex items-center gap-3 cursor-pointer select-none rounded-lg border border-border p-3",
                    "hover:bg-muted/50 transition-colors"
                  )}>
                    <input
                      type="checkbox"
                      checked={allowSelf}
                      onChange={(e) => setValue("allowSelfService", e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">Permitir reserva online</p>
                      <p className="text-xs text-muted-foreground">
                        Los pacientes pueden agendar este servicio desde el portal
                      </p>
                    </div>
                  </label>
                )}
              </section>

              <Separator />

              {/* ── SUNAT / Facturación electrónica ── */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Facturación electrónica (SUNAT)
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="svc-sunatProductCode">Código de producto SUNAT</Label>
                  <Input
                    id="svc-sunatProductCode"
                    {...register("sunatProductCode")}
                    placeholder="Ej. 85111500"
                    maxLength={20}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="svc-unitTypeCode">Unidad de medida</Label>
                    <select
                      id="svc-unitTypeCode"
                      {...register("unitTypeCode")}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
                    >
                      {UNIT_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="svc-igvAffectationCode">Afectación IGV</Label>
                    <select
                      id="svc-igvAffectationCode"
                      {...register("igvAffectationCode")}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
                    >
                      {IGV_AFFECTATION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasIgv}
                    onChange={(e) => setValue("hasIgv", e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-foreground">Precio incluye IGV (18%)</span>
                </label>
              </section>

            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            type="submit"
            form="service-form"
            disabled={isSubmitting}
            className="min-w-[130px]"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {service ? "Guardar cambios" : "Crear servicio"}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}

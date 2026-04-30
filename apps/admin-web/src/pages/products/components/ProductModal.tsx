import { useState, useEffect, useRef } from "react";
import {
  Camera, ImageOff, Info, X, Package,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Textarea, Separator,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@podoplus/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateProduct,
  useUpdateProduct,
  useUploadProductImage,
  useDeleteProductImage,
  getProductImageUrl,
  productKeys,
  type Product,
  type CreateProductInput,
  type UnitType,
} from "@/hooks/use-products";

// ── Constants ─────────────────────────────────────────────────────────────────

const UNIT_TYPE_OPTIONS: { value: UnitType; label: string }[] = [
  { value: "unit",   label: "Unidad" },
  { value: "box",    label: "Caja" },
  { value: "bottle", label: "Botella" },
  { value: "pair",   label: "Par" },
  { value: "bag",    label: "Bolsa" },
  { value: "other",  label: "Otro" },
];

const UNIT_TYPE_CODE_OPTIONS = [
  { value: "NIU", label: "NIU — Unidad" },
  { value: "ZZ",  label: "ZZ — Servicio" },
  { value: "KGM", label: "KGM — Kilogramo" },
  { value: "LTR", label: "LTR — Litro" },
  { value: "BLL", label: "BLL — Barril/Botella" },
  { value: "GRM", label: "GRM — Gramo" },
  { value: "MLT", label: "MLT — Mililitro" },
];

const IGV_OPTIONS = [
  { value: "10", label: "10 — Gravado IGV (18%)" },
  { value: "20", label: "20 — Exonerado" },
  { value: "30", label: "30 — Inafecto" },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open:    boolean;
  onClose: () => void;
  product: Product | null; // null = create mode
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProductModal({ open, onClose, product }: Props) {
  const isEdit = !!product;

  // Basic info
  const [sku,          setSku]          = useState("");
  const [name,         setName]         = useState("");
  const [description,  setDescription]  = useState("");
  const [unitType,     setUnitType]     = useState<UnitType>("unit");
  const [internalCode, setInternalCode] = useState("");

  // Prices
  const [costPrice, setCostPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");

  // SUNAT
  const [sunatCode,    setSunatCode]    = useState("");
  const [unitTypeCode, setUnitTypeCode] = useState("NIU");
  const [igvCode,      setIgvCode]      = useState("10");
  const [hasIgv,       setHasIgv]       = useState(true);

  // Image state
  const [imageFile,    setImageFile]    = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage,  setRemoveImage]  = useState(false);
  const [isUploading,  setIsUploading]  = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const qc             = useQueryClient();
  const createMut      = useCreateProduct();
  const updateMut      = useUpdateProduct(product?.id ?? "");
  const uploadImageMut = useUploadProductImage(product?.id ?? "new");
  const deleteImageMut = useDeleteProductImage(product?.id ?? "");

  // Populate form when editing
  useEffect(() => {
    if (open) {
      if (product) {
        setSku(product.sku);
        setName(product.name);
        setDescription(product.description ?? "");
        setUnitType(product.unitType);
        setInternalCode(product.internalCode ?? "");
        setCostPrice(String(parseFloat(product.costPrice) || ""));
        setSalePrice(String(parseFloat(product.salePrice) || ""));
        setSunatCode(product.sunatProductCode ?? "");
        setUnitTypeCode(product.unitTypeCode);
        setIgvCode(product.igvAffectationCode);
        setHasIgv(product.hasIgv);
      } else {
        setSku(""); setName(""); setDescription(""); setUnitType("unit");
        setInternalCode(""); setCostPrice(""); setSalePrice("");
        setSunatCode(""); setUnitTypeCode("NIU"); setIgvCode("10"); setHasIgv(true);
      }
      // Reset image state on open
      setImageFile(null);
      setImagePreview(null);
      setRemoveImage(false);
    }
  }, [open, product]);

  // Build preview URL for existing image
  const existingImageUrl = isEdit && product?.hasImage && !removeImage
    ? getProductImageUrl(product.id, product.updatedAt)
    : null;

  const previewSrc = imagePreview ?? existingImageUrl;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setRemoveImage(false);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isPending = createMut.isPending || updateMut.isPending ||
                    uploadImageMut.isPending || deleteImageMut.isPending || isUploading;

  const margin = (() => {
    const cost = parseFloat(costPrice);
    const sale = parseFloat(salePrice);
    if (sale > 0 && cost >= 0) {
      return (((sale - cost) / sale) * 100).toFixed(1);
    }
    return null;
  })();

  const canSave =
    sku.trim().length > 0 &&
    name.trim().length > 0 &&
    (costPrice === "" || parseFloat(costPrice) >= 0) &&
    (salePrice === "" || parseFloat(salePrice) >= 0);

  const handleSave = async () => {
    if (!canSave) return;

    const body: CreateProductInput = {
      sku:                  sku.trim(),
      name:                 name.trim(),
      description:          description.trim() || undefined,
      unit_type:            unitType,
      cost_price:           parseFloat(costPrice) || 0,
      sale_price:           parseFloat(salePrice) || 0,
      internal_code:        internalCode.trim()  || undefined,
      sunat_product_code:   sunatCode.trim()     || undefined,
      unit_type_code:       unitTypeCode,
      igv_affectation_code: igvCode,
      has_igv:              hasIgv,
    };

    try {
      let savedId: string;
      if (isEdit) {
        // PATCH no acepta sku (inmutable) — enviamos todo excepto sku
        const { sku: _sku, ...updateBody } = body;
        const updated = await updateMut.mutateAsync(updateBody);
        savedId = updated.id;
      } else {
        const created = await createMut.mutateAsync(body);
        savedId = created.id;
      }

      // Handle image after product is saved
      if (imageFile) {
        setIsUploading(true);
        try {
          const { uploadFile } = await import("@/lib/api");
          await uploadFile(`/v1/products/${savedId}/image`, imageFile);
          // Invalidate so list re-fetches with updated has_image + new image url
          await qc.invalidateQueries({ queryKey: productKeys.all });
        } finally {
          setIsUploading(false);
        }
      } else if (removeImage && isEdit && product?.hasImage) {
        await deleteImageMut.mutateAsync();
      }

      onClose();
    } catch { /* toasted in hooks */ }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            {isEdit ? "Editar producto" : "Nuevo producto"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit
              ? `Editar información del producto ${product?.name ?? ""}`
              : "Completa el formulario para crear un nuevo producto en el catálogo"}
          </DialogDescription>
        </DialogHeader>

        {/* ── Scrollable body ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── Top: image + basic info ─────────────────────────────── */}
          <div className="flex gap-4">

            {/* Image upload */}
            <div className="shrink-0 flex flex-col items-center gap-2">
              <div
                className="relative w-28 h-28 rounded-xl border-2 border-dashed border-border
                           bg-muted/30 flex items-center justify-center overflow-hidden
                           cursor-pointer hover:bg-muted/50 transition-colors group"
                onClick={() => fileInputRef.current?.click()}
                title="Haz clic para seleccionar una imagen"
              >
                {previewSrc ? (
                  <img
                    src={previewSrc}
                    alt="Imagen del producto"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground group-hover:text-foreground transition-colors">
                    <Camera className="h-7 w-7" />
                    <span className="text-[10px] text-center leading-tight">Subir imagen</span>
                  </div>
                )}
                {/* Overlay icon on hover when image exists */}
                {previewSrc && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="h-6 w-6 text-white" />
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              {previewSrc && (
                <button
                  type="button"
                  className="flex items-center gap-1 text-[11px] text-destructive hover:text-destructive/80 transition-colors"
                  onClick={handleRemoveImage}
                >
                  <ImageOff className="h-3 w-3" />
                  Eliminar
                </button>
              )}
              <p className="text-[10px] text-muted-foreground text-center leading-tight max-w-[7rem]">
                JPG, PNG, WEBP
              </p>
            </div>

            {/* Basic info */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* SKU + Código interno */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>
                    SKU <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="PROD-001"
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    disabled={isEdit}
                    className={isEdit ? "bg-muted/50 cursor-not-allowed font-mono text-sm" : "font-mono text-sm"}
                  />
                  {isEdit && (
                    <p className="text-[11px] text-muted-foreground">Inmutable</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Código interno{" "}
                    <span className="text-[11px] text-muted-foreground font-normal">(para buscador)</span>
                  </Label>
                  <Input
                    placeholder="COD-001 o código de barras"
                    value={internalCode}
                    onChange={(e) => setInternalCode(e.target.value)}
                  />
                </div>
              </div>

              {/* Nombre */}
              <div className="space-y-1.5">
                <Label>
                  Nombre <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Crema podológica 250ml"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Unidad */}
              <div className="space-y-1.5">
                <Label>
                  Tipo de unidad <span className="text-destructive">*</span>
                </Label>
                <Select value={unitType} onValueChange={(v) => setUnitType(v as UnitType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label>
              Descripción{" "}
              <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Textarea
              placeholder="Descripción del producto, ingredientes, uso recomendado…"
              rows={2}
              className="resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <Separator />

          {/* ── Precios ──────────────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Precios
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Precio de costo{" "}
                  <span className="text-[11px] text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">S/</span>
                  <Input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    className="pl-8"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Precio de venta <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">S/</span>
                  <Input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    className="pl-8"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Margen calculado */}
            {margin !== null && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs flex items-center justify-between">
                <span className="text-muted-foreground">Margen de ganancia</span>
                <span className={`font-semibold ${parseFloat(margin) >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {margin}%
                  {" · "}
                  S/ {(parseFloat(salePrice) - parseFloat(costPrice)).toFixed(2)}
                </span>
              </div>
            )}
          </section>

          <Separator />

          {/* ── SUNAT / Facturación ──────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Facturación electrónica (SUNAT)
              </p>
            </div>

            {/* Código SUNAT + UOM */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Código SUNAT{" "}
                  <span className="text-[11px] text-muted-foreground font-normal">(catálogo)</span>
                </Label>
                <Input
                  placeholder="50101501"
                  value={sunatCode}
                  onChange={(e) => setSunatCode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Código de unidad</Label>
                <Select value={unitTypeCode} onValueChange={setUnitTypeCode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPE_CODE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* IGV Afectación + Has IGV */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Afectación IGV</Label>
                <Select value={igvCode} onValueChange={setIgvCode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IGV_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>¿Precio incluye IGV?</Label>
                <Select value={hasIgv ? "true" : "false"} onValueChange={(v) => setHasIgv(v === "true")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Sí, el precio incluye IGV</SelectItem>
                    <SelectItem value="false">No, precio sin IGV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            disabled={!canSave || isPending}
            onClick={handleSave}
            className="min-w-[120px]"
          >
            {isPending
              ? (isEdit ? "Guardando…" : "Creando…")
              : (isEdit ? "Guardar cambios" : "Crear producto")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

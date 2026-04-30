import { useState, useEffect } from "react";
import { Info } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
  Button, Input, Label, Textarea, Separator, Select,
  SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@podoplus/ui";
import {
  useCreateProduct, useUpdateProduct,
  type Product, type CreateProductInput, type UnitType,
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
  { value: "BLL", label: "BLL — Barril" },
  { value: "GRM", label: "GRM — Gramo" },
  { value: "MLT", label: "MLT — Mililitro" },
];

const IGV_OPTIONS = [
  { value: "10", label: "10 — Gravado IGV" },
  { value: "20", label: "20 — Exonerado" },
  { value: "30", label: "30 — Inafecto" },
];

// ── Default form state ────────────────────────────────────────────────────────

const EMPTY: CreateProductInput = {
  sku:                  "",
  name:                 "",
  description:          "",
  unit_type:            "unit",
  cost_price:           0,
  sale_price:           0,
  internal_code:        "",
  sunat_product_code:   "",
  unit_type_code:       "NIU",
  igv_affectation_code: "10",
  has_igv:              true,
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open:    boolean;
  onClose: () => void;
  product: Product | null; // null = create mode
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProductDrawer({ open, onClose, product }: Props) {
  const isEdit = !!product;

  const [sku,                setsku]               = useState("");
  const [name,               setName]              = useState("");
  const [description,        setDescription]       = useState("");
  const [unitType,           setUnitType]          = useState<UnitType>("unit");
  const [costPrice,          setCostPrice]         = useState("");
  const [salePrice,          setSalePrice]         = useState("");
  const [internalCode,       setInternalCode]      = useState("");
  const [sunatCode,          setSunatCode]         = useState("");
  const [unitTypeCode,       setUnitTypeCode]      = useState("NIU");
  const [igvCode,            setIgvCode]           = useState("10");
  const [hasIgv,             setHasIgv]            = useState(true);
  const [showSunat,          setShowSunat]         = useState(false);

  const createMut = useCreateProduct();
  const updateMut = useUpdateProduct(product?.id ?? "");

  // Populate form when editing
  useEffect(() => {
    if (open) {
      if (product) {
        setsku(product.sku);
        setName(product.name);
        setDescription(product.description ?? "");
        setUnitType(product.unitType);
        setCostPrice(String(parseFloat(product.costPrice) || ""));
        setSalePrice(String(parseFloat(product.salePrice) || ""));
        setInternalCode(product.internalCode ?? "");
        setSunatCode(product.sunatProductCode ?? "");
        setUnitTypeCode(product.unitTypeCode);
        setIgvCode(product.igvAffectationCode);
        setHasIgv(product.hasIgv);
      } else {
        setsku(""); setName(""); setDescription(""); setUnitType("unit");
        setCostPrice(""); setSalePrice("");
        setInternalCode(""); setSunatCode("");
        setUnitTypeCode("NIU"); setIgvCode("10"); setHasIgv(true);
      }
      setShowSunat(false);
    }
  }, [open, product]);

  const isPending = createMut.isPending || updateMut.isPending;

  const canSave =
    sku.trim().length > 0 &&
    name.trim().length > 0 &&
    parseFloat(costPrice) >= 0 &&
    parseFloat(salePrice) >= 0;

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
      if (isEdit) {
        await updateMut.mutateAsync(body);
      } else {
        await createMut.mutateAsync(body);
      }
      onClose();
    } catch { /* toasted in hook */ }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full max-w-lg overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar producto" : "Nuevo producto"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Modifica los datos del producto."
              : "Completa la información para registrar un nuevo producto."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 py-4">

          {/* ── Información básica ───────────────────────────────────── */}
          <section className="space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Información básica
            </p>

            {/* SKU + Nombre */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  SKU <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="PROD-001"
                  value={sku}
                  onChange={(e) => setsku(e.target.value.toUpperCase())}
                  disabled={isEdit} // SKU is immutable after creation
                  className={isEdit ? "bg-muted/50 cursor-not-allowed" : ""}
                />
                {isEdit && (
                  <p className="text-[11px] text-muted-foreground">El SKU no puede modificarse</p>
                )}
              </div>
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
            </div>

            {/* Descripción */}
            <div className="space-y-1.5">
              <Label>
                Descripción{" "}
                <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Textarea
                placeholder="Descripción del producto, ingredientes, uso…"
                rows={2}
                className="resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Tipo de unidad */}
            <div className="space-y-1.5">
              <Label>
                Tipo de unidad <span className="text-destructive">*</span>
              </Label>
              <Select
                value={unitType}
                onValueChange={(v) => setUnitType(v as UnitType)}
              >
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
          </section>

          <Separator />

          {/* ── Precios ──────────────────────────────────────────────── */}
          <section className="space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Precios
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Precio de costo <span className="text-destructive">*</span>
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
            {parseFloat(salePrice) > 0 && parseFloat(costPrice) >= 0 && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
                <span>Margen</span>
                <span className="font-semibold text-foreground">
                  {(((parseFloat(salePrice) - parseFloat(costPrice)) / parseFloat(salePrice)) * 100).toFixed(1)}%
                  {" "}(S/ {(parseFloat(salePrice) - parseFloat(costPrice)).toFixed(2)})
                </span>
              </div>
            )}
          </section>

          <Separator />

          {/* ── SUNAT / Facturación (colapsable) ────────────────────── */}
          <section className="space-y-3">
            <button
              type="button"
              className="flex items-center gap-2 w-full text-left group"
              onClick={() => setShowSunat((v) => !v)}
            >
              <Info className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide group-hover:text-foreground transition-colors">
                Facturación / SUNAT
              </p>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {showSunat ? "Ocultar ▲" : "Mostrar ▼"}
              </span>
            </button>

            {showSunat && (
              <div className="space-y-4 pt-1">
                {/* Código interno + código SUNAT */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>
                      Código interno{" "}
                      <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                    </Label>
                    <Input
                      placeholder="COD-001"
                      value={internalCode}
                      onChange={(e) => setInternalCode(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      Código SUNAT{" "}
                      <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                    </Label>
                    <Input
                      placeholder="50101501"
                      value={sunatCode}
                      onChange={(e) => setSunatCode(e.target.value)}
                    />
                  </div>
                </div>

                {/* Código UOM (SUNAT) */}
                <div className="space-y-1.5">
                  <Label>Código de unidad (SUNAT)</Label>
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

                {/* Afectación IGV + Has IGV */}
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
                    <Label>¿Incluye IGV?</Label>
                    <Select
                      value={hasIgv ? "true" : "false"}
                      onValueChange={(v) => setHasIgv(v === "true")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Sí</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <SheetFooter className="pt-2 border-t gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={!canSave || isPending}
            onClick={handleSave}
          >
            {isPending
              ? (isEdit ? "Guardando…" : "Creando…")
              : (isEdit ? "Guardar cambios" : "Crear producto")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

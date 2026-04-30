import { useState, useMemo, useRef, useCallback } from "react";
import {
  Plus, Trash2, ShoppingCart, PackagePlus,
  Search, X,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Button, Input, Label, Textarea,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Separator,
} from "@podoplus/ui";
import {
  useCreatePurchase, useReceivePurchase,
  useSuppliers, useCreateSupplier,
  type CreatePurchaseInput, type CreatePurchaseItemInput,
  type Product,
} from "@/hooks/use-inventory";
import { useProducts } from "@/hooks/use-inventory";
import { useBranches } from "@/hooks/use-appointments";
import { useBranchContext } from "@/hooks/use-branch-context";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const VOUCHER_TYPES = [
  { value: "FACTURA",      label: "Factura" },
  { value: "BOLETA",       label: "Boleta" },
  { value: "NOTA_ENTRADA", label: "Nota de entrada" },
  { value: "LIQUIDACION",  label: "Liquidación" },
  { value: "TICKET",       label: "Ticket" },
  { value: "OTHER",        label: "Otro" },
] as const;

const IGV_RATE = 0.18;

function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function fmtNum(v: number) {
  return v.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Product search combobox ───────────────────────────────────────────────────

interface ProductSearchProps {
  products:   Product[];
  value:      string;       // product_id
  label:      string;       // display label (name · sku)
  onChange:   (product: Product) => void;
  onClear:    () => void;
}

function ProductSearch({ products, value, label, onChange, onClear }: ProductSearchProps) {
  const [query, setQuery] = useState("");
  const [open,  setOpen]  = useState(false);
  // Track whether the user is hovering the list — used to prevent blur from
  // closing the list before the click can register.
  const hoveringList = useRef(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 30);
    return products
      .filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.internal_code ?? "").toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [products, query]);

  const handleSelect = useCallback((p: Product) => {
    onChange(p);
    setQuery("");
    setOpen(false);
    hoveringList.current = false;
  }, [onChange]);

  // ── Selected state ──────────────────────────────────────────────────────────
  if (value) {
    return (
      <div className="flex items-center gap-1.5 h-8 px-3 rounded-md border bg-muted/20 text-xs">
        <span className="flex-1 truncate font-medium">{label}</span>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // ── Search + inline list ────────────────────────────────────────────────────
  return (
    <div>
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          className="flex h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="Buscar por nombre, SKU o código…"
          value={query}
          autoComplete="off"
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay so a click on a list item fires before the list disappears
            if (!hoveringList.current) setOpen(false);
          }}
        />
      </div>

      {/* Inline list — lives in normal document flow, no portal/z-index issues */}
      {open && (
        <div
          className="mt-1 rounded-md border bg-background shadow-md max-h-48 overflow-y-auto"
          onMouseEnter={() => { hoveringList.current = true; }}
          onMouseLeave={() => { hoveringList.current = false; }}
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-xs text-center text-muted-foreground">Sin resultados</p>
          ) : (
            filtered.map((p) => {
              const saleNum = parseFloat(p.sale_price) || 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  tabIndex={-1}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted text-left border-b last:border-0 transition-colors"
                  onClick={() => handleSelect(p)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-muted-foreground font-mono text-[10px]">
                      {p.sku}{p.internal_code ? ` · ${p.internal_code}` : ""}
                    </p>
                  </div>
                  {saleNum > 0 && (
                    <span className="shrink-0 tabular-nums text-green-700 font-mono font-medium">
                      S/ {saleNum.toFixed(2)}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Item draft ────────────────────────────────────────────────────────────────

interface ItemDraft {
  key:          number;
  product_id:   string;
  product_name: string;
  product_sku:  string;
  branch_id:    string;
  quantity:     string;
  unit_price:   string;
  lot:          string;
}

function calcItem(item: ItemDraft) {
  const qty   = parseFloat(item.quantity)   || 0;
  const price = parseFloat(item.unit_price) || 0;
  const uVal  = parseFloat((price / (1 + IGV_RATE)).toFixed(6));
  const total = qty * price;
  return { qty, price, uVal, total };
}

// ── Item row ──────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item:       ItemDraft;
  products:   Product[];
  branches:   { id: string; name: string; isActive: boolean }[];
  index:      number;
  onChange:   (key: number, field: keyof ItemDraft, value: string) => void;
  onSelect:   (key: number, product: Product) => void;
  onClear:    (key: number) => void;
  onRemove:   (key: number) => void;
  isOnly:     boolean;
}

function ItemRow({ item, products, branches, index, onChange, onSelect, onClear, onRemove, isOnly }: ItemRowProps) {
  const { qty, price, total } = calcItem(item);
  const activeBranches = branches.filter((b) => b.isActive);

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      {/* Row header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          Ítem {index + 1}
        </span>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className="text-xs font-semibold text-primary tabular-nums">
              S/ {fmtNum(total)}
            </span>
          )}
          <button
            type="button"
            className={cn(
              "h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground",
              isOnly && "opacity-30 pointer-events-none"
            )}
            disabled={isOnly}
            onClick={() => onRemove(item.key)}
            title="Eliminar ítem"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Producto search (full width) */}
        <div className="space-y-1">
          <Label className="text-xs">Producto *</Label>
          <ProductSearch
            products={products}
            value={item.product_id}
            label={`${item.product_name}  ·  ${item.product_sku}`}
            onChange={(p) => onSelect(item.key, p)}
            onClear={() => onClear(item.key)}
          />
        </div>

        {/* Almacén + Cantidad + Precio + Lote */}
        <div className="grid grid-cols-[1fr_80px_100px_100px] gap-3 items-end">
          {/* Almacén */}
          <div className="space-y-1">
            <Label className="text-xs">Almacén destino *</Label>
            <Select value={item.branch_id} onValueChange={(v) => onChange(item.key, "branch_id", v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Sede…" />
              </SelectTrigger>
              <SelectContent>
                {activeBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-xs">{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cantidad */}
          <div className="space-y-1">
            <Label className="text-xs">Cant. *</Label>
            <Input
              type="number" min="1" step="1" className="h-8 text-xs text-center"
              placeholder="1"
              value={item.quantity}
              onChange={(e) => onChange(item.key, "quantity", e.target.value)}
            />
          </div>

          {/* Precio c/IGV */}
          <div className="space-y-1">
            <Label className="text-xs">P. Unit c/IGV</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">S/</span>
              <input
                type="text"
                inputMode="decimal"
                className="flex h-8 w-full rounded-md border border-input bg-background pl-6 pr-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="0.00"
                value={item.unit_price}
                // Select-all on focus so typing always replaces the current value
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const v = e.target.value;
                  // Allow empty string, digits, and at most one decimal point
                  if (v === "" || /^\d*\.?\d{0,4}$/.test(v)) {
                    onChange(item.key, "unit_price", v);
                  }
                }}
              />
            </div>
          </div>

          {/* Lote */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Lote</Label>
            <Input
              className="h-8 text-xs"
              placeholder="L20260101"
              value={item.lot}
              onChange={(e) => onChange(item.key, "lot", e.target.value)}
              maxLength={100}
            />
          </div>
        </div>

        {/* Mini totals row */}
        {price > 0 && (
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-0.5">
            <span>Valor s/IGV: <span className="tabular-nums font-medium text-foreground">S/ {(price / (1 + IGV_RATE)).toFixed(2)}</span></span>
            <span>IGV: <span className="tabular-nums font-medium text-foreground">S/ {(price - price / (1 + IGV_RATE)).toFixed(2)}</span></span>
            {qty > 1 && (
              <span>Total: <span className="tabular-nums font-semibold text-primary">S/ {fmtNum(total)}</span></span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-primary">{number}</span>
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open:    boolean;
  onClose: () => void;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

let itemKey = 0;
const freshItem = (branchId = ""): ItemDraft => ({
  key: ++itemKey, product_id: "", product_name: "", product_sku: "",
  branch_id: branchId, quantity: "1", unit_price: "", lot: "",
});

export function CreatePurchaseModal({ open, onClose }: Props) {
  const { activeBranchId } = useBranchContext();

  // Header fields
  const [supplierId,   setSupplierId]   = useState("");
  const [voucherType,  setVoucherType]  = useState("FACTURA");
  const [serie,        setSerie]        = useState("");
  const [number,       setNumber]       = useState("");
  const [emissionDate, setEmissionDate] = useState(todayStr);
  const [dueDate,      setDueDate]      = useState("");
  const [currency,     setCurrency]     = useState("PEN");
  const [notes,        setNotes]        = useState("");

  // Quick supplier
  const [newSupplierName, setNewSupplierName] = useState("");
  const [showNewSupplier, setShowNewSupplier] = useState(false);

  // Items — pre-fill branch from global context
  const [items, setItems] = useState<ItemDraft[]>(() => [freshItem(activeBranchId ?? "")]);

  const createPurchase  = useCreatePurchase();
  const receivePurchase = useReceivePurchase();
  const createSupplier  = useCreateSupplier();

  const { data: suppliers }    = useSuppliers();
  const { data: branches }     = useBranches();
  const { data: productsData } = useProducts({ active: true, limit: 500 });
  const products = productsData?.data ?? [];

  // Totals
  const { subtotal, taxAmount, totalAmount } = useMemo(() => {
    let sub = 0, tax = 0, tot = 0;
    for (const item of items) {
      const { qty, price, uVal } = calcItem(item);
      sub += qty * uVal;
      tax += qty * (price - uVal);
      tot += qty * price;
    }
    return { subtotal: sub, taxAmount: tax, totalAmount: tot };
  }, [items]);

  const handleItemChange = (key: number, field: keyof ItemDraft, value: string) => {
    setItems((prev) => prev.map((i) => i.key === key ? { ...i, [field]: value } : i));
  };

  const handleProductSelect = (key: number, product: Product) => {
    const saleNum = parseFloat(product.sale_price) || 0;
    const costNum = parseFloat(product.cost_price) || 0;

    // Priority: sale_price → cost_price → leave blank for manual entry.
    // sale_price in Peru is typically the IGV-inclusive retail price → use directly.
    // cost_price is assumed to be the base (ex-IGV) value → multiply by 1.18 if has_igv.
    const autoPrice =
      saleNum > 0
        ? saleNum.toFixed(2)
        : costNum > 0
          ? (product.has_igv
              ? (costNum * (1 + IGV_RATE)).toFixed(2)
              : costNum.toFixed(2))
          : "";

    setItems((prev) => prev.map((i) =>
      i.key === key
        ? {
            ...i,
            product_id:   product.id,
            product_name: product.name,
            product_sku:  product.sku,
            unit_price:   autoPrice,
          }
        : i
    ));
  };

  const handleProductClear = (key: number) => {
    setItems((prev) => prev.map((i) =>
      i.key === key
        ? { ...i, product_id: "", product_name: "", product_sku: "", unit_price: "" }
        : i
    ));
  };

  const handleAddItem = () =>
    setItems((prev) => [...prev, freshItem(activeBranchId ?? prev[0]?.branch_id ?? "")]);
  const handleRemoveItem = (key: number) =>
    setItems((prev) => prev.filter((i) => i.key !== key));

  const reset = () => {
    setSupplierId(""); setVoucherType("FACTURA"); setSerie(""); setNumber("");
    setEmissionDate(todayStr()); setDueDate(""); setCurrency("PEN"); setNotes("");
    setItems([freshItem(activeBranchId ?? "")]); setNewSupplierName(""); setShowNewSupplier(false);
    onClose();
  };

  const handleQuickSupplier = async () => {
    if (!newSupplierName.trim()) return;
    try {
      const s = await createSupplier.mutateAsync({ name: newSupplierName.trim() });
      setSupplierId(s.id);
      setNewSupplierName("");
      setShowNewSupplier(false);
    } catch { /* toasted */ }
  };

  const buildBody = (): CreatePurchaseInput => ({
    supplier_id:   supplierId,
    voucher_type:  voucherType,
    serie:         serie.trim(),
    number:        number.trim(),
    emission_date: emissionDate,
    due_date:      dueDate || undefined,
    currency,
    subtotal,
    tax_amount:    taxAmount,
    total_amount:  totalAmount,
    notes:         notes.trim() || undefined,
    items: items
      .filter((i) => i.product_id && i.branch_id && parseFloat(i.quantity) > 0)
      .map((i): CreatePurchaseItemInput => {
        const { qty, price, uVal, total } = calcItem(i);
        return {
          product_id:   i.product_id,
          branch_id:    i.branch_id,
          quantity:     qty,
          unit_value:   uVal,
          unit_price:   price,
          total_amount: total,
          lot:          i.lot.trim() || undefined,
        };
      }),
  });

  const validItems = items.filter((i) => i.product_id && i.branch_id && parseFloat(i.quantity) > 0);
  const canSubmit  =
    !!supplierId && !!serie.trim() && !!number.trim() && !!emissionDate &&
    validItems.length > 0;

  const handleDraft = async () => {
    if (!canSubmit) return;
    try { await createPurchase.mutateAsync(buildBody()); reset(); } catch { /* toasted */ }
  };

  const handleReceive = async () => {
    if (!canSubmit) return;
    try {
      const draft = await createPurchase.mutateAsync(buildBody());
      await receivePurchase.mutateAsync((draft as any).id);
      reset();
    } catch { /* toasted */ }
  };

  const isBusy = createPurchase.isPending || receivePurchase.isPending || createSupplier.isPending;
  const itemsWithPrice = items.filter((i) => parseFloat(i.unit_price) > 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && reset()}>
      <DialogContent
        className="sm:max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0"
        // Prevent Radix from closing the dialog when the user clicks the
        // portal-based product-search dropdown (which lives outside this DOM node).
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <ShoppingCart className="h-4 w-4 text-primary" />
            </div>
            Nueva Compra
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Registra una orden de compra. Guarda como borrador o recíbela para actualizar el stock inmediatamente.
          </DialogDescription>
        </DialogHeader>

        {/* ── Scrollable body ─────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── 1. Proveedor ─────────────────────────────── */}
          <div>
            <SectionHeader number="1" title="Proveedor" subtitle="Selecciona o crea uno nuevo" />
            {!showNewSupplier ? (
              <div className="flex items-center gap-2">
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger className={cn("flex-1", !supplierId && "text-muted-foreground")}>
                    <SelectValue placeholder="Seleccionar proveedor…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(suppliers ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="font-medium">{s.name}</span>
                        {s.document_number && (
                          <span className="text-muted-foreground ml-1.5 text-xs">{s.document_number}</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button" variant="outline" size="sm" className="shrink-0 gap-1"
                  onClick={() => setShowNewSupplier(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Nuevo proveedor
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  placeholder="Nombre del proveedor"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleQuickSupplier()}
                  className="flex-1"
                />
                <Button type="button" size="sm" onClick={handleQuickSupplier} disabled={!newSupplierName.trim() || isBusy}>
                  Crear
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => { setShowNewSupplier(false); setNewSupplierName(""); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* ── 2. Comprobante ───────────────────────────── */}
          <div>
            <SectionHeader number="2" title="Comprobante" subtitle="Datos del documento de compra" />
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo *</Label>
                <Select value={voucherType} onValueChange={setVoucherType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VOUCHER_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Serie *</Label>
                <Input
                  placeholder="F001"
                  value={serie}
                  onChange={(e) => setSerie(e.target.value.toUpperCase())}
                  maxLength={20}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Número *</Label>
                <Input
                  placeholder="00001"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  maxLength={20}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Fecha emisión *</Label>
                <Input
                  type="date"
                  value={emissionDate}
                  onChange={(e) => setEmissionDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Vencimiento <span className="text-muted-foreground">(opc.)</span></Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Moneda</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PEN">Soles (S/)</SelectItem>
                    <SelectItem value="USD">Dólares (US$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* ── 3. Productos ─────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <SectionHeader
                number="3"
                title={`Productos (${validItems.length}/${items.length})`}
                subtitle="Busca y agrega los productos comprados"
              />
            </div>

            <div className="space-y-2.5">
              {items.map((item, idx) => (
                <ItemRow
                  key={item.key}
                  item={item}
                  products={products}
                  branches={branches ?? []}
                  index={idx}
                  onChange={handleItemChange}
                  onSelect={handleProductSelect}
                  onClear={handleProductClear}
                  onRemove={handleRemoveItem}
                  isOnly={items.length === 1}
                />
              ))}

              <Button
                type="button" variant="outline" size="sm"
                className="w-full text-xs h-9 border-dashed gap-1.5 mt-1"
                onClick={handleAddItem}
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar otro producto
              </Button>
            </div>

            {/* Totals */}
            {itemsWithPrice.length > 0 && (
              <div className="mt-4 rounded-xl bg-muted/30 border px-5 py-3.5 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subtotal (sin IGV)</span>
                  <span className="tabular-nums font-mono">S/ {fmtNum(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>IGV (18%)</span>
                  <span className="tabular-nums font-mono">S/ {fmtNum(taxAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2 mt-1">
                  <span>Total</span>
                  <span className="tabular-nums text-primary text-base font-bold">S/ {fmtNum(totalAmount)}</span>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* ── 4. Observaciones ─────────────────────────── */}
          <div>
            <SectionHeader number="4" title="Observaciones" subtitle="Notas internas opcionales" />
            <Textarea
              placeholder="Pedido mensual, condiciones especiales de entrega…"
              rows={2}
              className="resize-none text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
            />
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/20 shrink-0 flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={reset} disabled={isBusy} className="sm:mr-auto">
            Cancelar
          </Button>
          <Button
            type="button" variant="outline"
            disabled={!canSubmit || isBusy}
            onClick={handleDraft}
          >
            {createPurchase.isPending && !receivePurchase.isPending ? "Guardando…" : "Guardar borrador"}
          </Button>
          <Button
            type="button"
            disabled={!canSubmit || isBusy}
            onClick={handleReceive}
            className="gap-2"
          >
            <PackagePlus className="h-4 w-4" />
            {receivePurchase.isPending ? "Recibiendo…" : "Crear y recibir stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

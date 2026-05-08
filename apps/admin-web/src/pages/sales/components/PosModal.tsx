import { useState, useMemo, useRef } from "react";
import {
  X, Search, ShoppingCart, Plus, Minus, Trash2,
  Package, Wrench, ChevronRight, Loader2,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, Button, Label } from "@podoplus/ui";
import { useProducts, getProductImageUrl } from "@/hooks/use-products";
import { useServices }   from "@/hooks/use-services";
import { useCustomers }  from "@/hooks/use-customers";
import { useDebounce }   from "@/hooks/use-debounce";
import {
  useCreateSale,
  type PaymentMethod, type ItemType, type Sale, type TipoComprobante,
} from "@/hooks/use-sales";
import { useBranchContext } from "@/hooks/use-branch-context";
import { fmt } from "@/lib/sale-helpers";
import { cn } from "@/lib/utils";
import { generateUUID } from "@/lib/uuid";
// ── Types ─────────────────────────────────────────────────────────────────────

interface CartItem {
  key:           string;
  item_type:     ItemType;
  product_id?:   string;
  service_id?:   string;
  label:         string;
  price:         number;
  quantity:      number;
  igv_code:      string;
  unit_type_code:string;
  imageUrl?:     string;
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: "CASH",     label: "Efectivo",  icon: "💵" },
  { value: "CARD",     label: "Tarjeta",   icon: "💳" },
  { value: "YAPE",     label: "Yape",      icon: "📱" },
  { value: "PLIN",     label: "Plin",      icon: "📱" },
  { value: "TRANSFER", label: "Transfer.", icon: "🏦" },
  { value: "MIXED",    label: "Mixto",     icon: "🔀" },
];

const IGV_RATE = 0.18;

function computeTotals(items: CartItem[], discountAmt: number) {
  let totalGravado = 0;
  let totalIgv     = 0;
  let totalBruto   = 0;
  for (const item of items) {
    const lineTotal  = item.price * item.quantity;
    const isGravado  = item.igv_code === "10";
    const base       = isGravado ? lineTotal / (1 + IGV_RATE) : lineTotal;
    const igv        = isGravado ? lineTotal - base : 0;
    totalGravado    += base;
    totalIgv        += igv;
    totalBruto      += lineTotal;
  }
  const totalNeto = Math.max(0, totalBruto - discountAmt);
  return { totalGravado, totalIgv, totalBruto, totalNeto };
}

function getServiceImageUrl(serviceId: string, updatedAt?: string): string {
  const base = (import.meta as any).env?.VITE_API_URL ?? "";
  const url  = `${base}/v1/services/${serviceId}/image`;
  return updatedAt ? `${url}?v=${encodeURIComponent(updatedAt)}` : url;
}

// ── Product / Service card ────────────────────────────────────────────────────

function ItemCard({
  imageUrl, name, price, hasImage, onClick,
}: {
  imageUrl: string;
  name:     string;
  price:    string | number;
  hasImage: boolean;
  onClick:  () => void;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col rounded-xl border bg-card hover:border-primary/50 hover:shadow-md transition-all duration-150 overflow-hidden text-left focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      {/* Image */}
      <div className="w-full aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {hasImage && !imgError ? (
          <img
            src={imageUrl}
            alt={name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <Package className="h-8 w-8 text-muted-foreground/40" />
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 flex-1 flex flex-col justify-between gap-1">
        <p className="text-xs font-medium leading-snug line-clamp-2">{name}</p>
        <p className="text-sm font-bold text-primary">{fmt(price)}</p>
      </div>

      {/* Add overlay */}
      <div className="px-2.5 pb-2.5">
        <div className="flex items-center justify-center gap-1 py-1 rounded-lg bg-primary/5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors text-[11px] font-medium text-primary">
          <Plus className="h-3 w-3" />
          Agregar
        </div>
      </div>
    </button>
  );
}

// ── Cart item row ─────────────────────────────────────────────────────────────

function CartRow({
  item,
  onQty,
  onRemove,
}: {
  item:     CartItem;
  onQty:    (key: string, delta: number) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <div className="flex items-start gap-2 py-2.5 border-b last:border-b-0">
      {/* Image thumb */}
      <div className="h-9 w-9 rounded-md bg-muted overflow-hidden shrink-0 flex items-center justify-center">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.label} className="h-full w-full object-cover" />
        ) : (
          <Package className="h-4 w-4 text-muted-foreground/40" />
        )}
      </div>

      {/* Name + controls */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium leading-snug truncate">{item.label}</p>
        <p className="text-xs text-muted-foreground">{fmt(item.price)} c/u</p>

        {/* Qty row */}
        <div className="flex items-center gap-1 mt-1.5">
          <button
            type="button"
            onClick={() => onQty(item.key, -1)}
            disabled={item.quantity <= 1}
            className="h-5 w-5 rounded border flex items-center justify-center hover:bg-muted disabled:opacity-40 transition-colors"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="text-xs font-semibold w-5 text-center">{item.quantity}</span>
          <button
            type="button"
            onClick={() => onQty(item.key, 1)}
            className="h-5 w-5 rounded border flex items-center justify-center hover:bg-muted transition-colors"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Subtotal + remove */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <p className="text-xs font-bold">{fmt(item.price * item.quantity)}</p>
        <button
          type="button"
          onClick={() => onRemove(item.key)}
          className="p-1 rounded hover:bg-red-50 hover:text-red-500 text-muted-foreground transition-colors"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open:       boolean;
  onClose:    () => void;
  onSuccess?: (sale: Sale) => void;
}

type CategoryTab = "all" | "services" | "products";

// ── Main component ────────────────────────────────────────────────────────────

export function PosModal({ open, onClose, onSuccess }: Props) {
  const { activeBranchId } = useBranchContext();

  // Catalog state
  const [category,  setCategory]   = useState<CategoryTab>("all");
  const [searchQ,   setSearchQ]    = useState("");
  const debouncedQ = useDebounce(searchQ, 200);

  // Cart state
  const [cart,             setCart]             = useState<CartItem[]>([]);
  const [paymentMethod,    setPaymentMethod]     = useState<PaymentMethod>("CASH");
  const [tipoComprobante,  setTipoComprobante]   = useState<TipoComprobante>("03");
  const [serieDocumento,   setSerieDocumento]    = useState("B020");
  const [discount,         setDiscount]          = useState("");
  const [billingNumDoc,    setBillingNumDoc]      = useState("");
  const [billingRazon,     setBillingRazon]       = useState("");
  const [customerSearch,   setCustomerSearch]     = useState("");
  const [customerId,       setCustomerId]         = useState("");
  const [customerName,     setCustomerName]       = useState("");
  const [customerOpen,     setCustomerOpen]       = useState(false);
  const hoveringCustomer = useRef(false);

  const debouncedCSrch = useDebounce(customerSearch, 300);
  const createSale = useCreateSale();

  // Data
  const { data: services, isLoading: svcLoading } = useServices();
  const { data: products, isLoading: prdLoading } = useProducts({ active: true });
  const { data: customers } = useCustomers({ q: debouncedCSrch, limit: 8 });

  const filteredServices = useMemo(() => {
    if (category === "products") return [];
    return (services ?? []).filter(s =>
      s.isActive &&
      (!debouncedQ || s.name.toLowerCase().includes(debouncedQ.toLowerCase()))
    );
  }, [services, category, debouncedQ]);

  const filteredProducts = useMemo(() => {
    if (category === "services") return [];
    return (products ?? []).filter(p =>
      p.isActive &&
      (!debouncedQ ||
        p.name.toLowerCase().includes(debouncedQ.toLowerCase()) ||
        p.sku.toLowerCase().includes(debouncedQ.toLowerCase()))
    );
  }, [products, category, debouncedQ]);

  const discountAmt = parseFloat(discount) || 0;
  const totals = useMemo(() => computeTotals(cart, discountAmt), [cart, discount]);

  // ── Cart helpers ──────────────────────────────────────────────────────────

  function addToCart(item: Omit<CartItem, "key" | "quantity">) {
    setCart(prev => {
      const existing = prev.find(c =>
        c.item_type === item.item_type &&
        c.product_id === item.product_id &&
        c.service_id === item.service_id
      );
      if (existing) {
        return prev.map(c =>
          c.key === existing.key ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { ...item, key: generateUUID(), quantity: 1 }];
    });
  }

  function adjustQty(key: string, delta: number) {
    setCart(prev =>
      prev.map(c => c.key === key ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c)
    );
  }

  function removeItem(key: string) {
    setCart(prev => prev.filter(c => c.key !== key));
  }

  // ── Tipo comprobante toggle ───────────────────────────────────────────────

  function handleTipoChange(t: TipoComprobante) {
    setTipoComprobante(t);
    setSerieDocumento(prev =>
      t === "01" ? prev.replace(/^B/, "F") : prev.replace(/^F/, "B")
    );
  }

  const idemKey = useRef(generateUUID());

  async function handlePayClick() {
    if (!activeBranchId || cart.length === 0 || createSale.isPending) return;
    try {
      const sale = await createSale.mutateAsync({
        branch_id:      activeBranchId,
        customer_id:    customerId   || undefined,
        payment_method: paymentMethod,
        discount_amount: discountAmt || undefined,
        tipo_comprobante: tipoComprobante,
        serie_documento:  serieDocumento || undefined,
        customer_billing: (tipoComprobante === "01" || billingNumDoc) ? {
          tipo_doc:     tipoComprobante === "01" ? "6" : "1",
          num_doc:      billingNumDoc   || undefined,
          razon_social: billingRazon    || undefined,
        } : undefined,
        idempotency_key: idemKey.current,
        items: cart.map(c => ({
          item_type:  c.item_type,
          product_id: c.product_id,
          service_id: c.service_id,
          quantity:   c.quantity,
          unit_price: c.price,
        })),
      });
      idemKey.current = generateUUID();
      setCart([]);
      setDiscount("");
      setCustomerId("");
      setCustomerName("");
      setCustomerSearch("");
      setBillingNumDoc("");
      setBillingRazon("");
      onClose();
      onSuccess?.(sale);
    } catch {
      // toast is already shown by the mutation's onError
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const isLoading = svcLoading || prdLoading;
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[96vw] w-[1100px] h-[90vh] p-0 flex flex-col overflow-hidden rounded-2xl"
        aria-describedby={undefined}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b bg-card shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShoppingCart className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold leading-none">Punto de Venta</DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">Selecciona productos o servicios</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left: catalog ────────────────────────────────────────────── */}
          <div className="flex flex-col flex-1 overflow-hidden border-r">

            {/* Search + tabs */}
            <div className="px-4 pt-3 pb-2 space-y-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="Buscar por nombre o SKU…"
                  className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
              </div>

              <div className="flex gap-1.5">
                {(["all", "services", "products"] as CategoryTab[]).map(cat => {
                  const labels: Record<CategoryTab, string> = {
                    all: "Todos",
                    services: "Servicios",
                    products: "Productos",
                  };
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                        category === cat
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "border hover:bg-muted text-muted-foreground"
                      )}
                    >
                      {cat === "services" && <Wrench className="h-3 w-3" />}
                      {cat === "products" && <Package className="h-3 w-3" />}
                      {labels[cat]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Card grid */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  Cargando catálogo…
                </div>
              ) : (filteredServices.length === 0 && filteredProducts.length === 0) ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Package className="h-9 w-9 mb-2 opacity-25" />
                  <p className="text-sm">Sin resultados</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Services */}
                  {filteredServices.length > 0 && (
                    <div>
                      {category === "all" && (
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                          <Wrench className="h-3 w-3" /> Servicios
                        </p>
                      )}
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                        {filteredServices.map(s => (
                          <ItemCard
                            key={s.id}
                            name={s.name}
                            price={s.basePrice}
                            hasImage={s.hasImage}
                            imageUrl={getServiceImageUrl(s.id, s.updatedAt)}
                            onClick={() => addToCart({
                              item_type:      "SERVICE",
                              service_id:     s.id,
                              label:          s.name,
                              price:          Number(s.basePrice) || 0,
                              igv_code:       s.igvAffectationCode  ?? "10",
                              unit_type_code: s.unitTypeCode        ?? "ZZ",
                              imageUrl:       s.hasImage ? getServiceImageUrl(s.id, s.updatedAt) : undefined,
                            })}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Products */}
                  {filteredProducts.length > 0 && (
                    <div>
                      {category === "all" && (
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                          <Package className="h-3 w-3" /> Productos
                        </p>
                      )}
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                        {filteredProducts.map(p => (
                          <ItemCard
                            key={p.id}
                            name={p.name}
                            price={p.salePrice}
                            hasImage={p.hasImage}
                            imageUrl={getProductImageUrl(p.id, p.updatedAt)}
                            onClick={() => addToCart({
                              item_type:      "PRODUCT",
                              product_id:     p.id,
                              label:          p.name,
                              price:          parseFloat(p.salePrice) || 0,
                              igv_code:       p.igvAffectationCode ?? "10",
                              unit_type_code: p.unitTypeCode        ?? "NIU",
                              imageUrl:       p.hasImage ? getProductImageUrl(p.id, p.updatedAt) : undefined,
                            })}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: cart panel ─────────────────────────────────────────── */}
          <div className="w-[320px] shrink-0 flex flex-col bg-muted/20">

            {/* Cart header */}
            <div className="px-4 py-3 border-b bg-card shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Carrito</span>
                {cartCount > 0 && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">
                    {cartCount} ítem{cartCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-10 text-muted-foreground">
                  <ShoppingCart className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-sm text-center">
                    Selecciona productos<br />o servicios del catálogo
                  </p>
                </div>
              ) : (
                cart.map(item => (
                  <CartRow
                    key={item.key}
                    item={item}
                    onQty={adjustQty}
                    onRemove={removeItem}
                  />
                ))
              )}
            </div>

            {/* Bottom panel */}
            <div className="border-t bg-card px-4 py-3 space-y-3 shrink-0">

              {/* Tipo comprobante */}
              <div className="flex gap-1">
                {(["03", "01"] as TipoComprobante[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTipoChange(t)}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                      tipoComprobante === t
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {t === "03" ? "Boleta" : "Factura"}
                  </button>
                ))}
              </div>

              {/* Serie */}
              <div className="flex items-center gap-2">
                <Label className="text-[11px] shrink-0 text-muted-foreground">Serie</Label>
                <input
                  value={serieDocumento}
                  onChange={e => setSerieDocumento(e.target.value.toUpperCase())}
                  className="flex-1 h-7 px-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  placeholder="B020"
                  maxLength={10}
                />
              </div>

              {/* Billing (RUC only for Factura) */}
              {tipoComprobante === "01" && (
                <div className="space-y-1.5">
                  <input
                    value={billingNumDoc}
                    onChange={e => setBillingNumDoc(e.target.value)}
                    placeholder="RUC del cliente"
                    className="w-full h-7 px-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    maxLength={11}
                  />
                  <input
                    value={billingRazon}
                    onChange={e => setBillingRazon(e.target.value)}
                    placeholder="Razón social"
                    className="w-full h-7 px-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              )}

              {/* Customer (optional) */}
              <div className="relative">
                <input
                  value={customerSearch || customerName}
                  onChange={e => {
                    setCustomerSearch(e.target.value);
                    setCustomerId("");
                    setCustomerName("");
                  }}
                  onFocus={() => setCustomerOpen(true)}
                  onBlur={() => { if (!hoveringCustomer.current) setCustomerOpen(false); }}
                  placeholder="Cliente (opcional)"
                  className="w-full h-7 px-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {customerOpen && (customers?.data ?? []).length > 0 && (
                  <div
                    className="absolute bottom-8 left-0 right-0 z-50 rounded-md border bg-popover shadow-lg max-h-32 overflow-y-auto"
                    onMouseEnter={() => { hoveringCustomer.current = true; }}
                    onMouseLeave={() => { hoveringCustomer.current = false; }}
                  >
                    {(customers?.data ?? []).map((c: any) => (
                      <button
                        key={c.id} type="button" tabIndex={-1}
                        onClick={() => {
                          setCustomerId(c.id);
                          setCustomerName(`${c.firstName} ${c.lastName}`.trim());
                          setCustomerSearch("");
                          setCustomerOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors truncate"
                      >
                        {c.firstName} {c.lastName}
                        {c.documentNumber && <span className="text-muted-foreground ml-1">{c.documentNumber}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Discount */}
              <div className="flex items-center gap-2">
                <Label className="text-[11px] shrink-0 text-muted-foreground">Descuento S/</Label>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                  className="flex-1 h-7 px-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="0.00"
                />
              </div>

              {/* Payment method */}
              <div className="grid grid-cols-3 gap-1">
                {PAYMENT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPaymentMethod(opt.value)}
                    className={cn(
                      "flex flex-col items-center gap-0.5 py-1.5 rounded-lg border text-[10px] font-medium transition-colors",
                      paymentMethod === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    <span className="text-sm">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Totals */}
              {cart.length > 0 && (
                <div className="rounded-lg bg-muted/50 px-3 py-2 space-y-1 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>OP. Gravada</span>
                    <span>{fmt(totals.totalGravado)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>IGV (18%)</span>
                    <span>{fmt(totals.totalIgv)}</span>
                  </div>
                  {discountAmt > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Descuento</span>
                      <span className="text-red-500">- {fmt(discountAmt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm pt-1 border-t mt-1">
                    <span>TOTAL</span>
                    <span className="text-primary">{fmt(totals.totalNeto)}</span>
                  </div>
                </div>
              )}

              {/* Pay button */}
              <Button
                className="w-full h-11 text-base font-bold rounded-xl"
                disabled={cart.length === 0 || !activeBranchId || createSale.isPending}
                onClick={handlePayClick}
              >
                {createSale.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando…</>
                ) : (
                  <>
                    <ChevronRight className="h-5 w-5 mr-1" />
                    PAGAR {cart.length > 0 ? fmt(totals.totalNeto) : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

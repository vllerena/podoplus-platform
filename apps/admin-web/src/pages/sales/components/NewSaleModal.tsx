import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { X, Search, Plus, Trash2, ChevronDown, AlertCircle, Building2, Phone, Mail, MapPin } from "lucide-react";
import {
  Dialog, DialogContent, DialogTitle,
  Button, Label, Separator,
} from "@podoplus/ui";
import {
  useCreateSale, type CreateSaleInput, type ItemType,
  type PaymentMethod, type TipoComprobante, type CustomerBillingInput,
} from "@/hooks/use-sales";
import { useServices }      from "@/hooks/use-services";
import { useProducts }      from "@/hooks/use-products";
import { useCustomers }     from "@/hooks/use-customers";
import { useDebounce }      from "@/hooks/use-debounce";
import { useBranchContext } from "@/hooks/use-branch-context";
import { useBranch, useBranchSeries } from "@/hooks/use-branches";
import { useBusinessUnit }  from "@/hooks/use-business-units";
import { useOpenRegister }  from "@/hooks/use-cash-register";
import { fmt }              from "@/lib/sale-helpers";
import { cn }               from "@/lib/utils";
import type { Sale }        from "@/hooks/use-sales";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineItem {
  key:            string;
  item_type:      ItemType;
  product_id?:    string;
  service_id?:    string;
  label:          string;
  unit_type_code: string;
  igv_code:       string;
  quantity:       number;
  unit_price:     string; // with IGV, text input
  discount_pct:   string; // per-item discount %
}

type NonMixedMethod = Exclude<PaymentMethod, "MIXED">;

interface PaymentSplit {
  key:    string;
  method: NonMixedMethod;
  amount: string;
}

const ALL_PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: "CASH",     label: "Efectivo",      icon: "💵" },
  { value: "CARD",     label: "Tarjeta",       icon: "💳" },
  { value: "YAPE",     label: "Yape",          icon: "📱" },
  { value: "PLIN",     label: "Plin",          icon: "📱" },
  { value: "TRANSFER", label: "Transferencia", icon: "🏦" },
  { value: "MIXED",    label: "Mixto",         icon: "🔀" },
];

const SPLIT_OPTIONS: { value: NonMixedMethod; label: string }[] = [
  { value: "CASH",     label: "Efectivo" },
  { value: "CARD",     label: "Tarjeta" },
  { value: "YAPE",     label: "Yape" },
  { value: "PLIN",     label: "Plin" },
  { value: "TRANSFER", label: "Transferencia" },
];

/** Código SUNAT → prefijo de serie */
const SERIE_PREFIX: Record<string, string> = {
  "01": "F",
  "03": "B",
  "07": "C",
  "08": "D",
};

const IGV_RATE = 0.18;

function computeTotals(items: LineItem[], globalDiscPct: number) {
  let totalGravado = 0;
  let totalIgv     = 0;
  let totalVenta   = 0;
  for (const i of items) {
    const price    = parseFloat(i.unit_price)   || 0;
    const discPct  = parseFloat(i.discount_pct) || 0;
    const lineTotal = price * i.quantity * (1 - discPct / 100);
    const isGravado = i.igv_code === "10";
    const base = isGravado ? lineTotal / (1 + IGV_RATE) : lineTotal;
    const igv  = isGravado ? lineTotal - base : 0;
    totalGravado += base;
    totalIgv     += igv;
    totalVenta   += lineTotal;
  }
  const globalDiscAmount = totalVenta * (globalDiscPct / 100);
  const totalFinal = Math.max(0, totalVenta - globalDiscAmount);
  return { totalGravado, totalIgv, totalVenta, globalDiscAmount, totalFinal };
}

function lineSubtotal(item: LineItem): number {
  const price   = parseFloat(item.unit_price)   || 0;
  const discPct = parseFloat(item.discount_pct) || 0;
  return price * item.quantity * (1 - discPct / 100);
}

// ── Header del comprobante ────────────────────────────────────────────────────

function ComprobanteHeader({
  businessUnitId,
  branchName,
}: {
  businessUnitId: string | null;
  branchName:     string;
}) {
  const { data: bu } = useBusinessUnit(businessUnitId ?? undefined);

  const logoUrl = businessUnitId && bu?.hasLogo
    ? `/v1/business-units/${businessUnitId}/logo`
    : null;

  const today = new Date().toLocaleDateString("es-PE", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });

  return (
    <div className="flex items-start gap-4 px-6 pt-5 pb-4 bg-gradient-to-r from-[#0a4b6e]/5 to-transparent border-b">
      {/* Logo */}
      <div className="shrink-0 w-20 h-16 rounded-lg border bg-white flex items-center justify-center overflow-hidden shadow-sm">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
        ) : (
          <Building2 className="h-8 w-8 text-muted-foreground/30" />
        )}
      </div>

      {/* Datos empresa */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[15px] text-foreground leading-tight">
          {bu?.name ?? branchName}
        </p>
        {bu?.ruc && (
          <p className="text-xs text-muted-foreground mt-0.5">RUC {bu.ruc}</p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
          {bu?.address && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" />{bu.address}
            </span>
          )}
          {bu?.phone && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Phone className="h-3 w-3" />{bu.phone}
            </span>
          )}
          {bu?.email && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Mail className="h-3 w-3" />{bu.email}
            </span>
          )}
        </div>
      </div>

      {/* Fechas */}
      <div className="shrink-0 text-right space-y-1">
        <div className="inline-block text-right">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Fec. Emisión</p>
          <p className="text-sm font-semibold tabular-nums">{today}</p>
        </div>
        <div className="inline-block text-right">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Fec. Vencimiento</p>
          <p className="text-sm font-semibold tabular-nums">{today}</p>
        </div>
      </div>
    </div>
  );
}

// ── Item search ───────────────────────────────────────────────────────────────

type AddItemPayload = Omit<LineItem, "key" | "quantity" | "discount_pct">;

function ItemSearch({ onAdd }: { onAdd: (item: AddItemPayload) => void }) {
  const [q,    setQ]    = useState("");
  const [open, setOpen] = useState(false);
  const hovering = useRef(false);
  const debouncedQ = useDebounce(q, 200);

  const { data: services } = useServices();
  const { data: products  } = useProducts({ active: true });

  const filteredServices = useMemo(() =>
    (services ?? []).filter(
      s => s.isActive &&
           (!debouncedQ || s.name.toLowerCase().includes(debouncedQ.toLowerCase()))
    ).slice(0, 10),
  [services, debouncedQ]);

  const filteredProducts = useMemo(() =>
    (products ?? []).filter(
      p => p.isActive &&
           (!debouncedQ ||
            p.name.toLowerCase().includes(debouncedQ.toLowerCase()) ||
            p.sku.toLowerCase().includes(debouncedQ.toLowerCase()))
    ).slice(0, 10),
  [products, debouncedQ]);

  const hasResults = filteredServices.length > 0 || filteredProducts.length > 0;

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          className="w-full h-9 pl-9 pr-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Buscar producto o servicio…"
          value={q}
          onFocus={() => setOpen(true)}
          onBlur={() => { if (!hovering.current) setOpen(false); }}
          onChange={e => setQ(e.target.value)}
        />
      </div>
      {open && q.length >= 1 && (
        <div
          className="absolute z-50 w-full mt-1 rounded-md border bg-background shadow-lg max-h-72 overflow-y-auto"
          onMouseEnter={() => { hovering.current = true; }}
          onMouseLeave={() => { hovering.current = false; }}
        >
          {!hasResults ? (
            <p className="text-sm text-muted-foreground text-center py-3">Sin resultados</p>
          ) : (
            <>
              {filteredServices.length > 0 && (
                <>
                  <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/50 sticky top-0">
                    Servicios
                  </p>
                  {filteredServices.map(s => (
                    <button
                      key={s.id} type="button" tabIndex={-1}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-4"
                      onClick={() => {
                        onAdd({
                          item_type:      "SERVICE",
                          service_id:     s.id,
                          label:          s.name,
                          unit_type_code: s.unitTypeCode       ?? "ZZ",
                          igv_code:       s.igvAffectationCode ?? "10",
                          unit_price:     String(Number(s.basePrice) || 0),
                        });
                        setQ(""); setOpen(false);
                      }}
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{fmt(s.basePrice)}</span>
                    </button>
                  ))}
                </>
              )}
              {filteredProducts.length > 0 && (
                <>
                  <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/50 sticky top-0">
                    Productos
                  </p>
                  {filteredProducts.map(p => (
                    <button
                      key={p.id} type="button" tabIndex={-1}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-4"
                      onClick={() => {
                        onAdd({
                          item_type:      "PRODUCT",
                          product_id:     p.id,
                          label:          p.name,
                          unit_type_code: p.unitTypeCode       ?? "NIU",
                          igv_code:       p.igvAffectationCode ?? "10",
                          unit_price:     String(parseFloat(p.salePrice) || 0),
                        });
                        setQ(""); setOpen(false);
                      }}
                    >
                      <div className="min-w-0">
                        <span className="font-medium">{p.name}</span>
                        {p.sku && <span className="text-xs text-muted-foreground ml-2">{p.sku}</span>}
                      </div>
                      <span className="text-xs font-semibold text-green-600 shrink-0">{fmt(p.salePrice)}</span>
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open:       boolean;
  onClose:    () => void;
  onSuccess?: (sale: Sale) => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export function NewSaleModal({ open, onClose, onSuccess }: Props) {
  const { activeBranchId } = useBranchContext();

  // Branch + Business unit data
  const { data: branch }       = useBranch(activeBranchId ?? undefined);
  const { data: buSeries }     = useBranchSeries(activeBranchId ?? "");
  const { data: openRegister } = useOpenRegister(activeBranchId ?? "");

  // Form state
  const [tipoComprobante, setTipoComprobante] = useState<TipoComprobante>("03");
  const [serieDocumento,  setSerieDocumento]  = useState("");
  const [customerSearch,  setCustomerSearch]  = useState("");
  const [customerId,      setCustomerId]      = useState("");
  const [customerName,    setCustomerName]    = useState("");
  const [customerDoc,     setCustomerDoc]     = useState("");
  const [billing,         setBilling]         = useState<CustomerBillingInput>({});
  const [showBilling,     setShowBilling]     = useState(false);
  const [items,           setItems]           = useState<LineItem[]>([]);
  const [globalDiscPct,   setGlobalDiscPct]   = useState("");
  const [paymentMethod,   setPaymentMethod]   = useState<PaymentMethod>("CASH");
  const [paymentSplits,   setPaymentSplits]   = useState<PaymentSplit[]>([
    { key: crypto.randomUUID(), method: "CASH", amount: "" },
  ]);
  const [notes, setNotes] = useState("");

  const hoveringCustomer = useRef(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const idemKey = useRef(crypto.randomUUID());

  const debouncedCSearch = useDebounce(customerSearch, 300);
  const createSale = useCreateSale();

  const { data: customerPage } = useCustomers({
    q:     debouncedCSearch || undefined,
    limit: 8,
  });
  const customers = customerPage?.data ?? [];

  // ── Series filtradas por tipo comprobante ────────────────────────────────

  const seriesForTipo = useMemo(() => {
    if (!buSeries) return [];
    return buSeries.filter(s => s.tipoDocumento === tipoComprobante);
  }, [buSeries, tipoComprobante]);

  // Auto-select first serie when tipo changes or series load
  useEffect(() => {
    if (seriesForTipo.length > 0) {
      setSerieDocumento(seriesForTipo[0].serie);
    } else {
      // fallback prefix
      const prefix = SERIE_PREFIX[tipoComprobante] ?? "X";
      setSerieDocumento(prev => {
        if (!prev) return `${prefix}001`;
        const currentPrefix = prev[0]?.toUpperCase();
        if (currentPrefix !== prefix) return `${prefix}001`;
        return prev;
      });
    }
  }, [seriesForTipo, tipoComprobante]);

  // ── Caja abierta ─────────────────────────────────────────────────────────

  const cashRegister = openRegister?.register ?? null;

  // ── Item helpers ──────────────────────────────────────────────────────────

  const addItem = useCallback((partial: AddItemPayload) => {
    setItems(prev => [...prev, { ...partial, key: crypto.randomUUID(), quantity: 1, discount_pct: "" }]);
  }, []);

  const removeItem = (key: string) => setItems(prev => prev.filter(i => i.key !== key));
  const updateItem = (key: string, field: keyof LineItem, value: any) =>
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));

  // ── Payment splits ────────────────────────────────────────────────────────

  const addSplit = () =>
    setPaymentSplits(prev => [...prev, { key: crypto.randomUUID(), method: "CASH", amount: "" }]);
  const removeSplit = (key: string) =>
    setPaymentSplits(prev => prev.filter(s => s.key !== key));
  const updateSplit = (key: string, field: keyof PaymentSplit, value: any) =>
    setPaymentSplits(prev => prev.map(s => s.key === key ? { ...s, [field]: value } : s));

  // ── Totals ────────────────────────────────────────────────────────────────

  const globalPct = parseFloat(globalDiscPct) || 0;
  const { totalGravado, totalIgv, totalVenta, globalDiscAmount, totalFinal } =
    useMemo(() => computeTotals(items, globalPct), [items, globalDiscPct]);

  const splitTotal = useMemo(
    () => paymentSplits.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0),
    [paymentSplits],
  );
  const splitDiff = Math.abs(splitTotal - totalFinal);

  // ── Validation ────────────────────────────────────────────────────────────

  const splitValid = paymentMethod !== "MIXED" || (paymentSplits.length > 0 && splitDiff < 0.02);
  const canSubmit  =
    !!activeBranchId &&
    items.length > 0 &&
    items.every(i => parseFloat(i.unit_price) > 0) &&
    splitValid;

  // ── Reset / close ─────────────────────────────────────────────────────────

  const handleClose = () => {
    setTipoComprobante("03");
    setSerieDocumento("");
    setCustomerSearch(""); setCustomerId(""); setCustomerName(""); setCustomerDoc("");
    setBilling({}); setShowBilling(false);
    setItems([]); setGlobalDiscPct(""); setPaymentMethod("CASH");
    setPaymentSplits([{ key: crypto.randomUUID(), method: "CASH", amount: "" }]);
    setNotes("");
    idemKey.current = crypto.randomUUID();
    onClose();
  };

  // ── Tipo comprobante change ───────────────────────────────────────────────

  const handleTipoChange = (t: TipoComprobante) => {
    setTipoComprobante(t);
    // serieDocumento is updated by the effect above
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const apiItems = items.map(i => {
      const price   = parseFloat(i.unit_price)   || 0;
      const discPct = parseFloat(i.discount_pct) || 0;
      const effPrice = price * (1 - discPct / 100);
      return {
        item_type:  i.item_type,
        product_id: i.product_id,
        service_id: i.service_id,
        quantity:   i.quantity,
        unit_price: parseFloat(effPrice.toFixed(4)),
      };
    });

    let notesText = notes.trim();
    if (paymentMethod === "MIXED" && paymentSplits.length > 0) {
      const splitNote = paymentSplits
        .map(s => `${SPLIT_OPTIONS.find(o => o.value === s.method)?.label ?? s.method}: S/ ${s.amount}`)
        .join(" | ");
      notesText = notesText ? `${notesText} | Pagos: ${splitNote}` : `Pagos: ${splitNote}`;
    }
    if (cashRegister) {
      const cajaNote = `Caja: ${cashRegister.id.slice(-6).toUpperCase()}`;
      notesText = notesText ? `${notesText} | ${cajaNote}` : cajaNote;
    }

    const input: CreateSaleInput = {
      branch_id:        activeBranchId!,
      customer_id:      customerId     || undefined,
      payment_method:   paymentMethod,
      discount_amount:  globalDiscAmount > 0 ? parseFloat(globalDiscAmount.toFixed(2)) : undefined,
      notes:            notesText || undefined,
      idempotency_key:  idemKey.current,
      tipo_comprobante: tipoComprobante,
      serie_documento:  serieDocumento.trim() || undefined,
      customer_billing: (billing.num_doc || billing.razon_social) ? billing : undefined,
      items: apiItems,
    };

    try {
      const sale = await createSale.mutateAsync(input);
      onSuccess?.(sale);
      handleClose();
    } catch { /* toasted by hook */ }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent
        className="max-w-5xl max-h-[94vh] overflow-y-auto flex flex-col p-0 gap-0"
        aria-describedby={undefined}
        onPointerDownOutside={e => e.preventDefault()}
      >
        {/* Title oculto para accesibilidad */}
        <DialogTitle className="sr-only">Nueva Venta</DialogTitle>

        {/* ── Header: Logo + Business Unit ─────────────────────────────── */}
        <ComprobanteHeader
          businessUnitId={branch?.businessUnitId ?? null}
          branchName={branch?.name ?? ""}
        />

        <div className="flex-1 overflow-y-auto">

          {/* ── Fila 1: Tipo + Serie + Caja ────────────────────────────── */}
          <div className="px-6 py-4 border-b bg-muted/20">
            <div className="grid grid-cols-4 gap-4">

              {/* Tipo de comprobante */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Tipo comprobante
                </Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                  value={tipoComprobante}
                  onChange={e => handleTipoChange(e.target.value as TipoComprobante)}
                >
                  <option value="03">🧾 Boleta electrónica</option>
                  <option value="01">📄 Factura electrónica</option>
                </select>
              </div>

              {/* Serie */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Serie
                </Label>
                {seriesForTipo.length > 0 ? (
                  <select
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                    value={serieDocumento}
                    onChange={e => setSerieDocumento(e.target.value)}
                  >
                    {seriesForTipo.map(s => (
                      <option key={s.id} value={s.serie}>
                        {s.serie}{s.contingencia ? " (Contingencia)" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                    placeholder={`${SERIE_PREFIX[tipoComprobante] ?? "X"}001`}
                    value={serieDocumento}
                    onChange={e => setSerieDocumento(e.target.value.toUpperCase())}
                  />
                )}
                {seriesForTipo.length === 0 && buSeries !== undefined && (
                  <p className="text-[10px] text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Sin series configuradas para este tipo
                  </p>
                )}
              </div>

              {/* Tipo operación */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Tipo operación
                </Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                  defaultValue="internal"
                >
                  <option value="internal">Venta interna</option>
                  <option value="export">Exportación</option>
                </select>
              </div>

              {/* Caja */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Caja
                </Label>
                {cashRegister ? (
                  <div className="flex h-10 items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3">
                    <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-green-800 truncate">
                        Caja #{cashRegister.id.slice(-6).toUpperCase()}
                      </p>
                      <p className="text-[10px] text-green-700 truncate">
                        Saldo: {fmt(cashRegister.current_balance ?? cashRegister.opening_balance)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-10 items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3">
                    <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                    <p className="text-xs text-amber-700">Sin caja abierta</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">

            {/* ② Cliente ────────────────────────────────────────────────── */}
            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Cliente <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>

              {customerId ? (
                <div className="flex items-center justify-between rounded-lg border px-4 py-2.5 bg-muted/20">
                  <div>
                    <p className="text-sm font-semibold">{customerName}</p>
                    {customerDoc && (
                      <p className="text-xs text-muted-foreground">Doc: {customerDoc}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setCustomerId(""); setCustomerName(""); setCustomerDoc(""); setCustomerSearch(""); }}
                    className="p-1 rounded hover:bg-muted transition-colors"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    className="w-full h-10 pl-9 pr-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
                    placeholder="Buscar por nombre, apellido o DNI…"
                    value={customerSearch}
                    onFocus={() => setCustomerOpen(true)}
                    onBlur={() => { if (!hoveringCustomer.current) setCustomerOpen(false); }}
                    onChange={e => setCustomerSearch(e.target.value)}
                  />
                  {customerOpen && customers.length > 0 && customerSearch.length >= 2 && (
                    <div
                      className="absolute z-50 w-full mt-1 rounded-lg border bg-background shadow-lg max-h-56 overflow-y-auto"
                      onMouseEnter={() => { hoveringCustomer.current = true; }}
                      onMouseLeave={() => { hoveringCustomer.current = false; }}
                    >
                      {customers.map(c => (
                        <button
                          key={c.id} type="button" tabIndex={-1}
                          className="w-full text-left px-4 py-2.5 hover:bg-accent transition-colors flex items-center justify-between gap-3"
                          onClick={() => {
                            setCustomerId(c.id);
                            setCustomerName(`${c.firstName} ${c.lastName}`);
                            setCustomerDoc(c.documentNumber ?? "");
                            setCustomerSearch("");
                            setCustomerOpen(false);
                            if (tipoComprobante === "01") {
                              setBilling({
                                razon_social: `${c.firstName} ${c.lastName}`,
                                num_doc:      c.documentNumber ?? "",
                                tipo_doc:     "1",
                              });
                              setShowBilling(true);
                            }
                          }}
                        >
                          <div>
                            <p className="text-sm font-medium">{c.firstName} {c.lastName}</p>
                            {c.documentNumber && (
                              <p className="text-xs text-muted-foreground">
                                {c.documentType ?? "DNI"}: {c.documentNumber}
                              </p>
                            )}
                          </div>
                          {c.phone && (
                            <span className="text-xs text-muted-foreground shrink-0">{c.phone}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Datos de facturación (Factura) */}
              {tipoComprobante === "01" && (
                <div className="rounded-lg border bg-muted/10">
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowBilling(!showBilling)}
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showBilling && "rotate-180")} />
                    Datos de facturación del receptor
                  </button>
                  {showBilling && (
                    <div className="px-4 pb-4 grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Tipo doc.</Label>
                        <select
                          className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none"
                          value={billing.tipo_doc ?? "6"}
                          onChange={e => setBilling(p => ({ ...p, tipo_doc: e.target.value }))}
                        >
                          <option value="1">DNI</option>
                          <option value="6">RUC</option>
                          <option value="4">CE</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">N° documento</Label>
                        <input
                          className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="20123456789"
                          value={billing.num_doc ?? ""}
                          onChange={e => setBilling(p => ({ ...p, num_doc: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Email</Label>
                        <input
                          className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="cliente@mail.com"
                          value={billing.email ?? ""}
                          onChange={e => setBilling(p => ({ ...p, email: e.target.value }))}
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs text-muted-foreground">Razón social / Nombres</Label>
                        <input
                          className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="EMPRESA XYZ S.A.C."
                          value={billing.razon_social ?? ""}
                          onChange={e => setBilling(p => ({ ...p, razon_social: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Dirección</Label>
                        <input
                          className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="Av. Principal 123"
                          value={billing.direccion ?? ""}
                          onChange={e => setBilling(p => ({ ...p, direccion: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* ③ Productos / Servicios ──────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Productos / Servicios <span className="text-destructive">*</span>
                </Label>
                {items.length > 0 && (
                  <span className="text-xs text-muted-foreground">{items.length} ítem(s)</span>
                )}
              </div>

              <ItemSearch onAdd={addItem} />

              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 border border-dashed rounded-lg text-muted-foreground">
                  <Plus className="h-5 w-5 mb-2 opacity-40" />
                  <p className="text-sm">Busca y agrega productos o servicios</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Descripción</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground w-14">Unidad</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground w-20">Cant.</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground w-28">P. Unit (c/IGV)</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground w-20">Desc. %</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground w-28">Subtotal</th>
                        <th className="w-9" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => {
                        const sub = lineSubtotal(item);
                        return (
                          <tr key={item.key} className="border-t hover:bg-muted/20 transition-colors">
                            <td className="px-3 py-2">
                              <p className="font-medium leading-tight">{item.label}</p>
                              <p className="text-muted-foreground text-[10px] mt-0.5">
                                {item.item_type === "SERVICE" ? "Servicio" : "Producto"}
                                {" · "}
                                {item.igv_code === "10" ? "Gravado" : item.igv_code === "20" ? "Exonerado" : "Inafecto"}
                              </p>
                            </td>
                            <td className="px-3 py-2 text-center text-muted-foreground">{item.unit_type_code}</td>
                            <td className="px-3 py-2">
                              <input
                                type="text" inputMode="numeric"
                                className="h-7 w-full text-center rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                value={item.quantity}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                  const v = parseInt(e.target.value) || 1;
                                  updateItem(item.key, "quantity", Math.max(1, Math.min(999, v)));
                                }}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">S/</span>
                                <input
                                  type="text" inputMode="decimal"
                                  className="h-7 w-full text-right rounded-md border border-input bg-background pl-6 pr-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                  placeholder="0.00"
                                  value={item.unit_price}
                                  onFocus={e => e.target.select()}
                                  onChange={e => {
                                    const v = e.target.value;
                                    if (v === "" || /^\d*\.?\d{0,4}$/.test(v))
                                      updateItem(item.key, "unit_price", v);
                                  }}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="relative">
                                <input
                                  type="text" inputMode="decimal"
                                  className="h-7 w-full text-right rounded-md border border-input bg-background pr-5 pl-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                  placeholder="0"
                                  value={item.discount_pct}
                                  onFocus={e => e.target.select()}
                                  onChange={e => {
                                    const v = e.target.value;
                                    if (v === "" || /^\d*\.?\d{0,2}$/.test(v))
                                      updateItem(item.key, "discount_pct", v);
                                  }}
                                />
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">%</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmt(sub)}</td>
                            <td className="px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeItem(item.key)}
                                className="p-1 rounded hover:bg-red-50 hover:text-red-500 text-muted-foreground transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <Separator />

            {/* ④ Pago + descuento + notas ───────────────────────────────── */}
            <div className="grid grid-cols-[1fr_300px] gap-6">

              {/* Método de pago */}
              <div className="space-y-3">
                <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Método de pago <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {ALL_PAYMENT_OPTIONS.map(o => (
                    <button
                      key={o.value} type="button"
                      onClick={() => {
                        setPaymentMethod(o.value);
                        if (o.value === "MIXED" && paymentSplits.length === 0) {
                          setPaymentSplits([{ key: crypto.randomUUID(), method: "CASH", amount: "" }]);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                        paymentMethod === o.value
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "hover:bg-muted text-muted-foreground"
                      )}
                    >
                      <span className="text-base shrink-0">{o.icon}</span>
                      <span className="truncate">{o.label}</span>
                    </button>
                  ))}
                </div>

                {/* Split rows */}
                {paymentMethod === "MIXED" && (
                  <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs font-semibold text-muted-foreground">Distribución de pagos</p>
                    {paymentSplits.map((split, idx) => (
                      <div key={split.key} className="flex items-center gap-2">
                        <select
                          className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none"
                          value={split.method}
                          onChange={e => updateSplit(split.key, "method", e.target.value as NonMixedMethod)}
                        >
                          {SPLIT_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <div className="relative w-32 shrink-0">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">S/</span>
                          <input
                            type="text" inputMode="decimal"
                            className="h-8 w-full rounded-md border border-input bg-background pl-6 pr-2 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring"
                            placeholder="0.00"
                            value={split.amount}
                            onFocus={e => {
                              e.target.select();
                              if (idx === paymentSplits.length - 1 && !split.amount) {
                                const used = paymentSplits.slice(0, -1)
                                  .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
                                const rem = Math.max(0, totalFinal - used);
                                if (rem > 0) updateSplit(split.key, "amount", rem.toFixed(2));
                              }
                            }}
                            onChange={e => {
                              const v = e.target.value;
                              if (v === "" || /^\d*\.?\d{0,2}$/.test(v))
                                updateSplit(split.key, "amount", v);
                            }}
                          />
                        </div>
                        {paymentSplits.length > 1 && (
                          <button type="button" onClick={() => removeSplit(split.key)}
                            className="p-1 rounded hover:bg-red-50 hover:text-red-500 text-muted-foreground transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={addSplit}
                      className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                      <Plus className="h-3.5 w-3.5" />
                      Agregar método de pago
                    </button>
                    <div className={cn(
                      "flex items-center justify-between text-xs pt-1 border-t",
                      splitDiff > 0.02 ? "text-amber-600" : "text-muted-foreground"
                    )}>
                      <div className="flex items-center gap-1">
                        {splitDiff > 0.02 && <AlertCircle className="h-3.5 w-3.5" />}
                        <span>Distribuido: {fmt(splitTotal)}</span>
                      </div>
                      <span>Total: {fmt(totalFinal)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Descuento global + notas */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Descuento global
                  </Label>
                  <div className="relative">
                    <input
                      type="text" inputMode="decimal"
                      className="flex h-10 w-full rounded-lg border border-input bg-background pr-8 pl-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                      placeholder="0.00"
                      value={globalDiscPct}
                      onChange={e => {
                        const v = e.target.value;
                        if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setGlobalDiscPct(v);
                      }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">%</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Notas
                  </Label>
                  <textarea
                    className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
                    rows={3}
                    placeholder="Observaciones…"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ⑤ Totales ──────────────────────────────────────────────────── */}
            {items.length > 0 && (
              <div className="rounded-xl border bg-muted/20 overflow-hidden">
                <div className="px-5 py-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>OP. Gravada</span>
                    <span className="tabular-nums font-mono">{fmt(totalGravado)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>IGV (18%)</span>
                    <span className="tabular-nums font-mono">{fmt(totalIgv)}</span>
                  </div>
                  {globalDiscAmount > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Descuento global ({globalPct}%)</span>
                      <span className="tabular-nums font-mono">− {fmt(globalDiscAmount)}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center px-5 py-3 bg-muted/40 border-t">
                  <span className="text-sm font-bold">TOTAL A PAGAR</span>
                  <span className="text-xl font-bold text-primary tabular-nums">{fmt(totalFinal)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t shrink-0 flex items-center gap-3 bg-muted/10">
          <Button variant="outline" onClick={handleClose} className="shrink-0">
            Cancelar
          </Button>
          <Button
            className="flex-1 h-10 text-sm font-semibold"
            disabled={!canSubmit || createSale.isPending}
            onClick={handleSubmit}
          >
            {createSale.isPending
              ? "Emitiendo comprobante…"
              : `Generar ${tipoComprobante === "03" ? "Boleta" : "Factura"} · ${fmt(totalFinal)}`
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

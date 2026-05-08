import { useState, useCallback, useRef } from "react";
import { Plus, Trash2, Search, X } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
  Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Textarea, Separator,
} from "@podoplus/ui";
import { useCreateSale, type CreateSaleInput, type ItemType, type PaymentMethod } from "@/hooks/use-sales";
import { useServices }  from "@/hooks/use-services";
import { useBranches }     from "@/hooks/use-branches";
import { useBranchContext } from "@/hooks/use-branch-context";
import { useCustomers } from "@/hooks/use-customers";
import { useDebounce }  from "@/hooks/use-debounce";
import { fmt }          from "@/lib/sale-helpers";
import { generateUUID } from "@/lib/uuid";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineItem {
  id:          string; // local key
  item_type:   ItemType;
  service_id?: string;
  quantity:    number;
  unit_price:  number;
  label:       string;
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH",     label: "💵 Efectivo" },
  { value: "CARD",     label: "💳 Tarjeta" },
  { value: "YAPE",     label: "📱 Yape" },
  { value: "PLIN",     label: "📱 Plin" },
  { value: "TRANSFER", label: "🏦 Transferencia" },
  { value: "MIXED",    label: "🔀 Mixto" },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open:    boolean;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NewSaleDrawer({ open, onClose }: Props) {
  const { activeBranchId }               = useBranchContext();
  const [branchId,       setBranchId]     = useState(() => activeBranchId ?? "");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId,     setCustomerId]     = useState("");
  const [customerName,   setCustomerName]   = useState("");
  const [items,          setItems]          = useState<LineItem[]>([]);
  const [discount,       setDiscount]       = useState("");
  const [paymentMethod,  setPaymentMethod]  = useState<PaymentMethod>("CASH");
  const [notes,          setNotes]          = useState("");
  const [serviceSearch,  setServiceSearch]  = useState("");

  // Idempotency key: stable per "session" of this drawer open, regenerated on close
  const idemKeyRef = useRef(generateUUID());

  const debouncedCustomerSearch = useDebounce(customerSearch, 300);
  const debouncedServiceSearch  = useDebounce(serviceSearch,  200);

  const createSale = useCreateSale();
  const { data: branches }  = useBranches();
  const { data: allServices } = useServices();
  const { data: customerPage } = useCustomers({
    q:     debouncedCustomerSearch || undefined,
    limit: 8,
  });

  const customers = customerPage?.data ?? [];

  // Filter active services by search term (client-side — list is small)
  const filteredServices = (allServices ?? []).filter(
    (s) =>
      s.isActive &&
      (!debouncedServiceSearch ||
        s.name.toLowerCase().includes(debouncedServiceSearch.toLowerCase())),
  );

  // Totals
  const subtotal  = items.reduce((acc, i) => acc + i.quantity * i.unit_price, 0);
  const discountN = parseFloat(discount) || 0;
  const total     = Math.max(0, subtotal - discountN);

  const addService = useCallback(
    (svc: { id: string; name: string; basePrice: number | string }) => {
      const price = typeof svc.basePrice === "string"
        ? parseFloat(svc.basePrice) || 0
        : svc.basePrice;
      setItems((prev) => [
        ...prev,
        {
          id:         `${svc.id}-${Date.now()}`,
          item_type:  "SERVICE",
          service_id: svc.id,
          quantity:   1,
          unit_price: price,
          label:      svc.name,
        },
      ]);
      setServiceSearch("");
    },
    [],
  );

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((i) => i.id !== id));

  const updateItem = (id: string, field: keyof LineItem, value: any) =>
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)),
    );

  const handleClose = () => {
    setBranchId(""); setCustomerSearch(""); setCustomerId("");
    setCustomerName(""); setItems([]); setDiscount("");
    setPaymentMethod("CASH"); setNotes(""); setServiceSearch("");
    idemKeyRef.current = generateUUID(); // new key for next open
    onClose();
  };

  const handleSubmit = async () => {
    if (!branchId || items.length === 0) return;

    const input: CreateSaleInput = {
      branch_id:        branchId,
      customer_id:      customerId || undefined,
      payment_method:   paymentMethod,
      discount_amount:  discountN > 0 ? discountN : undefined,
      notes:            notes.trim() || undefined,
      idempotency_key:  idemKeyRef.current,
      items: items.map((i) => ({
        item_type:  i.item_type,
        service_id: i.service_id,
        quantity:   i.quantity,
        unit_price: i.unit_price,
      })),
    };

    try {
      await createSale.mutateAsync(input);
      handleClose();
    } catch { /* toasted in hook */ }
  };

  const canSubmit =
    !!branchId && items.length > 0 && items.every((i) => i.unit_price > 0);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="right" className="w-full max-w-xl overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle>Nueva venta</SheetTitle>
          <SheetDescription>
            Registra una nueva venta de servicios o productos.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 py-4">

          {/* ── Sede ─────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>
              Sede <span className="text-destructive">*</span>
            </Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar sede…" />
              </SelectTrigger>
              <SelectContent>
                {branches?.filter((b) => b.isActive).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Cliente (opcional) ────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>
              Cliente{" "}
              <span className="text-xs text-muted-foreground">(opcional)</span>
            </Label>
            {customerId ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm bg-muted/20">
                <span className="font-medium">{customerName}</span>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setCustomerId("");
                    setCustomerName("");
                    setCustomerSearch("");
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar cliente por nombre o teléfono…"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
                {customers.length > 0 && customerSearch.length >= 2 && (
                  <div className="absolute z-20 w-full top-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                    {customers.map((c) => (
                      <button
                        key={c.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onClick={() => {
                          setCustomerId(c.id);
                          setCustomerName(`${c.firstName} ${c.lastName}`);
                          setCustomerSearch("");
                        }}
                      >
                        <span className="font-medium">
                          {c.firstName} {c.lastName}
                        </span>
                        {c.phone && (
                          <span className="text-muted-foreground ml-2">{c.phone}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* ── Servicios / ítems ─────────────────────────────────────── */}
          <div className="space-y-3">
            <Label>
              Servicios <span className="text-destructive">*</span>
            </Label>

            {/* Buscador de servicios */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar y agregar servicio…"
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
              />
              {serviceSearch && filteredServices.length > 0 && (
                <div className="absolute z-20 w-full top-full mt-1 bg-popover border rounded-md shadow-md max-h-52 overflow-y-auto">
                  {filteredServices.map((s) => (
                    <button
                      key={s.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-3"
                      onClick={() => addService(s)}
                    >
                      <span className="truncate">{s.name}</span>
                      <span className="text-muted-foreground text-xs shrink-0">
                        {fmt(s.basePrice)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {serviceSearch && filteredServices.length === 0 && (
                <div className="absolute z-20 w-full top-full mt-1 bg-popover border rounded-md shadow-md">
                  <p className="text-sm text-muted-foreground text-center py-3">
                    Sin resultados para "{serviceSearch}"
                  </p>
                </div>
              )}
            </div>

            {/* Lista de ítems del carrito */}
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 border border-dashed rounded-lg text-muted-foreground">
                <Plus className="h-6 w-6 mb-1 opacity-40" />
                <p className="text-sm">Busca y agrega servicios para continuar</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-lg border p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.label}</p>
                    </div>

                    {/* Cantidad */}
                    <div className="w-14">
                      <Input
                        type="number"
                        min="1"
                        max="99"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(
                            item.id,
                            "quantity",
                            Math.max(1, parseInt(e.target.value) || 1),
                          )
                        }
                        className="h-8 text-center text-sm px-1"
                      />
                    </div>

                    {/* Precio unitario */}
                    <div className="w-24 relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        S/
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={item.unit_price || ""}
                        onChange={(e) =>
                          updateItem(
                            item.id,
                            "unit_price",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="h-8 text-sm pl-6 pr-1"
                      />
                    </div>

                    {/* Subtotal */}
                    <div className="w-20 text-right text-sm font-medium text-muted-foreground">
                      {fmt(item.quantity * item.unit_price)}
                    </div>

                    {/* Eliminar */}
                    <button
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* ── Descuento + método de pago ────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="discount">Descuento</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  S/
                </span>
                <Input
                  id="discount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-8"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>
                Método de pago <span className="text-destructive">*</span>
              </Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Notas ─────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">
              Notas{" "}
              <span className="text-xs text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="notes"
              placeholder="Observaciones adicionales…"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* ── Resumen de totales ────────────────────────────────────── */}
          {items.length > 0 && (
            <div className="rounded-lg bg-muted/40 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{fmt(subtotal)}</span>
              </div>
              {discountN > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Descuento</span>
                  <span>- {fmt(discountN)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-base pt-1.5 border-t mt-1">
                <span>Total a cobrar</span>
                <span>{fmt(total)}</span>
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="pt-2 border-t gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={!canSubmit || createSale.isPending}
            onClick={handleSubmit}
          >
            {createSale.isPending
              ? "Registrando…"
              : `Registrar · ${fmt(total)}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

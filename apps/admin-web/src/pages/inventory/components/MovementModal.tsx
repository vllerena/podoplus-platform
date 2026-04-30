import { useState } from "react";
import { ArrowLeftRight, SlidersHorizontal } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Button, Input, Label, Textarea,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@podoplus/ui";
import { useRegisterMovement, useProducts, type RegisterMovementInput } from "@/hooks/use-inventory";
import { useBranches } from "@/hooks/use-appointments";

type ActionType = "TRANSFER_OUT" | "ADJUSTMENT";

interface Props {
  branchId:    string;
  productId?:  string;
  defaultType?: ActionType;
  open:        boolean;
  onClose:     () => void;
}

const TYPE_CONFIG: Record<ActionType, { label: string; icon: React.ElementType; description: string }> = {
  TRANSFER_OUT: {
    label:       "Traslado entre sedes",
    icon:        ArrowLeftRight,
    description: "Transfiere unidades de esta sede a otra. El stock destino se incrementa automáticamente.",
  },
  ADJUSTMENT: {
    label:       "Ajuste de stock",
    icon:        SlidersHorizontal,
    description: "Establece la cantidad absoluta final para este producto en esta sede.",
  },
};

export function MovementModal({
  branchId,
  productId: preProduct,
  defaultType = "TRANSFER_OUT",
  open,
  onClose,
}: Props) {
  const [type,            setType]            = useState<ActionType>(defaultType);
  const [selectedProduct, setSelectedProduct] = useState(preProduct ?? "");
  const [quantity,        setQuantity]        = useState("");
  const [reason,          setReason]          = useState("");
  const [targetBranch,    setTargetBranch]    = useState("");

  const mutation = useRegisterMovement();
  const { data: branches }     = useBranches();
  const { data: productsData } = useProducts({ active: true, limit: 500 });
  const products = productsData?.data ?? [];

  const otherBranches = (branches ?? []).filter((b) => b.isActive && b.id !== branchId);
  const cfg = TYPE_CONFIG[type];
  const Icon = cfg.icon;

  const handleClose = () => {
    setType(defaultType);
    setSelectedProduct(preProduct ?? "");
    setQuantity("");
    setReason("");
    setTargetBranch("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 0 || !selectedProduct) return;
    if (type === "TRANSFER_OUT" && !targetBranch) return;

    try {
      await mutation.mutateAsync({
        branch_id:        branchId,
        product_id:       selectedProduct,
        type,
        quantity:         qty,
        reason:           reason.trim() || undefined,
        target_branch_id: type === "TRANSFER_OUT" ? targetBranch : undefined,
      } as RegisterMovementInput);
      handleClose();
    } catch { /* toasted in hook */ }
  };

  const canSubmit =
    !!selectedProduct &&
    quantity !== "" &&
    parseInt(quantity, 10) >= 0 &&
    (type !== "TRANSFER_OUT" || !!targetBranch);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {cfg.label}
          </DialogTitle>
          <DialogDescription>{cfg.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Tipo switcher */}
          <div className="flex rounded-lg border overflow-hidden">
            {(["TRANSFER_OUT", "ADJUSTMENT"] as ActionType[]).map((t, i) => {
              const c = TYPE_CONFIG[t];
              const TIcon = c.icon;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={[
                    "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors",
                    type === t
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground",
                    i > 0 ? "border-l" : "",
                  ].join(" ")}
                >
                  <TIcon className="h-3.5 w-3.5" />
                  {t === "TRANSFER_OUT" ? "Traslado" : "Ajuste"}
                </button>
              );
            })}
          </div>

          {/* Producto */}
          <div className="space-y-1.5">
            <Label>Producto <span className="text-destructive">*</span></Label>
            <Select
              value={selectedProduct}
              onValueChange={setSelectedProduct}
              disabled={!!preProduct}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar producto…" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground ml-1 text-xs">({p.sku})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sede destino — solo para TRANSFER_OUT */}
          {type === "TRANSFER_OUT" && (
            <div className="space-y-1.5">
              <Label>Sede destino <span className="text-destructive">*</span></Label>
              <Select value={targetBranch} onValueChange={setTargetBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sede destino…" />
                </SelectTrigger>
                <SelectContent>
                  {otherBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Cantidad */}
          <div className="space-y-1.5">
            <Label htmlFor="mov-qty">
              {type === "ADJUSTMENT" ? "Cantidad final absoluta" : "Cantidad a trasladar"}
              <span className="text-destructive"> *</span>
            </Label>
            {type === "ADJUSTMENT" && (
              <p className="text-xs text-muted-foreground">
                El stock quedará exactamente en este valor (0 = vaciar).
              </p>
            )}
            <Input
              id="mov-qty"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              autoFocus={!preProduct}
            />
          </div>

          {/* Motivo */}
          <div className="space-y-1.5">
            <Label htmlFor="mov-reason">
              Motivo / Referencia
              <span className="text-muted-foreground text-xs ml-1">(opcional)</span>
            </Label>
            <Input
              id="mov-reason"
              placeholder="Ej. Ajuste por conteo físico, NT20-15"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
          </div>

          <DialogFooter className="pt-1 gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit || mutation.isPending} className="min-w-[120px]">
              {mutation.isPending
                ? "Registrando…"
                : type === "TRANSFER_OUT"
                  ? "Trasladar"
                  : "Ajustar stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, Button, Input, Textarea, Label,
} from "@podoplus/ui";
import { useRefundSale } from "@/hooks/use-sales";
import type { Sale } from "@/hooks/use-sales";
import { fmt } from "@/lib/sale-helpers";

interface Props {
  sale:    Sale | null;
  onClose: () => void;
}

export function RefundModal({ sale, onClose }: Props) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const refundSale = useRefundSale();

  const maxAmount  = sale ? parseFloat(sale.total_amount) : 0;
  const amountNum  = parseFloat(amount) || 0;
  const amountValid = amountNum >= 0.01 && amountNum <= maxAmount;
  const reasonValid = reason.trim().length >= 3;
  const canSubmit   = amountValid && reasonValid;

  const handleConfirm = async () => {
    if (!sale || !canSubmit) return;
    try {
      await refundSale.mutateAsync({ id: sale.id, amount: amountNum, reason: reason.trim() });
      setAmount("");
      setReason("");
      onClose();
    } catch { /* toasted in hook */ }
  };

  const handleClose = () => {
    setAmount("");
    setReason("");
    onClose();
  };

  return (
    <Dialog open={!!sale} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reembolsar venta</DialogTitle>
          <DialogDescription>
            Ingresa el monto a reembolsar y el motivo. El estado pasará a <strong>Reembolsada</strong>.
          </DialogDescription>
        </DialogHeader>

        {sale && (
          <div className="space-y-4 py-1">
            {/* Resumen */}
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Venta</span>
                <span className="font-mono">#{sale.id.slice(-8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total pagado</span>
                <span className="font-semibold">{fmt(sale.total_amount)}</span>
              </div>
              {sale.customer_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente</span>
                  <span>{sale.customer_name}</span>
                </div>
              )}
            </div>

            {/* Monto */}
            <div className="space-y-1.5">
              <Label htmlFor="refund-amount">
                Monto a reembolsar <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">S/</span>
                <Input
                  id="refund-amount"
                  type="number"
                  min="0.01"
                  max={maxAmount}
                  step="0.01"
                  placeholder="0.00"
                  className="pl-8"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Máximo: {fmt(sale.total_amount)}</span>
                {amount && !amountValid && (
                  <span className="text-destructive">
                    {amountNum < 0.01 ? "Monto mínimo: S/ 0.01" : `Máximo: ${fmt(maxAmount)}`}
                  </span>
                )}
              </div>
            </div>

            {/* Motivo */}
            <div className="space-y-1.5">
              <Label htmlFor="refund-reason">
                Motivo del reembolso <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="refund-reason"
                placeholder="Describe el motivo del reembolso (mín. 3 caracteres)..."
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            disabled={!canSubmit || refundSale.isPending}
            onClick={handleConfirm}
          >
            {refundSale.isPending ? "Procesando..." : "Confirmar reembolso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

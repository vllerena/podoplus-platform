import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, Button, Textarea, Label,
} from "@podoplus/ui";
import { useVoidSale } from "@/hooks/use-sales";
import type { Sale } from "@/hooks/use-sales";
import { fmt } from "@/lib/sale-helpers";

interface Props {
  sale:    Sale | null;
  onClose: () => void;
}

export function VoidModal({ sale, onClose }: Props) {
  const [reason, setReason] = useState("");
  const voidSale = useVoidSale();

  const handleConfirm = async () => {
    if (!sale || reason.trim().length < 3) return;
    try {
      await voidSale.mutateAsync({ id: sale.id, reason: reason.trim() });
      setReason("");
      onClose();
    } catch { /* toasted in hook */ }
  };

  return (
    <Dialog open={!!sale} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Anular venta</DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. La venta pasará a estado <strong>Anulada</strong> y
            se restaurará el inventario.
          </DialogDescription>
        </DialogHeader>

        {sale && (
          <div className="space-y-4 py-1">
            {/* Resumen de la venta */}
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Venta</span>
                <span className="font-mono">#{sale.id.slice(-8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">{fmt(sale.total_amount)}</span>
              </div>
              {sale.customer_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente</span>
                  <span>{sale.customer_name}</span>
                </div>
              )}
            </div>

            {/* Motivo */}
            <div className="space-y-1.5">
              <Label htmlFor="void-reason">
                Motivo de anulación <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="void-reason"
                placeholder="Describe el motivo de la anulación (mín. 3 caracteres)..."
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              {reason.length > 0 && reason.length < 3 && (
                <p className="text-xs text-destructive">Mínimo 3 caracteres</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3 || voidSale.isPending}
            onClick={handleConfirm}
          >
            {voidSale.isPending ? "Anulando..." : "Confirmar anulación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

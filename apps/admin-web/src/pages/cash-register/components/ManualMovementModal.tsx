import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Button, Input, Label,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@podoplus/ui";
import { useAddManualMovement, type MovementType } from "@/hooks/use-cash-register";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  registerId: string;
  open:       boolean;
  onClose:    () => void;
}

export function ManualMovementModal({ registerId, open, onClose }: Props) {
  const [type,   setType]   = useState<MovementType>("IN");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const mutation = useAddManualMovement();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return;
    try {
      await mutation.mutateAsync({ registerId, type, amount: num, reason });
      setAmount("");
      setReason("");
      setType("IN");
      onClose();
    } catch { /* toasted in hook */ }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Movimiento manual de caja</DialogTitle>
          <DialogDescription>
            Registra un ingreso o egreso manual (fondos, vuelto, gastos, retiros, etc.)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Type selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("IN")}
              className={cn(
                "flex items-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-colors",
                type === "IN"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-muted hover:border-muted-foreground/40 text-muted-foreground"
              )}
            >
              <ArrowDownCircle className="h-5 w-5" />
              Ingreso
            </button>
            <button
              type="button"
              onClick={() => setType("OUT")}
              className={cn(
                "flex items-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-colors",
                type === "OUT"
                  ? "border-red-500 bg-red-50 text-red-600"
                  : "border-muted hover:border-muted-foreground/40 text-muted-foreground"
              )}
            >
              <ArrowUpCircle className="h-5 w-5" />
              Egreso
            </button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mov-amount">Monto (S/)</Label>
            <Input
              id="mov-amount"
              type="number"
              min="0.01"
              max="999999.99"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mov-reason">Motivo</Label>
            <Input
              id="mov-reason"
              placeholder="Ej. Retiro para pago de proveedor"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={3}
              maxLength={500}
              required
            />
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !amount || !reason}
              className={cn(
                type === "OUT" && "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
              )}
            >
              {mutation.isPending
                ? "Registrando…"
                : type === "IN" ? "Registrar ingreso" : "Registrar egreso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

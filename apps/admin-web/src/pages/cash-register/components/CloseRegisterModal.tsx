import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Button, Input, Label,
} from "@podoplus/ui";
import { useCloseRegister, type CashRegister } from "@/hooks/use-cash-register";
import { cn } from "@/lib/utils";

interface Props {
  register: CashRegister;
  open:     boolean;
  onClose:  () => void;
}

function fmt(v?: string | null) {
  return v ? `S/ ${parseFloat(v).toFixed(2)}` : "—";
}

export function CloseRegisterModal({ register, open, onClose }: Props) {
  const [reported, setReported] = useState("");
  const [notes,    setNotes]    = useState(register.notes ?? "");

  const mutation = useCloseRegister();

  const systemBalance = parseFloat(register.current_balance ?? register.opening_balance ?? "0");
  const reportedNum   = parseFloat(reported) || 0;
  const diff          = reportedNum - systemBalance;
  const hasDiff       = reported !== "" && !isNaN(parseFloat(reported));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(reported);
    if (isNaN(amount) || amount < 0) return;
    try {
      await mutation.mutateAsync({
        registerId:               register.id,
        closing_balance_reported: amount,
        notes:                    notes || undefined,
      });
      setReported("");
      setNotes("");
      onClose();
    } catch { /* toasted in hook */ }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cerrar caja</DialogTitle>
          <DialogDescription>
            Ingresa el balance físico contado para realizar el cuadre de caja.
          </DialogDescription>
        </DialogHeader>

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-2 text-sm rounded-lg bg-muted/50 p-3">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Saldo inicial</p>
            <p className="font-semibold">{fmt(register.opening_balance)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Ingresos</p>
            <p className="font-semibold text-green-600">+{fmt(register.total_in)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Egresos</p>
            <p className="font-semibold text-red-500">-{fmt(register.total_out)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm font-medium px-1">
          <span className="text-muted-foreground">Balance del sistema</span>
          <span className="text-base font-bold">{fmt(register.current_balance)}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="closing-balance">Balance físico contado (S/)</Label>
            <Input
              id="closing-balance"
              type="number"
              min="0"
              max="999999.99"
              step="0.01"
              placeholder="0.00"
              value={reported}
              onChange={(e) => setReported(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Difference preview */}
          {hasDiff && (
            <div className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium",
              diff === 0 ? "bg-green-50 text-green-700" :
              diff > 0   ? "bg-blue-50 text-blue-700"   : "bg-red-50 text-red-600"
            )}>
              <span>Diferencia</span>
              <span>
                {diff >= 0 ? "+" : ""}S/ {Math.abs(diff).toFixed(2)}
                {diff === 0 && " (sin diferencia)"}
                {diff > 0  && " (sobrante)"}
                {diff < 0  && " (faltante)"}
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="close-notes">Notas (opcional)</Label>
            <Input
              id="close-notes"
              placeholder="Ej. Cierre turno tarde. Sin diferencias."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
            />
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={mutation.isPending || !reported}>
              {mutation.isPending ? "Cerrando…" : "Confirmar cierre"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

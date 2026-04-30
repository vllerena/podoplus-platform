import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Button, Input, Label,
} from "@podoplus/ui";
import { useOpenRegisterMutation } from "@/hooks/use-cash-register";

interface Props {
  branchId:   string;
  branchName: string;
  open:       boolean;
  onClose:    () => void;
}

export function OpenRegisterModal({ branchId, branchName, open, onClose }: Props) {
  const [balance, setBalance] = useState("");
  const [notes,   setNotes]   = useState("");

  const mutation = useOpenRegisterMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(balance);
    if (isNaN(amount) || amount < 0) return;
    try {
      await mutation.mutateAsync({ branch_id: branchId, opening_balance: amount, notes: notes || undefined });
      setBalance("");
      setNotes("");
      onClose();
    } catch { /* toasted in hook */ }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Abrir caja — {branchName}</DialogTitle>
          <DialogDescription>
            Ingresa el saldo inicial en efectivo para abrir la caja del día.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="opening-balance">Saldo inicial (S/)</Label>
            <Input
              id="opening-balance"
              type="number"
              min="0"
              max="999999.99"
              step="0.01"
              placeholder="0.00"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="open-notes">Notas (opcional)</Label>
            <Input
              id="open-notes"
              placeholder="Ej. Apertura turno mañana"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending || !balance}>
              {mutation.isPending ? "Abriendo…" : "Abrir caja"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

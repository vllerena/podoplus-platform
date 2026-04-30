import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, Button, Textarea, Label,
} from "@podoplus/ui";
import { useCancelSubscription } from "@/hooks/use-plans";
import type { Subscription } from "@/hooks/use-plans";

interface Props {
  subscription: Subscription | null;
  onClose:      () => void;
}

export function CancelSubscriptionModal({ subscription, onClose }: Props) {
  const [reason, setReason] = useState("");
  const cancel = useCancelSubscription();

  const handleConfirm = async () => {
    if (!subscription || reason.trim().length < 3) return;
    try {
      await cancel.mutateAsync({ id: subscription.id, reason: reason.trim() });
      setReason("");
      onClose();
    } catch { /* toasted in hook */ }
  };

  const handleClose = () => {
    setReason("");
    onClose();
  };

  return (
    <Dialog open={!!subscription} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar suscripción</DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. La suscripción pasará a estado{" "}
            <strong>Cancelada</strong> permanentemente.
          </DialogDescription>
        </DialogHeader>

        {subscription && (
          <div className="space-y-4 py-1">
            {/* Resumen */}
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-medium">{subscription.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span>{subscription.planName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vence</span>
                <span>{new Date(subscription.endDate).toLocaleDateString("es-PE", {
                  day: "2-digit", month: "short", year: "numeric",
                })}</span>
              </div>
            </div>

            {/* Motivo */}
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason">
                Motivo de cancelación <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="cancel-reason"
                placeholder="Describe el motivo de la cancelación (mín. 3 caracteres)…"
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
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3 || cancel.isPending}
            onClick={handleConfirm}
          >
            {cancel.isPending ? "Cancelando…" : "Confirmar cancelación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

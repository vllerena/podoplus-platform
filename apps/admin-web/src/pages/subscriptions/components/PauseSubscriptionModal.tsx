import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, Button, Textarea, Label,
} from "@podoplus/ui";
import { usePauseSubscription } from "@/hooks/use-plans";
import type { Subscription } from "@/hooks/use-plans";

interface Props {
  subscription: Subscription | null;
  onClose:      () => void;
}

export function PauseSubscriptionModal({ subscription, onClose }: Props) {
  const [reason, setReason] = useState("");
  const pause = usePauseSubscription();

  const handleConfirm = async () => {
    if (!subscription) return;
    try {
      await pause.mutateAsync({ id: subscription.id, reason: reason.trim() || undefined });
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
          <DialogTitle>Pausar suscripción</DialogTitle>
          <DialogDescription>
            La suscripción quedará <strong>Pausada</strong>. Al reanudarla, la
            fecha de vencimiento se extenderá por los días que estuvo pausada.
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

            {/* Motivo (opcional) */}
            <div className="space-y-1.5">
              <Label htmlFor="pause-reason">
                Motivo{" "}
                <span className="text-xs text-muted-foreground">(opcional)</span>
              </Label>
              <Textarea
                id="pause-reason"
                placeholder="Viaje, tratamiento médico, etc."
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            disabled={pause.isPending}
            onClick={handleConfirm}
          >
            {pause.isPending ? "Pausando…" : "Pausar suscripción"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

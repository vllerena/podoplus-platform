import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useCancelAppointment } from "@/hooks/use-appointment-actions";
import { formatTime, formatDate, cn } from "@/lib/utils";
import type { Appointment } from "@/hooks/use-appointments";

interface CancelModalProps {
  appointment: Appointment | null;
  onClose:     () => void;
}

export function CancelModal({ appointment, onClose }: CancelModalProps) {
  const [reason, setReason] = useState("");
  const cancel = useCancelAppointment();

  if (!appointment) return null;

  const customerName = appointment.customer
    ? `${appointment.customer.firstName} ${appointment.customer.lastName}`
    : "Cliente";

  const handleConfirm = async () => {
    try {
      await cancel.mutateAsync({ id: appointment.id, body: { reason } });
      setReason("");
      onClose();
    } catch { /* toasted in hook */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Cancelar cita</h2>
          <p className="text-sm text-muted-foreground mt-1">Esta acción no se puede deshacer.</p>
        </div>

        {/* Appointment summary */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-1">
          <p className="text-sm font-medium text-gray-900">{customerName}</p>
          <p className="text-sm text-gray-600">{appointment.service?.name ?? "Servicio"}</p>
          <p className="text-sm text-gray-500">
            {formatDate(appointment.startAt)} · {formatTime(appointment.startAt)}
          </p>
        </div>

        {/* Reason */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">
            Motivo <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: El cliente solicitó cancelación..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* Error */}
        {cancel.error && (
          <p className="text-sm text-red-600">{cancel.error.message}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Mantener cita
          </button>
          <button
            onClick={handleConfirm}
            disabled={cancel.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {cancel.isPending && <Loader2 size={14} className="animate-spin" />}
            Cancelar cita
          </button>
        </div>
      </div>
    </div>
  );
}

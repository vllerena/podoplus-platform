import { useState } from "react";
import { MoreHorizontal, Ban, UserX, Clock } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import {
  PRIMARY_ACTION,
  PRIMARY_ACTION_LABEL,
  type AppointmentStatus,
  isActive,
} from "@/lib/appointment-status";
import {
  useConfirmAppointment,
  useCheckInAppointment,
  useStartAppointment,
  useCompleteAppointment,
  useNoShowAppointment,
} from "@/hooks/use-appointment-actions";
import { AppointmentStatusBadge } from "./AppointmentStatusBadge";
import type { Appointment } from "@/hooks/use-appointments";

interface AppointmentRowProps {
  appointment:     Appointment;
  onCancel:        (appointment: Appointment) => void;
  onReschedule:    (appointment: Appointment) => void;
}

export function AppointmentRow({ appointment, onCancel, onReschedule }: AppointmentRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const status = appointment.status as AppointmentStatus;
  const primaryAction = PRIMARY_ACTION[status];

  const confirmMutation   = useConfirmAppointment();
  const checkinMutation   = useCheckInAppointment();
  const startMutation     = useStartAppointment();
  const completeMutation  = useCompleteAppointment();
  const noShowMutation    = useNoShowAppointment();

  const mutationMap = {
    "confirm":  confirmMutation,
    "check-in": checkinMutation,
    "start":    startMutation,
    "complete": completeMutation,
  };

  const handlePrimaryAction = () => {
    if (!primaryAction || !(primaryAction in mutationMap)) return;
    mutationMap[primaryAction as keyof typeof mutationMap].mutate({ id: appointment.id });
  };

  const isLoading = Object.values(mutationMap).some((m) => m.isPending) || noShowMutation.isPending;

  const customerName = appointment.customer
    ? `${appointment.customer.firstName} ${appointment.customer.lastName}`
    : "—";

  const serviceName = appointment.service?.name ?? "—";

  return (
    <tr className="hover:bg-gray-50 transition-colors border-b last:border-0">
      {/* Hora */}
      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
        {formatTime(appointment.startAt)}
        <span className="text-gray-400 font-normal"> – {formatTime(appointment.endAt)}</span>
      </td>

      {/* Cliente */}
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-gray-900">{customerName}</p>
        {appointment.customer?.phone && (
          <p className="text-xs text-muted-foreground">{appointment.customer.phone}</p>
        )}
      </td>

      {/* Servicio */}
      <td className="px-4 py-3 text-sm text-gray-600">{serviceName}</td>

      {/* Estado */}
      <td className="px-4 py-3">
        <AppointmentStatusBadge status={appointment.status} />
      </td>

      {/* Acciones */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Primary action button */}
          {primaryAction && primaryAction in mutationMap && (
            <button
              onClick={handlePrimaryAction}
              disabled={isLoading}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50",
                primaryAction === "confirm"  && "bg-blue-600 text-white hover:bg-blue-700",
                primaryAction === "check-in" && "bg-purple-600 text-white hover:bg-purple-700",
                primaryAction === "start"    && "bg-indigo-600 text-white hover:bg-indigo-700",
                primaryAction === "complete" && "bg-green-600 text-white hover:bg-green-700",
              )}
            >
              {PRIMARY_ACTION_LABEL[primaryAction]}
            </button>
          )}

          {/* More menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <MoreHorizontal size={16} />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-44 bg-white border rounded-lg shadow-lg py-1 text-sm">
                  {isActive(status) && (
                    <>
                      {(status === "PENDING" || status === "CONFIRMED") && (
                        <button
                          className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-gray-700"
                          onClick={() => { setMenuOpen(false); onReschedule(appointment); }}
                        >
                          <Clock size={14} className="text-orange-500" />
                          Reprogramar
                        </button>
                      )}
                      {status === "CONFIRMED" && (
                        <button
                          className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-gray-700"
                          onClick={() => { setMenuOpen(false); noShowMutation.mutate({ id: appointment.id }); }}
                        >
                          <UserX size={14} className="text-gray-500" />
                          No asistió
                        </button>
                      )}
                      <button
                        className="flex items-center gap-2 w-full px-3 py-2 hover:bg-red-50 text-red-600"
                        onClick={() => { setMenuOpen(false); onCancel(appointment); }}
                      >
                        <Ban size={14} />
                        Cancelar cita
                      </button>
                    </>
                  )}
                  {!isActive(status) && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">Sin acciones disponibles</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

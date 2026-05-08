import { useState, useEffect } from "react";
import {
  Clock, MapPin, User, Calendar, FileText,
  CheckCircle2, XCircle, AlertCircle, CalendarClock, ArrowRight,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
  Button, Skeleton, Separator, Textarea, Badge,
} from "@podoplus/ui";
import { useAppointment, type Appointment } from "@/hooks/use-appointments";
import {
  useConfirmAppointment, useCheckInAppointment, useStartAppointment,
  useCompleteAppointment, useCancelAppointment, useNoShowAppointment,
} from "@/hooks/use-appointment-actions";
import { RescheduleModal } from "./RescheduleModal";
import {
  type AppointmentStatus,
  STATUS_LABEL, STATUS_COLOR, STATUS_DOT,
  PRIMARY_ACTION, PRIMARY_ACTION_LABEL,
  TERMINAL_STATUSES,
} from "@/lib/appointment-status";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  const d = new Date(iso);
  // timeZone: "UTC" muestra la hora naive Lima almacenada en el campo UTC.
  return d.toLocaleTimeString("es-PE", {
    hour: "numeric", minute: "2-digit", hour12: true,
    timeZone: "UTC",
  });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-PE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: "UTC",
  });
}

function durationLabel(startIso: string, endIso: string): string {
  const mins = Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000,
  );
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins}m`;
}

// ── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium mt-0.5 break-words">{value}</div>
      </div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

const PROGRESS_STEPS: AppointmentStatus[] = [
  "PENDING", "CONFIRMED", "CHECKED_IN", "IN_SERVICE", "COMPLETED",
];

const STEP_LABELS: Record<string, string> = {
  PENDING:    "Pendiente",
  CONFIRMED:  "Confirmada",
  CHECKED_IN: "Llegó",
  IN_SERVICE: "En atención",
  COMPLETED:  "Completada",
};

function StatusProgress({ status }: { status: string }) {
  const currentIdx = PROGRESS_STEPS.indexOf(status as AppointmentStatus);
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1">
        {PROGRESS_STEPS.map((s, i) => {
          const isDone    = i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className={`h-1.5 w-full rounded-full transition-all ${
                isDone    ? "bg-primary" :
                isCurrent ? "bg-primary/50" :
                "bg-muted"
              }`} />
              <span className={`text-[9px] font-medium hidden sm:block ${
                isCurrent ? "text-primary" : isDone ? "text-primary/60" : "text-muted-foreground/50"
              }`}>
                {STEP_LABELS[s]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  appointmentId: string | null;
  onClose:       () => void;
  /**
   * Callback disparado cuando la cita pasa a COMPLETED.
   * El padre puede usar estos datos para abrir el modal de nueva venta
   * precargado con el paciente y el servicio de la cita.
   */
  onCompleted?:  (appt: Appointment) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AppointmentDetailSheet({ appointmentId, onClose, onCompleted }: Props) {
  const [cancelReason,   setCancelReason]   = useState("");
  const [showCancel,     setShowCancel]     = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);

  // Permite navegar internamente a la nueva cita sin cerrar el Sheet
  const [currentId, setCurrentId] = useState<string | null>(appointmentId);

  // Sincroniza cuando el padre cambia el appointmentId (nueva cita abierta desde el calendario)
  useEffect(() => {
    setCurrentId(appointmentId);
    setCancelReason("");
    setShowCancel(false);
    setShowReschedule(false);
  }, [appointmentId]);

  const { data: appt, isLoading } = useAppointment(currentId ?? "");

  const confirm  = useConfirmAppointment();
  const checkIn  = useCheckInAppointment();
  const start    = useStartAppointment();
  const complete = useCompleteAppointment();
  const cancel   = useCancelAppointment();
  const noShow   = useNoShowAppointment();

  const isOpen = !!appointmentId;

  const handleClose = () => {
    setCancelReason("");
    setShowCancel(false);
    setShowReschedule(false);
    setCurrentId(null);
    onClose();
  };

  const handlePrimaryAction = () => {
    if (!appt) return;
    const action = PRIMARY_ACTION[appt.status as AppointmentStatus];
    const id = appt.id;
    switch (action) {
      case "confirm":  confirm.mutate({ id }); break;
      case "check-in": checkIn.mutate({ id }); break;
      case "start":    start.mutate({ id });   break;
      case "complete":
        // Capturamos appt en el closure: al completar con éxito cerramos el
        // sheet y notificamos al padre para que abra el modal de venta
        // precargado con el paciente y el servicio de esta cita.
        complete.mutate({ id }, {
          onSuccess: () => {
            const snapshot = appt; // captura antes de que el estado cambie
            handleClose();
            onCompleted?.(snapshot);
          },
        });
        break;
    }
  };

  const handleCancel = () => {
    if (!appt || !cancelReason.trim()) return;
    cancel.mutate({ id: appt.id, body: { reason: cancelReason } });
    setShowCancel(false);
    setCancelReason("");
  };

  const handleNoShow = () => {
    if (!appt) return;
    noShow.mutate({ id: appt.id });
  };

  const isTerminal = appt ? TERMINAL_STATUSES.includes(appt.status as AppointmentStatus) : false;
  const primaryAct = appt ? PRIMARY_ACTION[appt.status as AppointmentStatus] : null;
  const anyLoading = confirm.isPending || checkIn.isPending || start.isPending ||
                     complete.isPending || cancel.isPending || noShow.isPending;

  const serviceColor = appt?.service?.color ?? "#6B7280";

  // Status-gated actions
  const canCancel     = appt?.status === "PENDING" || appt?.status === "CONFIRMED" || appt?.status === "CHECKED_IN";
  const canNoShow     = appt?.status === "CONFIRMED" || appt?.status === "PENDING";
  const canReschedule = appt?.status === "PENDING"  || appt?.status === "CONFIRMED";

  // Cita reprogramada: tiene link a la nueva cita
  const isRescheduled    = appt?.status === "RESCHEDULED";
  const canViewNewAppt   = isRescheduled && !!appt?.rescheduledToId;

  return (
    <>
    <Sheet open={isOpen} onOpenChange={(v) => !v && handleClose()}>
      {/* aria-describedby={undefined} suppresses the Radix a11y warning —
          SheetDescription below provides the description */}
      <SheetContent side="right" className="w-full max-w-md p-0 flex flex-col overflow-hidden">

        {/* Service-color accent bar */}
        <div className="h-1 w-full shrink-0" style={{ backgroundColor: serviceColor }} />

        {/* Header */}
        <SheetHeader className="px-5 pt-4 pb-3 border-b space-y-0">
          <div className="flex items-center gap-2">
            {/* Breadcrumb: botón "← Volver" cuando se navega a una cita secundaria */}
            {currentId !== appointmentId && (
              <button
                onClick={() => {
                  setCurrentId(appointmentId);
                  setShowCancel(false);
                  setShowReschedule(false);
                }}
                className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center
                           text-muted-foreground hover:bg-muted/80 shrink-0"
                title="Volver a la cita anterior"
              >
                <ArrowRight className="h-3.5 w-3.5 rotate-180" />
              </button>
            )}
            <SheetTitle className="text-base font-bold">
              {currentId !== appointmentId ? "Nueva cita" : "Detalle de cita"}
            </SheetTitle>
          </div>
          <SheetDescription className="sr-only">
            Información completa de la cita y acciones disponibles.
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading || !appt ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="p-5 space-y-5">

              {/* Status badge */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border
                  ${STATUS_COLOR[appt.status as AppointmentStatus] ?? "bg-muted text-muted-foreground"}`}>
                  <span className={`h-2 w-2 rounded-full ${STATUS_DOT[appt.status as AppointmentStatus] ?? "bg-muted-foreground"}`} />
                  {STATUS_LABEL[appt.status as AppointmentStatus] ?? appt.status}
                </span>
              </div>

              {/* Info rows */}
              <div className="space-y-4">
                <InfoRow
                  icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
                  label="Fecha"
                  value={<span className="capitalize">{fmtDate(appt.startAt)}</span>}
                />
                <InfoRow
                  icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                  label="Horario"
                  value={
                    <span className="flex items-center gap-1.5">
                      <span>{fmtTime(appt.startAt)} – {fmtTime(appt.endAt)}</span>
                      <span className="text-xs text-muted-foreground font-normal bg-muted px-1.5 py-0.5 rounded">
                        {durationLabel(appt.startAt, appt.endAt)}
                      </span>
                    </span>
                  }
                />
                {appt.service && (
                  <InfoRow
                    icon={
                      <span
                        className="h-4 w-4 rounded-full border-2 shrink-0"
                        style={{
                          borderColor: appt.service.color ?? "#6B7280",
                          backgroundColor: `${appt.service.color ?? "#6B7280"}30`,
                        }}
                      />
                    }
                    label="Servicio"
                    value={appt.service.name}
                  />
                )}
                {appt.customer && (
                  <InfoRow
                    icon={<User className="h-4 w-4 text-muted-foreground" />}
                    label="Cliente"
                    value={
                      <span className="flex flex-col gap-0.5">
                        <span>{appt.customer.firstName} {appt.customer.lastName}</span>
                        {appt.customer.phone && (
                          <a
                            href={`tel:${appt.customer.phone}`}
                            className="text-xs text-primary font-normal hover:underline"
                          >
                            {appt.customer.phone}
                          </a>
                        )}
                      </span>
                    }
                  />
                )}
                {appt.branch && (
                  <InfoRow
                    icon={<MapPin className="h-4 w-4 text-muted-foreground" />}
                    label="Sede"
                    value={appt.branch.name}
                  />
                )}
                {appt.notes && (
                  <InfoRow
                    icon={<FileText className="h-4 w-4 text-muted-foreground" />}
                    label="Notas"
                    value={<span className="whitespace-pre-wrap text-muted-foreground font-normal">{appt.notes}</span>}
                  />
                )}
              </div>

              {/* Cancel reason (terminal) */}
              {appt.cancelReason && (
                <div className="rounded-xl bg-destructive/8 border border-destructive/20 px-4 py-3 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                    <p className="text-xs font-semibold text-destructive">Motivo de cancelación</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{appt.cancelReason}</p>
                </div>
              )}

              {/* ── Bloque RESCHEDULED: motivo + enlace a nueva cita ── */}
              {isRescheduled && (
                <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3 space-y-3">
                  {/* Header */}
                  <div className="flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5 text-indigo-600" />
                    <p className="text-xs font-semibold text-indigo-700">Cita reprogramada</p>
                  </div>

                  {/* Motivo de reprogramación */}
                  {appt.rescheduledReason && (
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                        Motivo
                      </p>
                      <p className="text-sm text-indigo-900">{appt.rescheduledReason}</p>
                    </div>
                  )}

                  {/* Botón: ver nueva cita */}
                  {canViewNewAppt && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-indigo-300 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-400"
                      onClick={() => {
                        setShowCancel(false);
                        setShowReschedule(false);
                        setCurrentId(appt.rescheduledToId!);
                      }}
                    >
                      <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                      Ver nueva cita
                    </Button>
                  )}
                </div>
              )}

              {/* Progress bar — only for active statuses */}
              {!isTerminal && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Progreso</p>
                    <StatusProgress status={appt.status} />
                  </div>
                </>
              )}

              {/* Cancel reason input */}
              {showCancel && (
                <div className="space-y-2.5 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <p className="text-sm font-semibold text-destructive">Cancelar cita</p>
                  </div>
                  <Textarea
                    placeholder="Escribe el motivo de cancelación…"
                    rows={3}
                    className="text-sm resize-none"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      disabled={cancelReason.trim().length < 3 || cancel.isPending}
                      onClick={handleCancel}
                    >
                      {cancel.isPending ? "Cancelando…" : "Confirmar cancelación"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setShowCancel(false); setCancelReason(""); }}
                    >
                      Volver
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {appt && !isTerminal && !showCancel && (
          <div className="px-5 py-4 border-t bg-card space-y-2 shrink-0">
            {/* Primary action */}
            {primaryAct && (
              <Button
                className="w-full"
                size="default"
                disabled={anyLoading}
                onClick={handlePrimaryAction}
                style={primaryAct === "complete" ? { backgroundColor: "#10b981" } : undefined}
              >
                {anyLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Procesando…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {PRIMARY_ACTION_LABEL[primaryAct]}
                  </span>
                )}
              </Button>
            )}

            {/* Reprogramar — fila propia, visible solo para PENDING / CONFIRMED */}
            {canReschedule && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-400"
                disabled={anyLoading}
                onClick={() => setShowReschedule(true)}
              >
                <CalendarClock className="h-3.5 w-3.5 mr-1.5" />
                Reprogramar cita
              </Button>
            )}

            {/* Cancelar + No asistió */}
            <div className="flex gap-2">
              {canCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                  disabled={anyLoading}
                  onClick={() => setShowCancel(true)}
                >
                  Cancelar cita
                </Button>
              )}
              {canNoShow && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={anyLoading}
                  onClick={handleNoShow}
                >
                  No asistió
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>

    {/* RescheduleModal se renderiza fuera del Sheet para garantizar z-index correcto */}
    {showReschedule && appt && (
      <RescheduleModal
        appointment={appt}
        onClose={() => setShowReschedule(false)}
      />
    )}
    </>
  );
}

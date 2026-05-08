import { useState, useEffect } from "react";
import {
  Clock, MapPin, User, CheckCircle2, CalendarClock, Calendar,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Button, Separator, Textarea, Skeleton,
} from "@podoplus/ui";
import { useBranches, useServices, useAvailabilitySlots } from "@/hooks/use-appointments";
import { useRescheduleAppointment } from "@/hooks/use-appointment-actions";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/hooks/use-appointments";

// ── Helpers ────────────────────────────────────────────────────────────────────

const DAYS   = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const MONTHS = ["enero","febrero","marzo","abril","mayo","junio",
                "julio","agosto","septiembre","octubre","noviembre","diciembre"];

const LIMA_TZ = "America/Lima";

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: LIMA_TZ }).format(new Date());
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-PE", {
    hour: "numeric", minute: "2-digit", hour12: true,
    timeZone: "UTC",
  });
}

function fmtDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  // Usamos Date.UTC para que getUTCDay/Date/Month den los valores Lima naive.
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return `${DAYS[date.getUTCDay()]}, ${d} de ${MONTHS[m - 1]} de ${y}`;
}

function fmtCurrentAppt(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("es-PE", {
    hour: "numeric", minute: "2-digit", hour12: true,
    timeZone: "UTC",
  });
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]} · ${time}`;
}

// ── Step badge ────────────────────────────────────────────────────────────────

function StepBadge({ n, active = true }: { n: number; active?: boolean }) {
  return (
    <span className={`h-5 w-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${
      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
    }`}>
      {n}
    </span>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface RescheduleModalProps {
  appointment: Appointment | null;
  onClose:     () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RescheduleModal({ appointment, onClose }: RescheduleModalProps) {
  // Branch is changeable (patient may prefer different location)
  // Service stays fixed (it's the same appointment type)
  const [selectedBranchId, setSelectedBranchId] = useState(appointment?.branchId ?? "");
  const [newDate,          setNewDate]          = useState(todayISO());
  const [selectedSlot,     setSelectedSlot]     = useState<{
    startAt: string; endAt: string; startAtLocal?: string;
  } | null>(null);
  const [reason, setReason] = useState("");

  const { data: allBranches = [] } = useBranches();
  const { data: allServices = [] } = useServices();
  const reschedule = useRescheduleAppointment();

  const activeBranches = allBranches.filter((b) => b.isActive);

  // Resolve service name/color from full list (appointment.service may be partial)
  const fullService = allServices.find((s) => s.id === appointment?.serviceId)
    ?? appointment?.service;

  // Auto-load slots whenever branch, date, or service changes
  const slotsParams =
    selectedBranchId && appointment?.serviceId && newDate
      ? { branchId: selectedBranchId, serviceId: appointment.serviceId, date: newDate }
      : null;

  const { data: rawSlots = [], isFetching: slotsFetching } = useAvailabilitySlots(slotsParams);
  const slots = rawSlots.filter((s) => s.availableCapacity > 0);

  // Reset slot when branch or date changes
  useEffect(() => { setSelectedSlot(null); }, [selectedBranchId, newDate]);

  if (!appointment) return null;

  const customerName = appointment.customer
    ? `${appointment.customer.firstName} ${appointment.customer.lastName}`
    : "Cliente";

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    try {
      await reschedule.mutateAsync({
        id:   appointment.id,
        body: { newStartAt: selectedSlot.startAt, reason: reason.trim() || undefined },
      });
      onClose();
    } catch { /* toasted inside the hook */ }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-3xl w-full p-0 gap-0 overflow-hidden max-h-[92vh]"
      >
        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b bg-muted/20 shrink-0">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
              <CalendarClock className="h-4 w-4 text-indigo-600" />
            </span>
            Reprogramar cita
            <span className="ml-1 text-sm font-normal text-muted-foreground truncate">
              — {customerName}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* ── Two-column body ── */}
        <div className="flex overflow-hidden" style={{ maxHeight: "calc(92vh - 140px)" }}>

          {/* ── LEFT: Servicio (read-only) + Sede (selectable) ── */}
          <div className="flex-1 border-r overflow-y-auto p-5 space-y-5">

            {/* ① Servicio — read-only, shown for context */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <StepBadge n={1} />
                <span className="text-sm font-semibold">Servicio</span>
                <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  No modificable
                </span>
              </div>

              {fullService ? (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-muted/30">
                  {fullService.color && (
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: fullService.color }}
                    />
                  )}
                  <span className="text-sm font-medium flex-1 truncate">{fullService.name}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                    <Clock className="h-3 w-3" />
                    {fullService.durationMinutes ?? "—"}m
                  </span>
                </div>
              ) : (
                <Skeleton className="h-10 w-full rounded-lg" />
              )}
            </section>

            <Separator />

            {/* ② Sede — selectable (puede atenderse en otra sede) */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <StepBadge n={2} />
                <span className="text-sm font-semibold">Sede <span className="text-destructive">*</span></span>
              </div>

              {activeBranches.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Sin sedes activas
                </p>
              ) : (
                <div className="space-y-1">
                  {activeBranches.map((b) => {
                    const isSelected = b.id === selectedBranchId;
                    return (
                      <button
                        key={b.id}
                        onClick={() => setSelectedBranchId(b.id)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors border",
                          isSelected
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "border-transparent hover:bg-muted",
                        )}
                      >
                        <MapPin className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          isSelected ? "text-primary" : "text-muted-foreground",
                        )} />
                        <span className="font-medium flex-1 truncate">{b.name}</span>
                        {isSelected && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* ── RIGHT: Info actual + Cliente + Fecha + Slots + Motivo ── */}
          <div className="w-80 shrink-0 overflow-y-auto p-5 space-y-4">

            {/* Cita actual — banner ámbar */}
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 space-y-0.5">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                Cita actual
              </p>
              <p className="text-sm font-semibold text-amber-900">
                {fmtCurrentAppt(appointment.startAt)}
              </p>
              {appointment.branch && (
                <p className="text-xs text-amber-700">{appointment.branch.name}</p>
              )}
            </div>

            {/* ③ Cliente — read-only */}
            <section className="space-y-1.5">
              <div className="flex items-center gap-2">
                <StepBadge n={3} />
                <span className="text-sm font-semibold">Cliente</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border bg-muted/30 px-3 py-2.5">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{customerName}</p>
                  {appointment.customer?.phone && (
                    <p className="text-xs text-muted-foreground">{appointment.customer.phone}</p>
                  )}
                </div>
              </div>
            </section>

            <Separator />

            {/* ④ Nueva fecha */}
            <section className="space-y-1.5">
              <div className="flex items-center gap-2">
                <StepBadge n={4} />
                <span className="text-sm font-semibold">
                  Nueva fecha <span className="text-destructive">*</span>
                </span>
              </div>

              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="date"
                  value={newDate}
                  min={todayISO()}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm bg-white
                             focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
                             transition-colors"
                />
              </div>

              {newDate && (
                <p className="text-[11px] text-muted-foreground capitalize px-1">
                  {fmtDateLong(newDate)}
                </p>
              )}
            </section>

            {/* ⑤ Horarios disponibles — se cargan automáticamente */}
            <section className="space-y-1.5">
              <div className="flex items-center gap-2">
                <StepBadge n={5} />
                <span className="text-sm font-semibold">
                  Horario disponible <span className="text-destructive">*</span>
                </span>
              </div>

              {!selectedBranchId ? (
                <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-lg">
                  Selecciona una sede para ver horarios
                </p>
              ) : slotsFetching ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 rounded-md" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground border border-dashed rounded-lg">
                  Sin horarios disponibles para esta fecha
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-0.5">
                  {slots.map((slot) => {
                    const isSelected = selectedSlot?.startAt === slot.startAt;
                    const label = slot.startAtLocal ?? fmtTime(slot.startAt);
                    return (
                      <button
                        key={slot.startAt}
                        onClick={() => setSelectedSlot({
                          startAt:      slot.startAt,
                          endAt:        slot.endAt,
                          startAtLocal: slot.startAtLocal,
                        })}
                        className={cn(
                          "px-2 py-2 rounded-md text-xs font-medium transition-all text-center border",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-muted/60 border-transparent hover:bg-primary/10 hover:border-primary/40",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedSlot && (
                <div className="flex items-center gap-2 text-xs bg-primary/8 border border-primary/20 rounded-md px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-primary font-semibold">
                    {selectedSlot.startAtLocal ?? fmtTime(selectedSlot.startAt)}
                    {" – "}
                    {fmtTime(selectedSlot.endAt)}
                  </span>
                </div>
              )}
            </section>

            <Separator />

            {/* ⑥ Motivo (opcional) */}
            <section className="space-y-1.5">
              <div className="flex items-center gap-2">
                <StepBadge n={6} active={false} />
                <span className="text-sm font-semibold text-muted-foreground">
                  Motivo{" "}
                  <span className="text-xs font-normal">(opcional)</span>
                </span>
              </div>
              <Textarea
                placeholder="Indica el motivo de la reprogramación…"
                rows={2}
                className="text-sm resize-none"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </section>

            {/* ── Actions ── */}
            <div className="space-y-2 pb-1 pt-1">
              {/* Hint de validación */}
              {!selectedSlot && (
                <p className="text-xs text-muted-foreground text-center">
                  {!selectedBranchId
                    ? "Selecciona una sede"
                    : "Elige un horario disponible"}
                </p>
              )}

              {reschedule.error && (
                <p className="text-xs text-destructive text-center">
                  {reschedule.error.message}
                </p>
              )}

              <Button
                className="w-full"
                disabled={!selectedSlot || reschedule.isPending}
                onClick={handleConfirm}
              >
                {reschedule.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Reprogramando…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4" />
                    Confirmar reprogramación
                  </span>
                )}
              </Button>

              <Button variant="ghost" size="sm" className="w-full" onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

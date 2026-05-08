import { useState, useCallback, useEffect } from "react";
import { Search, Clock, Users, MapPin, CheckCircle2, ChevronRight, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Button, Input, Label, Textarea, Separator, Skeleton,
} from "@podoplus/ui";
import { useBranches, useServices, useCustomerSearch, useAvailabilitySlots } from "@/hooks/use-appointments";
import { useBusinessUnits } from "@/hooks/use-business-units";
import { useCreateAppointment } from "@/hooks/use-appointment-actions";
import { useDebounce } from "@/hooks/use-debounce";

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_LABELS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const DAY_LABELS_LONG = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convierte "HH:mm" (24h Lima local del backend) → "H:mm AM/PM". */
function to12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Formatea timestamp naive Lima → hora con formato 12h. */
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-PE", {
    hour: "numeric", minute: "2-digit", hour12: true,
    timeZone: "UTC",
  });
}

function fmtDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_LABELS_LONG[date.getDay()]}, ${d} de ${MONTH_LABELS[m - 1]} de ${y}`;
}

// ── Step badge ────────────────────────────────────────────────────────────────

function StepBadge({ n, active = true }: { n: number; active?: boolean }) {
  return (
    <span className={`h-5 w-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0
      ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
      {n}
    </span>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open:         boolean;
  onClose:      () => void;
  defaultDate?: string;
  defaultHour?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BookingModal({ open, onClose, defaultDate, defaultHour }: Props) {
  // Form state
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedBranchId,  setSelectedBranchId]  = useState("");
  const [selectedBuId,      setSelectedBuId]       = useState("");
  const [selectedSlot,      setSelectedSlot]       = useState<{
    startAt: string; endAt: string; startAtLocal?: string; endAtLocal?: string;
  } | null>(null);
  const [customerId,        setCustomerId]         = useState("");
  const [customerName,      setCustomerName]       = useState("");
  const [customerSearch,    setCustomerSearch]     = useState("");
  const [notes,             setNotes]              = useState("");
  const [serviceSearch,     setServiceSearch]      = useState("");
  const [slotsRequested,    setSlotsRequested]     = useState(false);

  const date = defaultDate ?? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());

  const debouncedCustomer = useDebounce(customerSearch, 300);
  const debouncedService  = useDebounce(serviceSearch, 200);

  const { data: rawBranches }  = useBranches();
  const { data: allServices }  = useServices();
  const { data: customers, isFetching: customersFetching } = useCustomerSearch(debouncedCustomer);
  const { data: businessUnits = [] } = useBusinessUnits();

  const allBranches      = rawBranches ?? [];
  const filteredBranches = selectedBuId
    ? allBranches.filter((b) => b.businessUnitId === selectedBuId && b.isActive)
    : allBranches.filter((b) => b.isActive);
  const activeBranches   = filteredBranches;
  const activeServices = (allServices ?? []).filter(
    (s) => s.isActive && (!debouncedService || s.name.toLowerCase().includes(debouncedService.toLowerCase())),
  );

  const selectedService = allServices?.find((s) => s.id === selectedServiceId);

  const slotsParams = slotsRequested && selectedServiceId && selectedBranchId && date
    ? { branchId: selectedBranchId, serviceId: selectedServiceId, date }
    : null;

  const { data: rawSlots, isFetching: slotsFetching } = useAvailabilitySlots(slotsParams);
  // Solo mostrar slots con cupo disponible en el modal de reserva
  const slots = (rawSlots ?? []).filter((s) => s.availableCapacity > 0);

  const createAppt = useCreateAppointment();

  // Auto-set branch if only one
  useEffect(() => {
    if (activeBranches.length === 1 && !selectedBranchId) {
      setSelectedBranchId(activeBranches[0].id);
    }
  }, [activeBranches.length, selectedBuId]);

  // Reset slot when service or branch changes
  useEffect(() => {
    setSelectedSlot(null);
    setSlotsRequested(false);
  }, [selectedServiceId, selectedBranchId]);

  const handleClose = useCallback(() => {
    setSelectedServiceId(""); setSelectedBranchId(""); setSelectedSlot(null);
    setCustomerId(""); setCustomerName(""); setCustomerSearch("");
    setNotes(""); setServiceSearch(""); setSlotsRequested(false);
    setSelectedBuId("");
    onClose();
  }, [onClose]);

  const canSearchSlots = !!selectedServiceId && !!selectedBranchId;
  const canSubmit      = !!selectedServiceId && !!selectedBranchId && !!selectedSlot && !!customerId;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedSlot) return;
    try {
      await createAppt.mutateAsync({
        branchId:     selectedBranchId,
        customerId,
        serviceId:    selectedServiceId,
        startAt:      selectedSlot.startAt,
        startAtLocal: selectedSlot.startAtLocal,
        notes:        notes.trim() || undefined,
      });
      handleClose();
    } catch { /* toasted in hook */ }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-3xl w-full p-0 gap-0 overflow-hidden max-h-[92vh]"
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b bg-muted/20 shrink-0">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-primary" />
            </span>
            Nueva cita
            <span className="ml-1 text-sm font-normal text-muted-foreground capitalize">
              — {fmtDateLabel(date)}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* ── Two-column body ──────────────────────────────────────────────── */}
        <div className="flex overflow-hidden" style={{ maxHeight: "calc(92vh - 140px)" }}>

          {/* ── LEFT: Servicio + Sede ────────────────────────────────────── */}
          <div className="flex-1 border-r overflow-y-auto p-5 space-y-5">

            {/* ① Servicio */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <StepBadge n={1} />
                <span className="text-sm font-semibold">Servicio <span className="text-destructive">*</span></span>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-8 text-sm"
                  placeholder="Filtrar servicios…"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                />
              </div>

              <div className="space-y-1 max-h-52 overflow-y-auto pr-0.5">
                {activeServices.map((svc) => {
                  const isSelected = svc.id === selectedServiceId;
                  return (
                    <button
                      key={svc.id}
                      onClick={() => setSelectedServiceId(svc.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors
                        ${isSelected
                          ? "bg-primary/10 border border-primary/30 text-primary"
                          : "hover:bg-muted border border-transparent"
                        }`}
                    >
                      <div
                        className={`h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center
                          ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"}`}
                      >
                        {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                      {/* Service color dot */}
                      {svc.color && (
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: svc.color }}
                        />
                      )}
                      <span className="flex-1 font-medium truncate">{svc.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />{svc.durationMinutes}m
                      </span>
                    </button>
                  );
                })}
                {activeServices.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Sin servicios disponibles
                  </p>
                )}
              </div>
            </section>

            <Separator />

            {/* ② Sede */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <StepBadge n={2} />
                <span className="text-sm font-semibold">Sede <span className="text-destructive">*</span></span>
              </div>
              {businessUnits.length > 1 && (
                <div className="flex gap-1.5 flex-wrap mb-2">
                  <button
                    onClick={() => { setSelectedBuId(""); setSelectedBranchId(""); }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                      !selectedBuId ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    Todas
                  </button>
                  {businessUnits.map((bu) => (
                    <button
                      key={bu.id}
                      onClick={() => { setSelectedBuId(bu.id); setSelectedBranchId(""); }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                        selectedBuId === bu.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {bu.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-1">
                {activeBranches.map((b) => {
                  const isSelected = b.id === selectedBranchId;
                  return (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBranchId(b.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors
                        ${isSelected
                          ? "bg-primary/10 border border-primary/30 text-primary"
                          : "hover:bg-muted border border-transparent"
                        }`}
                    >
                      <MapPin className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="font-medium flex-1">{b.name}</span>
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </button>
                  );
                })}
                {activeBranches.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Sin sedes activas</p>
                )}
              </div>
            </section>
          </div>

          {/* ── RIGHT: Horario + Cliente + Notas ────────────────────────── */}
          <div className="w-80 shrink-0 overflow-y-auto p-5 space-y-5">

            {/* ③ Horario disponible */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <StepBadge n={3} />
                <span className="text-sm font-semibold">Horario disponible <span className="text-destructive">*</span></span>
              </div>

              {!slotsRequested ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canSearchSlots}
                  onClick={() => setSlotsRequested(true)}
                  className="w-full"
                  title={!canSearchSlots ? "Selecciona servicio y sede primero" : undefined}
                >
                  <Clock className="h-3.5 w-3.5 mr-2" />
                  Ver horarios disponibles
                  <ChevronRight className="h-3.5 w-3.5 ml-auto" />
                </Button>
              ) : slotsFetching ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 rounded-md" />
                  ))}
                </div>
              ) : (slots ?? []).length === 0 ? (
                <div className="text-center py-5 text-sm text-muted-foreground border border-dashed rounded-lg">
                  Sin horarios disponibles para este día
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto">
                  {(slots ?? []).map((slot) => {
                    const isSelected = selectedSlot?.startAt === slot.startAt;
                    const label = slot.startAtLocal ? to12h(slot.startAtLocal) : fmtTime(slot.startAt);
                    return (
                      <button
                        key={slot.startAt}
                        onClick={() => setSelectedSlot({
                          startAt:      slot.startAt,
                          endAt:        slot.endAt,
                          startAtLocal: slot.startAtLocal,
                          endAtLocal:   slot.endAtLocal,
                        })}
                        className={`px-2 py-2 rounded-md text-xs font-medium transition-all text-center
                          ${isSelected
                            ? "bg-primary text-primary-foreground border border-primary shadow-sm"
                            : "bg-muted/60 hover:bg-primary/10 hover:border-primary/40 border border-transparent"
                          }`}
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
                  <span className="text-primary font-medium">
                    {selectedSlot.startAtLocal ? to12h(selectedSlot.startAtLocal) : fmtTime(selectedSlot.startAt)}
                    {" – "}
                    {selectedSlot.endAtLocal   ? to12h(selectedSlot.endAtLocal)   : fmtTime(selectedSlot.endAt)}
                  </span>
                </div>
              )}
            </section>

            <Separator />

            {/* ④ Cliente */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <StepBadge n={4} />
                <span className="text-sm font-semibold">Cliente <span className="text-destructive">*</span></span>
              </div>

              {customerId ? (
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-sm font-medium truncate">{customerName}</span>
                  </div>
                  <button
                    className="text-muted-foreground hover:text-foreground ml-2 shrink-0"
                    onClick={() => { setCustomerId(""); setCustomerName(""); setCustomerSearch(""); }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="pl-8 h-8 text-sm"
                      placeholder="Buscar por nombre o teléfono…"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                    />
                  </div>
                  {customerSearch.length >= 2 && (
                    <div className="rounded-md border bg-popover shadow-md max-h-40 overflow-y-auto">
                      {customersFetching ? (
                        <div className="p-3 space-y-2">
                          {[1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
                        </div>
                      ) : (customers ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3">Sin resultados</p>
                      ) : (
                        (customers ?? []).map((c) => (
                          <button
                            key={c.id}
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors border-b last:border-0"
                            onClick={() => {
                              setCustomerId(c.id);
                              setCustomerName(`${c.firstName} ${c.lastName}`);
                              setCustomerSearch("");
                            }}
                          >
                            <p className="font-medium">{c.firstName} {c.lastName}</p>
                            {c.phone && (
                              <p className="text-xs text-muted-foreground">{c.phone}</p>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            <Separator />

            {/* ⑤ Notas */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <StepBadge n={5} active={false} />
                <Label className="text-sm font-semibold">
                  Notas{" "}
                  <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                </Label>
              </div>
              <Textarea
                placeholder="Observaciones, motivo de consulta…"
                rows={3}
                className="text-sm resize-none"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </section>

            {/* ── Actions ── */}
            <div className="space-y-2 pt-1 pb-1">
              {/* Validation hints */}
              {!canSubmit && (
                <p className="text-xs text-muted-foreground text-center">
                  {!selectedServiceId ? "Selecciona un servicio" :
                   !selectedBranchId  ? "Selecciona una sede"   :
                   !selectedSlot      ? "Elige un horario"      :
                   !customerId        ? "Busca un cliente"       : ""}
                </p>
              )}
              <Button
                className="w-full"
                disabled={!canSubmit || createAppt.isPending}
                onClick={handleSubmit}
              >
                {createAppt.isPending ? "Agendando…" : "Confirmar cita"}
              </Button>
              <Button variant="ghost" size="sm" className="w-full" onClick={handleClose}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

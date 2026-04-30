import { useState } from "react";
import { X, Search, ChevronRight, ChevronLeft, Loader2, Check } from "lucide-react";
import { useCreateAppointment } from "@/hooks/use-appointment-actions";
import { useBranches, useServices, useCustomerSearch, useAvailabilitySlots } from "@/hooks/use-appointments";
import { cn, formatTime } from "@/lib/utils";

interface NewAppointmentDrawerProps {
  open:             boolean;
  onClose:          () => void;
  defaultDate?:     string;
  defaultBranchId?: string;
}

interface WizardState {
  // Step 1 — Customer
  customerId:   string;
  customerName: string;
  // Step 2 — Service, branch, date, time
  branchId:   string;
  serviceId:  string;
  date:       string;
  startAt:    string;
  // Step 3 — Notes
  notes: string;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function NewAppointmentDrawer({ open, onClose, defaultDate, defaultBranchId }: NewAppointmentDrawerProps) {
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [wizard, setWizard] = useState<WizardState>({
    customerId: "", customerName: "",
    branchId: defaultBranchId ?? "", serviceId: "",
    date: defaultDate ?? todayISO(), startAt: "", notes: "",
  });

  const create = useCreateAppointment();
  const { data: branches = [] } = useBranches();
  const { data: services = [] } = useServices();
  const { data: customers = [], isLoading: searchLoading } = useCustomerSearch(searchQuery);
  const { data: slots = [], isLoading: slotsLoading } = useAvailabilitySlots(
    wizard.branchId && wizard.serviceId && wizard.date
      ? { branchId: wizard.branchId, serviceId: wizard.serviceId, date: wizard.date }
      : null
  );

  const reset = () => {
    setStep(1);
    setSearchQuery("");
    setWizard({ customerId: "", customerName: "", branchId: defaultBranchId ?? "", serviceId: "", date: defaultDate ?? todayISO(), startAt: "", notes: "" });
    create.reset();
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    try {
      await create.mutateAsync({
        branchId: wizard.branchId, customerId: wizard.customerId,
        serviceId: wizard.serviceId, startAt: wizard.startAt,
        notes: wizard.notes || undefined,
      });
      handleClose();
    } catch { /* toasted in hook */ }
  };

  const selectedService = services.find((s) => s.id === wizard.serviceId);
  const availableSlots = slots.filter((s) => s.availableCapacity > 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative ml-auto w-full max-w-lg bg-white h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Nueva Cita</h2>
            <p className="text-xs text-muted-foreground">Paso {step} de 3</p>
          </div>
          <button onClick={handleClose} className="p-2 rounded-md hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex px-6 py-3 gap-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className={cn("h-1.5 flex-1 rounded-full transition-colors", step >= n ? "bg-indigo-600" : "bg-gray-200")} />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* STEP 1 — Customer */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">¿Para quién es la cita?</h3>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o DNI..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              {searchLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 size={14} className="animate-spin" /> Buscando...
                </div>
              )}

              {customers.length > 0 && (
                <div className="space-y-1">
                  {customers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setWizard((w) => ({ ...w, customerId: c.id, customerName: `${c.firstName} ${c.lastName}` }))}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors",
                        wizard.customerId === c.id ? "border-indigo-500 bg-indigo-50" : "hover:bg-gray-50"
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{c.firstName} {c.lastName}</p>
                        <p className="text-xs text-muted-foreground">{c.documentNumber ?? c.phone ?? ""}</p>
                      </div>
                      {wizard.customerId === c.id && <Check size={16} className="text-indigo-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 && !searchLoading && customers.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">No se encontraron clientes. Verifica el nombre o DNI.</p>
              )}

              {wizard.customerId && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-indigo-700">Cliente seleccionado</p>
                  <p className="text-sm font-semibold text-indigo-900 mt-0.5">{wizard.customerName}</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2 — Branch, service, date, slot */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">¿Qué servicio y cuándo?</h3>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Sede</label>
                <select
                  value={wizard.branchId}
                  onChange={(e) => setWizard((w) => ({ ...w, branchId: e.target.value, startAt: "" }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Seleccionar sede...</option>
                  {branches.filter((b) => b.isActive).map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Servicio</label>
                <select
                  value={wizard.serviceId}
                  onChange={(e) => setWizard((w) => ({ ...w, serviceId: e.target.value, startAt: "" }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Seleccionar servicio...</option>
                  {services.filter((s) => s.isActive).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.durationMinutes} min)</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Fecha</label>
                <input
                  type="date"
                  value={wizard.date}
                  min={todayISO()}
                  onChange={(e) => setWizard((w) => ({ ...w, date: e.target.value, startAt: "" }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Slots */}
              {wizard.branchId && wizard.serviceId && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Hora disponible</label>
                  {slotsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Loader2 size={14} className="animate-spin" /> Cargando horarios...
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No hay horarios disponibles para esta fecha.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot.startAt}
                          onClick={() => setWizard((w) => ({ ...w, startAt: slot.startAt }))}
                          className={cn(
                            "py-2.5 text-sm rounded-lg border font-medium transition-colors",
                            wizard.startAt === slot.startAt
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-gray-700 border-gray-200 hover:border-indigo-400 hover:text-indigo-600"
                          )}
                        >
                          {formatTime(slot.startAt)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — Confirm */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Confirmar cita</h3>

              <div className="bg-gray-50 rounded-xl border p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-medium">{wizard.customerName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Servicio</span>
                  <span className="font-medium">{selectedService?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duración</span>
                  <span className="font-medium">{selectedService?.durationMinutes} min</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fecha</span>
                  <span className="font-medium">
                    {new Date(wizard.date + "T12:00:00").toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Hora</span>
                  <span className="font-medium">{formatTime(wizard.startAt)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sede</span>
                  <span className="font-medium">{branches.find((b) => b.id === wizard.branchId)?.name}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Notas <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <textarea
                  value={wizard.notes}
                  onChange={(e) => setWizard((w) => ({ ...w, notes: e.target.value }))}
                  placeholder="Indicaciones especiales, alergias, preferencias..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {create.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">{create.error.message}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="border-t px-6 py-4 flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ChevronLeft size={16} /> Atrás
            </button>
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={
                (step === 1 && !wizard.customerId) ||
                (step === 2 && (!wizard.branchId || !wizard.serviceId || !wizard.startAt))
              }
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              Siguiente <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={create.isPending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {create.isPending && <Loader2 size={14} className="animate-spin" />}
              Crear Cita
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

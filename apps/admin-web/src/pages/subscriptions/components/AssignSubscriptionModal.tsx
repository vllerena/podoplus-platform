import { useState } from "react";
import { Search, X, CalendarDays, StickyNote, UserRound, Layers } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Textarea, Separator,
} from "@podoplus/ui";
import { useAssignPlan, usePlans } from "@/hooks/use-plans";
import type { AssignSubscriptionInput } from "@/hooks/use-plans";
import { useCustomers } from "@/hooks/use-customers";
import { useDebounce }  from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(price: string) {
  return `S/ ${parseFloat(price).toFixed(2)}`;
}

// ── Plan type labels ──────────────────────────────────────────────────────────

const PLAN_TYPE_LABEL: Record<string, string> = {
  SESSION: "Por sesiones",
  DATE:    "Por tiempo",
  HYBRID:  "Híbrido",
};

const PLAN_TYPE_COLOR: Record<string, string> = {
  SESSION: "bg-blue-100 text-blue-700",
  DATE:    "bg-purple-100 text-purple-700",
  HYBRID:  "bg-orange-100 text-orange-700",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open:    boolean;
  onClose: () => void;
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AssignSubscriptionModal({ open, onClose }: Props) {
  const [customerId,     setCustomerId]     = useState("");
  const [customerName,   setCustomerName]   = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [planId,         setPlanId]         = useState("");
  const [startDate,      setStartDate]      = useState("");
  const [notes,          setNotes]          = useState("");

  const debouncedSearch = useDebounce(customerSearch, 300);

  const assign = useAssignPlan();
  const { data: plans } = usePlans(true);
  const { data: customerPage } = useCustomers({
    q:     debouncedSearch || undefined,
    limit: 8,
  });

  const customers   = customerPage?.data ?? [];
  const activePlans = plans ?? [];
  const selectedPlan = activePlans.find((p) => p.id === planId);

  const handleClose = () => {
    setCustomerId(""); setCustomerName(""); setCustomerSearch("");
    setPlanId(""); setStartDate(""); setNotes("");
    onClose();
  };

  const handleSubmit = async () => {
    if (!customerId || !planId) return;

    const body: AssignSubscriptionInput = {
      customer_id: customerId,
      plan_id:     planId,
      start_date:  startDate || undefined,
      notes:       notes.trim() || undefined,
    };

    try {
      await assign.mutateAsync(body);
      handleClose();
    } catch { /* toasted in hook */ }
  };

  const canSubmit = !!customerId && !!planId;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Asignar plan
          </DialogTitle>
          <DialogDescription>
            Crea una nueva suscripción para un paciente. La suscripción será válida en todas las sedes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">

          {/* ── 1. Paciente ────────────────────────────────────────────── */}
          <div>
            <SectionLabel icon={UserRound} label="Paciente" />
            {customerId ? (
              <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{customerName}</p>
                  <p className="text-xs text-muted-foreground">Paciente seleccionado</p>
                </div>
                <button
                  className="text-muted-foreground hover:text-foreground transition-colors rounded p-1 hover:bg-muted"
                  onClick={() => { setCustomerId(""); setCustomerName(""); setCustomerSearch(""); }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nombre o teléfono…"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  autoFocus
                />
                {/* Dropdown results */}
                {customerSearch.length >= 2 && (
                  <div className="absolute z-20 w-full top-full mt-1 bg-popover border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {customers.length > 0 ? (
                      customers.map((c) => (
                        <button
                          key={c.id}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors first:rounded-t-lg last:rounded-b-lg"
                          onClick={() => {
                            setCustomerId(c.id);
                            setCustomerName(`${c.firstName} ${c.lastName}`);
                            setCustomerSearch("");
                          }}
                        >
                          <span className="font-medium">{c.firstName} {c.lastName}</span>
                          {c.phone && (
                            <span className="text-muted-foreground ml-2 text-xs">{c.phone}</span>
                          )}
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4 px-3">
                        Sin resultados para <span className="font-medium">"{customerSearch}"</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* ── 2. Plan ────────────────────────────────────────────────── */}
          <div>
            <SectionLabel icon={Layers} label="Plan de suscripción" />
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger className={cn(!planId && "text-muted-foreground")}>
                <SelectValue placeholder="Seleccionar plan…" />
              </SelectTrigger>
              <SelectContent>
                {activePlans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      {p.color && (
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: p.color }}
                        />
                      )}
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground text-xs">
                        · {fmtPrice(p.price)}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Plan detail card */}
            {selectedPlan && (
              <div className="mt-3 rounded-lg border bg-muted/20 p-3.5 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  {selectedPlan.color && (
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: selectedPlan.color }}
                    />
                  )}
                  <span className="text-sm font-semibold">{selectedPlan.name}</span>
                  <span className={cn(
                    "ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded",
                    PLAN_TYPE_COLOR[selectedPlan.planType] ?? "bg-gray-100 text-gray-600"
                  )}>
                    {PLAN_TYPE_LABEL[selectedPlan.planType] ?? selectedPlan.planType}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-background rounded-md p-2 text-center border">
                    <p className="font-semibold text-sm">{fmtPrice(selectedPlan.price)}</p>
                    <p className="text-muted-foreground mt-0.5">Precio</p>
                  </div>
                  <div className="bg-background rounded-md p-2 text-center border">
                    <p className="font-semibold text-sm">{selectedPlan.durationDays}d</p>
                    <p className="text-muted-foreground mt-0.5">Duración</p>
                  </div>
                  <div className="bg-background rounded-md p-2 text-center border">
                    <p className="font-semibold text-sm">
                      {selectedPlan.planType === "DATE"
                        ? "∞"
                        : selectedPlan.includedSessions === "unlimited"
                          ? "∞"
                          : selectedPlan.includedSessions}
                    </p>
                    <p className="text-muted-foreground mt-0.5">Sesiones</p>
                  </div>
                </div>
                {selectedPlan.description && (
                  <p className="text-xs text-muted-foreground pt-2 border-t leading-relaxed">
                    {selectedPlan.description}
                  </p>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* ── 3. Opcionales ──────────────────────────────────────────── */}
          <div className="space-y-4">
            <SectionLabel icon={CalendarDays} label="Opcionales" />

            {/* Fecha de inicio */}
            <div className="space-y-1.5">
              <Label htmlFor="start-date" className="text-sm">
                Fecha de inicio
                <span className="text-xs text-muted-foreground ml-1.5">(por defecto: hoy)</span>
              </Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <Label htmlFor="sub-notes" className="text-sm flex items-center gap-1.5">
                <StickyNote className="h-3.5 w-3.5" />
                Notas
                <span className="text-xs text-muted-foreground ml-0.5">(opcional)</span>
              </Label>
              <Textarea
                id="sub-notes"
                placeholder="Observaciones, referidos, condiciones especiales…"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-none"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2 border-t">
          <Button variant="outline" onClick={handleClose} disabled={assign.isPending}>
            Cancelar
          </Button>
          <Button
            disabled={!canSubmit || assign.isPending}
            onClick={handleSubmit}
            className="min-w-[120px]"
          >
            {assign.isPending ? "Asignando…" : "Asignar plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

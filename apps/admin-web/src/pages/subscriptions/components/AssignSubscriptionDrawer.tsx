import { useState } from "react";
import { Search, X } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
  Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Textarea, Separator,
} from "@podoplus/ui";
import { useAssignPlan, usePlans } from "@/hooks/use-plans";
import type { AssignSubscriptionInput } from "@/hooks/use-plans";
import { useBranches }     from "@/hooks/use-appointments";
import { useBranchContext } from "@/hooks/use-branch-context";
import { useCustomers } from "@/hooks/use-customers";
import { useDebounce }  from "@/hooks/use-debounce";

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

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open:    boolean;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AssignSubscriptionDrawer({ open, onClose }: Props) {
  const { activeBranchId }           = useBranchContext();
  const [customerId,     setCustomerId]     = useState("");
  const [customerName,   setCustomerName]   = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [planId,         setPlanId]         = useState("");
  const [branchId,       setBranchId]       = useState(() => activeBranchId ?? "");
  const [startDate,      setStartDate]      = useState("");
  const [notes,          setNotes]          = useState("");

  const debouncedSearch = useDebounce(customerSearch, 300);

  const assign = useAssignPlan();
  const { data: branches }     = useBranches();
  const { data: plans }        = usePlans(true); // solo planes activos
  const { data: customerPage } = useCustomers({
    q:     debouncedSearch || undefined,
    limit: 8,
  });

  const customers   = customerPage?.data ?? [];
  const activePlans = plans ?? [];
  const selectedPlan = activePlans.find((p) => p.id === planId);

  const handleClose = () => {
    setCustomerId(""); setCustomerName(""); setCustomerSearch("");
    setPlanId(""); setBranchId(""); setStartDate(""); setNotes("");
    onClose();
  };

  const handleSubmit = async () => {
    if (!customerId || !planId || !branchId) return;

    const body: AssignSubscriptionInput = {
      customer_id: customerId,
      plan_id:     planId,
      branch_id:   branchId,
      start_date:  startDate || undefined,
      notes:       notes.trim() || undefined,
    };

    try {
      await assign.mutateAsync(body);
      handleClose();
    } catch { /* toasted in hook */ }
  };

  const canSubmit = !!customerId && !!planId && !!branchId;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="right" className="w-full max-w-lg overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle>Asignar plan</SheetTitle>
          <SheetDescription>
            Crea una nueva suscripción para un cliente.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 py-4">

          {/* ── Cliente ────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>
              Cliente <span className="text-destructive">*</span>
            </Label>
            {customerId ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm bg-muted/20">
                <span className="font-medium">{customerName}</span>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setCustomerId("");
                    setCustomerName("");
                    setCustomerSearch("");
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar cliente por nombre o teléfono…"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
                {customers.length > 0 && customerSearch.length >= 2 && (
                  <div className="absolute z-20 w-full top-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                    {customers.map((c) => (
                      <button
                        key={c.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onClick={() => {
                          setCustomerId(c.id);
                          setCustomerName(`${c.firstName} ${c.lastName}`);
                          setCustomerSearch("");
                        }}
                      >
                        <span className="font-medium">
                          {c.firstName} {c.lastName}
                        </span>
                        {c.phone && (
                          <span className="text-muted-foreground ml-2 text-xs">{c.phone}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {customerSearch.length >= 2 && customers.length === 0 && (
                  <div className="absolute z-20 w-full top-full mt-1 bg-popover border rounded-md shadow-md">
                    <p className="text-sm text-muted-foreground text-center py-3">
                      Sin resultados para "{customerSearch}"
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* ── Plan ───────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>
              Plan <span className="text-destructive">*</span>
            </Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
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
                      {p.name}
                      <span className="text-muted-foreground text-xs">
                        · {fmtPrice(p.price)} · {PLAN_TYPE_LABEL[p.planType] ?? p.planType}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Plan summary */}
            {selectedPlan && (
              <div className="rounded-lg bg-muted/30 border p-3 text-sm space-y-1 mt-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="font-medium">{PLAN_TYPE_LABEL[selectedPlan.planType]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Precio</span>
                  <span className="font-semibold">{fmtPrice(selectedPlan.price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duración</span>
                  <span>{selectedPlan.durationDays} días</span>
                </div>
                {selectedPlan.planType !== "DATE" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sesiones</span>
                    <span>
                      {selectedPlan.includedSessions === "unlimited"
                        ? "Ilimitadas"
                        : `${selectedPlan.includedSessions} sesiones`}
                    </span>
                  </div>
                )}
                {selectedPlan.description && (
                  <p className="text-xs text-muted-foreground pt-1 border-t mt-1">
                    {selectedPlan.description}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Sede ───────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>
              Sede <span className="text-destructive">*</span>
            </Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar sede…" />
              </SelectTrigger>
              <SelectContent>
                {branches?.filter((b) => b.isActive).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* ── Fecha de inicio (opcional) ──────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="start-date">
              Fecha de inicio{" "}
              <span className="text-xs text-muted-foreground">(opcional — por defecto hoy)</span>
            </Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* ── Notas ──────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="sub-notes">
              Notas{" "}
              <span className="text-xs text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="sub-notes"
              placeholder="Observaciones adicionales…"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <SheetFooter className="pt-2 border-t gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={!canSubmit || assign.isPending}
            onClick={handleSubmit}
          >
            {assign.isPending ? "Asignando…" : "Asignar plan"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

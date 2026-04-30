import { useState } from "react";
import { Building2, Edit2, Trash2, Check, X, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
  Button, Input, Skeleton,
} from "@podoplus/ui";
import {
  useServicePrices, useSetBranchPrice, useDeleteBranchPrice,
  type Service,
} from "@/hooks/use-services";
import { useBranches } from "@/hooks/use-branches";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(v: number | string | null | undefined) {
  if (v === null || v === undefined) return "—";
  const n = parseFloat(String(v));
  return isNaN(n) ? "—" : `S/ ${n.toFixed(2)}`;
}

// ── Branch price row ──────────────────────────────────────────────────────────

interface RowProps {
  branchId:    string;
  branchName:  string;
  basePrice:   number;
  override?:   number;
  saving:      boolean;
  deleting:    boolean;
  onSave:      (branchId: string, price: number) => void;
  onDelete:    (branchId: string) => void;
}

function BranchPriceRow({
  branchId, branchName, basePrice, override,
  saving, deleting, onSave, onDelete,
}: RowProps) {
  const [editing,   setEditing]   = useState(false);
  const [editValue, setEditValue] = useState("");

  const hasOverride = override !== undefined;

  const startEdit = () => {
    setEditValue(hasOverride ? String(override) : String(basePrice));
    setEditing(true);
  };
  const cancel = () => setEditing(false);

  const save = () => {
    const price = parseFloat(editValue);
    if (isNaN(price) || price < 0) return;
    onSave(branchId, price);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter")  save();
    if (e.key === "Escape") cancel();
  };

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-lg border px-4 py-3 transition-all",
      hasOverride
        ? "bg-primary/5 border-primary/20"
        : "bg-card hover:bg-muted/30"
    )}>
      {/* Branch info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{branchName}</p>
        <p className={cn(
          "text-xs",
          hasOverride ? "text-primary font-medium" : "text-muted-foreground"
        )}>
          {hasOverride ? "Precio personalizado" : "Usa precio base"}
        </p>
      </div>

      {/* Inline edit */}
      {editing ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
              S/
            </span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-28 pl-8 h-8 text-sm"
              autoFocus
            />
          </div>
          <Button
            size="sm"
            className="h-8 w-8 p-0 shrink-0"
            onClick={save}
            disabled={saving}
            title="Guardar"
          >
            {saving
              ? <Loader2 size={13} className="animate-spin" />
              : <Check size={13} />
            }
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 shrink-0 text-muted-foreground"
            onClick={cancel}
            title="Cancelar"
          >
            <X size={13} />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn(
            "text-sm font-semibold tabular-nums w-20 text-right",
            hasOverride ? "text-primary" : "text-muted-foreground"
          )}>
            {hasOverride ? fmtPrice(override) : fmtPrice(basePrice)}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={startEdit}
            title={hasOverride ? "Editar precio" : "Personalizar precio"}
          >
            <Edit2 size={12} />
          </Button>
          {hasOverride && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(branchId)}
              disabled={deleting}
              title="Quitar precio personalizado"
            >
              {deleting
                ? <Loader2 size={12} className="animate-spin" />
                : <Trash2 size={12} />
              }
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dialog ────────────────────────────────────────────────────────────────────

interface Props {
  open:    boolean;
  onClose: () => void;
  service: Service;
}

export function ServicePricesDialog({ open, onClose, service }: Props) {
  const { data: branches = [],  isLoading: loadBranches } = useBranches();
  const { data: prices   = [],  isLoading: loadPrices   } = useServicePrices(
    open ? service.id : undefined
  );

  const setPriceMut    = useSetBranchPrice(service.id);
  const deletePriceMut = useDeleteBranchPrice(service.id);

  const isLoading  = loadBranches || loadPrices;
  const basePrice  = parseFloat(String(service.basePrice));

  // branchId → override price
  const priceMap = new Map(prices.map((p) => [p.branchId, p.price]));

  const activeBranches = branches.filter((b) => b.isActive);
  const overrideCount  = prices.length;

  const handleSave = async (branchId: string, price: number) => {
    try {
      await setPriceMut.mutateAsync({ branchId, price });
    } catch { /* toasted in hook */ }
  };

  const handleDelete = async (branchId: string) => {
    try {
      await deletePriceMut.mutateAsync(branchId);
    } catch { /* toasted in hook */ }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 size={18} className="text-primary shrink-0" />
            Precios por sucursal
          </DialogTitle>
          <DialogDescription>
            Configura un precio personalizado para cada sucursal. Las sucursales sin precio
            propio usan el precio base del servicio.
          </DialogDescription>
        </DialogHeader>

        {/* Service reference */}
        <div className="rounded-lg bg-muted/50 border px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{service.name}</p>
            <p className="text-xs text-muted-foreground">Precio base del catálogo</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-base font-bold text-foreground">{fmtPrice(service.basePrice)}</p>
            {overrideCount > 0 && (
              <p className="text-[11px] text-primary">
                {overrideCount} sucursal{overrideCount > 1 ? "es" : ""} con precio propio
              </p>
            )}
          </div>
        </div>

        {/* Branch list */}
        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-0.5">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[60px] w-full rounded-lg" />
            ))
          ) : activeBranches.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No hay sucursales activas.</p>
            </div>
          ) : (
            activeBranches.map((branch) => (
              <BranchPriceRow
                key={branch.id}
                branchId={branch.id}
                branchName={branch.name}
                basePrice={basePrice}
                override={priceMap.get(branch.id)}
                saving={setPriceMut.isPending}
                deleting={deletePriceMut.isPending}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>

        {/* Help text */}
        {!isLoading && activeBranches.length > 0 && (
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <AlertCircle size={12} className="shrink-0 mt-0.5 text-muted-foreground/60" />
            Las sucursales sin precio personalizado cobran el precio base del servicio.
            Haz clic en <Edit2 size={11} className="inline mx-0.5" /> para personalizar.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

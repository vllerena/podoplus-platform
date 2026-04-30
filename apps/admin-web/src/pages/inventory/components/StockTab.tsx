import { useState, useMemo } from "react";
import {
  Package, AlertTriangle, Search, ArrowLeftRight, SlidersHorizontal,
} from "lucide-react";
import {
  Button, Input, Skeleton,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@podoplus/ui";
import { useAuthStore } from "@/stores/auth.store";
import { useBranches } from "@/hooks/use-appointments";
import {
  useStocks, useLowStockAlerts,
  type StockItem,
} from "@/hooks/use-inventory";
import { MovementModal } from "./MovementModal";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtS(v?: string | null) {
  if (!v || parseFloat(v) === 0) return "—";
  return `S/ ${parseFloat(v).toFixed(2)}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

// ── Stock row ─────────────────────────────────────────────────────────────────

function StockRow({
  item, isLow, onTransfer, onAdjust,
}: {
  item:       StockItem;
  isLow:      boolean;
  onTransfer: () => void;
  onAdjust:   () => void;
}) {
  const isEmpty = item.quantity === 0;

  return (
    <tr className="border-b hover:bg-muted/30 transition-colors group">
      <td className="px-4 py-3">
        <p className="font-medium text-sm group-hover:text-primary transition-colors">
          {item.product_name}
        </p>
        <p className="text-xs text-muted-foreground font-mono">{item.product_sku}</p>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{item.unit_type}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <span className={cn(
            "text-base font-bold tabular-nums",
            isEmpty ? "text-red-500" : isLow ? "text-amber-600" : "text-foreground"
          )}>
            {item.quantity}
          </span>
          {isEmpty && (
            <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 rounded px-1 py-0.5 leading-none">
              Sin stock
            </span>
          )}
          {!isEmpty && isLow && (
            <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 rounded px-1 py-0.5 leading-none">
              Bajo
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-sm">{fmtS(item.cost_price)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-sm font-medium">{fmtS(item.sale_price)}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {item.updated_at ? fmtDate(item.updated_at) : "—"}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm" variant="outline"
            className="h-7 text-xs gap-1"
            onClick={onTransfer}
          >
            <ArrowLeftRight className="h-3 w-3" /> Traslado
          </Button>
          <Button
            size="sm" variant="outline"
            className="h-7 text-xs gap-1"
            onClick={onAdjust}
          >
            <SlidersHorizontal className="h-3 w-3" /> Ajuste
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

export function StockTab() {
  const user    = useAuthStore((s) => s.user);
  const { data: allBranches } = useBranches();

  // Determine which branches this user can access
  const userBranches = useMemo(() => {
    if (!allBranches) return [];
    const isAdmin = user?.roles?.some((r) =>
      ["SUPER_ADMIN", "GENERAL_MANAGER", "ADMIN"].includes(r)
    );
    if (isAdmin) return allBranches.filter((b) => b.isActive);
    // Non-admins: restrict to their assigned branches
    const allowed = new Set((user?.branches ?? []).map((b) => b.id));
    return allBranches.filter((b) => b.isActive && allowed.has(b.id));
  }, [allBranches, user]);

  // Auto-select if only one branch
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const effectiveBranchId = useMemo(() => {
    if (selectedBranchId) return selectedBranchId;
    if (userBranches.length === 1) return userBranches[0].id;
    return "";
  }, [selectedBranchId, userBranches]);

  const [search,    setSearch]    = useState("");
  const [stockFilter, setStockFilter] = useState<"ALL" | "LOW" | "EMPTY" | "OK">("ALL");
  const [movModal,  setMovModal]  = useState(false);
  const [movType,   setMovType]   = useState<"TRANSFER_OUT" | "ADJUSTMENT">("TRANSFER_OUT");
  const [preProduct, setPreProduct] = useState<string | undefined>();

  const { data: stocks,  isLoading } = useStocks(effectiveBranchId, true);
  const { data: lowData }            = useLowStockAlerts(effectiveBranchId, 5);

  const lowIds   = new Set((lowData?.alerts ?? []).map((a) => a.product_id));
  const emptyIds = new Set((stocks ?? []).filter((s) => s.quantity === 0).map((s) => s.product_id));

  // Client-side filter
  const filtered = useMemo(() => {
    let list = stocks ?? [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.product_name.toLowerCase().includes(q) ||
        s.product_sku.toLowerCase().includes(q)
      );
    }
    if (stockFilter === "LOW")   list = list.filter((s) => lowIds.has(s.product_id) && s.quantity > 0);
    if (stockFilter === "EMPTY") list = list.filter((s) => s.quantity === 0);
    if (stockFilter === "OK")    list = list.filter((s) => s.quantity > 0 && !lowIds.has(s.product_id));
    return list;
  }, [stocks, search, stockFilter, lowIds]);

  const openTransfer = (productId: string) => {
    setMovType("TRANSFER_OUT");
    setPreProduct(productId);
    setMovModal(true);
  };
  const openAdjust = (productId: string) => {
    setMovType("ADJUSTMENT");
    setPreProduct(productId);
    setMovModal(true);
  };

  // No branch selected yet
  if (!effectiveBranchId) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-6 space-y-3">
          <p className="text-sm font-medium">Selecciona la sede</p>
          <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Seleccionar sede…" />
            </SelectTrigger>
            <SelectContent>
              {userBranches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground rounded-xl border">
          <Package className="h-12 w-12 mb-3 opacity-20" />
          <p className="font-medium text-foreground">Elige una sede para ver su stock</p>
          <p className="text-sm mt-1">El inventario se muestra por sede</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Branch selector + stats bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Branch selector — always visible for multi-branch users */}
        {userBranches.length > 1 && (
          <Select value={effectiveBranchId} onValueChange={setSelectedBranchId}>
            <SelectTrigger className="w-52 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {userBranches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Low stock alert */}
        {(lowData?.total_alerts ?? 0) > 0 && (
          <button
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full text-xs px-2.5 py-1 font-medium transition-colors",
              stockFilter === "LOW"
                ? "bg-amber-100 text-amber-800"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
            )}
            onClick={() => setStockFilter(stockFilter === "LOW" ? "ALL" : "LOW")}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {lowData!.total_alerts} con stock bajo
          </button>
        )}
        {(emptyIds.size ?? 0) > 0 && (
          <button
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full text-xs px-2.5 py-1 font-medium transition-colors",
              stockFilter === "EMPTY"
                ? "bg-red-100 text-red-800"
                : "bg-red-50 text-red-600 hover:bg-red-100"
            )}
            onClick={() => setStockFilter(stockFilter === "EMPTY" ? "ALL" : "EMPTY")}
          >
            <Package className="h-3.5 w-3.5" />
            {emptyIds.size} sin stock
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-8 text-xs w-52"
              placeholder="Buscar producto o SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Stock filter pills */}
          <div className="flex rounded-lg border overflow-hidden text-xs">
            {(["ALL", "OK", "LOW", "EMPTY"] as const).map((f, i) => (
              <button
                key={f}
                onClick={() => setStockFilter(f)}
                className={cn(
                  "px-2.5 py-1.5 font-medium transition-colors whitespace-nowrap",
                  stockFilter === f
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground",
                  i > 0 ? "border-l" : "",
                )}
              >
                {f === "ALL" ? "Todos" : f === "OK" ? "Con stock" : f === "LOW" ? "Stock bajo" : "Sin stock"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Count bar */}
      {!isLoading && (stocks ?? []).length > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          <Package className="h-3.5 w-3.5" />
          <span>
            {filtered.length} producto{filtered.length !== 1 ? "s" : ""}
            {filtered.length !== (stocks ?? []).length && ` de ${(stocks ?? []).length}`}
            {" · "}{userBranches.find((b) => b.id === effectiveBranchId)?.name}
          </span>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Producto</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Unidad</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Stock</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">P. Costo</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">P. Venta</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Actualización</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="flex flex-col items-center py-14 text-muted-foreground">
                      <Package className="h-10 w-10 mb-3 opacity-20" />
                      <p className="font-medium text-foreground">Sin productos</p>
                      <p className="text-sm mt-1">
                        {search || stockFilter !== "ALL"
                          ? "Prueba ajustando los filtros"
                          : "Esta sede aún no tiene stock registrado"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <StockRow
                    key={s.product_id}
                    item={s}
                    isLow={lowIds.has(s.product_id)}
                    onTransfer={() => openTransfer(s.product_id)}
                    onAdjust={() => openAdjust(s.product_id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movement modal */}
      {movModal && effectiveBranchId && (
        <MovementModal
          branchId={effectiveBranchId}
          productId={preProduct}
          defaultType={movType}
          open={movModal}
          onClose={() => { setMovModal(false); setPreProduct(undefined); }}
        />
      )}
    </>
  );
}

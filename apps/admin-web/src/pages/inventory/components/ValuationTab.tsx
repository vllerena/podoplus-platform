import { useState, useMemo } from "react";
import {
  TrendingUp, DollarSign, Package, AlertTriangle,
  BarChart3, ArrowUpRight,
} from "lucide-react";
import { Skeleton, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@podoplus/ui";
import { useAuthStore } from "@/stores/auth.store";
import { useBranches } from "@/hooks/use-appointments";
import {
  useInventoryValuation, useLowStockAlerts, useStocks,
} from "@/hooks/use-inventory";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtS(v?: string | null) {
  if (!v) return "S/ 0.00";
  return `S/ ${parseFloat(v).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pct(a: number, b: number) {
  if (!b) return "0%";
  return `${((a / b) * 100).toFixed(1)}%`;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, icon: Icon, accent, trend,
}: {
  label:  string;
  value:  string;
  sub?:   string;
  icon:   React.ElementType;
  accent: string;
  trend?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-start gap-3">
      <div className={cn("rounded-lg p-2.5 shrink-0", accent)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold mt-0.5 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {trend && (
        <div className="ml-auto shrink-0">
          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-600">
            <ArrowUpRight className="h-3 w-3" />{trend}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

export function ValuationTab() {
  const user    = useAuthStore((s) => s.user);
  const { data: allBranches } = useBranches();

  const userBranches = useMemo(() => {
    if (!allBranches) return [];
    const isAdmin = user?.roles?.some((r) =>
      ["SUPER_ADMIN", "GENERAL_MANAGER", "ADMIN"].includes(r)
    );
    if (isAdmin) return allBranches.filter((b) => b.isActive);
    const allowed = new Set((user?.branches ?? []).map((b) => b.id));
    return allBranches.filter((b) => b.isActive && allowed.has(b.id));
  }, [allBranches, user]);

  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const effectiveBranchId = useMemo(() => {
    if (selectedBranchId) return selectedBranchId;
    if (userBranches.length === 1) return userBranches[0].id;
    return "";
  }, [selectedBranchId, userBranches]);

  const { data: valuation, isLoading: valLoading } = useInventoryValuation(effectiveBranchId);
  const { data: lowData,   isLoading: lowLoading  } = useLowStockAlerts(effectiveBranchId, 5);
  const { data: stocks,    isLoading: stockLoading } = useStocks(effectiveBranchId, true);

  const isLoading = valLoading || lowLoading || stockLoading;

  // Derived metrics
  const totalProducts  = valuation?.total_products  ?? 0;
  const costValue      = parseFloat(valuation?.total_cost_value  ?? "0");
  const saleValue      = parseFloat(valuation?.total_sale_value  ?? "0");
  const margin         = parseFloat(valuation?.potential_margin  ?? "0");
  const lowCount       = lowData?.total_alerts ?? 0;
  const emptyCount     = (stocks ?? []).filter((s) => s.quantity === 0).length;
  const totalQty       = (stocks ?? []).reduce((sum, s) => sum + s.quantity, 0);
  const marginPct      = saleValue > 0 ? ((margin / saleValue) * 100).toFixed(1) : "0";

  // Top 5 by sale value
  const topItems = useMemo(() => {
    if (!valuation?.items) return [];
    return [...valuation.items]
      .sort((a, b) => parseFloat(b.sale_value) - parseFloat(a.sale_value))
      .slice(0, 5);
  }, [valuation]);

  return (
    <div className="space-y-5">
      {/* Branch selector */}
      {userBranches.length > 1 && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">Sede:</p>
          <Select
            value={effectiveBranchId}
            onValueChange={setSelectedBranchId}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Seleccionar sede…" />
            </SelectTrigger>
            <SelectContent>
              {userBranches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {effectiveBranchId && (
            <p className="text-xs text-muted-foreground">
              Última actualización: ahora
            </p>
          )}
        </div>
      )}

      {!effectiveBranchId ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground rounded-xl border">
          <BarChart3 className="h-12 w-12 mb-3 opacity-20" />
          <p className="font-medium text-foreground">Selecciona una sede para ver el dashboard</p>
        </div>
      ) : (
        <>
          {/* ── Metrics grid ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))
            ) : (
              <>
                <MetricCard
                  label="Productos con stock"
                  value={String(totalProducts)}
                  sub={`${totalQty} unidades totales`}
                  icon={Package}
                  accent="bg-blue-100 text-blue-700"
                />
                <MetricCard
                  label="Valor al costo"
                  value={fmtS(valuation?.total_cost_value)}
                  sub="Inversión en inventario"
                  icon={DollarSign}
                  accent="bg-gray-100 text-gray-600"
                />
                <MetricCard
                  label="Valor al precio venta"
                  value={fmtS(valuation?.total_sale_value)}
                  sub={`Margen potencial ${marginPct}%`}
                  icon={TrendingUp}
                  accent="bg-green-100 text-green-700"
                />
                <MetricCard
                  label="Margen potencial"
                  value={fmtS(valuation?.potential_margin)}
                  sub={pct(margin, saleValue) + " del precio venta"}
                  icon={BarChart3}
                  accent="bg-purple-100 text-purple-700"
                />
              </>
            )}
          </div>

          {/* ── Alert row ─────────────────────────────────────────── */}
          {(lowCount > 0 || emptyCount > 0) && !isLoading && (
            <div className="grid grid-cols-2 gap-3">
              {emptyCount > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                  <Package className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-red-700 text-sm">{emptyCount} producto{emptyCount !== 1 ? "s" : ""} sin stock</p>
                    <p className="text-xs text-red-600 mt-0.5">Stock en cero — requieren reposición urgente</p>
                  </div>
                </div>
              )}
              {lowCount > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-700 text-sm">{lowCount} con stock bajo</p>
                    <p className="text-xs text-amber-600 mt-0.5">Menos de 5 unidades — considera reposición</p>
                    <div className="mt-2 space-y-0.5">
                      {(lowData?.alerts ?? []).slice(0, 3).map((a) => (
                        <p key={a.product_id} className="text-xs text-amber-700">
                          · {a.product_name} <span className="font-medium">({a.quantity} u.)</span>
                        </p>
                      ))}
                      {(lowData?.alerts ?? []).length > 3 && (
                        <p className="text-xs text-amber-500">+{(lowData?.alerts ?? []).length - 3} más…</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Top products + Full table ──────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top 5 */}
            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm font-semibold mb-3">Top 5 por valor de venta</p>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : topItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sin datos</p>
              ) : (
                <div className="space-y-2">
                  {topItems.map((item, i) => {
                    const pctShare = saleValue > 0
                      ? (parseFloat(item.sale_value) / saleValue) * 100
                      : 0;
                    return (
                      <div key={item.product_id}>
                        <div className="flex items-center justify-between text-sm mb-0.5">
                          <span className="truncate text-xs font-medium max-w-[140px]" title={item.product_name}>
                            <span className="text-muted-foreground mr-1.5">{i + 1}.</span>
                            {item.product_name}
                          </span>
                          <span className="text-xs tabular-nums text-muted-foreground shrink-0 ml-2">
                            {fmtS(item.sale_value)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/60 transition-all"
                            style={{ width: `${Math.min(pctShare, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Full valuation table */}
            <div className="lg:col-span-2 rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/30">
                <p className="text-sm font-semibold">Valoración completa</p>
              </div>
              <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b bg-muted/40">
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Producto</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Cant.</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">P. Costo</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">P. Venta</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Val. Venta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <td key={j} className="px-3 py-2.5"><Skeleton className="h-3.5 w-full rounded" /></td>
                          ))}
                        </tr>
                      ))
                    ) : (valuation?.items ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                          Sin inventario registrado
                        </td>
                      </tr>
                    ) : (
                      (valuation?.items ?? []).map((item) => (
                        <tr key={item.product_id} className="border-b hover:bg-muted/30">
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-xs truncate max-w-[160px]">{item.product_name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{item.product_sku}</p>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-xs font-semibold">{item.quantity}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-xs">{fmtS(item.unit_cost)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-xs">{fmtS(item.unit_price)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-xs font-medium text-green-700">
                            {fmtS(item.sale_value)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

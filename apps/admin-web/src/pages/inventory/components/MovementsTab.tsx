import { useState, useMemo } from "react";
import {
  ArrowUpDown, ChevronLeft, ChevronRight,
  ArrowDownToLine, ArrowUpFromLine, Search,
} from "lucide-react";
import {
  Button, Input, Skeleton,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@podoplus/ui";
import { useAuthStore } from "@/stores/auth.store";
import { useBranches } from "@/hooks/use-appointments";
import {
  useInventoryMovements, useProducts,
  MOVEMENT_LABEL, MOVEMENT_COLOR,
  type MovementType,
} from "@/hooks/use-inventory";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Movement type groups ──────────────────────────────────────────────────────

const ALL_TYPES: MovementType[] = [
  "PURCHASE_IN", "ADJUSTMENT", "TRANSFER_OUT", "TRANSFER_IN", "SALE_OUT", "RETURN_IN",
];

const isEntry = (t: MovementType) =>
  ["PURCHASE_IN", "TRANSFER_IN", "RETURN_IN"].includes(t) ||
  (t === "ADJUSTMENT");   // adjustment shows in both columns (depends on context)

const isExit = (t: MovementType) =>
  ["SALE_OUT", "TRANSFER_OUT"].includes(t);

// ── Tab ───────────────────────────────────────────────────────────────────────

export function MovementsTab() {
  const user    = useAuthStore((s) => s.user);
  const { data: allBranches } = useBranches();
  const { data: productsData } = useProducts({ active: true, limit: 500 });
  const products = productsData?.data ?? [];

  const userBranches = useMemo(() => {
    if (!allBranches) return [];
    const isAdmin = user?.roles?.some((r) =>
      ["SUPER_ADMIN", "GENERAL_MANAGER", "ADMIN"].includes(r)
    );
    if (isAdmin) return allBranches.filter((b) => b.isActive);
    const allowed = new Set((user?.branches ?? []).map((b) => b.id));
    return allBranches.filter((b) => b.isActive && allowed.has(b.id));
  }, [allBranches, user]);

  const [branchId,    setBranchId]   = useState(() =>
    userBranches.length === 1 ? userBranches[0].id : ""
  );
  const effectiveBranchId = branchId ||
    (userBranches.length === 1 ? userBranches[0].id : "");

  const [typeFilter,   setTypeFilter]   = useState("ALL");
  const [productFilter, setProductFilter] = useState("");
  const [search,       setSearch]       = useState("");
  const [from,         setFrom]         = useState("");
  const [to,           setTo]           = useState("");
  const [cursor,       setCursor]       = useState<string | undefined>();
  const [stack,        setStack]        = useState<string[]>([]);

  const { data, isLoading } = useInventoryMovements({
    branchId:  effectiveBranchId,
    productId: productFilter || undefined,
    type:      typeFilter === "ALL" ? undefined : typeFilter,
    from:      from || undefined,
    to:        to   || undefined,
    cursor,
    limit:     50,
  });

  const movements  = data?.data ?? [];
  const hasNext    = data?.hasNext ?? false;
  const nextCursor = data?.nextCursor;
  const page       = stack.length + 1;

  const resetCursor = () => { setCursor(undefined); setStack([]); };
  const handleNext  = () => { if (!nextCursor) return; setStack((p) => [...p, cursor ?? ""]); setCursor(nextCursor); };
  const handlePrev  = () => { const s = [...stack]; const p = s.pop() ?? undefined; setStack(s); setCursor(p); };

  // Client-side product name search
  const filtered = useMemo(() => {
    if (!search) return movements;
    const q = search.toLowerCase();
    return movements.filter((m) =>
      (m.product_name ?? "").toLowerCase().includes(q) ||
      (m.product_sku  ?? "").toLowerCase().includes(q) ||
      (m.reason       ?? "").toLowerCase().includes(q)
    );
  }, [movements, search]);

  // No branch state
  if (!effectiveBranchId) {
    return (
      <div className="rounded-xl border bg-card p-6 space-y-3">
        <p className="text-sm font-medium">Selecciona la sede para ver movimientos</p>
        <Select value={branchId} onValueChange={setBranchId}>
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
    );
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Branch selector */}
        {userBranches.length > 1 && (
          <Select value={effectiveBranchId} onValueChange={(v) => { setBranchId(v); resetCursor(); }}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {userBranches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Type filter */}
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); resetCursor(); }}>
          <SelectTrigger className="w-48 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los tipos</SelectItem>
            {ALL_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{MOVEMENT_LABEL[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Product filter */}
        <Select value={productFilter} onValueChange={(v) => { setProductFilter(v === "_all" ? "" : v); resetCursor(); }}>
          <SelectTrigger className="w-48 h-8 text-xs">
            <SelectValue placeholder="Todos los productos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos los productos</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Fecha desde / hasta */}
        <Input
          type="date" className="w-36 h-8 text-xs"
          value={from}
          onChange={(e) => { setFrom(e.target.value); resetCursor(); }}
          title="Desde"
        />
        <Input
          type="date" className="w-36 h-8 text-xs"
          value={to}
          onChange={(e) => { setTo(e.target.value); resetCursor(); }}
          title="Hasta"
        />

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 h-8 text-xs w-48"
            placeholder="Buscar producto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {(from || to || typeFilter !== "ALL" || productFilter || search) && (
          <Button
            variant="ghost" size="sm" className="h-8 text-xs"
            onClick={() => {
              setTypeFilter("ALL"); setProductFilter(""); setFrom(""); setTo("");
              setSearch(""); resetCursor();
            }}
          >
            Limpiar
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        {/* Count */}
        {!isLoading && movements.length > 0 && (
          <div className="px-4 py-2.5 border-b bg-muted/30 text-xs text-muted-foreground flex items-center gap-1">
            <ArrowUpDown className="h-3.5 w-3.5" />
            {filtered.length} movimiento{filtered.length !== 1 ? "s" : ""}
            {filtered.length !== movements.length && ` de ${movements.length}`}
            {userBranches.length > 1 && (
              <span className="ml-1 font-medium text-foreground">
                · {userBranches.find((b) => b.id === effectiveBranchId)?.name}
              </span>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Fecha y hora</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Producto</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <span className="flex items-center justify-end gap-1">
                    <ArrowDownToLine className="h-3 w-3 text-green-600" /> Entrada
                  </span>
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <span className="flex items-center justify-end gap-1">
                    <ArrowUpFromLine className="h-3 w-3 text-red-500" /> Salida
                  </span>
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Motivo / Ref.</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center py-14 text-muted-foreground">
                      <ArrowUpDown className="h-10 w-10 mb-3 opacity-20" />
                      <p className="font-medium text-foreground">Sin movimientos</p>
                      <p className="text-sm mt-1">
                        {from || to || typeFilter !== "ALL" || productFilter || search
                          ? "Prueba ajustando los filtros"
                          : "No hay movimientos registrados en esta sede"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const entry = isEntry(m.type) && !isExit(m.type);
                  const exit  = isExit(m.type);
                  const isAdj = m.type === "ADJUSTMENT";
                  return (
                    <tr key={m.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDateTime(m.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          MOVEMENT_COLOR[m.type]
                        )}>
                          {MOVEMENT_LABEL[m.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm">{m.product_name ?? "—"}</p>
                        {m.product_sku && (
                          <p className="text-xs text-muted-foreground font-mono">{m.product_sku}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {(entry || isAdj) ? (
                          <span className="font-semibold text-green-700">
                            +{m.quantity}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {exit ? (
                          <span className="font-semibold text-red-500">
                            -{m.quantity}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate" title={m.reason}>
                        {m.reason || (m.reference_id ? `Ref: ${m.reference_id}` : "—")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {(stack.length > 0 || hasNext) && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground bg-muted/20">
            <span className="text-xs">Página {page}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={stack.length === 0} onClick={handlePrev}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={!hasNext} onClick={handleNext}>
                Siguiente <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

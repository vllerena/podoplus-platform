import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  Plus, Search, Package, TrendingUp, Tag, ToggleLeft, ToggleRight,
  Edit2, ChevronUp, ChevronDown, Image as ImageIcon,
} from "lucide-react";
import {
  Button, Input, Badge, Skeleton,
} from "@podoplus/ui";
import {
  useProducts, useEnableProduct, useDisableProduct,
  getProductImageUrl, type Product,
} from "@/hooks/use-products";
import { useAuthStore } from "@/stores/auth.store";
import { ProductModal } from "./components/ProductModal";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(v: string | number): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? "S/ 0.00" : `S/ ${n.toFixed(2)}`;
}

const UNIT_LABEL: Record<string, string> = {
  unit:   "Unidad",
  box:    "Caja",
  bottle: "Botella",
  pair:   "Par",
  bag:    "Bolsa",
  other:  "Otro",
};

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, color, loading,
}: {
  label: string; value: string; icon: React.ReactNode;
  color: string; loading: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        {loading
          ? <Skeleton className="h-5 w-16 mt-1" />
          : <p className="text-lg font-bold">{value}</p>}
      </div>
    </div>
  );
}

// ── Sort state ────────────────────────────────────────────────────────────────

type SortField = "name" | "sku" | "salePrice" | "costPrice";
type SortDir   = "asc" | "desc";

// ── Page ──────────────────────────────────────────────────────────────────────

export function ProductsPage() {
  const [searchInput,  setSearchInput]  = useState("");
  const [search,       setSearch]       = useState("");
  const [showAll,      setShowAll]      = useState(false);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editProduct,  setEditProduct]  = useState<Product | null>(null);
  const [sortField,    setSortField]    = useState<SortField>("name");
  const [sortDir,      setSortDir]      = useState<SortDir>("asc");

  // Debounce: wait 350ms after user stops typing to update the search query
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
    }, 350);
  }, []);

  // Barcode scanner: fires characters rapidly and ends with Enter key.
  // When Enter is pressed, apply the search immediately (skip debounce).
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSearch(searchInput);
    }
  }, [searchInput]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const canAdmin = useAuthStore((s) =>
    s.hasPermission?.("product.manage") ||
    s.hasAnyRole?.(["SUPER_ADMIN", "GENERAL_MANAGER"]) ||
    true
  );

  const { data: allProducts = [], isLoading } = useProducts({
    q:      search || undefined,
    active: showAll ? undefined : true,
  });

  const enableMut  = useEnableProduct();
  const disableMut = useDisableProduct();

  // Sort
  const sorted = useMemo(() => {
    return [...allProducts].sort((a, b) => {
      let va: string | number, vb: string | number;
      if (sortField === "salePrice")      { va = parseFloat(a.salePrice); vb = parseFloat(b.salePrice); }
      else if (sortField === "costPrice") { va = parseFloat(a.costPrice); vb = parseFloat(b.costPrice); }
      else { va = a[sortField] ?? ""; vb = b[sortField] ?? ""; }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ?  1 : -1;
      return 0;
    });
  }, [allProducts, sortField, sortDir]);

  // Stats from all products (separate query without filters)
  const { data: allForStats = [] } = useProducts();

  const stats = useMemo(() => ({
    total:    allForStats.length,
    active:   allForStats.filter((p) => p.isActive).length,
    inactive: allForStats.filter((p) => !p.isActive).length,
  }), [allForStats]);

  const handleSort = (field: SortField) => {
    if (field === sortField) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const openCreate = () => { setEditProduct(null); setModalOpen(true); };
  const openEdit   = (p: Product) => { setEditProduct(p); setModalOpen(true); };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="h-3 w-3 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp   className="h-3 w-3 text-primary" />
      : <ChevronDown className="h-3 w-3 text-primary" />;
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Productos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Catálogo de productos para venta e inventario
          </p>
        </div>
        {canAdmin && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo producto
          </Button>
        )}
      </div>

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Total de productos"
          value={String(stats.total)}
          icon={<Package className="h-5 w-5 text-blue-600" />}
          color="bg-blue-50"
          loading={isLoading}
        />
        <StatCard
          label="Activos"
          value={String(stats.active)}
          icon={<TrendingUp className="h-5 w-5 text-green-600" />}
          color="bg-green-50"
          loading={isLoading}
        />
        <StatCard
          label="Con precio de venta promedio"
          value={
            allForStats.length > 0
              ? fmtPrice(
                  allForStats.reduce((sum, p) => sum + parseFloat(p.salePrice), 0) /
                  allForStats.length,
                )
              : "—"
          }
          icon={<Tag className="h-5 w-5 text-purple-600" />}
          color="bg-purple-50"
          loading={isLoading}
        />
      </div>

      {/* ── Filters ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 pr-3"
            placeholder="Buscar por nombre, SKU o código de barras…"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>

        <button
          onClick={() => setShowAll((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
            showAll
              ? "bg-primary/10 border-primary/30 text-primary"
              : "border-border text-muted-foreground hover:bg-muted"
          }`}
        >
          {showAll
            ? <ToggleRight className="h-4 w-4" />
            : <ToggleLeft  className="h-4 w-4" />}
          Mostrar inactivos
        </button>

        {searchInput && (
          <p className="text-xs text-muted-foreground">
            ↵ Enter para buscar al instante (compatible con lector de barras)
          </p>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-3 text-left font-medium text-muted-foreground w-10"></th>
                <th className="px-4 py-3 text-left">
                  <button
                    className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => handleSort("sku")}
                  >
                    SKU <SortIcon field="sku" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    Nombre <SortIcon field="name" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Unidad</th>
                <th className="px-4 py-3 text-right">
                  <button
                    className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors ml-auto"
                    onClick={() => handleSort("costPrice")}
                  >
                    Costo <SortIcon field="costPrice" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors ml-auto"
                    onClick={() => handleSort("salePrice")}
                  >
                    Precio venta <SortIcon field="salePrice" />
                  </button>
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Estado</th>
                {canAdmin && (
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
                )}
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: canAdmin ? 8 : 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={canAdmin ? 8 : 7}>
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Package className="h-10 w-10 mb-3 opacity-30" />
                      <p className="font-medium">
                        {searchInput
                          ? `Sin resultados para "${searchInput}"`
                          : "Sin productos registrados"}
                      </p>
                      {canAdmin && !searchInput && (
                        <Button className="mt-4" size="sm" onClick={openCreate}>
                          <Plus className="h-4 w-4 mr-2" />
                          Crear primer producto
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sorted.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    canAdmin={canAdmin}
                    onEdit={openEdit}
                    onToggle={(p) =>
                      p.isActive
                        ? disableMut.mutate(p.id)
                        : enableMut.mutate(p.id)
                    }
                    isToggling={enableMut.isPending || disableMut.isPending}
                  />
                ))
              )}
            </tbody>

            {!isLoading && sorted.length > 0 && (
              <tfoot>
                <tr className="border-t bg-muted/20">
                  <td colSpan={canAdmin ? 8 : 7} className="px-4 py-2 text-xs text-muted-foreground">
                    {sorted.length} producto{sorted.length !== 1 ? "s" : ""}
                    {showAll && stats.inactive > 0 && (
                      <span className="ml-2 text-orange-500">
                        · {stats.inactive} inactivo{stats.inactive !== 1 ? "s" : ""}
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Modal ──────────────────────────────────────────────────── */}
      <ProductModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        product={editProduct}
      />
    </div>
  );
}

// ── Product row ───────────────────────────────────────────────────────────────

function ProductRow({
  product, canAdmin, onEdit, onToggle, isToggling,
}: {
  product:    Product;
  canAdmin:   boolean;
  onEdit:     (p: Product) => void;
  onToggle:   (p: Product) => void;
  isToggling: boolean;
}) {
  const margin =
    parseFloat(product.salePrice) > 0
      ? (((parseFloat(product.salePrice) - parseFloat(product.costPrice)) /
          parseFloat(product.salePrice)) * 100).toFixed(0)
      : null;

  return (
    <tr className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${!product.isActive ? "opacity-55" : ""}`}>
      {/* Thumbnail */}
      <td className="px-3 py-2">
        <div className="h-9 w-9 rounded-md border bg-muted/30 overflow-hidden flex items-center justify-center shrink-0">
          {product.hasImage ? (
            <img
              src={getProductImageUrl(product.id, product.updatedAt)}
              alt={product.name}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
          )}
        </div>
      </td>

      {/* SKU */}
      <td className="px-4 py-3">
        <div className="space-y-0.5">
          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
            {product.sku}
          </span>
          {product.internalCode && (
            <div className="text-[10px] text-muted-foreground/70 font-mono pl-0.5">
              {product.internalCode}
            </div>
          )}
        </div>
      </td>

      {/* Nombre */}
      <td className="px-4 py-3">
        <div className="min-w-0">
          <p className="font-medium truncate max-w-xs">{product.name}</p>
          {product.description && (
            <p className="text-xs text-muted-foreground truncate max-w-xs mt-0.5">
              {product.description}
            </p>
          )}
        </div>
      </td>

      {/* Unidad */}
      <td className="px-4 py-3">
        <span className="text-xs text-muted-foreground">
          {UNIT_LABEL[product.unitType] ?? product.unitType}
        </span>
      </td>

      {/* Costo */}
      <td className="px-4 py-3 text-right text-sm text-muted-foreground">
        {fmtPrice(product.costPrice)}
      </td>

      {/* Precio venta */}
      <td className="px-4 py-3 text-right">
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-semibold">{fmtPrice(product.salePrice)}</span>
          {margin !== null && (
            <span className="text-[10px] text-green-600 font-medium">{margin}% margen</span>
          )}
        </div>
      </td>

      {/* Estado */}
      <td className="px-4 py-3 text-center">
        <Badge
          variant="outline"
          className={`text-xs ${
            product.isActive
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-muted text-muted-foreground border-muted-foreground/20"
          }`}
        >
          {product.isActive ? "Activo" : "Inactivo"}
        </Badge>
      </td>

      {/* Acciones */}
      {canAdmin && (
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm" variant="ghost"
              className="h-7 w-7 p-0"
              title="Editar"
              onClick={() => onEdit(product)}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm" variant="ghost"
              className={`h-7 w-7 p-0 ${product.isActive ? "hover:text-destructive" : "hover:text-primary"}`}
              title={product.isActive ? "Desactivar" : "Activar"}
              disabled={isToggling}
              onClick={() => onToggle(product)}
            >
              {product.isActive
                ? <ToggleLeft  className="h-4 w-4" />
                : <ToggleRight className="h-4 w-4" />}
            </Button>
          </div>
        </td>
      )}
    </tr>
  );
}

import { useState } from "react";
import { ShoppingCart, Package, ArrowUpDown, BarChart3 } from "lucide-react";
import { PurchasesTab  } from "./components/PurchasesTab";
import { StockTab      } from "./components/StockTab";
import { MovementsTab  } from "./components/MovementsTab";
import { ValuationTab  } from "./components/ValuationTab";
import { cn } from "@/lib/utils";

// ── Tab config ────────────────────────────────────────────────────────────────

type Tab = "purchases" | "stock" | "movements" | "valuation";

const TABS: { id: Tab; label: string; icon: React.ElementType; description: string }[] = [
  {
    id:          "purchases",
    label:       "Compras",
    icon:        ShoppingCart,
    description: "Órdenes de compra · ingreso de stock",
  },
  {
    id:          "stock",
    label:       "Stock",
    icon:        Package,
    description: "Inventario actual por sede",
  },
  {
    id:          "movements",
    label:       "Movimientos",
    icon:        ArrowUpDown,
    description: "Kardex · traslados · ajustes",
  },
  {
    id:          "valuation",
    label:       "Valoración",
    icon:        BarChart3,
    description: "Dashboard de inventario",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export function InventoryPage() {
  const [tab, setTab] = useState<Tab>("purchases");

  const activeTab = TABS.find((t) => t.id === tab)!;

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inventario</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Compras, stock, movimientos y valoración de productos
        </p>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab description ──────────────────────────────────────── */}
      <p className="text-xs text-muted-foreground -mt-2">{activeTab.description}</p>

      {/* ── Content ──────────────────────────────────────────────── */}
      {tab === "purchases"  && <PurchasesTab />}
      {tab === "stock"      && <StockTab />}
      {tab === "movements"  && <MovementsTab />}
      {tab === "valuation"  && <ValuationTab />}
    </div>
  );
}

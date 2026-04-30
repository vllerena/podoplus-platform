import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CashMovement } from "@/hooks/use-cash-register";

interface Props {
  movement: CashMovement;
}

function fmt(amount: string) {
  return `S/ ${parseFloat(amount).toFixed(2)}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    day:    "2-digit",
    month:  "2-digit",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

export function MovementRow({ movement }: Props) {
  const isIn = movement.type === "IN";

  return (
    <tr className="border-b hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <div className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
          isIn ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
        )}>
          {isIn
            ? <ArrowDownCircle className="h-3.5 w-3.5" />
            : <ArrowUpCircle   className="h-3.5 w-3.5" />
          }
          {isIn ? "Ingreso" : "Egreso"}
        </div>
      </td>
      <td className={cn(
        "px-4 py-3 text-sm font-semibold tabular-nums",
        isIn ? "text-green-600" : "text-red-500"
      )}>
        {isIn ? "+" : "-"}{fmt(movement.amount)}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">
        {movement.reason}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {movement.created_by.name}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
        {fmtDate(movement.created_at)}
      </td>
    </tr>
  );
}

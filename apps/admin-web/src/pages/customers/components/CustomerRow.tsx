import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Eye, Pencil, Trash2, RotateCcw } from "lucide-react";
import {
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@podoplus/ui";
import type { Customer } from "@/hooks/use-customers";

interface Props {
  customer:  Customer;
  onEdit:    (customer: Customer) => void;
  onDelete:  (customer: Customer) => void;
  onRestore: (customer: Customer) => void;
}

const GENDER_LABEL: Record<string, string> = {
  M:     "Masculino",
  F:     "Femenino",
  OTHER: "Otro",
};

export function CustomerRow({ customer, onEdit, onDelete, onRestore }: Props) {
  const navigate   = useNavigate();
  const isDeleted  = !!customer.deletedAt;
  const fullName   = `${customer.firstName} ${customer.lastName}`;
  const initials   = `${customer.firstName[0] ?? ""}${customer.lastName[0] ?? ""}`.toUpperCase();

  return (
    <tr
      className={`border-b transition-colors hover:bg-muted/50 cursor-pointer ${isDeleted ? "opacity-60" : ""}`}
      onClick={() => navigate(`/customers/${customer.id}`)}
    >
      {/* Avatar + nombre */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate max-w-[160px]">{fullName}</p>
            {isDeleted && (
              <span className="text-xs text-destructive">Eliminado</span>
            )}
          </div>
        </div>
      </td>

      {/* Documento */}
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {customer.documentNumber
          ? `${customer.documentType ?? ""} ${customer.documentNumber}`.trim()
          : "—"}
      </td>

      {/* Teléfono */}
      <td className="px-4 py-3 text-sm">
        {customer.phone ?? <span className="text-muted-foreground">—</span>}
      </td>

      {/* Email */}
      <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-[180px]">
        {customer.email ?? "—"}
      </td>

      {/* Tags */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {customer.tags?.slice(0, 3).map((tag) => (
            <Badge
              key={tag.id}
              variant="outline"
              className="text-xs px-1.5 py-0"
              style={{ borderColor: tag.color, color: tag.color }}
            >
              {tag.name}
            </Badge>
          ))}
          {(customer.tags?.length ?? 0) > 3 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              +{(customer.tags?.length ?? 0) - 3}
            </Badge>
          )}
        </div>
      </td>

      {/* Acciones */}
      <td
        className="px-4 py-3 text-right"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => navigate(`/customers/${customer.id}`)}>
              <Eye className="mr-2 h-4 w-4" />
              Ver detalle
            </DropdownMenuItem>
            {!isDeleted && (
              <DropdownMenuItem onClick={() => onEdit(customer)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {isDeleted ? (
              <DropdownMenuItem onClick={() => onRestore(customer)}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Restaurar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => onDelete(customer)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

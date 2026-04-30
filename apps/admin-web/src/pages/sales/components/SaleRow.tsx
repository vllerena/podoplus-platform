import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Eye, Ban, RotateCcw, FileCode2, FileText, Archive } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@podoplus/ui";
import type { Sale } from "@/hooks/use-sales";
import {
  STATUS_LABEL, STATUS_COLOR,
  PAYMENT_LABEL, PAYMENT_ICON,
  fmt, fmtDate,
} from "@/lib/sale-helpers";

// ── Financials helper ─────────────────────────────────────────────────────────

const IGV_RATE = 0.18;

function computeFinancials(sale: Sale) {
  let gravado = 0;
  let igv     = 0;
  for (const item of sale.items) {
    const sub       = parseFloat(item.subtotal) || 0;
    const isGravado = !item.igv_affectation_code || item.igv_affectation_code === "10";
    if (isGravado) {
      const base = sub / (1 + IGV_RATE);
      gravado   += base;
      igv       += sub - base;
    }
  }
  return { gravado, igv, saldo: parseFloat(sale.total_amount) || 0 };
}

// ── Doc link button ───────────────────────────────────────────────────────────

function DocLink({
  href, icon, label, title,
}: {
  href?:  string;
  icon:   React.ReactNode;
  label:  string;
  title?: string;
}) {
  if (!href) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground/40 border border-dashed cursor-not-allowed select-none">
        {icon}
        {label}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title ?? label}
      onClick={e => e.stopPropagation()}
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
    >
      {icon}
      {label}
    </a>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  sale:     Sale;
  onVoid:   (sale: Sale) => void;
  onRefund: (sale: Sale) => void;
}

// ── Row ───────────────────────────────────────────────────────────────────────

export function SaleRow({ sale, onVoid, onRefund }: Props) {
  const navigate = useNavigate();
  const { gravado, igv, saldo } = computeFinancials(sale);

  const canVoid   = sale.status === "PAID";
  const canRefund = sale.status === "PAID";

  const numero = sale.numero_documento ?? null;

  return (
    <tr
      className="border-b transition-colors hover:bg-muted/40 cursor-pointer"
      onClick={() => navigate(`/sales/${sale.id}`)}
    >
      {/* Emisión */}
      <td className="px-4 py-3">
        <p className="text-xs font-medium whitespace-nowrap">{fmtDate(sale.created_at)}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {PAYMENT_ICON[sale.payment_method]} {PAYMENT_LABEL[sale.payment_method]}
        </p>
      </td>

      {/* Cliente */}
      <td className="px-4 py-3 text-sm max-w-[140px]">
        {sale.customer_name ? (
          <span className="font-medium truncate block">{sale.customer_name}</span>
        ) : (
          <span className="text-muted-foreground text-xs">Sin cliente</span>
        )}
        {sale.billing_razon_social && sale.billing_razon_social !== sale.customer_name && (
          <span className="text-[10px] text-muted-foreground block truncate">{sale.billing_razon_social}</span>
        )}
      </td>

      {/* Número comprobante */}
      <td className="px-4 py-3">
        {numero ? (
          <span className="text-xs font-mono font-semibold text-primary">{numero}</span>
        ) : (
          <span className="text-[10px] text-muted-foreground font-mono">
            #{sale.id.slice(-8).toUpperCase()}
          </span>
        )}
        {sale.tipo_comprobante && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {sale.tipo_comprobante === "01" ? "Factura" : "Boleta"}
          </p>
        )}
      </td>

      {/* Estado */}
      <td className="px-4 py-3">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${STATUS_COLOR[sale.status]}`}>
          {STATUS_LABEL[sale.status]}
        </span>
      </td>

      {/* T.Gravado */}
      <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
        {fmt(gravado)}
      </td>

      {/* T.IGV */}
      <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
        {fmt(igv)}
      </td>

      {/* Saldo */}
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-bold">{fmt(saldo)}</span>
        {sale.discount_amount && parseFloat(sale.discount_amount) > 0 && (
          <p className="text-[10px] text-muted-foreground">Desc: {fmt(sale.discount_amount)}</p>
        )}
      </td>

      {/* XML / PDF / CDR + dropdown */}
      <td
        className="px-4 py-3 text-right"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-end gap-1 mb-1.5">
          <DocLink
            href={sale.sunat_xml_url}
            icon={<FileCode2 className="h-2.5 w-2.5" />}
            label="XML"
            title="Descargar XML"
          />
          <DocLink
            href={sale.sunat_pdf_url}
            icon={<FileText className="h-2.5 w-2.5" />}
            label="PDF"
            title="Ver PDF"
          />
          <DocLink
            href={sale.sunat_cdr_url}
            icon={<Archive className="h-2.5 w-2.5" />}
            label="CDR"
            title="Descargar CDR"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => navigate(`/sales/${sale.id}`)}>
              <Eye className="mr-2 h-4 w-4" />
              Ver detalle
            </DropdownMenuItem>
            {(canVoid || canRefund) && <DropdownMenuSeparator />}
            {canVoid && (
              <DropdownMenuItem
                onClick={() => onVoid(sale)}
                className="text-destructive focus:text-destructive"
              >
                <Ban className="mr-2 h-4 w-4" />
                Anular venta
              </DropdownMenuItem>
            )}
            {canRefund && (
              <DropdownMenuItem onClick={() => onRefund(sale)}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reembolsar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

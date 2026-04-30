import { CheckCircle2, Printer, FileText, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, Button } from "@podoplus/ui";
import type { Sale } from "@/hooks/use-sales";
import { fmt } from "@/lib/sale-helpers";

interface Props {
  sale:    Sale | null;
  onClose: () => void;
}

const TIPO_LABEL: Record<string, string> = {
  "01": "Factura",
  "03": "Boleta",
};

export function SaleSuccessModal({ sale, onClose }: Props) {
  if (!sale) return null;

  const numero   = sale.numero_documento ?? null;
  const tipo     = sale.tipo_comprobante ? TIPO_LABEL[sale.tipo_comprobante] ?? "Comprobante" : null;
  const stateOk  = sale.sunat_state_type_id === "05" || sale.sunat_state_type_id === "01";
  const hasA4    = !!sale.sunat_print_a4_url;
  const hasTicket= !!sale.sunat_print_ticket_url;
  const hasPdf   = !!sale.sunat_pdf_url;

  return (
    <Dialog open={!!sale} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl" aria-describedby={undefined}>

        {/* Header strip */}
        <div className="bg-emerald-500 px-6 pt-8 pb-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center justify-center mb-3">
            <CheckCircle2 className="h-14 w-14 text-white drop-shadow" />
          </div>
          <DialogTitle className="text-lg font-bold text-white">¡Venta registrada!</DialogTitle>
          <p className="text-sm text-white/80 mt-1">La transacción se completó correctamente</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Comprobante info */}
          <div className="rounded-xl border bg-muted/30 divide-y">
            {tipo && numero && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-muted-foreground font-medium">{tipo}</span>
                <span className="text-sm font-bold font-mono">{numero}</span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-muted-foreground font-medium">Total</span>
              <span className="text-sm font-bold text-emerald-600">{fmt(sale.total_amount)}</span>
            </div>
            {sale.sunat_state_desc && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-muted-foreground font-medium">Estado SUNAT</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  stateOk
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}>
                  {sale.sunat_state_desc}
                </span>
              </div>
            )}
          </div>

          {/* Print buttons */}
          {(hasA4 || hasTicket || hasPdf) && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Imprimir comprobante
              </p>
              <div className="grid grid-cols-2 gap-2">
                {hasA4 && (
                  <a
                    href={sale.sunat_print_a4_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
                  >
                    <FileText className="h-4 w-4 text-blue-500" />
                    A4
                  </a>
                )}
                {hasTicket && (
                  <a
                    href={sale.sunat_print_ticket_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
                  >
                    <Printer className="h-4 w-4 text-purple-500" />
                    Ticket
                  </a>
                )}
                {!hasA4 && !hasTicket && hasPdf && (
                  <a
                    href={sale.sunat_pdf_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
                  >
                    <FileText className="h-4 w-4 text-blue-500" />
                    Ver PDF
                  </a>
                )}
              </div>
            </div>
          )}

          <Button className="w-full" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}

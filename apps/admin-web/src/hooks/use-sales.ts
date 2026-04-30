import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage } from "@/lib/api";
import { toast } from "@podoplus/ui";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SaleStatus = "PENDING" | "PAID" | "VOIDED" | "REFUNDED";
export type PaymentMethod = "CASH" | "CARD" | "YAPE" | "PLIN" | "TRANSFER" | "MIXED";
export type ItemType = "PRODUCT" | "SERVICE" | "PLAN";

export interface SaleItem {
  id:                   string;
  item_type:            ItemType;
  product_id?:          string;
  service_id?:          string;
  plan_id?:             string;
  name?:                string; // resolved by backend from service/product/plan relation
  quantity:             number;
  unit_price:           string;
  subtotal:             string;
  igv_affectation_code?: string;
  sunat_product_code?:  string;
  unit_type_code?:      string;
}

export type TipoComprobante = "01" | "03"; // 01=Factura, 03=Boleta

export interface CustomerBillingInput {
  tipo_doc?:     string;  // "1"=DNI, "6"=RUC
  num_doc?:      string;
  razon_social?: string;
  direccion?:    string;
  email?:        string;
  telefono?:     string;
  ubigeo?:       string;
}

export interface Sale {
  id:               string;
  branch_id:        string;
  customer_id?:     string;
  customer_name?:   string;
  appointment_id?:  string;
  cash_register_id?: string;
  total_amount:     string;
  discount_amount:  string;
  payment_method:   PaymentMethod;
  status:           SaleStatus;
  notes?:           string;
  void_reason?:     string;
  refund_amount?:   string;
  refund_reason?:   string;
  refunded_at?:     string;
  items:            SaleItem[];
  created_by:       string;
  created_at:       string;
  updated_at:       string;
  // Facturación electrónica
  tipo_comprobante?:       TipoComprobante;
  serie_documento?:        string;
  numero_documento?:       string;  // e.g. "B020-1500"
  billing_tipo_doc?:       string;
  billing_num_doc?:        string;
  billing_razon_social?:   string;
  sunat_external_id?:      string;
  sunat_filename?:         string;
  sunat_state_type_id?:    string;
  sunat_state_desc?:       string;
  sunat_print_ticket_url?: string;
  sunat_print_a4_url?:     string;
  sunat_pdf_url?:          string;
  sunat_xml_url?:          string;
  sunat_cdr_url?:          string;
  sunat_response_code?:    string;
  sunat_response_desc?:    string;
  sunat_emitted_at?:       string;
}

export interface SaleStats {
  branch_id:          string;
  period:             { from: string; to: string };
  total_revenue:      string; // Decimal as string, e.g. "1500.00"
  net_revenue:        string;
  total_refunded:     string;
  total_sales:        number; // count of PAID
  voided_count:       number;
  refunded_count:     number;
  by_payment_method:  Record<string, string>; // method → amount string
  top_services:       Array<{ service_id: string; name: string; count: number; revenue: string }>;
  top_products:       Array<{ product_id: string; name: string; count: number; revenue: string }>;
}

export interface SalesFilters {
  branchId:    string;
  from?:       string; // YYYY-MM-DD
  to?:         string;
  status?:     SaleStatus;
  customerId?: string;
  cursor?:     string;
  limit?:      number;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useSales(filters: SalesFilters) {
  return useQuery({
    queryKey: ["sales", filters],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/sales" as any, {
        params: {
          query: {
            branchId:   filters.branchId,
            from:       filters.from       || undefined,
            to:         filters.to         || undefined,
            status:     filters.status     || undefined,
            customerId: filters.customerId || undefined,
            cursor:     filters.cursor     || undefined,
            limit:      filters.limit      ?? 50,
          },
        },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      return {
        data:       (result?.data ?? []) as Sale[],
        nextCursor: result?.nextCursor as string | undefined,
        hasNext:    result?.hasNext as boolean,
      };
    },
    enabled: !!filters.branchId,
    staleTime: 1000 * 30,
  });
}

export function useSale(id: string) {
  return useQuery({
    queryKey: ["sales", id],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/sales/{id}" as any, {
        params: { path: { id } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as Sale;
    },
    enabled: !!id,
  });
}

export function useSaleStats(branchId: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ["sales", "stats", branchId, from, to],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/sales/stats" as any, {
        params: {
          query: {
            branchId,
            from: from || undefined,
            to:   to   || undefined,
          },
        },
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as SaleStats;
    },
    enabled: !!branchId,
    staleTime: 1000 * 60,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export interface CreateSaleInput {
  branch_id:        string;
  customer_id?:     string;
  appointment_id?:  string;
  items: Array<{
    item_type:  ItemType;
    product_id?: string;
    service_id?: string;
    plan_id?:   string;
    quantity:   number;
    unit_price: number;
  }>;
  discount_amount?:  number;
  payment_method:   PaymentMethod;
  notes?:           string;
  idempotency_key?: string;
  // Facturación electrónica
  tipo_comprobante?: TipoComprobante;
  serie_documento?:  string;
  customer_billing?: CustomerBillingInput;
}

export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSaleInput) => {
      const { data, error } = await api.POST("/v1/sales" as any, {
        body: input as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as Sale;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      toast({ title: "Venta registrada", description: "La venta se registró correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al registrar venta", description: err.message, variant: "destructive" });
    },
  });
}

export function useVoidSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await api.POST("/v1/sales/{id}/void" as any, {
        params: { path: { id } },
        body: { reason } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as Sale;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      toast({ title: "Venta anulada" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al anular", description: err.message, variant: "destructive" });
    },
  });
}

export function useRefundSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount, reason }: { id: string; amount: number; reason: string }) => {
      const { data, error } = await api.POST("/v1/sales/{id}/refund" as any, {
        params: { path: { id } },
        body: { amount, reason } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as Sale;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      toast({ title: "Reembolso registrado" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al reembolsar", description: err.message, variant: "destructive" });
    },
  });
}

// ── Audit history ─────────────────────────────────────────────────────────────

export interface SaleHistoryEntry {
  id:         string;
  action:     string;
  actorId?:   string;
  actorType:  string;
  metadata?:  Record<string, unknown>;
  createdAt:  string;
}

export function useSaleHistory(saleId: string) {
  return useQuery({
    queryKey: ["sales", saleId, "history"],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/sales/{id}/history" as any, {
        params: { path: { id: saleId } },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      return (result?.data ?? result ?? []) as SaleHistoryEntry[];
    },
    enabled: !!saleId,
    staleTime: 1000 * 60,
  });
}

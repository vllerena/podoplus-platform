import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage } from "@/lib/api";
import { toast } from "@podoplus/ui";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Product {
  id:                   string;
  sku:                  string;
  name:                 string;
  description?:         string | null;
  unit_type:            string;
  cost_price:           string;
  sale_price:           string;
  is_active:            boolean;
  internal_code?:       string | null;
  sunat_product_code?:  string | null;
  unit_type_code:       string;
  igv_affectation_code: string;
  has_igv:              boolean;
  created_at:           string;
  updated_at:           string;
}

export interface StockItem {
  branch_id:    string;
  product_id:   string;
  product_sku:  string;
  product_name: string;
  unit_type:    string;
  cost_price:   string;
  sale_price:   string;
  quantity:     number;
  has_record:   boolean;
  updated_at:   string | null;
}

export interface LowStockAlert {
  branch_id:    string;
  threshold:    number;
  total_alerts: number;
  alerts: Array<{
    product_id:      string;
    product_sku:     string;
    product_name:    string;
    unit_type:       string;
    quantity:        number;
    is_out_of_stock: boolean;
    updated_at:      string;
  }>;
}

export interface InventoryValuation {
  branch_id:        string;
  total_products:   number;
  total_cost_value: string;
  total_sale_value: string;
  potential_margin: string;
  items: Array<{
    product_id:   string;
    product_sku:  string;
    product_name: string;
    quantity:     number;
    unit_cost:    string;
    unit_price:   string;
    cost_value:   string;
    sale_value:   string;
  }>;
}

export type MovementType =
  | "PURCHASE_IN"
  | "ADJUSTMENT"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "SALE_OUT"
  | "RETURN_IN";

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  PURCHASE_IN:  "Compra / Entrada",
  ADJUSTMENT:   "Ajuste de stock",
  TRANSFER_OUT: "Transferencia salida",
  TRANSFER_IN:  "Transferencia entrada",
  SALE_OUT:     "Venta (salida)",
  RETURN_IN:    "Devolución (entrada)",
};

export const MOVEMENT_COLOR: Record<MovementType, string> = {
  PURCHASE_IN:  "bg-green-50 text-green-700",
  ADJUSTMENT:   "bg-amber-50 text-amber-700",
  TRANSFER_OUT: "bg-blue-50 text-blue-600",
  TRANSFER_IN:  "bg-blue-50 text-blue-600",
  SALE_OUT:     "bg-red-50 text-red-500",
  RETURN_IN:    "bg-purple-50 text-purple-600",
};

export interface InventoryMovement {
  id:             string;
  branch_id:      string;
  product_id:     string;
  product_sku?:   string;
  product_name?:  string;
  type:           MovementType;
  quantity:       number;
  reference_type?: string;
  reference_id?:   string;
  reason?:        string;
  created_by:     string;
  created_at:     string;
}

// ── Product hooks ─────────────────────────────────────────────────────────────

export function useProducts(params: { q?: string; active?: boolean; cursor?: string; limit?: number } = {}) {
  return useQuery({
    queryKey: ["products", params],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/products" as any, {
        params: {
          query: {
            q:      params.q      || undefined,
            active: params.active !== undefined ? String(params.active) : undefined,
            cursor: params.cursor || undefined,
            limit:  params.limit  ?? 50,
          },
        },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      return {
        data:       (result?.data ?? []) as Product[],
        nextCursor: result?.nextCursor as string | undefined,
        hasNext:    result?.hasNext    as boolean,
      };
    },
    staleTime: 1000 * 60,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ["products", id],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/products/{id}" as any, {
        params: { path: { id } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as Product;
    },
    enabled: !!id,
  });
}

// ── Stock hooks ───────────────────────────────────────────────────────────────

export function useStocks(branchId: string, includeAll = true) {
  return useQuery({
    queryKey: ["inventory", "stocks", branchId, includeAll],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/inventory/stocks" as any, {
        params: { query: { branchId, includeAll: String(includeAll) } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return (data ?? []) as StockItem[];
    },
    enabled:   !!branchId,
    staleTime: 1000 * 30,
  });
}

export function useLowStockAlerts(branchId: string, threshold = 5) {
  return useQuery({
    queryKey: ["inventory", "low-stock", branchId, threshold],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/inventory/stocks/low" as any, {
        params: { query: { branchId, threshold: String(threshold) } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as LowStockAlert;
    },
    enabled:   !!branchId,
    staleTime: 1000 * 60,
  });
}

export function useInventoryValuation(branchId: string) {
  return useQuery({
    queryKey: ["inventory", "valuation", branchId],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/inventory/valuation" as any, {
        params: { query: { branchId } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as InventoryValuation;
    },
    enabled:   !!branchId,
    staleTime: 1000 * 60,
  });
}

export function useInventoryMovements(params: {
  branchId:   string;
  productId?: string;
  type?:      string;
  from?:      string;
  to?:        string;
  cursor?:    string;
  limit?:     number;
}) {
  return useQuery({
    queryKey: ["inventory", "movements", params],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/inventory/movements" as any, {
        params: {
          query: {
            branchId:  params.branchId,
            productId: params.productId || undefined,
            type:      params.type      || undefined,
            from:      params.from      || undefined,
            to:        params.to        || undefined,
            cursor:    params.cursor    || undefined,
            limit:     params.limit     ?? 50,
          },
        },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      return {
        data:       (result?.data ?? []) as InventoryMovement[],
        nextCursor: result?.nextCursor as string | undefined,
        hasNext:    result?.hasNext    as boolean,
      };
    },
    enabled:   !!params.branchId,
    staleTime: 1000 * 30,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export interface CreateProductInput {
  sku:                  string;
  name:                 string;
  description?:         string;
  unit_type:            string;
  cost_price:           number;
  sale_price:           number;
  is_active?:           boolean;
  internal_code?:       string;
  sunat_product_code?:  string;
  unit_type_code?:      string;
  igv_affectation_code?: string;
  has_igv?:             boolean;
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      const { data, error } = await api.POST("/v1/products" as any, {
        body: input as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as Product;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast({ title: "Producto creado correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al crear producto", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateProductInput> & { id: string }) => {
      const { data, error } = await api.PATCH("/v1/products/{id}" as any, {
        params: { path: { id } },
        body: input as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as Product;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Producto actualizado correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al actualizar producto", description: err.message, variant: "destructive" });
    },
  });
}

export function useDisableProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.DELETE("/v1/products/{id}" as any, {
        params: { path: { id } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as Product;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Producto desactivado." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al desactivar producto", description: err.message, variant: "destructive" });
    },
  });
}

export function useEnableProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.POST("/v1/products/{id}/enable" as any, {
        params: { path: { id } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as Product;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Producto reactivado correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al reactivar producto", description: err.message, variant: "destructive" });
    },
  });
}

export interface RegisterMovementInput {
  branch_id:        string;
  product_id:       string;
  type:             "PURCHASE_IN" | "ADJUSTMENT" | "TRANSFER_OUT" | "TRANSFER_IN";
  quantity:         number;
  reason?:          string;
  target_branch_id?: string;
}

export function useRegisterMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegisterMovementInput) => {
      const { data, error } = await api.POST("/v1/inventory/movements" as any, {
        body: input as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as InventoryMovement;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast({ title: "Movimiento registrado correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al registrar movimiento", description: err.message, variant: "destructive" });
    },
  });
}

// ── Supplier types & hooks ────────────────────────────────────────────────────

export interface Supplier {
  id:              string;
  document_type:   string;
  document_number: string | null;
  name:            string;
  address:         string | null;
  phone:           string | null;
  email:           string | null;
  is_active:       boolean;
  created_at:      string;
  updated_at:      string;
}

export interface CreateSupplierInput {
  document_type?:   string;
  document_number?: string;
  name:             string;
  address?:         string;
  phone?:           string;
  email?:           string;
}

export function useSuppliers(q?: string) {
  return useQuery({
    queryKey: ["suppliers", q],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/suppliers" as any, {
        params: { query: { q: q || undefined } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return (data as Supplier[]) ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSupplierInput) => {
      const { data, error } = await api.POST("/v1/suppliers" as any, { body: input as any });
      if (error) throw new Error(getErrorMessage(error));
      return data as Supplier;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: "Proveedor creado correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al crear proveedor", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateSupplier(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CreateSupplierInput>) => {
      const { data, error } = await api.PATCH("/v1/suppliers/{id}" as any, {
        params: { path: { id } } as any,
        body:   input as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as Supplier;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: "Proveedor actualizado correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al actualizar proveedor", description: err.message, variant: "destructive" });
    },
  });
}

export function useDisableSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.DELETE("/v1/suppliers/{id}" as any, {
        params: { path: { id } } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as Supplier;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: "Proveedor deshabilitado." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al deshabilitar proveedor", description: err.message, variant: "destructive" });
    },
  });
}

// ── Lookup hooks (SUNAT / RENIEC via /v1/lookup) ──────────────────────────────

export interface RucLookupResult {
  documentNumber: string;
  name:           string;
  address:        string | null;
  state?:         string;
  condition?:     string;
}

export interface DniLookupResult {
  documentNumber: string;
  firstName:      string;
  lastName:       string;
  fullName:       string;
}

export function useRucLookup() {
  return useMutation({
    mutationFn: async (ruc: string): Promise<RucLookupResult> => {
      const { data, error } = await api.GET("/v1/lookup/ruc/{ruc}" as any, {
        params: { path: { ruc } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as RucLookupResult;
    },
  });
}

export function useDniLookup() {
  return useMutation({
    mutationFn: async (documentNumber: string): Promise<DniLookupResult> => {
      const { data, error } = await api.GET("/v1/lookup/dni/{documentNumber}" as any, {
        params: { path: { documentNumber } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as DniLookupResult;
    },
  });
}

// ── Purchase types & hooks ────────────────────────────────────────────────────

export type PurchaseStatus = "DRAFT" | "RECEIVED" | "CANCELLED";

export const VOUCHER_TYPE_LABEL: Record<string, string> = {
  FACTURA:       "Factura",
  BOLETA:        "Boleta",
  NOTA_ENTRADA:  "Nota de entrada",
  LIQUIDACION:   "Liquidación",
  TICKET:        "Ticket",
  OTHER:         "Otro",
};

export interface PurchaseItem {
  id:             string;
  product_id:     string;
  product_sku:    string | null;
  product_name:   string | null;
  branch_id:      string;
  branch_name:    string | null;
  lot:            string | null;
  unit_type_code: string;
  quantity:       string;
  unit_value:     string;
  unit_price:     string;
  discount:       string;
  charge:         string;
  total_amount:   string;
}

export interface Purchase {
  id:            string;
  supplier_id:   string;
  supplier_name: string | null;
  voucher_type:  string;
  serie:         string;
  number:        string;
  emission_date: string;
  due_date:      string | null;
  currency:      string;
  exchange_rate: string;
  subtotal:      string;
  tax_amount:    string;
  total_amount:  string;
  status:        PurchaseStatus;
  notes:         string | null;
  items_count:   number;
  received_at:   string | null;
  cancelled_at:  string | null;
  cancel_reason: string | null;
  created_at:    string;
  updated_at:    string;
}

export interface PurchaseDetail extends Purchase {
  supplier:     Supplier | null;
  items:        PurchaseItem[];
}

export interface CreatePurchaseItemInput {
  product_id:     string;
  branch_id:      string;
  quantity:       number;
  unit_value:     number;
  unit_price:     number;
  total_amount:   number;
  lot?:           string;
  discount?:      number;
  charge?:        number;
  unit_type_code?: string;
}

export interface CreatePurchaseInput {
  supplier_id:    string;
  voucher_type:   string;
  serie:          string;
  number:         string;
  emission_date:  string;
  due_date?:      string;
  currency?:      string;
  exchange_rate?: number;
  subtotal?:      number;
  tax_amount?:    number;
  total_amount?:  number;
  notes?:         string;
  items?:         CreatePurchaseItemInput[];
}

export function usePurchases(params: {
  supplierId?: string;
  status?:     PurchaseStatus;
  from?:       string;
  to?:         string;
  cursor?:     string;
  limit?:      number;
} = {}) {
  return useQuery({
    queryKey: ["purchases", params],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/purchases" as any, {
        params: {
          query: {
            supplierId: params.supplierId || undefined,
            status:     params.status     || undefined,
            from:       params.from       || undefined,
            to:         params.to         || undefined,
            cursor:     params.cursor     || undefined,
            limit:      params.limit      ?? 50,
          },
        },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      return {
        data:       (result?.data ?? []) as Purchase[],
        nextCursor: result?.nextCursor as string | undefined,
        hasNext:    result?.hasNext    as boolean,
      };
    },
    staleTime: 1000 * 30,
  });
}

export function usePurchase(id: string) {
  return useQuery({
    queryKey: ["purchases", id],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/purchases/{id}" as any, {
        params: { path: { id } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as PurchaseDetail;
    },
    enabled: !!id,
    staleTime: 1000 * 30,
  });
}

export function useCreatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePurchaseInput) => {
      const { data, error } = await api.POST("/v1/purchases" as any, { body: input as any });
      if (error) throw new Error(getErrorMessage(error));
      return data as Purchase;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      toast({ title: "Compra registrada en borrador." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al registrar compra", description: err.message, variant: "destructive" });
    },
  });
}

export function useReceivePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.POST("/v1/purchases/{id}/receive" as any, {
        params: { path: { id } },
        body:   {} as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as PurchaseDetail;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast({ title: "Compra recibida. Stock actualizado correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al recibir compra", description: err.message, variant: "destructive" });
    },
  });
}

export function useCancelPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data, error } = await api.POST("/v1/purchases/{id}/cancel" as any, {
        params: { path: { id } },
        body:   { reason } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      toast({ title: "Compra cancelada." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al cancelar compra", description: err.message, variant: "destructive" });
    },
  });
}

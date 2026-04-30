import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage, uploadFile } from "@/lib/api";
import { toast } from "@podoplus/ui";

// ── Types ─────────────────────────────────────────────────────────────────────

export type UnitType = "unit" | "box" | "bottle" | "pair" | "bag" | "other";

export interface Product {
  id:                 string;
  sku:                string;
  name:               string;
  description:        string | null;
  unitType:           UnitType;
  costPrice:          string; // Decimal as string
  salePrice:          string; // Decimal as string
  isActive:           boolean;
  hasImage:           boolean;
  internalCode:       string | null;
  sunatProductCode:   string | null;
  unitTypeCode:       string;
  igvAffectationCode: string;
  hasIgv:             boolean;
  createdAt:          string;
  updatedAt:          string;
}

export interface CreateProductInput {
  sku:                  string;
  name:                 string;
  description?:         string;
  unit_type:            UnitType;
  cost_price:           number;
  sale_price:           number;
  internal_code?:       string;
  sunat_product_code?:  string;
  unit_type_code?:      string;
  igv_affectation_code?: string;
  has_igv?:             boolean;
}

export type UpdateProductInput = Partial<CreateProductInput>;

// ── Query keys ────────────────────────────────────────────────────────────────

export const productKeys = {
  all:    ["products"] as const,
  list:   (params?: object) => ["products", "list", params] as const,
  detail: (id: string)      => ["products", "detail", id]  as const,
};

// ── Normalizer ────────────────────────────────────────────────────────────────

function normalizeProduct(raw: any): Product {
  return {
    id:                 raw.id,
    sku:                raw.sku ?? "",
    name:               raw.name ?? "",
    description:        raw.description          ?? null,
    unitType:           (raw.unit_type           ?? raw.unitType           ?? "unit") as UnitType,
    costPrice:          String(raw.cost_price     ?? raw.costPrice          ?? "0"),
    salePrice:          String(raw.sale_price     ?? raw.salePrice          ?? "0"),
    isActive:           raw.is_active             ?? raw.isActive           ?? true,
    hasImage:           raw.has_image             ?? raw.hasImage           ?? false,
    internalCode:       raw.internal_code         ?? raw.internalCode       ?? null,
    sunatProductCode:   raw.sunat_product_code    ?? raw.sunatProductCode   ?? null,
    unitTypeCode:       raw.unit_type_code        ?? raw.unitTypeCode       ?? "NIU",
    igvAffectationCode: raw.igv_affectation_code  ?? raw.igvAffectationCode ?? "10",
    hasIgv:             raw.has_igv               ?? raw.hasIgv             ?? true,
    createdAt:          raw.created_at            ?? raw.createdAt          ?? "",
    updatedAt:          raw.updated_at            ?? raw.updatedAt          ?? "",
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useProducts(params?: { q?: string; active?: boolean }) {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/products" as any, {
        params: {
          query: {
            q:      params?.q      || undefined,
            active: params?.active ?? undefined,
            limit:  200,
          },
        },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      const raw = (result?.data ?? result ?? []) as any[];
      return raw.map(normalizeProduct);
    },
    staleTime: 1000 * 30,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/products/{id}" as any, {
        params: { path: { id } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return normalizeProduct(data as any);
    },
    enabled: !!id,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateProductInput) => {
      const { data, error } = await api.POST("/v1/products" as any, {
        body: body as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return normalizeProduct(data as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all });
      toast({ title: "Producto creado", description: "El producto fue registrado exitosamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al crear producto", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateProductInput) => {
      const { data, error } = await api.PATCH("/v1/products/{id}" as any, {
        params: { path: { id } } as any,
        body: body as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return normalizeProduct(data as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all });
      toast({ title: "Producto actualizado", description: "Los cambios se guardaron correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al actualizar producto", description: err.message, variant: "destructive" });
    },
  });
}

export function useEnableProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.POST("/v1/products/{id}/enable" as any, {
        params: { path: { id } } as any,
        body: {} as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return normalizeProduct(data as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all });
      toast({ title: "Producto activado" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al activar producto", description: err.message, variant: "destructive" });
    },
  });
}

export function useDisableProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.DELETE("/v1/products/{id}" as any, {
        params: { path: { id } } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return normalizeProduct(data as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all });
      toast({ title: "Producto desactivado" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al desactivar producto", description: err.message, variant: "destructive" });
    },
  });
}

export function useUploadProductImage(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      return uploadFile(`/v1/products/${productId}/image`, file);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all });
      toast({ title: "Imagen actualizada", description: "La imagen del producto se actualizó correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al subir imagen", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteProductImage(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await api.DELETE("/v1/products/{id}/image" as any, {
        params: { path: { id: productId } } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all });
      toast({ title: "Imagen eliminada" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar imagen", description: err.message, variant: "destructive" });
    },
  });
}

/**
 * URL directa a la imagen del producto (sirve como src de <img>).
 * El parámetro `bust` se usa como query string para invalidar la caché del browser
 * cuando la imagen cambia (pasar updatedAt o un timestamp).
 */
export function getProductImageUrl(productId: string, bust?: string): string {
  const base = import.meta.env.VITE_API_URL ?? "";
  const url  = `${base}/v1/products/${productId}/image`;
  return bust ? `${url}?v=${encodeURIComponent(bust)}` : url;
}

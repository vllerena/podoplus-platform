import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, uploadFile } from "@/lib/api";
import { getErrorMessage } from "@/lib/api";
import { toast } from "@podoplus/ui";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ServiceCategory {
  id:    string;
  name:  string;
  color: string;
  order: number;
}

export interface Service {
  id:                  string;
  name:                string;
  description:         string | null;
  durationMinutes:     number;
  bufferMinutes:       number;
  basePrice:           number | string; // Prisma Decimal → serializado como string en JSON
  allowSelfService:    boolean;
  isActive:            boolean;
  color:               string | null;
  internalCode:        string | null;
  categoryId:          string | null;
  category:            ServiceCategory | null;
  hasImage:            boolean;
  imageUrl:            string | null;  // relative: /v1/services/:id/image cuando hasImage=true
  // Campos SUNAT / facturación electrónica
  sunatProductCode:    string | null;
  unitTypeCode:        string | null;
  igvAffectationCode:  string | null;
  hasIgv:              boolean;
  createdAt:           string;
  updatedAt:           string;
}

export interface ServiceStats {
  totalAppointments:      number;
  completedAppointments:  number;
  canceledAppointments:   number;   // ojo: un solo 'l' (backend usa "canceled")
  noShowAppointments:     number;
  totalRevenue:           number;
  completionRate:         number;
  cancelRate:             number;
  salesCount:             number;
  branchesWithCustomPrice: number;
}

export interface BranchPrice {
  branchId:   string;
  branchName: string;
  price:      number;
}

/** Shape real que devuelve GET /v1/services/:id/prices */
interface ServicePricesResponse {
  serviceId:    string;
  serviceName:  string;
  basePrice:    number;
  branchPrices: BranchPrice[];
}

export interface ServiceHistoryEntry {
  id:        string;
  action:    string;
  changes:   Record<string, unknown> | null;
  userId:    string | null;
  userName:  string | null;
  createdAt: string;
}

export interface CreateServiceDto {
  name:                string;
  description?:        string;
  durationMinutes:     number;
  bufferMinutes?:      number;
  basePrice:           number;
  allowSelfService?:   boolean;
  color?:              string;
  categoryId?:         string;
  internalCode?:       string;
  sunatProductCode?:   string;
  unitTypeCode?:       string;
  igvAffectationCode?: string;
  hasIgv?:             boolean;
}

export interface UpdateServiceDto extends Partial<CreateServiceDto> {}

export interface CreateCategoryDto {
  name:   string;
  color?: string;
  order?: number;
}

export interface SetBranchPriceDto {
  branchId: string;
  price:    number;
}

// ── Normalización ─────────────────────────────────────────────────────────────

function normalizeService(raw: any): Service {
  const hasImage = raw.hasImage ?? false;
  return {
    id:                  raw.id,
    name:                raw.name,
    description:         raw.description ?? null,
    durationMinutes:     raw.durationMinutes,
    bufferMinutes:       raw.bufferMinutes ?? 0,
    basePrice:           raw.basePrice,
    allowSelfService:    raw.allowSelfService ?? false,
    isActive:            raw.isActive ?? true,
    color:               raw.color ?? null,
    internalCode:        raw.internalCode ?? null,
    categoryId:          raw.categoryId ?? null,
    category:            raw.category ?? null,
    hasImage,
    imageUrl:            hasImage ? `/v1/services/${raw.id}/image` : null,
    sunatProductCode:    raw.sunatProductCode ?? null,
    unitTypeCode:        raw.unitTypeCode ?? null,
    igvAffectationCode:  raw.igvAffectationCode ?? null,
    hasIgv:              raw.hasIgv ?? true,
    createdAt:           raw.createdAt,
    updatedAt:           raw.updatedAt,
  };
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const serviceKeys = {
  all:        ["services"] as const,
  lists:      () => [...serviceKeys.all, "list"] as const,
  list:       (params: Record<string, unknown>) => [...serviceKeys.lists(), params] as const,
  detail:     (id: string) => [...serviceKeys.all, "detail", id] as const,
  stats:      (id: string) => [...serviceKeys.all, "stats", id] as const,
  prices:     (id: string) => [...serviceKeys.all, "prices", id] as const,
  categories: () => [...serviceKeys.all, "categories"] as const,
  history:    (id: string) => [...serviceKeys.all, "history", id] as const,
};

// ── Hooks de lectura ──────────────────────────────────────────────────────────

/** Lista todos los servicios (activos por default, todos con all=true) */
export function useServices(params?: { all?: boolean; categoryId?: string }) {
  return useQuery({
    queryKey: serviceKeys.list(params ?? {}),
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (params?.all) query.all = "true";
      if (params?.categoryId) query.categoryId = params.categoryId;

      const { data, error } = await api.GET("/v1/services" as any, {
        params: { query } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return (data as any[]).map(normalizeService);
    },
  });
}

/** Detalle de un servicio */
export function useService(id: string | undefined) {
  return useQuery({
    queryKey: serviceKeys.detail(id ?? ""),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/services/{id}" as any, {
        params: { path: { id } } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return normalizeService(data);
    },
    enabled: !!id,
  });
}

/** Categorías de servicios */
export function useServiceCategories() {
  return useQuery({
    queryKey: serviceKeys.categories(),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/services/categories" as any, {} as any);
      if (error) throw new Error(getErrorMessage(error));
      return data as ServiceCategory[];
    },
  });
}

/**
 * Precios por sucursal de un servicio.
 * La API devuelve { serviceId, serviceName, basePrice, branchPrices: [...] }
 * o directamente un array — normalizamos ambos casos.
 */
export function useServicePrices(id: string | undefined) {
  return useQuery({
    queryKey: serviceKeys.prices(id ?? ""),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/services/{id}/prices" as any, {
        params: { path: { id } } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      const raw = data as any;
      // Soporte para ambas formas de respuesta
      const arr: BranchPrice[] = Array.isArray(raw)
        ? raw
        : (raw?.branchPrices ?? []);
      return arr;
    },
    enabled: !!id,
  });
}

/** Estadísticas de un servicio */
export function useServiceStats(id: string | undefined) {
  return useQuery({
    queryKey: serviceKeys.stats(id ?? ""),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/services/{id}/stats" as any, {
        params: { path: { id } } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as ServiceStats;
    },
    enabled: !!id,
  });
}

/** Historial de cambios de un servicio */
export function useServiceHistory(id: string | undefined) {
  return useQuery({
    queryKey: serviceKeys.history(id ?? ""),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/services/{id}/history" as any, {
        params: { path: { id } } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as ServiceHistoryEntry[];
    },
    enabled: !!id,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateServiceDto) => {
      const { data, error } = await api.POST("/v1/services" as any, { body } as any);
      if (error) throw new Error(getErrorMessage(error));
      return normalizeService(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceKeys.lists() });
      toast({ title: "Servicio creado", description: "El servicio fue registrado exitosamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al crear servicio", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateService(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateServiceDto) => {
      const { data, error } = await api.PATCH("/v1/services/{id}" as any, {
        params: { path: { id } } as any,
        body,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      return normalizeService(data);
    },
    onSuccess: (updated) => {
      qc.setQueryData(serviceKeys.detail(id), updated);
      qc.invalidateQueries({ queryKey: serviceKeys.lists() });
      toast({ title: "Servicio actualizado", description: "Los cambios se guardaron correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al actualizar servicio", description: err.message, variant: "destructive" });
    },
  });
}

export function useActivateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.POST("/v1/services/{id}/activate" as any, {
        params: { path: { id } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceKeys.lists() });
      toast({ title: "Servicio activado" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al activar servicio", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeactivateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.POST("/v1/services/{id}/deactivate" as any, {
        params: { path: { id } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceKeys.lists() });
      toast({ title: "Servicio desactivado" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al desactivar servicio", description: err.message, variant: "destructive" });
    },
  });
}

/** Sube la imagen de un servicio (multipart/form-data) */
export function useUploadServiceImage(serviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadFile(`/v1/services/${serviceId}/image`, file),
    onSuccess: () => {
      const imageUrl = `/v1/services/${serviceId}/image`;
      qc.setQueryData(
        serviceKeys.detail(serviceId),
        (old: Service | undefined) =>
          old ? { ...old, hasImage: true, imageUrl } : old,
      );
      qc.invalidateQueries({ queryKey: serviceKeys.lists() });
      toast({ title: "Imagen del servicio actualizada." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al subir imagen", description: err.message, variant: "destructive" });
    },
  });
}

/** Elimina la imagen de un servicio */
export function useDeleteServiceImage(serviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await api.DELETE("/v1/services/{id}/image" as any, {
        params: { path: { id: serviceId } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.setQueryData(
        serviceKeys.detail(serviceId),
        (old: Service | undefined) =>
          old ? { ...old, hasImage: false, imageUrl: null } : old,
      );
      qc.invalidateQueries({ queryKey: serviceKeys.lists() });
      toast({ title: "Imagen eliminada." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar imagen", description: err.message, variant: "destructive" });
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateCategoryDto) => {
      const { data, error } = await api.POST("/v1/services/categories" as any, { body } as any);
      if (error) throw new Error(getErrorMessage(error));
      return data as ServiceCategory;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceKeys.categories() });
      toast({ title: "Categoría creada" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al crear categoría", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<CreateCategoryDto> }) => {
      const { data, error } = await api.PATCH("/v1/services/categories/{categoryId}" as any, {
        params: { path: { categoryId: id } } as any,
        body,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      return data as ServiceCategory;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceKeys.categories() });
      toast({ title: "Categoría actualizada" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al actualizar categoría", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE("/v1/services/categories/{categoryId}" as any, {
        params: { path: { categoryId: id } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceKeys.categories() });
      toast({ title: "Categoría eliminada" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar categoría", description: err.message, variant: "destructive" });
    },
  });
}

export function useSetBranchPrice(serviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ branchId, price }: SetBranchPriceDto) => {
      const { data, error } = await api.PUT("/v1/services/{id}/prices/{branchId}" as any, {
        params: { path: { id: serviceId, branchId } } as any,
        body: { price } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      return data as BranchPrice;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceKeys.prices(serviceId) });
      toast({ title: "Precio actualizado", description: "El precio de la sucursal fue guardado." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al actualizar precio", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteBranchPrice(serviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (branchId: string) => {
      const { error } = await api.DELETE("/v1/services/{id}/prices/{branchId}" as any, {
        params: { path: { id: serviceId, branchId } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceKeys.prices(serviceId) });
      toast({
        title:       "Precio eliminado",
        description: "La sucursal volvió al precio base del servicio.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar precio", description: err.message, variant: "destructive" });
    },
  });
}

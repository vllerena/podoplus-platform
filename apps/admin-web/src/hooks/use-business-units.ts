import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage, uploadFile } from "@/lib/api";
import { toast } from "@podoplus/ui";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BusinessUnitBranch {
  id:           string;
  name:         string;
  code:         string | null;
  address:      string | null;
  attachedCode: string | null;
  isActive:     boolean;
}

export interface BusinessUnit {
  id:          string;
  name:        string;
  ruc:         string | null;
  address:     string | null;
  hasLogo:     boolean;
  hasBanner:   boolean;
  website:     string | null;
  email:       string | null;
  phone:       string | null;
  isActive:    boolean;
  branchCount?: number;
  branches?:   BusinessUnitBranch[];
  /** Solo disponible en findOne (GET /:id). Null si no configurado. */
  sunatEndpoint?: string | null;
  sunatToken?:    string | null;
  createdAt:   string;
  updatedAt:   string;
}

export interface CreateBusinessUnitDto {
  name:           string;
  ruc?:           string;
  address?:       string;
  website?:       string;
  email?:         string;
  phone?:         string;
  sunatEndpoint?: string;
  sunatToken?:    string;
}

export type UpdateBusinessUnitDto = Partial<CreateBusinessUnitDto> & { isActive?: boolean };

// ── Query keys ────────────────────────────────────────────────────────────────

export const businessUnitKeys = {
  all:    ["business-units"] as const,
  detail: (id: string) => ["business-units", "detail", id] as const,
};

// ── Hooks — Read ──────────────────────────────────────────────────────────────

export function useBusinessUnits() {
  return useQuery({
    queryKey: businessUnitKeys.all,
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/business-units" as any, {} as any);
      if (error) throw new Error(getErrorMessage(error));
      return (data as BusinessUnit[]) ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useBusinessUnit(id: string | undefined) {
  return useQuery({
    queryKey: businessUnitKeys.detail(id ?? ""),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/business-units/{id}" as any, {
        params: { path: { id } },
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      return data as BusinessUnit;
    },
    enabled: !!id,
  });
}

// ── Hooks — Mutations ─────────────────────────────────────────────────────────

export function useCreateBusinessUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateBusinessUnitDto) => {
      const { data, error } = await api.POST("/v1/business-units" as any, { body } as any);
      if (error) throw new Error(getErrorMessage(error));
      return data as BusinessUnit;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: businessUnitKeys.all });
      toast({ title: "Empresa creada exitosamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al crear empresa", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateBusinessUnit(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateBusinessUnitDto) => {
      const { data, error } = await api.PATCH("/v1/business-units/{id}" as any, {
        params: { path: { id } },
        body,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      return data as BusinessUnit;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: businessUnitKeys.all });
      qc.invalidateQueries({ queryKey: businessUnitKeys.detail(id) });
      toast({ title: "Empresa actualizada." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al actualizar empresa", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteBusinessUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE("/v1/business-units/{id}" as any, {
        params: { path: { id } },
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: businessUnitKeys.all });
      toast({ title: "Empresa eliminada." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar empresa", description: err.message, variant: "destructive" });
    },
  });
}

// ── Logo ──────────────────────────────────────────────────────────────────────

export function useUploadBusinessUnitLogo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadFile(`/v1/business-units/${id}/logo`, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: businessUnitKeys.all });
      qc.invalidateQueries({ queryKey: businessUnitKeys.detail(id) });
      toast({ title: "Logo actualizado." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al subir logo", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteBusinessUnitLogo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await api.DELETE("/v1/business-units/{id}/logo" as any, {
        params: { path: { id } },
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: businessUnitKeys.all });
      qc.invalidateQueries({ queryKey: businessUnitKeys.detail(id) });
      toast({ title: "Logo eliminado." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar logo", description: err.message, variant: "destructive" });
    },
  });
}

// ── Banner ────────────────────────────────────────────────────────────────────

export function useUploadBusinessUnitBanner(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadFile(`/v1/business-units/${id}/banner`, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: businessUnitKeys.all });
      qc.invalidateQueries({ queryKey: businessUnitKeys.detail(id) });
      toast({ title: "Banner actualizado." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al subir banner", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteBusinessUnitBanner(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await api.DELETE("/v1/business-units/{id}/banner" as any, {
        params: { path: { id } },
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: businessUnitKeys.all });
      qc.invalidateQueries({ queryKey: businessUnitKeys.detail(id) });
      toast({ title: "Banner eliminado." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar banner", description: err.message, variant: "destructive" });
    },
  });
}

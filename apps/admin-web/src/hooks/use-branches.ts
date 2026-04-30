/**
 * use-branches.ts
 * Todos los hooks de lectura y mutación para el módulo de Sucursales.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage, uploadFile, ApiError } from "@/lib/api";
import { toast } from "@podoplus/ui";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface Branch {
  id:              string;
  code:            string | null;
  name:            string;
  address:         string | null;
  district:        string | null;
  city:            string | null;
  phone:           string | null;
  email:           string | null;
  latitude:        number | null;
  longitude:       number | null;
  googleMapsUrl:   string | null;
  isActive:        boolean;
  defaultCapacity: number;
  timezone:        string;
  /** true = la sede tiene foto guardada en BD (binario). */
  hasPhoto:        boolean;
  /**
   * URL relativa para mostrar la foto: `/v1/branches/:id/photo` cuando
   * hasPhoto=true. Al ser relativa va a través del Vite proxy (dev) o del
   * reverse-proxy del servidor (prod), evitando bloqueos CORP/COEP.
   */
  photoUrl:        string | null;
  createdAt:       string;
  updatedAt:       string;
  businessUnitId:  string | null;
  banner:          string | null;
  attachedCode:    string | null;
  ubigeo:          string | null;
  businessUnit:    { id: string; name: string } | null;
}

export interface BranchStats {
  totalAppointments:     number;
  completedAppointments: number;
  cancelledAppointments: number;
  totalRevenue:          number;
  activeUsers:           number;
}

/**
 * Shape que devuelve y acepta la API para horarios.
 * weekday: 0=Dom … 6=Sáb
 * Días cerrados NO se incluyen en el array.
 */
export interface OperatingHour {
  weekday:   number;
  startTime: string; // HH:mm
  endTime:   string; // HH:mm
}

/**
 * Shape extendida para uso local en el panel de horarios.
 * `isClosed` es solo UI — no se envía a la API.
 */
export interface LocalHour extends OperatingHour {
  isClosed: boolean;
}

// Bloqueos
export type BlockType = "LUNCH" | "HOLIDAY" | "MAINTENANCE" | "EVENT" | "CUSTOM";

export interface ScheduleBlock {
  id:      string;
  type:    BlockType;
  title:   string;
  startAt: string; // ISO datetime
  endAt:   string; // ISO datetime
}

export interface CreateBlockDto {
  type:    BlockType;
  title:   string;
  startAt: string; // ISO datetime  e.g. "2026-04-22T10:00:00"
  endAt:   string;
}

// Excepciones
export interface ScheduleException {
  id:        string;
  date:      string;      // YYYY-MM-DD
  startTime: string;      // HH:mm  (horario especial ese día)
  endTime:   string;      // HH:mm
  reason:    string | null;
}

export interface CreateExceptionDto {
  date:      string;
  startTime: string;
  endTime:   string;
  reason?:   string;
}

// Precios de servicio
export interface BranchServicePrice {
  serviceId:   string;
  serviceName: string;
  basePrice:   number;
  branchPrice: number | null;
}

export interface SetServicePriceDto {
  serviceId: string;
  price:     number;
}

// Usuarios
export interface BranchUser {
  id:        string;
  firstName: string;
  lastName:  string;
  email:     string;
  avatarUrl: string | null;
  roles:     { code: string; name: string }[];
}

// Timezones válidos según backend
export const BRANCH_TIMEZONES = [
  "America/Lima", "America/Bogota", "America/Santiago",
  "America/Buenos_Aires", "America/Argentina/Buenos_Aires",
  "America/Guayaquil", "America/La_Paz", "America/Asuncion",
  "America/Montevideo", "America/Caracas", "America/Mexico_City",
  "America/Sao_Paulo", "UTC",
] as const;
export type BranchTimezone = typeof BRANCH_TIMEZONES[number];

// DTOs de sede
export interface CreateBranchDto {
  name:             string;
  address?:         string;
  district?:        string;
  city?:            string;
  phone?:           string;
  email?:           string;
  latitude?:        number;
  longitude?:       number;
  googleMapsUrl?:   string;
  defaultCapacity?: number;
  timezone?:        string;
  businessUnitId?:  string;
}

/**
 * PATCH /v1/branches/:id
 * Campos admitidos. No admite `website` ni `code` (solo al crear).
 */
export interface UpdateBranchDto {
  name?:            string;
  address?:         string;
  district?:        string;
  city?:            string;
  phone?:           string;
  email?:           string;
  latitude?:        number | null;
  longitude?:       number | null;
  googleMapsUrl?:   string | null;
  defaultCapacity?: number;
  timezone?:        string;
  businessUnitId?:  string | null;
  banner?:          string;
  attachedCode?:    string;
  ubigeo?:          string;
}

// Series de documentos
export const TIPO_DOC_CODES = [
  "01", "03", "07", "08", "NV", "04", "09", "31", "32", "33",
] as const;
export type TipoDocCode = (typeof TIPO_DOC_CODES)[number];

export const TIPO_DOC_LABELS: Record<string, string> = {
  "01": "FACTURA ELECTRÓNICA",
  "03": "BOLETA DE VENTA ELECTRÓNICA",
  "07": "NOTA DE CRÉDITO",
  "08": "NOTA DE DÉBITO",
  "NV": "NOTA DE VENTA",
  "04": "LIQUIDACIÓN DE COMPRA",
  "09": "GUÍA DE REMISIÓN",
  "31": "GUÍA DE INGRESO ALMACÉN",
  "32": "GUÍA DE SALIDA ALMACÉN",
  "33": "GUÍA DE TRANSFERENCIA ALMACÉN",
};

export interface BranchSerie {
  id:            string;
  branchId:      string;
  tipoDocumento: string;
  serie:         string;
  contingencia:  boolean;
  createdAt:     string;
  updatedAt:     string;
}

export interface CreateBranchSerieDto {
  tipoDocumento: TipoDocCode;
  serie:         string;
  contingencia?: boolean;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const branchKeys = {
  all:        ["branches"] as const,
  lists:      () => [...branchKeys.all, "list"] as const,
  detail:     (id: string) => [...branchKeys.all, "detail", id] as const,
  stats:      (id: string) => [...branchKeys.all, id, "stats"] as const,
  hours:      (id: string) => [...branchKeys.all, id, "hours"] as const,
  blocks:     (id: string) => [...branchKeys.all, id, "blocks"] as const,
  exceptions: (id: string) => [...branchKeys.all, id, "exceptions"] as const,
  prices:     (id: string) => [...branchKeys.all, id, "service-prices"] as const,
  users:      (id: string) => [...branchKeys.all, id, "users"] as const,
  series:     (id: string) => [...branchKeys.all, id, "series"] as const,
};

// ── Normalización de Branch ───────────────────────────────────────────────────

/**
 * La foto se almacena como binario en PostgreSQL.
 * El backend devuelve `hasPhoto: boolean` en el GET detail/list.
 * La URL real de la imagen es el endpoint público GET /v1/branches/:id/photo.
 */
function normalizeBranch(raw: any): Branch {
  const hasPhoto = raw.hasPhoto ?? false;
  return {
    id:              raw.id,
    code:            raw.code             ?? null,
    name:            raw.name,
    address:         raw.address          ?? null,
    district:        raw.district         ?? null,
    city:            raw.city             ?? null,
    phone:           raw.phone            ?? null,
    email:           raw.email            ?? null,
    latitude:        raw.latitude  != null ? Number(raw.latitude)  : null,
    longitude:       raw.longitude != null ? Number(raw.longitude) : null,
    googleMapsUrl:   raw.googleMapsUrl    ?? null,
    isActive:        raw.isActive         ?? true,
    defaultCapacity: raw.defaultCapacity  ?? 6,
    timezone:        raw.timezone         ?? "America/Lima",
    hasPhoto,
    // URL relativa — pasa por el Vite proxy (dev) / reverse-proxy (prod)
    // así el navegador la ve como same-origin y no hay bloqueo CORP/COEP.
    photoUrl: hasPhoto ? `/v1/branches/${raw.id}/photo` : null,
    createdAt:      raw.createdAt,
    updatedAt:      raw.updatedAt ?? raw.createdAt,
    businessUnitId: raw.businessUnitId ?? null,
    banner:         raw.banner         ?? null,
    attachedCode:   raw.attachedCode   ?? null,
    ubigeo:         raw.ubigeo         ?? null,
  businessUnit:   raw.businessUnit   ?? null,
  };
}

// ── Lectura ───────────────────────────────────────────────────────────────────

/** Listado de sedes accesibles al usuario. */
export function useBranches() {
  return useQuery({
    queryKey: branchKeys.all,
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/branches" as any, {} as any);
      if (error) throw new Error(getErrorMessage(error));
      return (data as any[] ?? []).map(normalizeBranch) as Branch[];
    },
  });
}

/** Detalle completo de una sede. */
export function useBranch(id: string | undefined) {
  return useQuery({
    queryKey: branchKeys.detail(id ?? ""),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/branches/{id}" as any, {
        params: { path: { id } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      return normalizeBranch(data as any);
    },
    enabled: !!id,
  });
}

/** Información pública de una sede. */
export function useBranchPublic(id: string | undefined) {
  return useQuery({
    queryKey: [...branchKeys.detail(id ?? ""), "public"],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/branches/{id}/public" as any, {
        params: { path: { id } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      return normalizeBranch(data as any);
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}

/** Estadísticas de actividad de una sede. */
export function useBranchStats(id: string | undefined) {
  return useQuery({
    queryKey: branchKeys.stats(id ?? ""),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/branches/{id}/stats" as any, {
        params: { path: { id } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      // El API devuelve { appointments: { total, completed, canceled, ... }, revenue, activeUsers }
      // Mapeamos al contrato que usa el frontend.
      const d = data as any;
      return {
        totalAppointments:     d.appointments?.total     ?? 0,
        completedAppointments: d.appointments?.completed ?? 0,
        cancelledAppointments: d.appointments?.canceled  ?? 0,
        totalRevenue:          d.revenue                 ?? 0,
        activeUsers:           d.activeUsers             ?? 0,
      } as BranchStats;
    },
    enabled: !!id,
  });
}

/**
 * Horarios de atención.
 * Devuelve solo los días abiertos (weekday, startTime, endTime).
 */
export function useBranchHours(id: string | undefined) {
  return useQuery({
    queryKey: branchKeys.hours(id ?? ""),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/branches/{id}/hours" as any, {
        params: { path: { id } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      return (data as OperatingHour[]) ?? [];
    },
    enabled: !!id,
  });
}

/** Bloques de horario (cierres puntuales). */
export function useBranchBlocks(id: string | undefined) {
  return useQuery({
    queryKey: branchKeys.blocks(id ?? ""),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/branches/{id}/blocks" as any, {
        params: { path: { id } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      return (data as ScheduleBlock[]) ?? [];
    },
    enabled: !!id,
  });
}

/** Excepciones de horario (feriados, días especiales). */
export function useBranchExceptions(id: string | undefined) {
  return useQuery({
    queryKey: branchKeys.exceptions(id ?? ""),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/branches/{id}/schedule-exceptions" as any, {
        params: { path: { id } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      return (data as ScheduleException[]) ?? [];
    },
    enabled: !!id,
  });
}

/** Precios de servicio configurados para la sede. */
export function useBranchServicePrices(id: string | undefined) {
  return useQuery({
    queryKey: branchKeys.prices(id ?? ""),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/branches/{id}/service-prices" as any, {
        params: { path: { id } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      return (data as BranchServicePrice[]) ?? [];
    },
    enabled: !!id,
  });
}

/** Usuarios asignados a la sede. */
export function useBranchUsers(id: string | undefined) {
  return useQuery({
    queryKey: branchKeys.users(id ?? ""),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/branches/{id}/users" as any, {
        params: { path: { id } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      return (data as BranchUser[]) ?? [];
    },
    enabled: !!id,
  });
}

// ── Mutaciones — CRUD de sedes ────────────────────────────────────────────────

export function useCreateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateBranchDto) => {
      const { data, error } = await api.POST("/v1/branches" as any, { body } as any);
      if (error) throw new Error(getErrorMessage(error));
      return normalizeBranch(data as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      toast({ title: "Sucursal creada", description: "La sucursal fue registrada exitosamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al crear sucursal", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateBranch(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateBranchDto) => {
      const { data, error } = await api.PATCH("/v1/branches/{id}" as any, {
        params: { path: { id } } as any,
        body,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      return normalizeBranch(data as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      // Refrescar business-units porque puede haber cambiado la asignación de sede
      qc.invalidateQueries({ queryKey: ["business-units"] });
      toast({ title: "Sucursal actualizada", description: "Los datos se guardaron correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al actualizar sucursal", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE("/v1/branches/{id}" as any, {
        params: { path: { id } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      toast({ title: "Sucursal eliminada" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar sucursal", description: err.message, variant: "destructive" });
    },
  });
}

export function useToggleBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const path = active ? "/v1/branches/{id}/activate" : "/v1/branches/{id}/deactivate";
      const { error } = await api.POST(path as any, {
        params: { path: { id } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      toast({ title: v.active ? "Sucursal activada" : "Sucursal desactivada" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al cambiar estado", description: err.message, variant: "destructive" });
    },
  });
}

// ── Mutaciones — Foto ─────────────────────────────────────────────────────────

export function useUploadBranchPhoto(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadFile(`/v1/branches/${branchId}/photo`, file),
    onSuccess: () => {
      // El endpoint devuelve solo { message: "..." }, no datos de la sede.
      // Actualizamos el cache directamente: hasPhoto = true y la URL relativa.
      // El componente agrega ?cb=<timestamp> para evitar el caché del navegador.
      const photoUrl = `/v1/branches/${branchId}/photo`;
      qc.setQueryData(
        branchKeys.detail(branchId),
        (old: Branch | undefined) =>
          old ? { ...old, hasPhoto: true, photoUrl } : old,
      );
      qc.invalidateQueries({ queryKey: branchKeys.lists() });
      toast({ title: "Foto de sede actualizada." });
    },
    onError: (err: Error) => {
      const status = (err as ApiError).statusCode;
      if (status === 413) {
        toast({ title: "Archivo demasiado grande", description: "El límite es 5 MB.", variant: "destructive" });
      } else {
        toast({ title: "Error al subir foto", description: err.message, variant: "destructive" });
      }
    },
  });
}

export function useDeleteBranchPhoto(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await api.DELETE("/v1/branches/{id}/photo" as any, {
        params: { path: { id: branchId } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.setQueryData(
        branchKeys.detail(branchId),
        (old: Branch | undefined) =>
          old ? { ...old, hasPhoto: false, photoUrl: null } : old,
      );
      qc.invalidateQueries({ queryKey: branchKeys.lists() });
      toast({ title: "Foto eliminada." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar foto", description: err.message, variant: "destructive" });
    },
  });
}

// ── Mutaciones — Horarios ─────────────────────────────────────────────────────

/**
 * Recibe LocalHour[] (con isClosed para UI), filtra los cerrados
 * y envía solo días abiertos con { weekday, startTime, endTime }.
 */
export function useSaveHours(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (hours: LocalHour[]) => {
      const openHours = hours
        .filter((h) => !h.isClosed)
        .map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime }));
      const { error } = await api.POST("/v1/branches/{id}/hours" as any, {
        params: { path: { id: branchId } } as any,
        body: { hours: openHours } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: branchKeys.hours(branchId) });
      toast({ title: "Horarios guardados", description: "Los horarios de atención se actualizaron." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al guardar horarios", description: err.message, variant: "destructive" });
    },
  });
}

// ── Mutaciones — Bloques ──────────────────────────────────────────────────────

export function useCreateBlock(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateBlockDto) => {
      const { data, error } = await api.POST("/v1/branches/{id}/blocks" as any, {
        params: { path: { id: branchId } } as any,
        body,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      return data as ScheduleBlock;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: branchKeys.blocks(branchId) });
      toast({ title: "Bloque de horario registrado." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al crear bloque", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteBlock(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (blockId: string) => {
      const { error } = await api.DELETE("/v1/branches/{id}/blocks/{blockId}" as any, {
        params: { path: { id: branchId, blockId } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: branchKeys.blocks(branchId) });
      toast({ title: "Bloque eliminado." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar bloque", description: err.message, variant: "destructive" });
    },
  });
}

// ── Mutaciones — Excepciones ──────────────────────────────────────────────────

export function useCreateException(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateExceptionDto) => {
      const { data, error } = await api.POST("/v1/branches/{id}/schedule-exceptions" as any, {
        params: { path: { id: branchId } } as any,
        body,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      return data as ScheduleException;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: branchKeys.exceptions(branchId) });
      toast({ title: "Excepción de horario registrada." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al crear excepción", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteException(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (exceptionId: string) => {
      const { error } = await api.DELETE("/v1/branches/{id}/schedule-exceptions/{exceptionId}" as any, {
        params: { path: { id: branchId, exceptionId } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: branchKeys.exceptions(branchId) });
      toast({ title: "Excepción eliminada." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar excepción", description: err.message, variant: "destructive" });
    },
  });
}

// ── Mutaciones — Precios de servicio ──────────────────────────────────────────

export function useSetBranchServicePrice(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: SetServicePriceDto) => {
      const { error } = await api.POST("/v1/branches/{id}/service-prices" as any, {
        params: { path: { id: branchId } } as any,
        body,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: branchKeys.prices(branchId) });
      toast({ title: "Precio actualizado." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al actualizar precio", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteBranchServicePrice(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (serviceId: string) => {
      const { error } = await api.DELETE("/v1/branches/{id}/service-prices/{serviceId}" as any, {
        params: { path: { id: branchId, serviceId } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: branchKeys.prices(branchId) });
      toast({ title: "Precio de sede eliminado." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar precio", description: err.message, variant: "destructive" });
    },
  });
}

// ── Mutaciones — Usuarios de la sede ─────────────────────────────────────────

export function useAssignUserToBranch(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await api.POST("/v1/branches/{branchId}/users/{userId}" as any, {
        params: { path: { branchId, userId } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: branchKeys.users(branchId) });
      toast({ title: "Usuario asignado a la sede." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al asignar usuario", description: err.message, variant: "destructive" });
    },
  });
}

export function useRemoveUserFromBranch(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await api.DELETE("/v1/branches/{branchId}/users/{userId}" as any, {
        params: { path: { branchId, userId } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: branchKeys.users(branchId) });
      toast({ title: "Usuario removido de la sede." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al remover usuario", description: err.message, variant: "destructive" });
    },
  });
}

// ── Series de documentos ──────────────────────────────────────────────────────

export function useBranchSeries(branchId: string) {
  return useQuery({
    queryKey: branchKeys.series(branchId),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/branches/{id}/series" as any, {
        params: { path: { id: branchId } },
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      return (data as any[] ?? []) as BranchSerie[];
    },
    enabled: !!branchId,
  });
}

export function useCreateBranchSerie(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateBranchSerieDto) => {
      const { data, error } = await api.POST("/v1/branches/{id}/series" as any, {
        params: { path: { id: branchId } },
        body: dto as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      return data as BranchSerie;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: branchKeys.series(branchId) });
      toast({ title: "Serie agregada correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al agregar serie", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteBranchSerie(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (serieId: string) => {
      const { error } = await api.DELETE("/v1/branches/{id}/series/{serieId}" as any, {
        params: { path: { id: branchId, serieId } },
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: branchKeys.series(branchId) });
      toast({ title: "Serie eliminada." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar serie", description: err.message, variant: "destructive" });
    },
  });
}

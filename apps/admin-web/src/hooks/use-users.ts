import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, uploadFile, ApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/api";
import { toast } from "@podoplus/ui";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface UserRole {
  // Shape plano (esperado)
  code?:     string;
  name?:     string;
  // Shape anidado que devuelve Prisma: { role: { code, name }, branchId }
  role?:     { code: string; name: string };
  branchId:  string | null;
}

/** Extrae el código de rol independientemente del shape que devuelva la API */
export function getRoleCode(r: UserRole): string {
  return r.code ?? r.role?.code ?? "";
}

/** Extrae el nombre de rol independientemente del shape */
export function getRoleName(r: UserRole): string {
  return r.name ?? r.role?.name ?? "";
}

export interface UserListItem {
  id:             string;
  firstName:      string;
  lastName:       string;
  email:          string;
  phone:          string | null;
  avatarUrl:      string | null;
  isActive:       boolean;
  roles:          UserRole[];
  documentType:   string | null;
  documentNumber: string | null;
  address:        string | null;
  birthDate:      string | null;
  lastLoginAt:    string | null;
  createdAt:      string;
}

export interface UserDetail extends UserListItem {
  branches: { id: string; name: string }[];
}

/** Alias — perfil propio, misma shape que UserDetail */
export type MyProfile = UserDetail;

export interface UserStats {
  scheduledAppointments:  number;
  completedAppointments:  number;
  cancelledAppointments:  number;
  noShowAppointments:     number;
  totalAppointments:      number;
  completionRate:         number;
  totalSales:             number;
  totalRevenue:           number;
}

export interface DniLookupResult {
  documentNumber: string;
  firstName:      string;
  lastName:       string;
  fullName:       string;
}

export interface UsersListParams {
  q?:       string;
  role?:    string;
  isActive?: boolean;
  branchId?: string;
  limit?:   number;
  cursor?:  string;
}

export interface UsersListResult {
  data:      UserListItem[];
  nextCursor: string | null;
  hasNext:   boolean;
  total?:    number;
}

export interface CreateUserDto {
  firstName:      string;
  lastName:       string;
  email:          string;
  password:       string;
  phone?:         string;
  documentType?:  string;
  documentNumber?: string;
  address?:       string;
  birthDate?:     string;
  roleCode?:      string;
  branchId?:      string;
}

export interface UpdateUserDto {
  firstName?:      string;
  lastName?:       string;
  email?:          string;
  phone?:          string;
  documentType?:   string;
  documentNumber?: string;
  address?:        string;
  birthDate?:      string;
}

/** Campos editables del perfil propio (sin email) */
export interface UpdateMyProfileDto {
  firstName?:      string;
  lastName?:       string;
  phone?:          string;
  documentType?:   string;
  documentNumber?: string;
  address?:        string;
  birthDate?:      string;
}

export interface ChangeMyPasswordDto {
  currentPassword: string;
  newPassword:     string;
}

export interface RbacRole {
  id:   string;
  code: string;
  name: string;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const userKeys = {
  all:    ["users"] as const,
  me:     ["users", "me"] as const,
  lists:  () => [...userKeys.all, "list"] as const,
  list:   (p: UsersListParams) => [...userKeys.lists(), p] as const,
  detail: (id: string) => [...userKeys.all, "detail", id] as const,
  stats:  (id: string) => [...userKeys.all, "stats", id] as const,
  roles:  ["rbac", "roles"] as const,
};

// ── Hooks de lectura ──────────────────────────────────────────────────────────

export function useUsers(params: UsersListParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (params.q)        query.q        = params.q;
      if (params.role)     query.role     = params.role;
      if (params.branchId) query.branchId = params.branchId;
      if (params.limit)    query.limit    = String(params.limit);
      if (params.cursor)   query.cursor   = params.cursor;
      if (params.isActive !== undefined) query.isActive = String(params.isActive);

      const { data, error } = await api.GET("/v1/users" as any, {
        params: { query } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as UsersListResult;
    },
  });
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: userKeys.detail(id ?? ""),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/users/{id}" as any, {
        params: { path: { id } } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as UserDetail;
    },
    enabled: !!id,
  });
}

export function useUserStats(id: string | undefined) {
  return useQuery({
    queryKey: userKeys.stats(id ?? ""),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/users/{id}/stats" as any, {
        params: { path: { id } } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as UserStats;
    },
    enabled: !!id,
  });
}

export function useRbacRoles() {
  return useQuery({
    queryKey: userKeys.roles,
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/rbac/roles" as any, {} as any);
      if (error) throw new Error(getErrorMessage(error));
      return data as RbacRole[];
    },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateUserDto) => {
      const { data, error } = await api.POST("/v1/users" as any, { body } as any);
      if (error) throw new Error(getErrorMessage(error));
      return data as UserDetail;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.lists() });
      toast({ title: "Usuario creado", description: "El usuario fue registrado exitosamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al crear usuario", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateUser(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateUserDto) => {
      const { data, error } = await api.PATCH("/v1/users/{id}" as any, {
        params: { path: { id } } as any,
        body,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      return data as UserDetail;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.lists() });
      qc.invalidateQueries({ queryKey: userKeys.detail(id) });
      toast({ title: "Usuario actualizado", description: "Los datos se guardaron correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al actualizar usuario", description: err.message, variant: "destructive" });
    },
  });
}

export function useActivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.POST("/v1/users/{id}/activate" as any, {
        params: { path: { id } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: userKeys.lists() });
      qc.invalidateQueries({ queryKey: userKeys.detail(id) });
      toast({ title: "Usuario activado" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al activar usuario", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.POST("/v1/users/{id}/deactivate" as any, {
        params: { path: { id } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: userKeys.lists() });
      qc.invalidateQueries({ queryKey: userKeys.detail(id) });
      toast({ title: "Usuario desactivado" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al desactivar usuario", description: err.message, variant: "destructive" });
    },
  });
}

export function useAdminResetPassword() {
  return useMutation({
    mutationFn: async ({ id, newPassword }: { id: string; newPassword: string }) => {
      const { error } = await api.POST("/v1/users/{id}/reset-password" as any, {
        params: { path: { id } } as any,
        body: { newPassword } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      toast({ title: "Contraseña restablecida", description: "Las sesiones activas del usuario fueron revocadas." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al resetear contraseña", description: err.message, variant: "destructive" });
    },
  });
}

export function useAssignRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, roleCode, branchId }: { userId: string; roleCode: string; branchId?: string }) => {
      const { error } = await api.POST("/v1/users/{id}/roles" as any, {
        params: { path: { id: userId } } as any,
        body: { roleCode, branchId } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: userKeys.detail(v.userId) });
      qc.invalidateQueries({ queryKey: userKeys.lists() });
      toast({ title: "Rol asignado correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al asignar rol", description: err.message, variant: "destructive" });
    },
  });
}

export function useRemoveRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, roleCode }: { userId: string; roleCode: string }) => {
      const { error } = await api.DELETE("/v1/users/{id}/roles/{roleCode}" as any, {
        params: { path: { id: userId, roleCode } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: userKeys.detail(v.userId) });
      qc.invalidateQueries({ queryKey: userKeys.lists() });
      toast({ title: "Rol removido correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al remover rol", description: err.message, variant: "destructive" });
    },
  });
}

// ── Perfil propio ─────────────────────────────────────────────────────────────

/** Carga el perfil del usuario autenticado. GET /v1/users/me */
export function useMyProfile() {
  return useQuery({
    queryKey: userKeys.me,
    queryFn:  async () => {
      const { data, error } = await api.GET("/v1/users/me" as any, {} as any);
      if (error) throw new Error(getErrorMessage(error));
      return data as MyProfile;
    },
    staleTime: 1000 * 60 * 5,
  });
}

/** Actualiza nombre/apellido/teléfono propios. PATCH /v1/users/me */
export function useUpdateMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateMyProfileDto) => {
      const { data, error } = await api.PATCH("/v1/users/me" as any, { body } as any);
      if (error) throw new Error(getErrorMessage(error));
      return data as MyProfile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.me });
      qc.invalidateQueries({ queryKey: ["me"] }); // también actualiza auth store
      toast({ title: "Perfil actualizado correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al actualizar perfil", description: err.message, variant: "destructive" });
    },
  });
}

/** Cambia la contraseña propia. POST /v1/users/me/change-password */
export function useChangeMyPassword() {
  return useMutation({
    mutationFn: async (body: ChangeMyPasswordDto) => {
      const { error } = await api.POST("/v1/users/me/change-password" as any, { body } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      toast({ title: "Contraseña cambiada correctamente.", description: "Todas las demás sesiones fueron revocadas." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al cambiar contraseña", description: err.message, variant: "destructive" });
    },
  });
}

/** Sube foto de perfil propia. POST /v1/users/me/avatar */
export function useUploadMyAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadFile("/v1/users/me/avatar", file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.me });
      qc.invalidateQueries({ queryKey: ["me"] });
      toast({ title: "Foto de perfil actualizada." });
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

/** Elimina foto de perfil propia. DELETE /v1/users/me/avatar */
export function useDeleteMyAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await api.DELETE("/v1/users/me/avatar" as any, {} as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.me });
      qc.invalidateQueries({ queryKey: ["me"] });
      toast({ title: "Foto de perfil eliminada." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar foto", description: err.message, variant: "destructive" });
    },
  });
}

// ── Avatar de otros usuarios (admin) ──────────────────────────────────────────

/** Sube foto de perfil de un usuario. POST /v1/users/:id/avatar */
export function useUploadUserAvatar(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadFile(`/v1/users/${userId}/avatar`, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.detail(userId) });
      qc.invalidateQueries({ queryKey: userKeys.lists() });
      toast({ title: "Foto actualizada correctamente." });
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

/** Elimina foto de perfil de un usuario. DELETE /v1/users/:id/avatar */
export function useDeleteUserAvatar(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await api.DELETE("/v1/users/{id}/avatar" as any, {
        params: { path: { id: userId } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.detail(userId) });
      qc.invalidateQueries({ queryKey: userKeys.lists() });
      toast({ title: "Foto eliminada." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar foto", description: err.message, variant: "destructive" });
    },
  });
}

// ── Active sessions ───────────────────────────────────────────────────────────

export interface ActiveSession {
  jti:         string;
  deviceName?: string;
  ip?:         string;
  issuedAt:    string; // ISO timestamp
}

/** Lee el JTI del access token almacenado en localStorage (sin verificar firma). */
export function getCurrentJti(): string | null {
  try {
    const token = localStorage.getItem("pdo_access");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return (payload.jti as string) ?? null;
  } catch {
    return null;
  }
}

/** Lista todas las sesiones activas del usuario autenticado. */
export function useActiveSessions() {
  return useQuery({
    queryKey: ["auth", "sessions"],
    queryFn:  async () => {
      const { data, error } = await api.GET("/v1/auth/sessions" as any, {});
      if (error) throw new Error(getErrorMessage(error));
      return (data as ActiveSession[]) ?? [];
    },
    staleTime: 1000 * 30, // 30s — las sesiones pueden cambiar pronto
  });
}

// ── Branch assignment ─────────────────────────────────────────────────────────

export function useAssignUserBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, branchId }: { userId: string; branchId: string }) => {
      const { data, error } = await api.POST("/v1/users/{id}/branches" as any, {
        params: { path: { id: userId } } as any,
        body:   { branchId } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      return data as UserDetail;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: userKeys.detail(v.userId) });
      qc.invalidateQueries({ queryKey: userKeys.lists() });
      toast({ title: "Sede asignada correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al asignar sede", description: err.message, variant: "destructive" });
    },
  });
}

export function useRemoveUserBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, branchId }: { userId: string; branchId: string }) => {
      const { data, error } = await api.DELETE("/v1/users/{id}/branches/{branchId}" as any, {
        params: { path: { id: userId, branchId } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      return data as UserDetail;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: userKeys.detail(v.userId) });
      qc.invalidateQueries({ queryKey: userKeys.lists() });
      toast({ title: "Sede removida correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al remover sede", description: err.message, variant: "destructive" });
    },
  });
}

// ── DNI Lookup ────────────────────────────────────────────────────────────────

export function useDniLookup() {
  return useMutation({
    mutationFn: async (documentNumber: string): Promise<DniLookupResult> => {
      const { data, error } = await api.GET("/v1/lookup/dni/{documentNumber}" as any, {
        params: { path: { documentNumber } } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as DniLookupResult;
    },
    onError: (err: Error) => {
      toast({ title: "DNI no encontrado", description: err.message, variant: "destructive" });
    },
  });
}

/** Revoca una sesión activa por su JTI. */
export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jti: string) => {
      const { error } = await api.DELETE("/v1/auth/sessions/{jti}" as any, {
        params: { path: { jti } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth", "sessions"] });
      toast({ title: "Sesión cerrada" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al cerrar sesión", description: err.message, variant: "destructive" });
    },
  });
}

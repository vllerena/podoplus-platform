import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, throwApiError } from "@/lib/api";
import { toast } from "@podoplus/ui";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface Permission {
  id:           string;
  code:         string;
  name:         string;
  description?: string;
  group?:       string;
}

export interface RbacRole {
  id:           string;
  code:         string;
  name:         string;
  description?: string;
  permissions:  Permission[];
}

export interface RbacBranchUser {
  id:        string;
  firstName: string;
  lastName:  string;
  email:     string;
  roles:     string[];
}

export interface RbacBranchDetail {
  id:    string;
  name:  string;
  users: RbacBranchUser[];
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const rbacKeys = {
  all:         ["rbac"] as const,
  roles:       () => [...rbacKeys.all, "roles"] as const,
  permissions: () => [...rbacKeys.all, "permissions"] as const,
  branch:      (id: string) => [...rbacKeys.all, "branch", id] as const,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normaliza la lista de permisos de un rol (shape plano o anidado con { permission: {...} }) */
function normalizePerms(raw: any[]): Permission[] {
  return (raw ?? []).map((p: any) => {
    const perm = p.permission ?? p;
    return {
      id:          perm.id          ?? p.id   ?? "",
      code:        perm.code        ?? p.code ?? "",
      name:        perm.name        ?? p.name ?? "",
      description: perm.description ?? p.description,
      group:       perm.group       ?? p.group,
    };
  }).filter((p: Permission) => !!p.code);
}

// ── Hooks de lectura ──────────────────────────────────────────────────────────

/**
 * Lista de todos los roles con sus permisos.
 * Requiere SUPER_ADMIN o GENERAL_MANAGER → puede responder 403.
 */
export function useRbacRoles() {
  return useQuery({
    queryKey: rbacKeys.roles(),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/rbac/roles" as any, {} as any);
      if (error) throwApiError(error);
      const raw = data as any[];
      return (raw ?? []).map((role: any) => ({
        id:          role.id          ?? "",
        code:        role.code        ?? "",
        name:        role.name        ?? "",
        description: role.description,
        permissions: normalizePerms(role.permissions ?? []),
      })) as RbacRole[];
    },
    retry: false,
  });
}

/**
 * Lista de todos los permisos disponibles en el sistema.
 * Requiere SUPER_ADMIN o GENERAL_MANAGER → puede responder 403.
 */
export function useRbacPermissions() {
  return useQuery({
    queryKey: rbacKeys.permissions(),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/rbac/permissions" as any, {} as any);
      if (error) throwApiError(error);
      return (data as any[] ?? []).map((p: any) => ({
        id:          p.id          ?? "",
        code:        p.code        ?? "",
        name:        p.name        ?? "",
        description: p.description,
        group:       p.group,
      })) as Permission[];
    },
    staleTime: 1000 * 60 * 10, // 10 min — los permisos son estáticos
    retry: false,
  });
}

/**
 * Detalle de una sucursal (usuarios y roles asignados).
 * Requiere que el usuario tenga acceso a esa sucursal → puede responder 403.
 */
export function useRbacBranch(branchId: string | undefined) {
  return useQuery({
    queryKey: rbacKeys.branch(branchId ?? ""),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/rbac/branches/{branchId}" as any, {
        params: { path: { branchId } } as any,
      } as any);
      if (error) throwApiError(error);
      return data as RbacBranchDetail;
    },
    enabled: !!branchId,
    retry:   false,
  });
}

// ── Mutations — Permisos de roles ─────────────────────────────────────────────

export function useAssignPermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ roleId, permissionCode }: { roleId: string; permissionCode: string }) => {
      const { error } = await api.POST("/v1/rbac/role-permissions" as any, {
        body: { roleId, permissionCode } as any,
      } as any);
      if (error) throwApiError(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rbacKeys.roles() });
      toast({ title: "Permiso asignado correctamente." });
    },
    onError: (err: Error) => {
      const status = (err as any).statusCode;
      if (status === 403) {
        toast({
          title:       "Acción no permitida",
          description: "No tienes permisos para modificar roles.",
          variant:     "destructive",
        });
      } else {
        toast({ title: "Error al asignar permiso", description: err.message, variant: "destructive" });
      }
    },
  });
}

export function useRevokePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ roleId, permissionCode }: { roleId: string; permissionCode: string }) => {
      const { error } = await api.DELETE("/v1/rbac/role-permissions" as any, {
        body: { roleId, permissionCode } as any,
      } as any);
      if (error) throwApiError(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rbacKeys.roles() });
      toast({ title: "Permiso revocado correctamente." });
    },
    onError: (err: Error) => {
      const status = (err as any).statusCode;
      if (status === 403) {
        toast({
          title:       "Acción no permitida",
          description: "No tienes permisos para modificar roles.",
          variant:     "destructive",
        });
      } else {
        toast({ title: "Error al revocar permiso", description: err.message, variant: "destructive" });
      }
    },
  });
}

// ── Mutations — Roles de usuarios ─────────────────────────────────────────────

export function useAssignUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, roleCode, branchId }: {
      userId:    string;
      roleCode:  string;
      branchId?: string;
    }) => {
      const { error } = await api.POST("/v1/rbac/user-roles" as any, {
        body: { userId, roleCode, branchId } as any,
      } as any);
      if (error) throwApiError(error);
    },
    onSuccess: () => {
      // Invalida lista de usuarios y detalle
      qc.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Rol asignado al usuario." });
    },
    onError: (err: Error) => {
      const status = (err as any).statusCode;
      if (status === 403) {
        toast({
          title:       "Acción no permitida",
          description: "No tienes permisos para asignar roles.",
          variant:     "destructive",
        });
      } else {
        toast({ title: "Error al asignar rol", description: err.message, variant: "destructive" });
      }
    },
  });
}

export function useRevokeUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, roleCode }: { userId: string; roleCode: string }) => {
      const { error } = await api.DELETE("/v1/rbac/user-roles" as any, {
        body: { userId, roleCode } as any,
      } as any);
      if (error) throwApiError(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Rol revocado del usuario." });
    },
    onError: (err: Error) => {
      const status = (err as any).statusCode;
      if (status === 403) {
        toast({
          title:       "Acción no permitida",
          description: "No tienes permisos para revocar roles.",
          variant:     "destructive",
        });
      } else {
        toast({ title: "Error al revocar rol", description: err.message, variant: "destructive" });
      }
    },
  });
}

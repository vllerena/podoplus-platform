import { create } from "zustand";
import { persist } from "zustand/middleware";
import { clearTokens, setAccessToken, setRefreshToken } from "@/lib/api";
import type { MeResult } from "@/lib/auth";
// Importación diferida para evitar dependencia circular en el nivel de módulo.
// Se llama en tiempo de ejecución (dentro de clearAuth), no durante la inicialización.
const getBranchStore = () =>
  import("@/stores/branch.store").then((m) => m.useBranchStore.getState());

export interface AuthUser {
  id:          string;
  email:       string;
  firstName:   string;
  lastName:    string;
  /** Códigos de rol, e.g. ["SUPER_ADMIN"] */
  roles:       string[];
  /** Códigos de permiso derivados de los roles */
  permissions: string[];
  /** Sucursales accesibles */
  branches:    { id: string; name: string }[];
}

interface AuthState {
  user:            AuthUser | null;
  accessToken:     string | null;
  refreshToken:    string | null;
  isAuthenticated: boolean;

  /**
   * Rutas que el usuario ocultó manualmente del sidebar.
   * Persiste entre sesiones (localStorage). Solo aplica a ítems
   * que el usuario ya tiene permiso de ver.
   */
  hiddenModules: string[];

  /** Guarda user + tokens (usado tras login exitoso) */
  setAuth: (user: Omit<AuthUser, "permissions" | "branches"> & Partial<Pick<AuthUser, "permissions" | "branches">>, accessToken: string, refreshToken: string) => void;

  /** Solo actualiza los tokens (usado tras refresh) */
  setTokens: (accessToken: string, refreshToken: string) => void;

  /** Actualiza datos de perfil sin tocar tokens (usado tras GET /v1/auth/me) */
  updateMe: (data: MeResult) => void;

  /** Limpia toda la sesión localmente */
  clearAuth: () => void;

  /** Oculta/muestra un módulo del sidebar. Toggle si no se especifica forzar. */
  toggleModule: (route: string, force?: boolean) => void;

  hasRole:          (role: string) => boolean;
  hasAnyRole:       (roles: string[]) => boolean;
  hasPermission:    (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
  /** SUPER_ADMIN o GENERAL_MANAGER pueden gestionar roles/permisos */
  canManageRbac:    () => boolean;
  /** Verifica si el usuario tiene acceso a una sucursal específica */
  hasBranchAccess:  (branchId: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:            null,
      accessToken:     null,
      refreshToken:    null,
      isAuthenticated: false,
      hiddenModules:   [],

      setAuth: (user, accessToken, refreshToken) => {
        setAccessToken(accessToken);
        setRefreshToken(refreshToken);
        set({
          user: {
            ...user,
            permissions: user.permissions ?? [],
            branches:    user.branches    ?? [],
          },
          accessToken,
          refreshToken,
          isAuthenticated: true,
        });
      },

      setTokens: (accessToken, refreshToken) => {
        setAccessToken(accessToken);
        setRefreshToken(refreshToken);
        set({ accessToken, refreshToken });
      },

      updateMe: (data) => {
        const current = get().user;
        if (!current) return;
        set({
          user: {
            ...current,
            roles:       data.roles       ?? current.roles,
            permissions: data.permissions ?? current.permissions,
            branches:    data.branches    ?? current.branches,
          },
        });
      },

      clearAuth: () => {
        clearTokens();
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, hiddenModules: [] });
        // Limpia la sucursal seleccionada al cerrar sesión
        getBranchStore().then((s) => s.clearBranch()).catch(() => {});
      },

      toggleModule: (route, force) => {
        const current = get().hiddenModules;
        const isHidden = current.includes(route);
        if (force === true)  { set({ hiddenModules: [...current, route] }); return; }
        if (force === false) { set({ hiddenModules: current.filter((r) => r !== route) }); return; }
        // Toggle
        set({
          hiddenModules: isHidden
            ? current.filter((r) => r !== route)
            : [...current, route],
        });
      },

      hasRole: (role) => get().user?.roles?.includes(role) ?? false,

      hasAnyRole: (roles) => {
        const userRoles = get().user?.roles ?? [];
        return roles.some((r) => userRoles.includes(r));
      },

      hasPermission: (code) => get().user?.permissions?.includes(code) ?? false,

      hasAnyPermission: (codes) => {
        const userPerms = get().user?.permissions ?? [];
        return codes.some((c) => userPerms.includes(c));
      },

      canManageRbac: () => {
        const roles = get().user?.roles ?? [];
        return roles.includes("SUPER_ADMIN") || roles.includes("GENERAL_MANAGER");
      },

      hasBranchAccess: (branchId) => {
        const user = get().user;
        if (!user) return false;
        // SUPER_ADMIN tiene acceso a todas las sucursales
        if (user.roles.includes("SUPER_ADMIN")) return true;
        return user.branches.some((b) => b.id === branchId);
      },
    }),
    {
      name: "podoplus-auth",
      partialize: (state) => ({
        user:            state.user,
        accessToken:     state.accessToken,
        refreshToken:    state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        hiddenModules:   state.hiddenModules,
      }),
    }
  )
);

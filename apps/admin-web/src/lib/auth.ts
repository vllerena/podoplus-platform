/**
 * auth.ts — Funciones de alto nivel para autenticación.
 * Encapsula todas las llamadas al backend de auth para que los componentes
 * no tengan que conocer los endpoints directamente.
 */

import { api, publicApi, getRefreshToken, clearTokens, getErrorMessage } from "./api";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface LoginResult {
  accessToken:  string;
  refreshToken: string;
  user: {
    id:          string;
    email:       string;
    firstName:   string;
    lastName:    string;
    roles:       string[];
    permissions: string[];
    branches:    { id: string; name: string }[];
  };
}

export interface MeResult {
  id:          string;
  email:       string;
  firstName:   string;
  lastName:    string;
  /** Códigos de rol (e.g. "SUPER_ADMIN") */
  roles:       string[];
  /** Códigos de permiso que el usuario tiene a través de sus roles */
  permissions: string[];
  /** Sucursales a las que el usuario tiene acceso */
  branches:    { id: string; name: string }[];
}

export type AuthErrorKind =
  | "invalid_credentials"
  | "account_locked"
  | "network_error"
  | "unknown";

export interface AuthError {
  kind:    AuthErrorKind;
  message: string;
  /** Segundos restantes de bloqueo si kind === "account_locked" (aproximado) */
  lockSeconds?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function classifyError(raw: unknown): AuthError {
  const msg = getErrorMessage(raw).toLowerCase();

  if (msg.includes("bloqueada") || msg.includes("locked") || msg.includes("15 minutos")) {
    return {
      kind:        "account_locked",
      message:     getErrorMessage(raw),
      lockSeconds: 15 * 60,
    };
  }
  if (
    msg.includes("credenciales") ||
    msg.includes("contraseña") ||
    msg.includes("email") ||
    msg.includes("inválid")
  ) {
    return { kind: "invalid_credentials", message: getErrorMessage(raw) };
  }
  if (msg.includes("conexión") || msg.includes("network") || msg.includes("fetch")) {
    return { kind: "network_error", message: "Error de conexión. Verifica tu red e intenta de nuevo." };
  }
  return { kind: "unknown", message: getErrorMessage(raw) };
}

// ── Login ─────────────────────────────────────────────────────────────────────

/** Login completo. El backend retorna user embebido → no necesita /me separado. */
export async function apiLogin(
  email:      string,
  password:   string,
  deviceName?: string,
): Promise<LoginResult> {
  try {
    const { data, error } = await publicApi.POST("/v1/auth/login" as any, {
      body: { email, password, deviceName } as any,
    });
    if (error) {
      throw classifyError(error);
    }
    return data as LoginResult;
  } catch (err) {
    // Re-throw AuthError si ya fue clasificado
    if (err && typeof err === "object" && "kind" in err) throw err;
    // Error de red (fetch falló completamente)
    throw { kind: "network_error", message: "Error de conexión. Verifica tu red." } as AuthError;
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────

/**
 * Logout seguro:
 * 1. Blacklistea el access token en el servidor
 * 2. Revoca el refresh token
 * 3. Limpia localStorage (siempre, incluso si el server falla)
 */
export async function apiLogout(): Promise<void> {
  const refreshToken = getRefreshToken();
  try {
    await api.POST("/v1/auth/logout" as any, {
      body: { refreshToken: refreshToken ?? "" } as any,
    });
  } catch {
    // Ignorar errores del servidor — se limpia localmente de todas formas
  } finally {
    clearTokens();
  }
}

// ── Forgot password ───────────────────────────────────────────────────────────

/**
 * Solicita el envío de email de recuperación.
 * El backend siempre responde 200 para no revelar si el email existe.
 */
export async function apiForgotPassword(email: string): Promise<void> {
  const { error } = await publicApi.POST("/v1/auth/forgot-password" as any, {
    body: { email } as any,
  });
  if (error) throw new Error(getErrorMessage(error));
}

// ── Reset password ────────────────────────────────────────────────────────────

export async function apiResetPassword(token: string, newPassword: string): Promise<void> {
  const { error } = await publicApi.POST("/v1/auth/reset-password" as any, {
    body: { token, newPassword } as any,
  });
  if (error) throw new Error(getErrorMessage(error));
}

// ── Me ────────────────────────────────────────────────────────────────────────

/** Obtiene el perfil completo del usuario autenticado (roles, permisos, sucursales). */
export async function apiMe(): Promise<MeResult> {
  const { data, error } = await api.GET("/v1/auth/me" as any, {} as any);
  if (error) throw new Error(getErrorMessage(error));
  const raw = data as any;
  return {
    id:          raw.id,
    email:       raw.email,
    firstName:   raw.firstName,
    lastName:    raw.lastName,
    roles:       (raw.roles ?? []).map((r: any) => (typeof r === "string" ? r : r?.code ?? "")),
    permissions: raw.permissions ?? [],
    branches:    raw.branches    ?? [],
  };
}

// ── Refresh silencioso ────────────────────────────────────────────────────────

/** Refresca el access token manualmente (útil al iniciar la app). */
export async function apiRefreshToken(refreshToken: string) {
  const { data, error } = await publicApi.POST("/v1/auth/refresh" as any, {
    body: { refreshToken } as any,
  });
  if (error) throw new Error(getErrorMessage(error));
  return data as { accessToken: string; refreshToken: string };
}

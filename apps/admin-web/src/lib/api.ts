import createClient from "openapi-fetch";
import type { paths } from "@podoplus/api-client";

export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// ── Token helpers ─────────────────────────────────────────────────────────────

export const ACCESS_TOKEN_KEY  = "pdo_access";
export const REFRESH_TOKEN_KEY = "pdo_refresh";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}
export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}
export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}
export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ── Effective base URL ────────────────────────────────────────────────────────
// En desarrollo usamos URL relativa ("") para que las peticiones pasen por el
// proxy de Vite → mismo origen → sin problemas CORS/CORP.
// En producción se usa la URL absoluta definida en VITE_API_URL.
const EFFECTIVE_BASE = import.meta.env.DEV ? "" : API_BASE;

// ── Public client (no auth) ───────────────────────────────────────────────────

export const publicApi = createClient<paths>({ baseUrl: EFFECTIVE_BASE });

// ── Authenticated client ──────────────────────────────────────────────────────

export const api = createClient<paths>({ baseUrl: EFFECTIVE_BASE });

api.use({
  onRequest({ request }) {
    const token = getAccessToken();
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  },
  async onResponse({ response, request }) {
    // Auto-refresh on 401
    if (response.status === 401) {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        type RefreshResp = { accessToken: string; refreshToken: string };
        const result = await publicApi.POST("/v1/auth/refresh", {
          body: { refreshToken },
        });
        const data = result.data as RefreshResp | undefined;
        if (data?.accessToken) {
          setAccessToken(data.accessToken);
          if (data.refreshToken) setRefreshToken(data.refreshToken);
          // Retry original request with new token
          request.headers.set("Authorization", `Bearer ${data.accessToken}`);
          return fetch(request);
        }
      }
      // Refresh failed — limpiar tokens Y el store de Zustand, luego redirigir.
      // clearTokens() solo borra localStorage; sin clearAuth() el store mantiene
      // isAuthenticated=true y PublicRoute redirige de vuelta → bucle infinito.
      clearTokens();
      // Import dinámico para evitar dependencia circular en tiempo de módulo.
      // El módulo ya está en memoria (Vite bundle), la promesa resuelve antes
      // de que el navegador procese la navegación (microtask vs macrotask).
      import("@/stores/auth.store")
        .then(({ useAuthStore }) => useAuthStore.getState().clearAuth())
        .catch(() => {});
      window.location.href = "/login";
    }
    return response;
  },
});

// ── Error helpers ─────────────────────────────────────────────────────────────

export function getErrorMessage(error: unknown): string {
  if (!error) return "Error desconocido";
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const e = error as Record<string, unknown>;
    if (typeof e["message"] === "string") return e["message"];
    if (Array.isArray(e["message"])) return (e["message"] as string[]).join(", ");
    if (typeof e["error"] === "string") return e["error"];
  }
  return "Ha ocurrido un error inesperado";
}

/** Extrae el statusCode HTTP del cuerpo de error (NestJS incluye statusCode en el body). */
export function getApiStatusCode(error: unknown): number | undefined {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    if (typeof e["statusCode"] === "number") return e["statusCode"];
  }
  return undefined;
}

/** Error enriquecido que preserva el statusCode HTTP para guards de 403/401. */
export class ApiError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = "ApiError";
  }
}

/** Lanza ApiError con statusCode extraído del cuerpo de error de la API. */
export function throwApiError(error: unknown): never {
  throw new ApiError(getErrorMessage(error), getApiStatusCode(error));
}

/**
 * Sube un archivo como multipart/form-data al endpoint indicado.
 * Usa el access token del localStorage (bypass openapi-fetch para no sobreescribir el Content-Type boundary).
 *
 * La URL se construye con `path` directamente cuando el navegador ya está
 * en el mismo origen que la API (Vite proxy o producción same-domain).
 * Si API_BASE apunta a un origen externo se usa como prefijo.
 */
export async function uploadFile(path: string, file: File): Promise<unknown> {
  const formData = new FormData();
  formData.append("file", file);
  const token = getAccessToken();

  // En desarrollo el Vite proxy intercepta las rutas /v1/* y las reenvía
  // al API server, resolviendo problemas de CORS/CORP.
  // En producción se usa la URL absoluta (API_BASE apunta al servidor real).
  const url = import.meta.env.DEV ? path : `${API_BASE}${path}`;

  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new ApiError(
      (typeof body["message"] === "string" ? body["message"] : null) ?? "Error al subir archivo",
      typeof body["statusCode"] === "number" ? body["statusCode"] : res.status,
    );
  }
  return res.json().catch(() => ({}));
}

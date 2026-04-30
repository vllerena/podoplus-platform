import createClient from "openapi-fetch";
import type { paths } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const API_BASE: string = (typeof globalThis !== "undefined" && (globalThis as any).__VITE_API_URL__)
  ?? "http://localhost:3000";

// ── Token storage ────────────────────────────────────────────────────────────

const TOKEN_KEY = "podoplus_access_token";
const REFRESH_KEY = "podoplus_refresh_token";

export const tokenStorage = {
  getAccess: () => localStorage.getItem(TOKEN_KEY),
  setAccess: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  setRefresh: (token: string) => localStorage.setItem(REFRESH_KEY, token),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

// ── Public client (no auth — for login, self-register, etc.) ─────────────────

export const publicClient = createClient<paths>({
  baseUrl: API_BASE,
});

// ── Authenticated client (injects Bearer token) ──────────────────────────────

export const apiClient = createClient<paths>({
  baseUrl: API_BASE,
});

// Inject auth header on every request
apiClient.use({
  onRequest({ request }) {
    const token = tokenStorage.getAccess();
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    return request;
  },
});

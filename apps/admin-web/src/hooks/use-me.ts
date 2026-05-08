/**
 * use-me.ts
 * Sincroniza GET /v1/auth/me con el auth store cada vez que el usuario está autenticado.
 * Enriquece roles[], permissions[] y branches[] sin tocar los tokens.
 */
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiMe } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth.store";
import { getAccessToken } from "@/lib/api";

export function useMe() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const updateMe        = useAuthStore((s) => s.updateMe);

  // Guard doble: isAuthenticated (store) Y que haya un token real en localStorage.
  // Evita que el query dispare si el store aún dice "autenticado" pero los tokens
  // ya fueron limpiados (ventana entre clearTokens y clearAuth en el interceptor).
  const hasToken = Boolean(getAccessToken());

  const query = useQuery({
    queryKey: ["me"],
    queryFn:  apiMe,
    enabled:  isAuthenticated && hasToken,
    staleTime: 0,             // siempre revalidar al montar (permisos críticos)
    retry:    false,           // no reintentar en 401/403 — el middleware ya redirige
  });

  useEffect(() => {
    if (query.data) updateMe(query.data);
  }, [query.data, updateMe]);

  return query;
}

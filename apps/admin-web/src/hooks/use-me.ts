/**
 * use-me.ts
 * Sincroniza GET /v1/auth/me con el auth store cada vez que el usuario está autenticado.
 * Enriquece roles[], permissions[] y branches[] sin tocar los tokens.
 */
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiMe } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth.store";

export function useMe() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const updateMe        = useAuthStore((s) => s.updateMe);

  const query = useQuery({
    queryKey: ["me"],
    queryFn:  apiMe,
    enabled:  isAuthenticated,
    staleTime: 0,             // siempre revalidar al montar (permisos críticos)
    retry:    false,           // no reintentar en 401/403 — el middleware ya redirige
  });

  useEffect(() => {
    if (query.data) updateMe(query.data);
  }, [query.data, updateMe]);

  return query;
}

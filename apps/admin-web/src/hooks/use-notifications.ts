import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage } from "@/lib/api";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type NotificationType =
  | "appointment"
  | "sale"
  | "subscription"
  | "cash_register"
  | "system";

export interface AppNotification {
  id:         string;
  type:       NotificationType;
  title:      string;
  body:       string;
  entityType: string | null;
  entityId:   string | null;
  isRead:     boolean;
  readAt:     string | null;
  createdAt:  string;
}

export interface NotificationsResult {
  data:   AppNotification[];
  total:  number;
  unread: number;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const notifKeys = {
  all:         ["notifications"] as const,
  list:        (params: { unread?: boolean; limit?: number; offset?: number }) =>
                 [...notifKeys.all, "list", params] as const,
  unreadCount: () => [...notifKeys.all, "unread-count"] as const,
};

// ── Hooks de lectura ──────────────────────────────────────────────────────────

export function useNotifications(params?: {
  unread?: boolean;
  limit?:  number;
  offset?: number;
}) {
  return useQuery({
    queryKey: notifKeys.list(params ?? {}),
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (params?.unread  !== undefined) query.unread  = String(params.unread);
      if (params?.limit   !== undefined) query.limit   = String(params.limit);
      if (params?.offset  !== undefined) query.offset  = String(params.offset);

      const { data, error } = await api.GET("/v1/notifications" as any, {
        params: { query } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as NotificationsResult;
    },
    refetchInterval: 60_000, // Refresco de respaldo cada 60s si el WS falla
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notifKeys.unreadCount(),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/notifications/unread-count" as any, {} as any);
      if (error) throw new Error(getErrorMessage(error));
      return (data as { unread_count: number }).unread_count ?? 0;
    },
    refetchInterval: 30_000, // Polling de respaldo cada 30s
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.POST("/v1/notifications/{id}/read" as any, {
        params: { path: { id } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notifKeys.all });
    },
  });
}

export function useMarkAllAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await api.POST("/v1/notifications/read-all" as any, {} as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notifKeys.all });
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE("/v1/notifications/{id}" as any, {
        params: { path: { id } } as any,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notifKeys.all });
    },
  });
}

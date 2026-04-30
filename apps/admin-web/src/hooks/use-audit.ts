/**
 * use-audit.ts
 * Hooks para consultar el registro de auditoría del sistema.
 */
import { useQuery } from "@tanstack/react-query";
import { api, getErrorMessage } from "@/lib/api";

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id:          string;
  actor_type:  "USER" | "SYSTEM";
  actor_id?:   string;
  actor_name?: string;
  branch_id?:  string;
  action:      string;
  entity_type: string;
  entity_id:   string;
  reason?:     string;
  metadata?:   Record<string, unknown>;
  created_at:  string;
}

export interface AuditLogsPage {
  total:      number | null;
  limit:      number;
  offset:     number | null;
  nextCursor: string | null;
  data:       AuditLogEntry[];
}

export interface AuditFilters {
  branchId?:   string;
  entityType?: string;
  action?:     string;
  actorId?:    string;
  from?:       string; // YYYY-MM-DD
  to?:         string; // YYYY-MM-DD
  limit?:      number;
  offset?:     number;
}

// ── Query keys ───────────────────────────────────────────────────────────────

export const auditKeys = {
  all:  ["audit"] as const,
  logs: (f: AuditFilters) => ["audit", "logs", f] as const,
};

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useAuditLogs(filters: AuditFilters) {
  return useQuery({
    queryKey: auditKeys.logs(filters),
    queryFn: async () => {
      const q: Record<string, string> = {};
      if (filters.branchId)   q.branchId   = filters.branchId;
      if (filters.entityType) q.entityType  = filters.entityType;
      if (filters.action)     q.action      = filters.action;
      if (filters.actorId)    q.actorId     = filters.actorId;
      if (filters.from)       q.from        = filters.from;
      if (filters.to)         q.to          = filters.to;
      if (filters.limit  != null) q.limit  = String(filters.limit);
      if (filters.offset != null) q.offset = String(filters.offset);

      const { data, error } = await api.GET("/v1/audit" as any, {
        params: { query: q } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as AuditLogsPage;
    },
    staleTime: 1000 * 30, // 30 s — los logs no cambian a menudo en un rango fijo
    placeholderData: (prev) => prev, // mantiene datos anteriores mientras carga la nueva página
  });
}

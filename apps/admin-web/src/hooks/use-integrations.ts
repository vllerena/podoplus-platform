/**
 * use-integrations.ts
 * Hooks para el módulo de Integraciones externas (WhatsApp, SUNAT…).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@podoplus/ui";
import { api, getErrorMessage } from "@/lib/api";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type IntegrationStatus = "live" | "simulated" | "not_configured";

export interface IntegrationsStatusResult {
  whatsapp: IntegrationStatus;
  sunat:    IntegrationStatus;
}

export interface WhatsappStats {
  total:       number;
  sentToday:   number;
  failedToday: number;
  byStatus:    Record<string, number>;
}

export interface WhatsappLogEntry {
  id:                string;
  branchId:          string;
  branchName?:       string;
  customerId?:       string;
  customerName?:     string;
  appointmentId?:    string;
  toPhone:           string;
  messageType:       string;
  templateName?:     string;
  messageBody?:      string;
  status:            string;
  providerMessageId?: string;
  errorMessage?:     string;
  scheduledFor?:     string;
  sentAt?:           string;
  createdAt:         string;
}

export interface WhatsappLogsPage {
  total:      number | null;
  limit:      number;
  offset:     number | null;
  nextCursor: string | null;
  data:       WhatsappLogEntry[];
}

export interface WhatsappLogFilters {
  branchId?: string;
  status?:   string;
  from?:     string;
  to?:       string;
  limit?:    number;
  offset?:   number;
}

export interface WhatsappTemplateVariable {
  index:   number;
  label:   string;
  example: string;
}

export interface WhatsappTemplate {
  name:        string;
  displayName: string;
  description: string;
  preview:     string;
  variables:   WhatsappTemplateVariable[];
}

export interface SendWhatsappInput {
  toPhone:       string;
  branchId:      string;
  messageType:   "TEXT" | "TEMPLATE";
  templateName?: string;
  messageBody?:  string;
  variables?:    Record<string, string>;
  customerId?:   string;
  appointmentId?: string;
}

export interface SendWhatsappResult {
  status:    string;
  message:   string;
  recipient: string;
  preview:   string;
  timestamp: string;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const integrationKeys = {
  all:               ["integrations"] as const,
  status:            () => ["integrations", "status"] as const,
  whatsappStats:     (branchId?: string) => ["integrations", "whatsapp", "stats", branchId] as const,
  whatsappLogs:      (f: WhatsappLogFilters) => ["integrations", "whatsapp", "logs", f] as const,
  whatsappTemplates: () => ["integrations", "whatsapp", "templates"] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useIntegrationsStatus() {
  return useQuery({
    queryKey: integrationKeys.status(),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/integrations/status" as any, {} as any);
      if (error) throw new Error(getErrorMessage(error));
      return data as IntegrationsStatusResult;
    },
    staleTime: 1000 * 60 * 5, // 5 min — el estado no cambia frecuentemente
  });
}

export function useWhatsappStats(branchId?: string) {
  return useQuery({
    queryKey: integrationKeys.whatsappStats(branchId),
    queryFn: async () => {
      const q: Record<string, string> = {};
      if (branchId) q.branch_id = branchId;
      const { data, error } = await api.GET("/v1/integrations/whatsapp/stats" as any, {
        params: { query: q } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as WhatsappStats;
    },
    staleTime: 1000 * 60,     // 1 min
    refetchInterval: 1000 * 60,
  });
}

export function useWhatsappLogs(filters: WhatsappLogFilters) {
  return useQuery({
    queryKey: integrationKeys.whatsappLogs(filters),
    queryFn: async () => {
      const q: Record<string, string> = {};
      if (filters.branchId) q.branch_id = filters.branchId;
      if (filters.status)   q.status    = filters.status;
      if (filters.from)     q.from      = filters.from;
      if (filters.to)       q.to        = filters.to;
      if (filters.limit  != null) q.limit  = String(filters.limit);
      if (filters.offset != null) q.offset = String(filters.offset);

      const { data, error } = await api.GET("/v1/integrations/whatsapp/logs" as any, {
        params: { query: q } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as WhatsappLogsPage;
    },
    staleTime: 1000 * 30,
    placeholderData: (prev) => prev,
  });
}

export function useWhatsappTemplates() {
  return useQuery({
    queryKey: integrationKeys.whatsappTemplates(),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/whatsapp/templates" as any, {} as any);
      if (error) throw new Error(getErrorMessage(error));
      return data as WhatsappTemplate[];
    },
    staleTime: 1000 * 60 * 60, // los templates no cambian frecuentemente
  });
}

export function useSendWhatsappMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendWhatsappInput) => {
      const { data, error } = await api.POST("/v1/whatsapp/messages" as any, {
        body: input,
      } as any);
      if (error) throw new Error(getErrorMessage(error));
      return data as SendWhatsappResult;
    },
    onSuccess: (result) => {
      // Refresca los logs para mostrar el mensaje recién enviado
      qc.invalidateQueries({ queryKey: ["integrations", "whatsapp", "logs"] });
      qc.invalidateQueries({ queryKey: ["integrations", "whatsapp", "stats"] });
      toast({
        title: "Mensaje simulado enviado",
        description: `Destinatario: ${result.recipient}`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Error al enviar mensaje",
        description: err.message,
        variant: "destructive",
      });
    },
  });
}

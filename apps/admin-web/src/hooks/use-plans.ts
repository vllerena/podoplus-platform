import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage } from "@/lib/api";
import { toast } from "@podoplus/ui";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlanType            = "SESSION" | "DATE" | "HYBRID";
export type SubscriptionStatus  = "ACTIVE" | "PAUSED" | "CANCELED" | "EXPIRED";

export interface Plan {
  id:               string;
  name:             string;
  description:      string | null;
  planType:         PlanType;
  price:            string;  // Decimal as string
  durationDays:     number;
  includedSessions: number | "unlimited";
  isActive:         boolean;
  color:            string | null;
  createdAt:        string;
  updatedAt:        string;
}

export interface Subscription {
  id:                string;
  customerId:        string;
  customerName:      string;
  planId:            string;
  planName:          string;
  planType:          PlanType;
  planColor:         string | null;
  branchId:          string | null;
  status:            SubscriptionStatus;
  startDate:         string;
  endDate:           string;
  remainingSessions: number | "unlimited";
  cancelReason:      string | null;
  canceledAt:        string | null;
  pausedAt:          string | null;
  pausedReason:      string | null;
  renewedFromId:     string | null;
  createdAt:         string;
  updatedAt:         string;
}

export interface SubscriptionStats {
  total_subscriptions:      number;
  active_count:             number;
  paused_count:             number;
  expired_count:            number;
  canceled_count:           number;
  total_sessions_consumed:  number;
  total_remaining_sessions: number;
  active_subscriptions:     Subscription[];
}

export interface CreatePlanInput {
  name:               string;
  description?:       string;
  plan_type:          PlanType;
  price:              number;
  duration_days:      number;
  included_sessions?: number;
  is_active?:         boolean;
  color?:             string;
}

export type UpdatePlanInput = Partial<Omit<CreatePlanInput, "plan_type">>;

export interface AssignSubscriptionInput {
  customer_id:     string;
  plan_id:         string;
  branch_id?:      string;  // opcional — la suscripción es válida en todas las sedes
  start_date?:     string;
  appointment_id?: string;
  notes?:          string;
}

export interface SubscriptionsListFilters {
  branchId?: string;
  status?:   SubscriptionStatus;
  planId?:   string;
  cursor?:   string;
  limit?:    number;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const planKeys = {
  all:             ["plans"] as const,
  list:            (active?: boolean) => ["plans", "list", active] as const,
  detail:          (id: string)       => ["plans", "detail", id]   as const,
  subscriptions:   (cid: string)      => ["subscriptions", "customer", cid] as const,
  subscriptionDetail: (id: string)    => ["subscriptions", "detail", id]    as const,
  subscriptionStats:  (cid: string)   => ["subscriptions", "stats", cid]    as const,
  subscriptionList:   (f: SubscriptionsListFilters) => ["subscriptions", "list", f] as const,
};

// ── Normalizers ───────────────────────────────────────────────────────────────

function normalizePlan(raw: any): Plan {
  const sessions = raw.included_sessions ?? raw.includedSessions;
  return {
    id:               raw.id,
    name:             raw.name           ?? "",
    description:      raw.description    ?? null,
    planType:         (raw.plan_type     ?? raw.planType ?? "SESSION") as PlanType,
    price:            String(raw.price   ?? "0"),
    durationDays:     raw.duration_days  ?? raw.durationDays  ?? 0,
    includedSessions: sessions === "unlimited" || sessions === 9999
      ? "unlimited"
      : Number(sessions ?? 0),
    isActive:         raw.is_active ?? raw.isActive ?? true,
    color:            raw.color          ?? null,
    createdAt:        raw.created_at     ?? raw.createdAt ?? "",
    updatedAt:        raw.updated_at     ?? raw.updatedAt ?? "",
  };
}

function normalizeSubscription(raw: any): Subscription {
  const rs = raw.remaining_sessions ?? raw.remainingSessions;
  return {
    id:                raw.id,
    customerId:        raw.customer_id       ?? raw.customerId        ?? "",
    customerName:      raw.customer_name     ?? raw.customerName      ?? "",
    planId:            raw.plan_id           ?? raw.planId            ?? "",
    planName:          raw.plan_name         ?? raw.planName          ?? "",
    planType:          (raw.plan_type        ?? raw.planType          ?? "SESSION") as PlanType,
    planColor:         raw.plan_color        ?? raw.planColor         ?? null,
    branchId:          raw.branch_id         ?? raw.branchId          ?? "",
    status:            (raw.status           ?? "ACTIVE")             as SubscriptionStatus,
    startDate:         raw.start_date        ?? raw.startDate         ?? "",
    endDate:           raw.end_date          ?? raw.endDate           ?? "",
    remainingSessions: rs === "unlimited"    ? "unlimited" : Number(rs ?? 0),
    cancelReason:      raw.cancel_reason     ?? raw.cancelReason      ?? null,
    canceledAt:        raw.canceled_at       ?? raw.canceledAt        ?? null,
    pausedAt:          raw.paused_at         ?? raw.pausedAt          ?? null,
    pausedReason:      raw.paused_reason     ?? raw.pausedReason      ?? null,
    renewedFromId:     raw.renewed_from_id   ?? raw.renewedFromId     ?? null,
    createdAt:         raw.created_at        ?? raw.createdAt         ?? "",
    updatedAt:         raw.updated_at        ?? raw.updatedAt         ?? "",
  };
}

// ── Plan queries ──────────────────────────────────────────────────────────────

export function usePlans(active?: boolean) {
  return useQuery({
    queryKey: planKeys.list(active),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/plans" as any, {
        params: { query: active !== undefined ? { active } : {} },
      });
      if (error) throw new Error(getErrorMessage(error));
      const raw = (data as any[] ?? []);
      return raw.map(normalizePlan);
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function usePlan(id: string) {
  return useQuery({
    queryKey: planKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/plans/{id}" as any, {
        params: { path: { id } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return normalizePlan(data as any);
    },
    enabled: !!id,
  });
}

// ── Plan mutations ────────────────────────────────────────────────────────────

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreatePlanInput) => {
      const { data, error } = await api.POST("/v1/plans" as any, { body: body as any });
      if (error) throw new Error(getErrorMessage(error));
      return normalizePlan(data as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.all });
      toast({ title: "Plan creado", description: "El plan fue registrado exitosamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al crear plan", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdatePlan(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdatePlanInput) => {
      const { data, error } = await api.PATCH("/v1/plans/{id}" as any, {
        params: { path: { id } } as any,
        body: body as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return normalizePlan(data as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.all });
      toast({ title: "Plan actualizado" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al actualizar plan", description: err.message, variant: "destructive" });
    },
  });
}

export function useActivatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.POST("/v1/plans/{id}/activate" as any, {
        params: { path: { id } } as any, body: {} as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return normalizePlan(data as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.all });
      toast({ title: "Plan activado" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al activar plan", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeactivatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.POST("/v1/plans/{id}/deactivate" as any, {
        params: { path: { id } } as any, body: {} as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return normalizePlan(data as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.all });
      toast({ title: "Plan desactivado" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al desactivar plan", description: err.message, variant: "destructive" });
    },
  });
}

// ── Subscription queries ──────────────────────────────────────────────────────

export function useSubscriptions(filters: SubscriptionsListFilters) {
  return useQuery({
    queryKey: planKeys.subscriptionList(filters),
    queryFn:  async () => {
      const { data, error } = await api.GET("/v1/subscriptions" as any, {
        params: {
          query: {
            branch_id: filters.branchId || undefined,
            status:    filters.status   || undefined,
            plan_id:   filters.planId   || undefined,
            cursor:    filters.cursor   || undefined,
            limit:     filters.limit    ?? 20,
          },
        },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      return {
        data:       (result?.data ?? []).map(normalizeSubscription) as Subscription[],
        total:      (result?.total as number) ?? 0,
        nextCursor: result?.nextCursor as string | undefined,
        hasNext:    result?.hasNext as boolean,
      };
    },
    staleTime: 1000 * 30,
  });
}

export function useCustomerSubscriptions(customerId: string) {
  return useQuery({
    queryKey: planKeys.subscriptions(customerId),
    queryFn: async () => {
      const { data, error } = await api.GET(
        "/v1/subscriptions/customer/{customerId}" as any,
        { params: { path: { customerId } } },
      );
      if (error) throw new Error(getErrorMessage(error));
      return (data as any[] ?? []).map(normalizeSubscription);
    },
    enabled: !!customerId,
    staleTime: 1000 * 30,
  });
}

export function useSubscription(id: string) {
  return useQuery({
    queryKey: planKeys.subscriptionDetail(id),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/subscriptions/{id}" as any, {
        params: { path: { id } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return normalizeSubscription(data as any);
    },
    enabled: !!id,
  });
}

export function useSubscriptionStats(customerId: string) {
  return useQuery({
    queryKey: planKeys.subscriptionStats(customerId),
    queryFn: async () => {
      const { data, error } = await api.GET(
        "/v1/subscriptions/stats/{customerId}" as any,
        { params: { path: { customerId } } },
      );
      if (error) throw new Error(getErrorMessage(error));
      return data as SubscriptionStats;
    },
    enabled: !!customerId,
    staleTime: 1000 * 30,
  });
}

// ── Subscription mutations ────────────────────────────────────────────────────

export function useAssignPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: AssignSubscriptionInput) => {
      const { data, error } = await api.POST("/v1/subscriptions" as any, {
        body: body as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return normalizeSubscription(data as any);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: planKeys.subscriptions(vars.customer_id) });
      qc.invalidateQueries({ queryKey: planKeys.subscriptionStats(vars.customer_id) });
      qc.invalidateQueries({ queryKey: ["subscriptions", "list"] });
      toast({ title: "Plan asignado", description: "La suscripción fue creada exitosamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al asignar plan", description: err.message, variant: "destructive" });
    },
  });
}

export function useConsumeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { data, error } = await api.POST("/v1/subscriptions/{id}/consume" as any, {
        params: { path: { id } } as any,
        body: { notes } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return normalizeSubscription(data as any);
    },
    onSuccess: (sub) => {
      qc.invalidateQueries({ queryKey: planKeys.subscriptions(sub.customerId) });
      qc.invalidateQueries({ queryKey: planKeys.subscriptionDetail(sub.id) });
      toast({ title: "Sesión registrada" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al consumir sesión", description: err.message, variant: "destructive" });
    },
  });
}

export function usePauseSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data, error } = await api.POST("/v1/subscriptions/{id}/pause" as any, {
        params: { path: { id } } as any,
        body: { reason } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return normalizeSubscription(data as any);
    },
    onSuccess: (sub) => {
      qc.invalidateQueries({ queryKey: planKeys.subscriptions(sub.customerId) });
      qc.invalidateQueries({ queryKey: ["subscriptions", "list"] });
      toast({ title: "Suscripción pausada" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al pausar suscripción", description: err.message, variant: "destructive" });
    },
  });
}

export function useResumeSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.POST("/v1/subscriptions/{id}/resume" as any, {
        params: { path: { id } } as any,
        body: {} as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return normalizeSubscription(data as any);
    },
    onSuccess: (sub) => {
      qc.invalidateQueries({ queryKey: planKeys.subscriptions(sub.customerId) });
      qc.invalidateQueries({ queryKey: ["subscriptions", "list"] });
      toast({ title: "Suscripción reanudada" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al reanudar suscripción", description: err.message, variant: "destructive" });
    },
  });
}

export function useRenewSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.POST("/v1/subscriptions/{id}/renew" as any, {
        params: { path: { id } } as any,
        body: {} as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return normalizeSubscription(data as any);
    },
    onSuccess: (sub) => {
      qc.invalidateQueries({ queryKey: planKeys.subscriptions(sub.customerId) });
      qc.invalidateQueries({ queryKey: ["subscriptions", "list"] });
      toast({ title: "Suscripción renovada", description: "Se creó una nueva suscripción." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al renovar", description: err.message, variant: "destructive" });
    },
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await api.POST("/v1/subscriptions/{id}/cancel" as any, {
        params: { path: { id } } as any,
        body: { reason } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return normalizeSubscription(data as any);
    },
    onSuccess: (sub) => {
      qc.invalidateQueries({ queryKey: planKeys.subscriptions(sub.customerId) });
      qc.invalidateQueries({ queryKey: ["subscriptions", "list"] });
      toast({ title: "Suscripción cancelada" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al cancelar", description: err.message, variant: "destructive" });
    },
  });
}

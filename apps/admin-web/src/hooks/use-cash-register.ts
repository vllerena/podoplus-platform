import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage } from "@/lib/api";
import { toast } from "@podoplus/ui";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RegisterStatus = "OPEN" | "CLOSED";
export type MovementType   = "IN" | "OUT";

export interface CashRegister {
  id:                       string;
  branch_id:                string;
  branch_name?:             string;
  status:                   RegisterStatus;
  opening_balance:          string;
  opened_at:                string;
  opened_by?:               { id: string; name: string };
  closed_at?:               string | null;
  closed_by?:               { id: string; name: string } | null;
  closing_balance_reported?: string | null;
  closing_balance_system?:   string | null;
  difference?:               string | null;
  notes?:                   string | null;
  created_at:               string;
  updated_at:               string;
  // only on detail / open queries
  current_balance?: string;
  total_in?:        string;
  total_out?:       string;
}

export interface CashMovement {
  id:               string;
  cash_register_id: string;
  type:             MovementType;
  amount:           string;
  reason:           string;
  created_by:       { id: string; name: string };
  created_at:       string;
}

export interface RegisterSummary {
  register_id:              string;
  branch_id:                string;
  branch_name:              string | null;
  status:                   RegisterStatus;
  opening_balance:          string;
  total_in:                 string;
  total_out:                string;
  total_movements:          number;
  movements_in_count:       number;
  movements_out_count:      number;
  system_balance:           string;
  closing_balance_reported: string | null;
  closing_balance_system:   string | null;
  difference:               string | null;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Caja actualmente OPEN en una sede */
export function useOpenRegister(branchId: string) {
  return useQuery({
    queryKey: ["cash-register", "open", branchId],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/cash-registers/open" as any, {
        params: { query: { branch_id: branchId } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as { open: boolean; register: CashRegister | null };
    },
    enabled:   !!branchId,
    staleTime: 1000 * 30,
  });
}

/** Historial de cajas de una sede */
export function useRegisters(params: {
  branchId: string;
  status?:  string;
  cursor?:  string;
  limit?:   number;
}) {
  return useQuery({
    queryKey: ["cash-register", "list", params],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/cash-registers" as any, {
        params: {
          query: {
            branch_id: params.branchId,
            status:    params.status  || undefined,
            cursor:    params.cursor  || undefined,
            limit:     params.limit   ?? 20,
          },
        },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      return {
        data:       (result?.data ?? []) as CashRegister[],
        nextCursor: result?.nextCursor as string | undefined,
        hasNext:    result?.hasNext    as boolean,
      };
    },
    enabled:   !!params.branchId,
    staleTime: 1000 * 30,
  });
}

/** Detalle de una caja (con balance calculado) */
export function useRegister(registerId: string) {
  return useQuery({
    queryKey: ["cash-register", registerId],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/cash-registers/{id}" as any, {
        params: { path: { id: registerId } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as CashRegister;
    },
    enabled:   !!registerId,
    staleTime: 1000 * 15,
  });
}

/** Resumen / cuadre de caja */
export function useRegisterSummary(registerId: string) {
  return useQuery({
    queryKey: ["cash-register", registerId, "summary"],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/cash-registers/{id}/summary" as any, {
        params: { path: { id: registerId } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as RegisterSummary;
    },
    enabled:   !!registerId,
    staleTime: 1000 * 15,
  });
}

/** Movimientos de una caja */
export function useMovements(params: {
  registerId: string;
  type?:      MovementType;
  cursor?:    string;
  limit?:     number;
}) {
  return useQuery({
    queryKey: ["cash-register", params.registerId, "movements", params],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/cash-registers/{id}/movements" as any, {
        params: {
          path:  { id: params.registerId },
          query: {
            type:   params.type   || undefined,
            cursor: params.cursor || undefined,
            limit:  params.limit  ?? 50,
          },
        },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      return {
        data:       (result?.data ?? []) as CashMovement[],
        nextCursor: result?.nextCursor as string | undefined,
        hasNext:    result?.hasNext    as boolean,
      };
    },
    enabled:   !!params.registerId,
    staleTime: 1000 * 15,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useOpenRegisterMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { branch_id: string; opening_balance: number; notes?: string }) => {
      const { data, error } = await api.POST("/v1/cash-registers" as any, {
        body: input as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as CashRegister;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-register"] });
      toast({ title: "Caja abierta", description: "La caja se abrió correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al abrir caja", description: err.message, variant: "destructive" });
    },
  });
}

export function useCloseRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { registerId: string; closing_balance_reported: number; notes?: string }) => {
      const { data, error } = await api.POST("/v1/cash-registers/{id}/close" as any, {
        params: { path: { id: input.registerId } },
        body: {
          closing_balance_reported: input.closing_balance_reported,
          notes: input.notes,
        } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as CashRegister;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-register"] });
      toast({ title: "Caja cerrada", description: "El cierre de caja se registró correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al cerrar caja", description: err.message, variant: "destructive" });
    },
  });
}

export function useAddManualMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { registerId: string; type: MovementType; amount: number; reason: string }) => {
      const { data, error } = await api.POST("/v1/cash-registers/{id}/movements" as any, {
        params: { path: { id: input.registerId } },
        body: {
          type:   input.type,
          amount: input.amount,
          reason: input.reason,
        } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as CashMovement;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["cash-register"] });
      toast({
        title:       vars.type === "IN" ? "Ingreso registrado" : "Egreso registrado",
        description: `S/ ${vars.amount.toFixed(2)} — ${vars.reason}`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error al registrar movimiento", description: err.message, variant: "destructive" });
    },
  });
}

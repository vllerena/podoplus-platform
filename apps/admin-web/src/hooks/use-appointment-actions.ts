import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage } from "@/lib/api";
import { toast } from "@podoplus/ui";

function useAppointmentMutation(
  successTitle: string,
  mutationFn: (id: string, body?: Record<string, unknown>) => Promise<unknown>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      mutationFn(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({ title: successTitle });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

// Backend uses POST for all state-transition actions
// (not PATCH — the controller declares them as @Post)

export function useConfirmAppointment() {
  return useAppointmentMutation("Cita confirmada", async (id) => {
    const { error } = await api.POST("/v1/appointments/{id}/confirm" as any, {
      params: { path: { id } },
      body: {} as any,
    });
    if (error) throw new Error(getErrorMessage(error));
  });
}

export function useCheckInAppointment() {
  return useAppointmentMutation("Check-in registrado", async (id) => {
    const { error } = await api.POST("/v1/appointments/{id}/check-in" as any, {
      params: { path: { id } },
      body: {} as any,
    });
    if (error) throw new Error(getErrorMessage(error));
  });
}

export function useStartAppointment() {
  return useAppointmentMutation("Consulta iniciada", async (id) => {
    const { error } = await api.POST("/v1/appointments/{id}/start" as any, {
      params: { path: { id } },
      body: {} as any,
    });
    if (error) throw new Error(getErrorMessage(error));
  });
}

export function useCompleteAppointment() {
  return useAppointmentMutation("Cita completada", async (id) => {
    const { error } = await api.POST("/v1/appointments/{id}/complete" as any, {
      params: { path: { id } },
      body: {} as any,
    });
    if (error) throw new Error(getErrorMessage(error));
  });
}

export function useCancelAppointment() {
  return useAppointmentMutation("Cita cancelada", async (id, body) => {
    const { error } = await api.POST("/v1/appointments/{id}/cancel" as any, {
      params: { path: { id } },
      body: { reason: body?.reason ?? "" } as any,
    });
    if (error) throw new Error(getErrorMessage(error));
  });
}

export function useNoShowAppointment() {
  return useAppointmentMutation("No-show registrado", async (id) => {
    const { error } = await api.POST("/v1/appointments/{id}/no-show" as any, {
      params: { path: { id } },
      body: {} as any,
    });
    if (error) throw new Error(getErrorMessage(error));
  });
}

export function useRescheduleAppointment() {
  return useAppointmentMutation("Cita reagendada", async (id, body) => {
    const isoStr = body?.newStartAt as string | undefined;
    if (!isoStr) throw new Error("Se requiere una fecha y hora para reagendar");

    // Backend DTO expects separate date + time fields (snake_case)
    const new_start_date = isoStr.slice(0, 10); // "YYYY-MM-DD"
    const d              = new Date(isoStr);
    const new_start_time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

    const { error } = await api.POST("/v1/appointments/{id}/reschedule" as any, {
      params: { path: { id } },
      body:   {
        new_start_date,
        new_start_time,
        reason: (body?.reason as string | undefined) || undefined,
      } as any,
    });
    if (error) throw new Error(getErrorMessage(error));
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      branchId:      string;
      customerId:    string;
      serviceId:     string;
      startAt:       string;
      startAtLocal?: string;
      notes?:        string;
    }) => {
      const d          = new Date(body.startAt);
      const start_date = body.startAt.slice(0, 10);
      const start_time = body.startAtLocal
        ?? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

      const { data, error } = await api.POST("/v1/appointments" as any, {
        body: {
          branch_id:   body.branchId,
          customer_id: body.customerId,
          service_id:  body.serviceId,
          start_date,
          start_time,
          notes:       body.notes,
        } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({ title: "Cita agendada", description: "La cita se registró correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al agendar cita", description: err.message, variant: "destructive" });
    },
  });
}

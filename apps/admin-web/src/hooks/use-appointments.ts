import { useQuery } from "@tanstack/react-query";
import { api, getErrorMessage } from "@/lib/api";

export interface AppointmentFilters {
  date:      string;          // YYYY-MM-DD
  branchId?: string;
  status?:   string;
  serviceId?: string;
}

export interface AppointmentRangeFilters {
  from:      string;   // YYYY-MM-DD
  to:        string;   // YYYY-MM-DD
  branchId?: string;
  status?:   string;
}

export function useAppointments(filters: AppointmentFilters) {
  return useQuery({
    queryKey: ["appointments", filters],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/appointments" as any, {
        params: {
          query: {
            from:      filters.date,
            to:        filters.date,
            branchId:  filters.branchId,
            status:    filters.status,
            serviceId: filters.serviceId,
            limit:     100,
          },
        },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      const raw = (result?.data ?? result ?? []) as any[];
      return raw.map(normalizeAppointment);
    },
    staleTime: 1000 * 30,
  });
}

export function useAppointmentsRange(filters: AppointmentRangeFilters) {
  return useQuery({
    queryKey: ["appointments", "range", filters],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/appointments" as any, {
        params: {
          query: {
            from:     filters.from,
            to:       filters.to,
            branchId: filters.branchId || undefined,
            status:   filters.status   || undefined,
            limit:    500,
          },
        },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      const raw = (result?.data ?? result ?? []) as any[];
      return raw.map(normalizeAppointment);
    },
    staleTime: 1000 * 30,
  });
}

export function useAppointment(id: string) {
  return useQuery({
    queryKey: ["appointments", id],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/appointments/{id}" as any, {
        params: { path: { id } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return normalizeAppointment(data as any);
    },
    enabled: !!id,
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Appointment {
  id:            string;
  branchId:      string;
  customerId:    string;
  serviceId:     string;
  startAt:       string;  // ISO string
  endAt:         string;  // ISO string
  status:        string;
  source:        string;
  notes?:        string;
  color?:        string;
  cancelReason?:     string;
  rescheduledFromId?: string;  // ID de la cita original (en citas nuevas post-reprogramación)
  rescheduledToId?:   string;  // ID de la nueva cita    (en citas marcadas RESCHEDULED)
  rescheduledReason?: string;  // Motivo de la reprogramación (en citas RESCHEDULED)
  createdAt:     string;
  updatedAt:     string;
  // Relations (may be nested objects OR flattened by backend)
  customer?: { id: string; firstName: string; lastName: string; phone?: string; documentNumber?: string };
  service?:  { id: string; name: string; durationMinutes: number; color?: string };
  branch?:   { id: string; name: string };
}

/**
 * Normalizes a raw API appointment (snake_case flat fields) into the camelCase
 * Appointment interface used throughout the frontend.
 *
 * Backend returns flat fields like:
 *   start_at, end_at, branch_id, customer_id, service_id,
 *   customer_name, service_name, service_color, service_duration_minutes, ...
 */
function normalizeAppointment(raw: any): Appointment {
  // Convierte "YYYY-MM-DD HH:mm" o "YYYY-MM-DD HH:mm:ss" al ISO UTC correcto.
  //
  // ESTRATEGIA NAIVE LIMA: las horas en la BD son Lima local almacenadas como UTC.
  // Ejemplo: "2026-05-05 15:30:00" = Lima 15:30 (naive).
  //
  // Debemos añadir 'T' y 'Z' para que el browser trate el valor como UTC y no
  // como hora local Lima (que sumaría 5h extra al convertir a UTC internamente).
  //   SIN Z: new Date("2026-05-05 15:30:00") en Lima → UTC 20:30 ← INCORRECTO
  //   CON Z: new Date("2026-05-05T15:30:00Z") → UTC 15:30 ← CORRECTO (naive Lima)
  const toIso = (v: string | undefined): string => {
    if (!v) return "";
    // Ya es ISO con T/Z → no modificar
    if (v.includes("T") || v.includes("Z")) return v;
    // "YYYY-MM-DD HH:mm" o "YYYY-MM-DD HH:mm:ss" → convertir a ISO UTC naive
    const withSec = v.length === 16 ? `${v}:00` : v;   // asegurar segundos
    return `${withSec.replace(" ", "T")}Z`;              // → "2026-05-05T15:30:00Z"
  };

  const startAt = toIso(raw.start_at ?? raw.startAt);
  const endAt   = toIso(raw.end_at   ?? raw.endAt);

  // Build nested customer from flat fields when relations aren't embedded
  const customer: Appointment["customer"] = raw.customer ?? (
    raw.customer_id ? {
      id:        raw.customer_id,
      firstName: (raw.customer_name ?? "").split(" ")[0] ?? "",
      lastName:  (raw.customer_name ?? "").split(" ").slice(1).join(" ") ?? "",
      phone:     raw.customer_phone ?? undefined,
    } : undefined
  );

  // Build nested service from flat fields
  const service: Appointment["service"] = raw.service ?? (
    raw.service_id ? {
      id:              raw.service_id,
      name:            raw.service_name            ?? "",
      durationMinutes: raw.service_duration_minutes ?? 0,
      color:           raw.service_color            ?? undefined,
    } : undefined
  );

  return {
    id:           raw.id,
    branchId:     raw.branch_id      ?? raw.branchId      ?? "",
    customerId:   raw.customer_id    ?? raw.customerId    ?? "",
    serviceId:    raw.service_id     ?? raw.serviceId     ?? "",
    startAt,
    endAt,
    status:       raw.status         ?? "",
    source:       raw.source         ?? "",
    notes:        raw.notes          ?? undefined,
    color:        raw.color          ?? raw.service_color ?? undefined,
    cancelReason:      raw.cancel_reason       ?? raw.cancelReason      ?? undefined,
    rescheduledFromId: raw.rescheduled_from_id ?? raw.rescheduledFromId ?? undefined,
    rescheduledToId:   raw.rescheduled_to_id   ?? raw.rescheduledToId   ?? undefined,
    rescheduledReason: raw.rescheduled_reason  ?? raw.rescheduledReason ?? undefined,
    createdAt:         raw.created_at          ?? raw.createdAt         ?? "",
    updatedAt:         raw.updated_at          ?? raw.updatedAt         ?? "",
    customer,
    service,
    branch:            raw.branch              ?? undefined,
  };
}

export function useBranches() {
  return useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/branches" as any, {});
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      return (result?.data ?? result ?? []) as Array<{
        id: string; name: string; isActive: boolean;
        businessUnitId?: string | null;
        attachedCode?: string | null;
      }>;
    },
    staleTime: 1000 * 60 * 5, // 5 min — branches rarely change
  });
}

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/services" as any, {});
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      return (result?.data ?? result ?? []) as Array<{ id: string; name: string; durationMinutes: number; isActive: boolean; color?: string | null }>;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useCustomerSearch(query: string) {
  return useQuery({
    queryKey: ["customers", "search", query],
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/customers" as any, {
        params: { query: { q: query, limit: 10 } },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      return (result?.data ?? result ?? []) as Array<{
        id: string; firstName: string; lastName: string;
        documentNumber?: string; phone?: string;
      }>;
    },
    enabled: query.length >= 2,
    staleTime: 1000 * 30,
  });
}

export function useAvailabilitySlots(params: {
  branchId:  string;
  serviceId: string;
  date:      string; // YYYY-MM-DD
} | null) {
  return useQuery({
    queryKey: ["availability", params],
    queryFn: async () => {
      if (!params) return [];
      // Backend parseLocalDate() expects YYYY-MM-DD, NOT ISO timestamps
      const { data, error } = await api.GET("/v1/availability" as any, {
        params: { query: { branchId: params.branchId, serviceId: params.serviceId, from: params.date, to: params.date } },
      });
      if (error) throw new Error(getErrorMessage(error));
      // Backend returns { byDate: [{ date: "YYYY-MM-DD", slots: [...] }] }
      // For a single-date query (from === to) flatten all days into one array
      const result = data as any;
      const allSlots = (result?.byDate ?? []).flatMap(
        (d: any) => d.slots ?? [],
      );
      return allSlots as Array<{
        startAt: string; endAt: string;
        startAtLocal: string; endAtLocal: string;
        availableCapacity: number; totalCapacity: number;
        isAvailable: boolean;
      }>;
    },
    enabled: !!params?.branchId && !!params?.serviceId && !!params?.date,
    staleTime: 1000 * 60, // 1 min
  });
}

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ReportParams {
  branchId: string;
  from:     string; // YYYY-MM-DD
  to:       string; // YYYY-MM-DD
}

// Dashboard KPIs
export interface DashboardReport {
  appointments: {
    total:      number;
    completed:  number;
    cancelled:  number;
    noShow:     number;
    pending:    number;
  };
  sales: {
    totalRevenue:     number;
    totalTransactions: number;
    averageTicket:    number;
  };
  activeSubscriptions: number;
  lowStockAlerts:      number;
  newCustomers:        number;
}

// Operations report
export interface OperationsReport {
  occupancyRate:   number;
  totalSlots:      number;
  usedSlots:       number;
  byStatus: {
    completed:  number;
    cancelled:  number;
    noShow:     number;
    confirmed:  number;
    pending:    number;
  };
  topService: {
    id:    string;
    name:  string;
    count: number;
  } | null;
  bySource: {
    manual:      number;
    selfService: number;
  };
}

// Sales report
export interface SalesReport {
  totalRevenue:      number;
  totalTransactions: number;
  averageTicket:     number;
  refunds:           number;
  refundAmount:      number;
  byPaymentMethod:   { method: string; amount: number; count: number }[];
  topProducts:       { id: string; name: string; quantity: number; revenue: number }[];
  topServices:       { id: string; name: string; quantity: number; revenue: number }[];
  revenueByDay:      { date: string; amount: number }[];
}

// No-show / cancellations report
export interface NoShowReport {
  totalNoShows:        number;
  totalCancellations:  number;
  noShowRate:          number;
  cancellationRate:    number;
  recurringNoShows:    { customerId: string; customerName: string; count: number }[];
  topCancellationReasons: { reason: string; count: number }[];
}

// Inventory report
export interface InventoryReport {
  totalProducts:      number;
  totalStockValue:    number;
  lowStockProducts:   { id: string; name: string; stock: number; threshold: number }[];
  outOfStockProducts: { id: string; name: string }[];
  topMovements:       { id: string; name: string; totalOut: number }[];
}

// Customers report
export interface CustomersReport {
  newCustomers:      number;
  recurringCustomers: number;
  totalCustomers:    number;
  retentionRate:     number;
  topSpenders:       { customerId: string; name: string; totalSpent: number }[];
  topVisitors:       { customerId: string; name: string; visits: number }[];
}

// Plans / subscriptions report
export interface PlansReport {
  activeSubscriptions:    number;
  pausedSubscriptions:    number;
  cancelledSubscriptions: number;
  totalSessionsConsumed:  number;
  churnRate:              number;
  topPlans:               { planId: string; planName: string; count: number }[];
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const reportKeys = {
  all:        ["reports"] as const,
  dashboard:  (p: ReportParams) => [...reportKeys.all, "dashboard", p] as const,
  operations: (p: ReportParams) => [...reportKeys.all, "operations", p] as const,
  sales:      (p: ReportParams) => [...reportKeys.all, "sales", p] as const,
  noShow:     (p: ReportParams) => [...reportKeys.all, "no-show", p] as const,
  inventory:  (p: ReportParams & { threshold?: number }) => [...reportKeys.all, "inventory", p] as const,
  customers:  (p: ReportParams) => [...reportKeys.all, "customers", p] as const,
  plans:      (p: ReportParams) => [...reportKeys.all, "plans", p] as const,
};

function buildQuery(p: ReportParams & { threshold?: number }) {
  return {
    branchId:  p.branchId,
    from:      p.from,
    to:        p.to,
    ...(p.threshold !== undefined ? { threshold: String(p.threshold) } : {}),
  };
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useDashboardReport(params: ReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.dashboard(params),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/reports/dashboard" as any, {
        params: { query: buildQuery(params) } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as DashboardReport;
    },
    enabled: enabled && !!params.branchId && !!params.from && !!params.to,
  });
}

export function useOperationsReport(params: ReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.operations(params),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/reports/operations" as any, {
        params: { query: buildQuery(params) } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as OperationsReport;
    },
    enabled: enabled && !!params.branchId && !!params.from && !!params.to,
  });
}

export function useSalesReport(params: ReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.sales(params),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/reports/sales" as any, {
        params: { query: buildQuery(params) } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as SalesReport;
    },
    enabled: enabled && !!params.branchId && !!params.from && !!params.to,
  });
}

export function useNoShowReport(params: ReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.noShow(params),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/reports/no-show" as any, {
        params: { query: buildQuery(params) } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as NoShowReport;
    },
    enabled: enabled && !!params.branchId && !!params.from && !!params.to,
  });
}

export function useInventoryReport(params: ReportParams & { threshold?: number }, enabled = true) {
  return useQuery({
    queryKey: reportKeys.inventory(params),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/reports/inventory" as any, {
        params: { query: buildQuery(params) } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as InventoryReport;
    },
    enabled: enabled && !!params.branchId && !!params.from && !!params.to,
  });
}

export function useCustomersReport(params: ReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.customers(params),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/reports/customers" as any, {
        params: { query: buildQuery(params) } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as CustomersReport;
    },
    enabled: enabled && !!params.branchId && !!params.from && !!params.to,
  });
}

export function usePlansReport(params: ReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.plans(params),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/reports/plans" as any, {
        params: { query: buildQuery(params) } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as PlansReport;
    },
    enabled: enabled && !!params.branchId && !!params.from && !!params.to,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Construye la URL de descarga CSV directamente desde el API */
export function buildCsvUrl(
  endpoint: "operations" | "sales" | "no-show" | "inventory" | "customers",
  params: ReportParams,
) {
  const base = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
  const q = new URLSearchParams({
    branchId: params.branchId,
    from:     params.from,
    to:       params.to,
    format:   "csv",
  });
  return `${base}/v1/reports/${endpoint}?${q.toString()}`;
}

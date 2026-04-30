import { useState, useEffect } from "react";
import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage, getAccessToken } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CustomerTag {
  id:    string;
  name:  string;
  color: string;
}

export interface MarketingChannel {
  id:       string;
  name:     string;
  isActive: boolean;
}

export interface Company {
  id:             string;
  name:           string;
  documentType?:  string | null;
  documentNumber?: string | null;
  address?:       string | null;
  createdAt?:     string;
}

export interface Customer {
  id:             string;
  firstName:      string;
  lastName:       string;
  fullName?:      string;
  documentType?:  string | null;
  documentNumber?: string | null;
  phone?:         string | null;
  email?:         string | null;
  birthDate?:     string | null;
  age?:           number | null;
  gender?:        string | null;
  notes?:         string | null;
  whatsappOptIn:  boolean;
  familyHeadId?:  string | null;
  familyRelation?: string | null;
  familyHead?:    { id: string; fullName: string } | null;
  deletedAt?:     string | null;
  createdAt:      string;
  updatedAt:      string;
  tags?:          CustomerTag[];
  hasAvatar:      boolean;
  avatarUrl:      string | null;
  // Datos clínicos
  occupation?:            string | null;
  allergies?:             string[];
  emergencyContactName?:  string | null;
  emergencyContactPhone?: string | null;
  emergencyContactEmail?: string | null;
  // Citas desnormalizadas
  lastAppointmentDate?:   string | null;
  lastAppointmentStatus?: string | null;
  nextAppointmentDate?:   string | null;
  nextAppointmentStatus?: string | null;
  // Marketing
  marketingChannelId?: string | null;
  marketingChannel?:   { id: string; name: string } | null;
  // Empresas
  companies?: Company[];
  isActive?:  boolean;
}

export interface CreateCustomerDto {
  firstName:             string;
  lastName:              string;
  documentType?:         string;
  documentNumber?:       string;
  phone?:                string;
  email?:                string;
  birthDate?:            string;
  gender?:               string;
  notes?:                string;
  whatsappOptIn?:        boolean;
  familyHeadId?:         string;
  occupation?:           string;
  allergies?:            string[];
  emergencyContactName?:  string;
  emergencyContactPhone?: string;
  emergencyContactEmail?: string;
  marketingChannelId?:   string;
}

export type UpdateCustomerDto = Partial<CreateCustomerDto>;

export interface CustomerNote {
  id:        string;
  content:   string;
  createdAt: string;
  updatedAt: string;
  author?: { id: string; fullName: string };
}

export interface CustomerStats {
  customerId:            string;
  totalAppointments:     number;
  completedAppointments: number;
  canceledAppointments:  number;
  noShowAppointments:    number;
  noShowRate:            number;
  activeSubscriptions:   number;
  totalSpent:            string;
  totalRefunded:         string;
  netSpent:              string;
}

export interface TimelineItem {
  id:          string;
  type:        "APPOINTMENT" | "SALE" | "SUBSCRIPTION";
  date:        string;
  description: string;
  status:      string;
  metadata:    Record<string, unknown>;
}

export interface CustomersPage {
  data:        Customer[];
  nextCursor?: string | null;
  total?:      number;
}

export interface FamilyMember {
  id:        string;
  firstName: string;
  lastName:  string;
  relation:  string | null;
  phone:     string | null;
  email:     string | null;
  birthDate: string | null;
  avatarUrl: string | null;
  hasAvatar: boolean;
  isHead:    boolean;
}

export interface FamilyGroup {
  head:         FamilyMember | null;
  members:      FamilyMember[];
  totalMembers: number;
}

export interface BirthdayReminder {
  customerId: string;
  firstName:  string;
  lastName:   string;
  birthDate:  string;
  daysUntil:  number;
  phone:      string | null;
  avatarUrl:  string | null;
}

export interface CustomerSaleItem {
  id:        string;
  itemType:  string;
  name:      string;
  quantity:  number;
  unitPrice: number;
  subtotal:  number;
}

export interface CustomerSale {
  id:            string;
  total:         number;
  status:        string;
  paymentMethod: string;
  branchName:    string | null;
  createdAt:     string;
  items:         CustomerSaleItem[];
}

// ── Filters ───────────────────────────────────────────────────────────────────

export interface CustomerFilters {
  q?:              string;
  phone?:          string;
  documentNumber?: string;
  email?:          string;
  tagIds?:         string[];
  deleted?:        boolean;
  limit?:          number;
  cursor?:         string;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const customerKeys = {
  all:              ["customers"] as const,
  lists:            () => [...customerKeys.all, "list"] as const,
  list:             (f: Record<string, unknown>) => [...customerKeys.lists(), f] as const,
  detail:           (id: string) => [...customerKeys.all, "detail", id] as const,
  notes:            (id: string) => [...customerKeys.all, id, "notes"] as const,
  stats:            (id: string) => [...customerKeys.all, id, "stats"] as const,
  timeline:         (id: string) => [...customerKeys.all, id, "timeline"] as const,
  appointments:     (id: string) => [...customerKeys.all, id, "appointments"] as const,
  family:           (id: string) => [...customerKeys.all, id, "family"] as const,
  sales:            (id: string) => [...customerKeys.all, id, "sales"] as const,
  companies:        (id: string) => [...customerKeys.all, id, "companies"] as const,
  tags:             () => ["customer-tags"] as const,
  birthdays:        (days: number) => ["customer-birthdays", days] as const,
  allCompanies:     () => ["companies"] as const,
  companiesList:    (q?: string) => [...customerKeys.allCompanies(), q ?? ""] as const,
  marketingChannels: () => ["marketing-channels"] as const,
};

// ── Normalizer ────────────────────────────────────────────────────────────────

export function normalizeCustomer(raw: any): Customer {
  const hasAvatar = raw.hasAvatar ?? false;
  return {
    ...raw,
    fullName:  raw.fullName ?? `${raw.firstName} ${raw.lastName}`,
    hasAvatar,
    avatarUrl: hasAvatar ? `/v1/customers/${raw.id}/avatar` : null,
    allergies: raw.allergies ?? [],
    companies: raw.companies ?? [],
    tags:      raw.tags ?? [],
  } as Customer;
}

// ── List / search hooks ───────────────────────────────────────────────────────

export function useCustomers(filters: CustomerFilters) {
  return useQuery({
    queryKey: customerKeys.list(filters as Record<string, unknown>),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/customers" as any, {
        params: {
          query: {
            q:              filters.q              || undefined,
            phone:          filters.phone          || undefined,
            documentNumber: filters.documentNumber || undefined,
            email:          filters.email          || undefined,
            tagIds:         filters.tagIds?.join(",") || undefined,
            deleted:        filters.deleted        ? "true" : undefined,
            limit:          filters.limit          ?? 50,
            cursor:         filters.cursor         || undefined,
          },
        },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      const rawList: any[] = result?.data ?? result ?? [];
      return {
        data:       rawList.map(normalizeCustomer),
        nextCursor: result?.nextCursor as string | undefined,
        total:      result?.total as number | undefined,
      } as CustomersPage;
    },
    staleTime: 1000 * 30,
  });
}

export function useInfiniteCustomers(filters: Omit<CustomerFilters, "cursor">) {
  return useInfiniteQuery({
    queryKey: ["customers", "infinite", filters],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await api.GET("/v1/customers" as any, {
        params: {
          query: {
            q:              filters.q              || undefined,
            phone:          filters.phone          || undefined,
            documentNumber: filters.documentNumber || undefined,
            email:          filters.email          || undefined,
            tagIds:         filters.tagIds?.join(",") || undefined,
            deleted:        filters.deleted        ? "true" : undefined,
            limit:          filters.limit          ?? 50,
            cursor:         pageParam              || undefined,
          },
        },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      const rawList: any[] = result?.data ?? result ?? [];
      return {
        data:       rawList.map(normalizeCustomer),
        nextCursor: result?.nextCursor as string | undefined,
        total:      result?.total as number | undefined,
      } as CustomersPage;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 1000 * 30,
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/customers/{id}" as any, {
        params: { path: { id } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return normalizeCustomer(data as any);
    },
    enabled: !!id,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateCustomerDto) => {
      const { data, error } = await api.POST("/v1/customers" as any, { body: dto as any });
      if (error) throw new Error(getErrorMessage(error));
      return normalizeCustomer(data as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}

export function useUpdateCustomer(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: UpdateCustomerDto) => {
      const { data, error } = await api.PATCH("/v1/customers/{id}" as any, {
        params: { path: { id: customerId } },
        body: dto as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return normalizeCustomer(data as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerKeys.detail(customerId) });
      qc.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (customerId: string) => {
      const { error } = await api.DELETE("/v1/customers/{id}" as any, {
        params: { path: { id: customerId } },
      });
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}

export function useRestoreCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (customerId: string) => {
      const { error } = await api.POST("/v1/customers/{id}/restore" as any, {
        params: { path: { id: customerId } },
      });
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export function useCustomerNotes(customerId: string) {
  return useQuery({
    queryKey: customerKeys.notes(customerId),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/customers/{id}/notes" as any, {
        params: { path: { id: customerId } },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      return (result?.data ?? result ?? []) as CustomerNote[];
    },
    enabled: !!customerId,
  });
}

export function useCreateCustomerNote(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const { data, error } = await api.POST("/v1/customers/{id}/notes" as any, {
        params: { path: { id: customerId } },
        body: { content } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: customerKeys.notes(customerId) }),
  });
}

export function useDeleteCustomerNote(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await api.DELETE("/v1/customers/{id}/notes/{noteId}" as any, {
        params: { path: { id: customerId, noteId } },
      });
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: customerKeys.notes(customerId) }),
  });
}

// ── Stats / timeline ──────────────────────────────────────────────────────────

export function useCustomerStats(customerId: string) {
  return useQuery({
    queryKey: customerKeys.stats(customerId),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/customers/{id}/stats" as any, {
        params: { path: { id: customerId } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as CustomerStats;
    },
    enabled: !!customerId,
  });
}

export function useCustomerTimeline(customerId: string) {
  return useQuery({
    queryKey: customerKeys.timeline(customerId),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/customers/{id}/timeline" as any, {
        params: { path: { id: customerId }, query: { limit: 30 } },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      return (result?.data ?? result ?? []) as TimelineItem[];
    },
    enabled: !!customerId,
  });
}

export function useCustomerAppointments(customerId: string) {
  return useQuery({
    queryKey: customerKeys.appointments(customerId),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/customers/{id}/appointments" as any, {
        params: { path: { id: customerId }, query: { limit: 20 } },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      return (result?.data ?? result ?? []) as any[];
    },
    enabled: !!customerId,
  });
}

// ── Family ────────────────────────────────────────────────────────────────────

function toFamilyMember(m: any, isHead = false): FamilyMember {
  const hasAvatar = m.hasAvatar ?? false;
  return {
    id:        m.id,
    firstName: m.firstName,
    lastName:  m.lastName,
    relation:  m.familyRelation ?? m.relation ?? null,
    phone:     m.phone      ?? null,
    email:     m.email      ?? null,
    birthDate: m.birthDate  ?? null,
    hasAvatar,
    avatarUrl: hasAvatar ? `/v1/customers/${m.id}/avatar` : null,
    isHead,
  };
}

export function useCustomerFamily(customerId: string) {
  return useQuery({
    queryKey: customerKeys.family(customerId),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/customers/{id}/family" as any, {
        params: { path: { id: customerId } },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      if (result?.familyHead !== undefined) {
        return {
          head:         result.familyHead ? toFamilyMember(result.familyHead, true) : null,
          members:      (result.members ?? []).map((m: any) => toFamilyMember(m, false)),
          totalMembers: result.totalMembers ?? (result.members?.length ?? 0),
        } as FamilyGroup;
      }
      const rawList: any[] = Array.isArray(result) ? result : (result?.data ?? []);
      return {
        head:         null,
        members:      rawList.map((m: any) => toFamilyMember(m, false)),
        totalMembers: rawList.length,
      } as FamilyGroup;
    },
    enabled: !!customerId,
  });
}

// ── Sales ─────────────────────────────────────────────────────────────────────

export function useCustomerSales(customerId: string) {
  return useQuery({
    queryKey: customerKeys.sales(customerId),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/customers/{id}/sales" as any, {
        params: { path: { id: customerId } },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      const rawList: any[] = result?.data ?? result ?? [];
      return rawList.map((s: any): CustomerSale => ({
        id:            s.id,
        total:         s.total ?? s.totalAmount,
        status:        s.status,
        paymentMethod: s.paymentMethod ?? "",
        branchName:    s.branchName ?? null,
        createdAt:     s.createdAt,
        items: (s.items ?? []).map((item: any): CustomerSaleItem => ({
          id:        item.id,
          itemType:  item.itemType ?? "",
          name:      item.name ?? "",
          quantity:  item.quantity,
          unitPrice: item.unitPrice ?? 0,
          subtotal:  item.subtotal,
        })),
      }));
    },
    enabled: !!customerId,
  });
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export function useCustomerTags() {
  return useQuery({
    queryKey: customerKeys.tags(),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/customers/tags" as any, {});
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      return (result?.data ?? result ?? []) as CustomerTag[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useAssignCustomerTag(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await api.POST("/v1/customers/{id}/tags/{tagId}" as any, {
        params: { path: { id: customerId, tagId } },
      });
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: customerKeys.detail(customerId) }),
  });
}

export function useRemoveCustomerTag(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await api.DELETE("/v1/customers/{id}/tags/{tagId}" as any, {
        params: { path: { id: customerId, tagId } },
      });
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: customerKeys.detail(customerId) }),
  });
}

// ── Companies ─────────────────────────────────────────────────────────────────

export function useCustomerCompanies(customerId: string) {
  return useQuery({
    queryKey: customerKeys.companies(customerId),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/customers/{id}/companies" as any, {
        params: { path: { id: customerId } },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      return (result?.data ?? result ?? []) as Company[];
    },
    enabled: !!customerId,
  });
}

export function useCompanies(q?: string) {
  return useQuery({
    queryKey: customerKeys.companiesList(q),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/customers/companies" as any, {
        params: { query: { q: q || undefined } },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      return (result?.data ?? result ?? []) as Company[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      name: string;
      documentType?: string;
      documentNumber?: string;
      address?: string;
    }) => {
      const { data, error } = await api.POST("/v1/customers/companies" as any, {
        body: dto as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as Company;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: customerKeys.allCompanies() }),
  });
}

export function useAssignCustomerCompany(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (companyId: string) => {
      const { error } = await api.POST("/v1/customers/{id}/companies/{companyId}" as any, {
        params: { path: { id: customerId, companyId } },
      });
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerKeys.companies(customerId) });
      qc.invalidateQueries({ queryKey: customerKeys.detail(customerId) });
    },
  });
}

export function useRemoveCustomerCompany(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (companyId: string) => {
      const { error } = await api.DELETE("/v1/customers/{id}/companies/{companyId}" as any, {
        params: { path: { id: customerId, companyId } },
      });
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerKeys.companies(customerId) });
      qc.invalidateQueries({ queryKey: customerKeys.detail(customerId) });
    },
  });
}

// ── Marketing channels ────────────────────────────────────────────────────────

export function useMarketingChannels() {
  return useQuery({
    queryKey: customerKeys.marketingChannels(),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/customers/marketing-channels" as any, {});
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      return (result?.data ?? result ?? []) as MarketingChannel[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useCreateMarketingChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await api.POST("/v1/customers/marketing-channels" as any, {
        body: { name } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as MarketingChannel;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: customerKeys.marketingChannels() }),
  });
}

export function useDeleteMarketingChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (channelId: string) => {
      const { error } = await api.DELETE("/v1/customers/marketing-channels/{channelId}" as any, {
        params: { path: { channelId } } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: customerKeys.marketingChannels() }),
  });
}

// ── Birthdays ─────────────────────────────────────────────────────────────────

export function useBirthdayReminders(days = 7) {
  return useQuery({
    queryKey: customerKeys.birthdays(days),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/customers/birthdays" as any, {
        params: { query: { days } },
      });
      if (error) throw new Error(getErrorMessage(error));
      const result = data as any;
      const rawList: any[] = result?.data ?? result ?? [];
      return rawList.map((r: any): BirthdayReminder => ({
        customerId: r.customerId ?? r.id,
        firstName:  r.firstName,
        lastName:   r.lastName,
        birthDate:  r.birthDate,
        daysUntil:  r.daysUntil,
        phone:      r.phone ?? null,
        avatarUrl:  r.hasAvatar ? `/v1/customers/${r.customerId ?? r.id}/avatar` : null,
      }));
    },
    staleTime: 1000 * 60 * 10,
  });
}

// ── DNI lookup (reuse from users) ─────────────────────────────────────────────

export interface DniLookupResult {
  documentNumber: string;
  firstName:      string;
  lastName:       string;
  fullName:       string;
}

export interface RucLookupResult {
  documentNumber: string;
  name:           string;
  address:        string | null;
  state?:         string;
  condition?:     string;
}

export function useDniLookup() {
  return useMutation({
    mutationFn: async (documentNumber: string): Promise<DniLookupResult> => {
      const { data, error } = await api.GET("/v1/lookup/dni/{documentNumber}" as any, {
        params: { path: { documentNumber } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as DniLookupResult;
    },
  });
}

export function useRucLookup() {
  return useMutation({
    mutationFn: async (ruc: string): Promise<RucLookupResult> => {
      const { data, error } = await api.GET("/v1/lookup/ruc/{ruc}" as any, {
        params: { path: { ruc } },
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as RucLookupResult;
    },
  });
}

// ── Authenticated image hook ──────────────────────────────────────────────────

export function useAuthenticatedImageUrl(url: string | null): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setBlobUrl(null);
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;

    const token = getAccessToken();
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const u = URL.createObjectURL(blob);
        createdUrl = u;
        setBlobUrl(u);
      })
      .catch(() => {
        if (!cancelled) setBlobUrl(null);
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [url]);

  return blobUrl;
}

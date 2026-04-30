import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage, uploadFile } from "@/lib/api";
import { toast } from "@podoplus/ui";
import { customerKeys, normalizeCustomer } from "./use-customers";

// ── Helpers ───────────────────────────────────────────────────────────────────

function invalidate(qc: ReturnType<typeof useQueryClient>, keys: readonly (readonly string[])[]) {
  keys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface CreateCustomerInput {
  firstName:      string;
  lastName:       string;
  documentType?:  string;
  documentNumber?: string;
  phone?:         string;
  email?:         string;
  birthDate?:     string;
  gender?:        string;
  notes?:         string;
  whatsappOptIn?: boolean;
  familyHeadId?:  string;
}

// ── Customer CRUD ─────────────────────────────────────────────────────────────

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCustomerInput) => {
      const { data, error } = await api.POST("/v1/customers" as any, {
        body: input as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as any;
    },
    onSuccess: () => {
      invalidate(qc, [customerKeys.all]);
      toast({ title: "Cliente creado", description: "El cliente fue registrado exitosamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al crear cliente", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateCustomer(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CreateCustomerInput>) => {
      const { data, error } = await api.PATCH("/v1/customers/{id}" as any, {
        params: { path: { id: customerId } },
        body: input as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as any;
    },
    onSuccess: () => {
      invalidate(qc, [customerKeys.all, customerKeys.detail(customerId)]);
      toast({ title: "Cliente actualizado", description: "Los datos se guardaron correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al actualizar", description: err.message, variant: "destructive" });
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
      invalidate(qc, [customerKeys.all]);
      toast({ title: "Cliente eliminado" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
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
      invalidate(qc, [customerKeys.all]);
      toast({ title: "Cliente restaurado" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al restaurar", description: err.message, variant: "destructive" });
    },
  });
}

// ── Avatar ────────────────────────────────────────────────────────────────────

export function useUploadAvatar(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      await uploadFile(`/v1/customers/${customerId}/avatar`, file);
    },
    onSuccess: () => {
      const cb = Date.now();
      qc.setQueryData(customerKeys.detail(customerId), (old: any) => {
        if (!old) return old;
        return normalizeCustomer({
          ...old,
          hasAvatar: true,
          avatarUrl: `/v1/customers/${customerId}/avatar?cb=${cb}`,
        });
      });
      invalidate(qc, [customerKeys.lists()]);
      toast({ title: "Foto actualizada" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al subir foto", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteAvatar(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await api.DELETE("/v1/customers/{id}/avatar" as any, {
        params: { path: { id: customerId } },
      });
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.setQueryData(customerKeys.detail(customerId), (old: any) => {
        if (!old) return old;
        return { ...old, hasAvatar: false, avatarUrl: null };
      });
      invalidate(qc, [customerKeys.lists()]);
      toast({ title: "Foto eliminada" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar foto", description: err.message, variant: "destructive" });
    },
  });
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export function useAssignTag(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await api.POST("/v1/customers/{id}/tags/{tagId}" as any, {
        params: { path: { id: customerId, tagId } },
      });
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      invalidate(qc, [customerKeys.detail(customerId), customerKeys.lists()]);
    },
    onError: (err: Error) => {
      toast({ title: "Error al asignar tag", description: err.message, variant: "destructive" });
    },
  });
}

export function useRemoveTag(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await api.DELETE("/v1/customers/{id}/tags/{tagId}" as any, {
        params: { path: { id: customerId, tagId } },
      });
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      invalidate(qc, [customerKeys.detail(customerId), customerKeys.lists()]);
    },
    onError: (err: Error) => {
      toast({ title: "Error al remover tag", description: err.message, variant: "destructive" });
    },
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color: string }) => {
      const { data, error } = await api.POST("/v1/customers/tags" as any, {
        body: input as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as any;
    },
    onSuccess: () => {
      invalidate(qc, [customerKeys.tags()]);
      toast({ title: "Tag creado" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al crear tag", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; name?: string; color?: string }) => {
      const { data, error } = await api.PATCH("/v1/customers/tags/{id}" as any, {
        params: { path: { id } },
        body: body as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data as any;
    },
    onSuccess: () => {
      invalidate(qc, [customerKeys.tags()]);
      toast({ title: "Tag actualizado" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al actualizar tag", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE("/v1/customers/tags/{id}" as any, {
        params: { path: { id } },
      });
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      invalidate(qc, [customerKeys.tags()]);
      toast({ title: "Tag eliminado" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar tag", description: err.message, variant: "destructive" });
    },
  });
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export function useCreateNote(customerId: string) {
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
    onSuccess: () => {
      invalidate(qc, [customerKeys.notes(customerId)]);
      toast({ title: "Nota guardada" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al guardar nota", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateNote(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId, content }: { noteId: string; content: string }) => {
      const { data, error } = await api.PATCH("/v1/customers/{id}/notes/{noteId}" as any, {
        params: { path: { id: customerId, noteId } },
        body: { content } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data;
    },
    onSuccess: () => {
      invalidate(qc, [customerKeys.notes(customerId)]);
      toast({ title: "Nota actualizada" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al actualizar nota", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteNote(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await api.DELETE("/v1/customers/{id}/notes/{noteId}" as any, {
        params: { path: { id: customerId, noteId } },
      });
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      invalidate(qc, [customerKeys.notes(customerId)]);
      toast({ title: "Nota eliminada" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar nota", description: err.message, variant: "destructive" });
    },
  });
}

// ── Family ────────────────────────────────────────────────────────────────────

export function useAddFamilyMember(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    // POST /v1/customers/:memberId/link-family/:familyHeadId  +  body { relation }
    // customerId = el titular (familyHead); memberId = quien se agrega
    mutationFn: async ({ memberId, relation }: { memberId: string; relation: string }) => {
      const { error } = await api.POST(
        "/v1/customers/{id}/link-family/{familyHeadId}" as any,
        {
          params: { path: { id: memberId, familyHeadId: customerId } },
          body: { relation } as any,
        } as any,
      );
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      invalidate(qc, [customerKeys.family(customerId)]);
      toast({ title: "Miembro agregado a la familia" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al agregar miembro", description: err.message, variant: "destructive" });
    },
  });
}

export function useRemoveFamilyMember(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    // POST /v1/customers/:memberId/unlink-family
    mutationFn: async (memberId: string) => {
      const { error } = await api.POST(
        "/v1/customers/{id}/unlink-family" as any,
        { params: { path: { id: memberId } } } as any,
      );
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      invalidate(qc, [customerKeys.family(customerId)]);
      toast({ title: "Miembro eliminado del grupo familiar" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar miembro", description: err.message, variant: "destructive" });
    },
  });
}

export function useSetFamilyHead(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    // Convierte a customerId en miembro del grupo cuyo titular es familyHeadId
    mutationFn: async (familyHeadId: string) => {
      const { error } = await api.POST(
        "/v1/customers/{id}/link-family/{familyHeadId}" as any,
        { params: { path: { id: customerId, familyHeadId } } } as any,
      );
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      invalidate(qc, [customerKeys.detail(customerId)]);
      toast({ title: "Titular de familia actualizado" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al actualizar titular", description: err.message, variant: "destructive" });
    },
  });
}

// ── Merge ─────────────────────────────────────────────────────────────────────

export function useMergeCustomers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, sourceId }: { id: string; sourceId: string }) => {
      const { data, error } = await api.POST("/v1/customers/{id}/merge" as any, {
        params: { path: { id } },
        body: { sourceId } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
      return data;
    },
    onSuccess: () => {
      invalidate(qc, [customerKeys.all]);
      toast({ title: "Clientes fusionados exitosamente" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al fusionar clientes", description: err.message, variant: "destructive" });
    },
  });
}

// ── WhatsApp opt-in / opt-out ─────────────────────────────────────────────────

export function useWhatsappOptIn(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    // El backend no tiene endpoint dedicado; se usa PATCH con whatsappOptIn: true
    mutationFn: async () => {
      const { error } = await api.PATCH("/v1/customers/{id}" as any, {
        params: { path: { id: customerId } },
        body: { whatsappOptIn: true } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.setQueryData(customerKeys.detail(customerId), (old: any) =>
        old ? { ...old, whatsappOptIn: true } : old,
      );
      invalidate(qc, [customerKeys.lists()]);
      toast({ title: "WhatsApp activado", description: "El cliente recibirá mensajes por WhatsApp." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al activar WhatsApp", description: err.message, variant: "destructive" });
    },
  });
}

export function useWhatsappOptOut(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await api.PATCH("/v1/customers/{id}" as any, {
        params: { path: { id: customerId } },
        body: { whatsappOptIn: false } as any,
      });
      if (error) throw new Error(getErrorMessage(error));
    },
    onSuccess: () => {
      qc.setQueryData(customerKeys.detail(customerId), (old: any) =>
        old ? { ...old, whatsappOptIn: false } : old,
      );
      invalidate(qc, [customerKeys.lists()]);
      toast({ title: "WhatsApp desactivado", description: "El cliente no recibirá mensajes por WhatsApp." });
    },
    onError: (err: Error) => {
      toast({ title: "Error al desactivar WhatsApp", description: err.message, variant: "destructive" });
    },
  });
}

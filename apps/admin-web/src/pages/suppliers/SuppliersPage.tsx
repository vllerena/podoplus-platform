import { useState, useEffect } from "react";
import {
  Plus, Search, Building2, Phone, Mail, MapPin,
  MoreHorizontal, Edit2, PowerOff, CheckCircle2,
  Loader2, SearchCode,
} from "lucide-react";
import {
  Button, Input, Label, Skeleton, Textarea,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@podoplus/ui";
import {
  useSuppliers, useCreateSupplier, useUpdateSupplier, useDisableSupplier,
  useRucLookup, useDniLookup,
  type Supplier, type CreateSupplierInput,
} from "@/hooks/use-inventory";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type DocType = "RUC" | "DNI" | "OTHER";

const DOC_TYPE_LABEL: Record<DocType, string> = {
  RUC:   "RUC",
  DNI:   "DNI",
  OTHER: "Otro",
};

const DOC_PLACEHOLDER: Record<DocType, string> = {
  RUC:   "20601234567 (11 dígitos)",
  DNI:   "72492353 (8 dígitos)",
  OTHER: "Número de documento",
};

// ── Supplier form modal ───────────────────────────────────────────────────────

interface FormState {
  document_type:   DocType;
  document_number: string;
  name:            string;
  address:         string;
  phone:           string;
  email:           string;
}

const EMPTY_FORM: FormState = {
  document_type:   "RUC",
  document_number: "",
  name:            "",
  address:         "",
  phone:           "",
  email:           "",
};

interface SupplierModalProps {
  supplier?: Supplier | null;
  onClose:   () => void;
}

function SupplierModal({ supplier, onClose }: SupplierModalProps) {
  const isEdit = !!supplier;

  const [form, setForm] = useState<FormState>(() =>
    supplier
      ? {
          document_type:   (supplier.document_type as DocType) ?? "RUC",
          document_number: supplier.document_number ?? "",
          name:            supplier.name,
          address:         supplier.address ?? "",
          phone:           supplier.phone   ?? "",
          email:           supplier.email   ?? "",
        }
      : { ...EMPTY_FORM }
  );

  const [lookupError, setLookupError] = useState<string | null>(null);

  const set = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier(supplier?.id ?? "");
  const rucLookup      = useRucLookup();
  const dniLookup      = useDniLookup();

  const isBusy =
    createMutation.isPending ||
    updateMutation.isPending ||
    rucLookup.isPending ||
    dniLookup.isPending;

  // Auto-lookup when RUC/DNI reaches full length
  useEffect(() => {
    setLookupError(null);
  }, [form.document_number, form.document_type]);

  const handleLookup = async () => {
    setLookupError(null);
    const num = form.document_number.trim();

    if (form.document_type === "RUC") {
      if (!/^\d{11}$/.test(num)) {
        setLookupError("El RUC debe tener 11 dígitos numéricos.");
        return;
      }
      try {
        const result = await rucLookup.mutateAsync(num);
        setForm((prev) => ({
          ...prev,
          name:    result.name,
          address: result.address ?? prev.address,
        }));
      } catch (err: any) {
        setLookupError(err.message ?? "No se encontró el RUC en SUNAT");
      }
    } else if (form.document_type === "DNI") {
      if (!/^\d{8}$/.test(num)) {
        setLookupError("El DNI debe tener 8 dígitos numéricos.");
        return;
      }
      try {
        const result = await dniLookup.mutateAsync(num);
        setForm((prev) => ({ ...prev, name: result.fullName }));
      } catch (err: any) {
        setLookupError(err.message ?? "No se encontró el DNI en RENIEC");
      }
    }
  };

  const handleSubmit = async () => {
    const body: CreateSupplierInput = {
      document_type:   form.document_type,
      document_number: form.document_number.trim() || undefined,
      name:            form.name.trim(),
      address:         form.address.trim()  || undefined,
      phone:           form.phone.trim()    || undefined,
      email:           form.email.trim()    || undefined,
    };

    try {
      if (isEdit) {
        await updateMutation.mutateAsync(body);
      } else {
        await createMutation.mutateAsync(body);
      }
      onClose();
    } catch { /* toasted in hook */ }
  };

  const canLookup =
    (form.document_type === "RUC" && /^\d{11}$/.test(form.document_number.trim())) ||
    (form.document_type === "DNI" && /^\d{8}$/.test(form.document_number.trim()));

  const canSubmit = form.name.trim().length >= 2;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {isEdit ? "Editar proveedor" : "Nuevo proveedor"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Editando: ${supplier!.name}`
              : "Completa los datos del proveedor. El RUC y DNI pueden consultarse automáticamente."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">

          {/* ── Documento ─────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 mb-2.5">
              Documento de identidad
            </p>
            <div className="flex gap-2">
              {/* Tipo */}
              <Select
                value={form.document_type}
                onValueChange={(v) => { set("document_type", v); set("document_number", ""); }}
              >
                <SelectTrigger className="w-28 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RUC">RUC</SelectItem>
                  <SelectItem value="DNI">DNI</SelectItem>
                  <SelectItem value="OTHER">Otro</SelectItem>
                </SelectContent>
              </Select>

              {/* Número */}
              <div className="flex-1 relative">
                <Input
                  placeholder={DOC_PLACEHOLDER[form.document_type]}
                  value={form.document_number}
                  onChange={(e) => set("document_number", e.target.value.replace(/\D/g, ""))}
                  maxLength={form.document_type === "RUC" ? 11 : form.document_type === "DNI" ? 8 : 20}
                  className={cn(
                    form.document_type !== "OTHER" && "pr-24",
                    lookupError && "border-destructive"
                  )}
                />
                {/* SUNAT / RENIEC button */}
                {form.document_type !== "OTHER" && (
                  <Button
                    type="button"
                    size="sm"
                    variant={canLookup ? "default" : "outline"}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs px-2 gap-1"
                    disabled={!canLookup || isBusy}
                    onClick={handleLookup}
                  >
                    {(rucLookup.isPending || dniLookup.isPending)
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <SearchCode className="h-3 w-3" />
                    }
                    {form.document_type === "RUC" ? "SUNAT" : "RENIEC"}
                  </Button>
                )}
              </div>
            </div>

            {/* Lookup feedback */}
            {lookupError && (
              <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                {lookupError}
              </p>
            )}
            {(rucLookup.isSuccess || dniLookup.isSuccess) && !lookupError && (
              <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Datos completados automáticamente
              </p>
            )}
          </div>

          {/* ── Razón social / Nombre ──────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>
              Razón social / Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Ej. SUMACDERM S.A.C."
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              maxLength={200}
            />
          </div>

          {/* ── Contacto ───────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 mb-2.5">
              Contacto <span className="text-muted-foreground font-normal normal-case">(opcional)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Teléfono
                </Label>
                <Input
                  placeholder="01-2345678"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  maxLength={30}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Correo electrónico
                </Label>
                <Input
                  type="email"
                  placeholder="ventas@empresa.com"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  maxLength={254}
                />
              </div>
            </div>
          </div>

          {/* ── Dirección ─────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-sm flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              Dirección <span className="text-muted-foreground text-xs">(opcional)</span>
            </Label>
            <Textarea
              placeholder="Av. Industrial 123, Lima"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              rows={2}
              className="resize-none"
              maxLength={300}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose} disabled={isBusy}>
            Cancelar
          </Button>
          <Button
            disabled={!canSubmit || isBusy}
            onClick={handleSubmit}
            className="min-w-[120px]"
          >
            {(createMutation.isPending || updateMutation.isPending)
              ? "Guardando…"
              : isEdit ? "Guardar cambios" : "Crear proveedor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Supplier row ──────────────────────────────────────────────────────────────

function SupplierRow({
  supplier,
  onEdit,
  onDisable,
}: {
  supplier: Supplier;
  onEdit:   () => void;
  onDisable: () => void;
}) {
  return (
    <tr className="border-b hover:bg-muted/30 transition-colors group">
      {/* Nombre */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-primary/70" />
          </div>
          <div>
            <p className="text-sm font-medium">{supplier.name}</p>
            {!supplier.is_active && (
              <span className="text-[10px] text-muted-foreground">Inactivo</span>
            )}
          </div>
        </div>
      </td>

      {/* Tipo doc */}
      <td className="px-4 py-3">
        <span className="inline-flex items-center text-xs font-medium bg-muted rounded px-1.5 py-0.5">
          {DOC_TYPE_LABEL[(supplier.document_type as DocType) ?? "OTHER"]}
        </span>
      </td>

      {/* Número */}
      <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
        {supplier.document_number ?? "—"}
      </td>

      {/* Teléfono */}
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {supplier.phone
          ? <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{supplier.phone}</span>
          : "—"
        }
      </td>

      {/* Email */}
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {supplier.email
          ? <a href={`mailto:${supplier.email}`} className="hover:text-primary transition-colors flex items-center gap-1">
              <Mail className="h-3 w-3" />{supplier.email}
            </a>
          : "—"
        }
      </td>

      {/* Estado */}
      <td className="px-4 py-3">
        <span className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
          supplier.is_active
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-gray-100 text-gray-500 border border-gray-200"
        )}>
          <span className={cn(
            "h-1.5 w-1.5 rounded-full",
            supplier.is_active ? "bg-green-500" : "bg-gray-400"
          )} />
          {supplier.is_active ? "Activo" : "Inactivo"}
        </span>
      </td>

      {/* Acciones */}
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEdit}>
              <Edit2 className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            {supplier.is_active && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDisable}
                  className="text-destructive focus:text-destructive"
                >
                  <PowerOff className="mr-2 h-4 w-4" />
                  Deshabilitar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SuppliersPage() {
  const [search,       setSearch]       = useState("");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ACTIVE");
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editing,      setEditing]      = useState<Supplier | null>(null);

  const debouncedSearch = useDebounce(search, 300);
  const disable = useDisableSupplier();

  const { data: suppliers, isLoading, isError, error } = useSuppliers(
    debouncedSearch || undefined
  );

  // Client-side active filter
  const filtered = (suppliers ?? []).filter((s) => {
    if (activeFilter === "ACTIVE")   return s.is_active;
    if (activeFilter === "INACTIVE") return !s.is_active;
    return true;
  });

  const openNew  = () => { setEditing(null);    setModalOpen(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const activeCount   = (suppliers ?? []).filter((s) =>  s.is_active).length;
  const inactiveCount = (suppliers ?? []).filter((s) => !s.is_active).length;

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proveedores</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Empresas y personas de las que se adquieren productos
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nuevo proveedor
        </Button>
      </div>

      {/* ── Stats ────────────────────────────────────────────────── */}
      {!isLoading && (suppliers ?? []).length > 0 && (
        <div className="flex gap-3">
          <div className="rounded-xl border bg-card px-4 py-3 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold">{(suppliers ?? []).length}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3 flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <CheckCircle2 className="h-4 w-4 text-green-700" />
            </div>
            <div>
              <p className="text-xl font-bold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Activos</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Filters ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status pills */}
        <div className="flex rounded-lg border overflow-hidden">
          {([
            { value: "ACTIVE",   label: `Activos (${activeCount})` },
            { value: "INACTIVE", label: `Inactivos (${inactiveCount})` },
            { value: "ALL",      label: "Todos" },
          ] as const).map((tab, i) => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={cn(
                "px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                activeFilter === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground",
                i > 0 ? "border-l" : "",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 h-8 text-xs w-60"
            placeholder="Buscar por nombre o RUC…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        {/* Count bar */}
        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-b bg-muted/30 text-xs text-muted-foreground flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            {filtered.length} proveedor{filtered.length !== 1 ? "es" : ""}
            {debouncedSearch && (
              <span className="ml-1">· búsqueda: "{debouncedSearch}"</span>
            )}
          </div>
        )}

        {isError ? (
          <div className="p-8 text-center text-sm text-destructive">
            Error: {(error as Error)?.message}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Proveedor</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo Doc.</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Número</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Teléfono</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <Building2 className="h-10 w-10 mb-3 opacity-20" />
                        <p className="font-medium text-foreground">Sin proveedores</p>
                        <p className="text-sm mt-1">
                          {search || activeFilter !== "ALL"
                            ? "Prueba ajustando los filtros"
                            : "Registra el primer proveedor para gestionar tus compras"}
                        </p>
                        {!search && activeFilter === "ALL" && (
                          <Button className="mt-4" size="sm" onClick={openNew}>
                            <Plus className="h-4 w-4 mr-1.5" />
                            Nuevo proveedor
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <SupplierRow
                      key={s.id}
                      supplier={s}
                      onEdit={() => openEdit(s)}
                      onDisable={() => disable.mutate(s.id)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal ────────────────────────────────────────────────── */}
      {modalOpen && (
        <SupplierModal
          supplier={editing}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

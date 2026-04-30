import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Pencil, Trash2, RotateCcw, Phone, Mail, FileText,
  Calendar, ShoppingBag, MessageSquare, Clock, Plus, X, Camera,
  Tag, Users, CreditCard, AlertTriangle, Building2, ScanLine,
  User, Briefcase, Heart, Loader2, Check,
} from "lucide-react";
import {
  Button,
  Badge,
  Skeleton,
  Separator,
  Textarea,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  toast,
} from "@podoplus/ui";
import {
  useCustomer, useCustomerNotes, useCustomerStats,
  useCustomerTimeline, useCustomerAppointments, useCustomerTags,
  useAuthenticatedImageUrl, useCustomerCompanies, useCompanies,
  useCreateCompany, useAssignCustomerCompany, useRemoveCustomerCompany,
  useMarketingChannels, useDniLookup, useRucLookup,
  type Customer, type CustomerTag, type Company,
} from "@/hooks/use-customers";
import {
  useDeleteCustomer, useRestoreCustomer,
  useCreateNote, useDeleteNote,
  useUploadAvatar, useDeleteAvatar,
  useAssignTag, useRemoveTag,
  useWhatsappOptIn, useWhatsappOptOut,
  useUpdateCustomer,
  type CreateCustomerInput,
} from "@/hooks/use-customer-actions";
import { FamilyTab } from "./components/FamilyTab";
import { SalesTab }  from "./components/SalesTab";
import { cn }        from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(date?: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDT(date?: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString("es-PE", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const GENDER_LABEL: Record<string, string> = { M: "Masculino", F: "Femenino", OTHER: "Otro" };

const STATUS_LABEL: Record<string, string> = {
  PENDING:    "Pendiente",
  CONFIRMED:  "Confirmada",
  CHECKED_IN: "Llegó",
  IN_SERVICE: "En atención",
  COMPLETED:  "Completada",
  RESCHEDULED:"Reprogramada",
  CANCELED:   "Cancelada",
  NO_SHOW:    "No asistió",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING:     "bg-yellow-100 text-yellow-800",
  CONFIRMED:   "bg-blue-100   text-blue-800",
  CHECKED_IN:  "bg-cyan-100   text-cyan-800",
  IN_SERVICE:  "bg-purple-100 text-purple-800",
  COMPLETED:   "bg-green-100  text-green-800",
  RESCHEDULED: "bg-orange-100 text-orange-800",
  CANCELED:    "bg-red-100    text-red-800",
  NO_SHOW:     "bg-gray-100   text-gray-800",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoField({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-medium mt-0.5 text-sm", mono && "font-mono")}>{value || "—"}</p>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground rounded-xl border bg-card">
      {icon}
      <p className="mt-3 text-sm">{text}</p>
    </div>
  );
}

// ── AvatarUpload ──────────────────────────────────────────────────────────────

function AvatarUpload({ customerId, hasAvatar, avatarUrl, initials }: {
  customerId: string; hasAvatar: boolean; avatarUrl: string | null; initials: string;
}) {
  const [hovered, setHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMut    = useUploadAvatar(customerId);
  const deleteMut    = useDeleteAvatar(customerId);
  const blobUrl      = useAuthenticatedImageUrl(hasAvatar ? avatarUrl : null);
  const isPending    = uploadMut.isPending || deleteMut.isPending;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({ title: "Formato no válido", variant: "destructive" }); return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: "Archivo muy grande (máx 3 MB)", variant: "destructive" }); return;
    }
    try { await uploadMut.mutateAsync(file); } catch { /* toasted */ }
    e.target.value = "";
  };

  return (
    <div
      className="relative h-20 w-20 shrink-0 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !isPending && fileInputRef.current?.click()}
    >
      <div className="h-20 w-20 rounded-full overflow-hidden ring-2 ring-border">
        {blobUrl ? (
          <img src={blobUrl} alt={initials} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
            {initials}
          </div>
        )}
      </div>
      {hovered && !isPending && (
        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
          <Camera className="h-5 w-5 text-white" />
        </div>
      )}
      {isPending && (
        <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
          <Loader2 className="h-4 w-4 text-white animate-spin" />
        </div>
      )}
      {hasAvatar && hovered && !isPending && (
        <button
          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/80"
          onClick={(e) => { e.stopPropagation(); deleteMut.mutate(); }}
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ── TagChips ──────────────────────────────────────────────────────────────────

function TagChips({ customerId, assignedTags, allTags }: {
  customerId: string; assignedTags: CustomerTag[]; allTags: CustomerTag[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const assignTag   = useAssignTag(customerId);
  const removeTag   = useRemoveTag(customerId);
  const assignedIds = new Set(assignedTags.map((t) => t.id));
  const unassigned  = allTags.filter((t) => !assignedIds.has(t.id));

  return (
    <div className="relative flex flex-wrap items-center gap-1">
      {assignedTags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
          style={{ borderColor: tag.color, color: tag.color }}
        >
          {tag.name}
          <button onClick={() => removeTag.mutate(tag.id)} disabled={removeTag.isPending}
            className="hover:opacity-70 transition-opacity">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {unassigned.length > 0 && (
        <div className="relative">
          <button
            className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-dashed border-muted-foreground/50 text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
            onClick={() => setPickerOpen((v) => !v)}
            title="Agregar etiqueta"
          >
            <Plus className="h-3 w-3" />
          </button>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
              <div className="absolute z-50 top-7 left-0 w-44 rounded-lg border bg-popover shadow-md p-1.5 space-y-0.5">
                {unassigned.map((tag) => (
                  <button key={tag.id}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-muted transition-colors text-left"
                    onClick={() => { assignTag.mutate(tag.id); setPickerOpen(false); }}>
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                    <span style={{ color: tag.color }} className="font-medium">{tag.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── MarketingChannelPicker ────────────────────────────────────────────────────

function MarketingChannelPicker({ customerId, currentChannelId, currentChannelName }: {
  customerId:          string;
  currentChannelId?:   string | null;
  currentChannelName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { data: channels = [], isLoading } = useMarketingChannels();
  const update = useUpdateCustomer(customerId);

  const handleSelect = async (channelId: string | null) => {
    setOpen(false);
    try {
      await update.mutateAsync({ marketingChannelId: channelId ?? undefined } as any);
    } catch { /* toasted */ }
  };

  if (isLoading) return <span className="text-muted-foreground text-sm">…</span>;
  if (channels.length === 0) return (
    <span className="text-muted-foreground text-sm italic">Sin canales — configúralos en Ajustes</span>
  );

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={update.isPending}
        className="flex items-center gap-1.5 text-sm font-medium hover:text-primary transition-colors disabled:opacity-50"
      >
        {update.isPending
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : currentChannelName
            ? <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-medium">{currentChannelName}</span>
            : <span className="text-muted-foreground border border-dashed border-muted-foreground/40 px-2 py-0.5 rounded-full text-xs">Sin canal</span>
        }
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-8 left-0 w-52 rounded-lg border bg-popover shadow-lg p-1 space-y-0.5">
            <button
              className="w-full text-left px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors"
              onClick={() => handleSelect(null)}
            >
              Sin canal
            </button>
            {channels.map((c) => (
              <button
                key={c.id}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded-md text-xs hover:bg-muted transition-colors",
                  c.id === currentChannelId && "bg-primary/10 text-primary font-medium"
                )}
                onClick={() => handleSelect(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── AddCompanyDialog ──────────────────────────────────────────────────────────

const COMPANY_DOC_TYPES = ["RUC", "DNI", "PASSPORT", "CE", "OTHER"] as const;

function AddCompanyDialog({ customerId, open, onClose }: {
  customerId: string; open: boolean; onClose: () => void;
}) {
  const [mode,  setMode]  = useState<"search" | "create">("search");
  const [query, setQuery] = useState("");
  const [form,  setForm]  = useState({ name: "", documentType: "RUC", documentNumber: "", address: "" });

  const { data: allCompanies = [], isLoading: loadingSearch } = useCompanies(query.length >= 2 ? query : undefined);
  const { data: linked = [] }   = useCustomerCompanies(customerId);
  const createCompany            = useCreateCompany();
  const assignCompany            = useAssignCustomerCompany(customerId);
  const rucLookup                = useRucLookup();

  const linkedIds = new Set(linked.map((c) => c.id));
  const available = allCompanies.filter((c) => !linkedIds.has(c.id));

  const setF = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleRucSearch = async () => {
    if (form.documentNumber.length !== 11) return;
    try {
      const result = await rucLookup.mutateAsync(form.documentNumber);
      setF("name", result.name);
      if (result.address) setF("address", result.address);
      toast({ title: "RUC encontrado", description: result.name });
    } catch { toast({ title: "RUC no encontrado", variant: "destructive" }); }
  };

  const handleAssign = async (companyId: string) => {
    try { await assignCompany.mutateAsync(companyId); onClose(); }
    catch { /* toasted */ }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { toast({ title: "El nombre es requerido", variant: "destructive" }); return; }
    try {
      const company = await createCompany.mutateAsync({
        name:           form.name.trim(),
        documentType:   form.documentType || undefined,
        documentNumber: form.documentNumber || undefined,
        address:        form.address || undefined,
      });
      await assignCompany.mutateAsync(company.id);
      onClose();
    } catch { /* toasted */ }
  };

  useEffect(() => {
    if (!open) { setMode("search"); setQuery(""); setForm({ name: "", documentType: "RUC", documentNumber: "", address: "" }); }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Agregar empresa</DialogTitle>
          <DialogDescription>
            Busca una empresa existente o crea una nueva.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mt-1 mb-4">
          <button
            onClick={() => setMode("search")}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-lg border transition-colors",
              mode === "search" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            Buscar existente
          </button>
          <button
            onClick={() => setMode("create")}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-lg border transition-colors",
              mode === "create" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            Crear nueva
          </button>
        </div>

        {mode === "search" ? (
          <div className="space-y-3">
            <Input
              placeholder="Buscar por nombre o RUC..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <div className="max-h-60 overflow-y-auto space-y-1">
              {loadingSearch ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : available.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {query.length < 2 ? "Escribe al menos 2 caracteres para buscar" : "No se encontraron empresas"}
                </p>
              ) : (
                available.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => handleAssign(company.id)}
                    disabled={assignCompany.isPending}
                    className="w-full flex items-start gap-3 p-2.5 rounded-lg border hover:bg-muted/40 text-left transition-colors"
                  >
                    <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{company.name}</p>
                      {company.documentNumber && (
                        <p className="text-xs text-muted-foreground font-mono">{company.documentType} {company.documentNumber}</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tipo + Número doc + búsqueda */}
            <div className="space-y-1.5">
              <Label>Documento</Label>
              <div className="flex gap-2">
                <Select value={form.documentType} onValueChange={(v) => setF("documentType", v)}>
                  <SelectTrigger className="w-24 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent aria-describedby={undefined}>
                    {COMPANY_DOC_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="flex-1"
                  placeholder="N° documento"
                  value={form.documentNumber}
                  onChange={(e) => setF("documentNumber", e.target.value)}
                />
                {form.documentType === "RUC" && (
                  <Button type="button" variant="outline" size="icon"
                    disabled={form.documentNumber.length !== 11 || rucLookup.isPending}
                    onClick={handleRucSearch}
                    title="Buscar RUC"
                  >
                    {rucLookup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Razón social *</Label>
              <Input placeholder="Empresa S.A.C." value={form.name} onChange={(e) => setF("name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Dirección fiscal</Label>
              <Input placeholder="Av. Lima 123, Lima" value={form.address} onChange={(e) => setF("address", e.target.value)} />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={createCompany.isPending || assignCompany.isPending}>
                {createCompany.isPending || assignCompany.isPending ? "Creando..." : "Crear y vincular"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = "personal" | "fiscal" | "appointments" | "sales" | "notes" | "timeline" | "family";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "personal",     label: "Datos Personales", icon: <User className="h-3.5 w-3.5" /> },
  { id: "fiscal",       label: "Datos Fiscales",   icon: <Building2 className="h-3.5 w-3.5" /> },
  { id: "appointments", label: "Citas",             icon: <Calendar className="h-3.5 w-3.5" /> },
  { id: "sales",        label: "Ventas",            icon: <CreditCard className="h-3.5 w-3.5" /> },
  { id: "notes",        label: "Notas clínicas",    icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "family",       label: "Familia",           icon: <Users className="h-3.5 w-3.5" /> },
  { id: "timeline",     label: "Actividad",         icon: <Clock className="h-3.5 w-3.5" /> },
];

// ── Edit form (inline, re-uses same fields as CustomersPage form) ──────────────

const DOCUMENT_TYPES = ["DNI", "CE", "PASSPORT", "RUC", "OTHER"] as const;
const GENDERS = [
  { value: "M", label: "Masculino" }, { value: "F", label: "Femenino" }, { value: "OTHER", label: "Otro" },
] as const;

function EditCustomerDialog({ open, onClose, customer }: {
  open: boolean; onClose: () => void; customer: Customer;
}) {
  const [form, setForm] = useState({
    firstName: "", lastName: "", documentType: "", documentNumber: "",
    phone: "", email: "", birthDate: "", gender: "", notes: "",
    whatsappOptIn: false, occupation: "", emergencyContactName: "", emergencyContactPhone: "",
  });
  const [allergies,        setAllergies]        = useState<string[]>([]);
  const [allergyInput,     setAllergyInput]      = useState("");
  const [marketingChannelId, setMarketingChannelId] = useState("");
  const [isSubmitting,     setIsSubmitting]      = useState(false);

  const update    = useUpdateCustomer(customer.id);
  const dniLookup = useDniLookup();
  const { data: channels = [] } = useMarketingChannels();

  useEffect(() => {
    if (open) {
      setForm({
        firstName:             customer.firstName,
        lastName:              customer.lastName,
        documentType:          customer.documentType          ?? "",
        documentNumber:        customer.documentNumber        ?? "",
        phone:                 customer.phone                 ?? "",
        email:                 customer.email                 ?? "",
        birthDate:             customer.birthDate             ?? "",
        gender:                customer.gender                ?? "",
        notes:                 customer.notes                 ?? "",
        whatsappOptIn:         customer.whatsappOptIn,
        occupation:            customer.occupation            ?? "",
        emergencyContactName:  customer.emergencyContactName  ?? "",
        emergencyContactPhone: customer.emergencyContactPhone ?? "",
      });
      setAllergies(customer.allergies ?? []);
      setMarketingChannelId(customer.marketingChannelId ?? "");
      setAllergyInput("");
    }
  }, [open, customer]);

  const set = (f: string, v: string | boolean) => setForm((p) => ({ ...p, [f]: v }));

  const handleDniSearch = async () => {
    if (form.documentNumber.length !== 8) return;
    try {
      const result = await dniLookup.mutateAsync(form.documentNumber);
      set("firstName", result.firstName);
      set("lastName",  result.lastName);
      toast({ title: "DNI encontrado", description: result.fullName });
    } catch { toast({ title: "DNI no encontrado", variant: "destructive" }); }
  };

  const addAllergy = () => {
    const v = allergyInput.trim();
    if (!v || allergies.includes(v)) return;
    setAllergies((p) => [...p, v]);
    setAllergyInput("");
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    const payload: any = {
      firstName:             form.firstName.trim(),
      lastName:              form.lastName.trim(),
      documentType:          form.documentType  || undefined,
      documentNumber:        form.documentNumber || undefined,
      phone:                 form.phone          || undefined,
      email:                 form.email          || undefined,
      birthDate:             form.birthDate       || undefined,
      gender:                form.gender          || undefined,
      notes:                 form.notes.trim()    || undefined,
      whatsappOptIn:         form.whatsappOptIn,
      allergies,
      occupation:            form.occupation.trim()            || undefined,
      emergencyContactName:  form.emergencyContactName.trim()  || undefined,
      emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
      marketingChannelId:    marketingChannelId || undefined,
    };
    try { await update.mutateAsync(payload); onClose(); }
    catch { /* toasted */ }
    finally { setIsSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar paciente</DialogTitle>
          <DialogDescription>Modifica los datos del cliente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Documento */}
          <div className="space-y-1.5">
            <Label>Documento</Label>
            <div className="flex gap-2">
              <Select value={form.documentType} onValueChange={(v) => set("documentType", v)}>
                <SelectTrigger className="w-28 shrink-0"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent aria-describedby={undefined}>
                  {DOCUMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="flex-1" placeholder="N° documento" value={form.documentNumber}
                onChange={(e) => set("documentNumber", e.target.value)} />
              {form.documentType === "DNI" && (
                <Button type="button" variant="outline" size="icon"
                  disabled={form.documentNumber.length !== 8 || dniLookup.isPending}
                  onClick={handleDniSearch} title="Buscar DNI">
                  {dniLookup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>
          {/* Nombre */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Apellido *</Label>
              <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
            </div>
          </div>
          {/* Contacto */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
          </div>
          {/* Personales */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nacimiento</Label>
              <Input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Género</Label>
              <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent aria-describedby={undefined}>
                  {GENDERS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Ocupación</Label>
            <Input placeholder="Ej: Ingeniero, Docente..." value={form.occupation}
              onChange={(e) => set("occupation", e.target.value)} />
          </div>
          {/* Marketing channel */}
          <div className="space-y-1.5">
            <Label>¿Cómo nos conoció?</Label>
            <Select value={marketingChannelId || "none"} onValueChange={(v) => setMarketingChannelId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Sin canal..." /></SelectTrigger>
              <SelectContent aria-describedby={undefined}>
                <SelectItem value="none">Sin canal</SelectItem>
                {channels.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {channels.length === 0 && (
              <p className="text-xs text-muted-foreground">No hay canales configurados. Créalos en Configuración → Canal de Marketing.</p>
            )}
          </div>
          {/* Alergias */}
          <div className="space-y-1.5">
            <Label>Alergias</Label>
            <div className="flex gap-2">
              <Input placeholder="Agregar alergia..." value={allergyInput}
                onChange={(e) => setAllergyInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAllergy(); } }} />
              <Button type="button" variant="outline" size="icon" onClick={addAllergy}><Plus className="h-4 w-4" /></Button>
            </div>
            {allergies.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {allergies.map((a) => (
                  <span key={a} className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs rounded-full px-2.5 py-0.5">
                    {a}
                    <button onClick={() => setAllergies((p) => p.filter((x) => x !== a))}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Emergencia */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contacto emergencia</Label>
              <Input placeholder="Nombre..." value={form.emergencyContactName}
                onChange={(e) => set("emergencyContactName", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono emergencia</Label>
              <Input placeholder="+51 999..." value={form.emergencyContactPhone}
                onChange={(e) => set("emergencyContactPhone", e.target.value)} />
            </div>
          </div>
          {/* WhatsApp */}
          <div className="flex items-center gap-2">
            <input id="waOpt" type="checkbox" className="h-4 w-4" checked={form.whatsappOptIn}
              onChange={(e) => set("whatsappOptIn", e.target.checked)} />
            <Label htmlFor="waOpt" className="font-normal cursor-pointer">Acepta mensajes por WhatsApp</Label>
          </div>
          {/* Notas */}
          <div className="space-y-1.5">
            <Label>Notas generales</Label>
            <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function CustomerDetailPage() {
  const { id = "" }  = useParams<{ id: string }>();
  const navigate      = useNavigate();
  const [tab, setTab] = useState<Tab>("personal");
  const [editOpen,       setEditOpen]       = useState(false);
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [noteText,       setNoteText]       = useState("");
  const [confirmDelete,  setConfirmDelete]  = useState(false);

  const { data: customer, isLoading } = useCustomer(id);
  const { data: notes }               = useCustomerNotes(id);
  const { data: stats }               = useCustomerStats(id);
  const { data: timeline }            = useCustomerTimeline(id);
  const { data: appointments }        = useCustomerAppointments(id);
  const { data: allTags = [] }        = useCustomerTags();
  const { data: linkedCompanies = [] } = useCustomerCompanies(id);

  const deleteCustomer      = useDeleteCustomer();
  const restoreCustomer     = useRestoreCustomer();
  const createNote          = useCreateNote(id);
  const deleteNote          = useDeleteNote(id);
  const removeCompany       = useRemoveCustomerCompany(id);

  const isDeleted = !!customer?.deletedAt;

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    try { await createNote.mutateAsync(noteText.trim()); setNoteText(""); }
    catch { /* toasted */ }
  };

  const handleDelete = async () => {
    try { await deleteCustomer.mutateAsync(id); navigate("/customers"); }
    catch { /* toasted */ }
  };

  // ── Loading skeleton ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 space-y-5 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-40" />
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-start gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Cliente no encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/customers")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>
      </div>
    );
  }

  const fullName = customer.fullName ?? `${customer.firstName} ${customer.lastName}`;
  const initials = `${customer.firstName[0] ?? ""}${customer.lastName[0] ?? ""}`.toUpperCase();

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">

      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/customers")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Clientes
        </Button>
        <div className="flex gap-2">
          {isDeleted ? (
            <Button variant="outline" size="sm" onClick={() => restoreCustomer.mutate(id)}>
              <RotateCcw className="h-4 w-4 mr-2" /> Restaurar
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" /> Editar
              </Button>
              <Button variant="outline" size="sm"
                className="text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Profile card */}
      <div className={cn("rounded-xl border bg-card p-5", isDeleted && "opacity-70 border-destructive/30")}>
        <div className="flex flex-col md:flex-row md:items-start gap-5">

          {/* Avatar */}
          <AvatarUpload customerId={id} hasAvatar={customer.hasAvatar} avatarUrl={customer.avatarUrl} initials={initials} />

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{fullName}</h1>
              {isDeleted && <Badge variant="destructive">Eliminado</Badge>}
              {customer.whatsappOptIn && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  <MessageSquare className="h-3 w-3" /> WhatsApp
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              {customer.documentNumber && (
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-mono">{customer.documentType} {customer.documentNumber}</span>
                </span>
              )}
              {customer.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0" /> {customer.phone}
                </span>
              )}
              {customer.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 shrink-0" /> {customer.email}
                </span>
              )}
              {customer.birthDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  {fmt(customer.birthDate)} {customer.age != null ? `(${customer.age} años)` : ""}
                </span>
              )}
            </div>

            {/* Allergies warning */}
            {(customer.allergies?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600">
                  <AlertTriangle className="h-3.5 w-3.5" /> Alergias:
                </span>
                {customer.allergies!.map((a) => (
                  <span key={a} className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5">{a}</span>
                ))}
              </div>
            )}

            {/* Tags */}
            <div className="mt-2">
              <TagChips customerId={id} assignedTags={customer.tags ?? []} allTags={allTags} />
            </div>
          </div>

          {/* Stats grid */}
          {stats && (
            <div className="grid grid-cols-3 md:grid-cols-3 gap-3 shrink-0 min-w-[240px]">
              <div className="rounded-lg bg-primary/5 p-2.5 text-center">
                <p className="text-lg font-bold text-primary">{stats.totalAppointments}</p>
                <p className="text-xs text-muted-foreground">Citas</p>
              </div>
              <div className="rounded-lg bg-green-50 p-2.5 text-center">
                <p className="text-lg font-bold text-green-700">{stats.completedAppointments}</p>
                <p className="text-xs text-muted-foreground">Completadas</p>
              </div>
              <div className="rounded-lg bg-violet-50 p-2.5 text-center">
                <p className="text-lg font-bold text-violet-700">S/ {parseFloat(stats.netSpent).toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Gastado</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-0.5 -mb-px overflow-x-auto pb-px">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab: Datos Personales ─────────────────────────────────────────────── */}
      {tab === "personal" && (
        <div className="space-y-4">
          {/* Datos personales */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" /> Información personal
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InfoField label="Nombre completo"   value={fullName} />
              <InfoField label="Documento"          value={customer.documentNumber ? `${customer.documentType ?? ""} ${customer.documentNumber}` : null} mono />
              <InfoField label="Teléfono"           value={customer.phone} />
              <InfoField label="Email"              value={customer.email} />
              <InfoField label="Fecha de nacimiento" value={customer.birthDate ? `${fmt(customer.birthDate)}${customer.age != null ? ` (${customer.age} años)` : ""}` : null} />
              <InfoField label="Género"             value={customer.gender ? GENDER_LABEL[customer.gender] ?? customer.gender : null} />
              <InfoField label="Ocupación"         value={customer.occupation} />
              <InfoField label="Fecha de registro" value={fmt(customer.createdAt)} />
            </div>
          </div>

          {/* Canal de captación — inline picker */}
          <div className="rounded-xl border bg-card p-5 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Canal de captación
            </h3>
            <MarketingChannelPicker
              customerId={id}
              currentChannelId={customer.marketingChannelId}
              currentChannelName={customer.marketingChannel?.name}
            />
          </div>

          {/* Contacto de emergencia */}
          {(customer.emergencyContactName || customer.emergencyContactPhone || customer.emergencyContactEmail) && (
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-400" /> Contacto de emergencia
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <InfoField label="Nombre"   value={customer.emergencyContactName} />
                <InfoField label="Teléfono" value={customer.emergencyContactPhone} />
                <InfoField label="Email"    value={customer.emergencyContactEmail} />
              </div>
            </div>
          )}

          {/* Alergias */}
          {(customer.allergies?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 p-5 space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-orange-600 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Alergias registradas
              </h3>
              <div className="flex flex-wrap gap-2">
                {customer.allergies!.map((a) => (
                  <span key={a} className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-sm rounded-full px-3 py-1 font-medium border border-orange-200">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notas generales */}
          {customer.notes && (
            <div className="rounded-xl border bg-card p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Notas generales</h3>
              <p className="text-sm whitespace-pre-wrap text-foreground/80">{customer.notes}</p>
            </div>
          )}

          {/* WhatsApp + citas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">WhatsApp</p>
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                customer.whatsappOptIn ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              )}>
                <MessageSquare className="h-3.5 w-3.5" />
                {customer.whatsappOptIn ? "Opt-in activo" : "Sin consentimiento"}
              </span>
            </div>
            {customer.lastAppointmentDate && (
              <div className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">Última cita</p>
                <p className="text-sm font-medium">{fmt(customer.lastAppointmentDate)}</p>
                {customer.lastAppointmentStatus && (
                  <span className={cn(
                    "inline-flex items-center px-1.5 py-0.5 rounded text-xs mt-1",
                    STATUS_COLOR[customer.lastAppointmentStatus] ?? "bg-gray-100 text-gray-700"
                  )}>
                    {STATUS_LABEL[customer.lastAppointmentStatus] ?? customer.lastAppointmentStatus}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Datos Fiscales ───────────────────────────────────────────────── */}
      {tab === "fiscal" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Empresas vinculadas
              </h3>
              {!isDeleted && (
                <Button size="sm" variant="outline" onClick={() => setAddCompanyOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Agregar empresa
                </Button>
              )}
            </div>

            {linkedCompanies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Building2 className="h-8 w-8 opacity-30 mb-2" />
                <p className="text-sm">Sin empresas vinculadas</p>
                <p className="text-xs mt-1">Las empresas se usan para emitir comprobantes de pago.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {linkedCompanies.map((company) => (
                  <div key={company.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors group">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{company.name}</p>
                        {company.documentNumber && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {company.documentType} {company.documentNumber}
                          </p>
                        )}
                        {company.address && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{company.address}</p>
                        )}
                      </div>
                    </div>
                    {!isDeleted && (
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => removeCompany.mutate(company.id)}
                        disabled={removeCompany.isPending}
                        title="Desvincular empresa"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Citas ────────────────────────────────────────────────────────── */}
      {tab === "appointments" && (
        <div className="rounded-xl border bg-card overflow-hidden">
          {!appointments?.length ? (
            <EmptyState icon={<Calendar className="h-8 w-8 opacity-30" />} text="Sin citas registradas" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Servicio</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sede</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a: any) => (
                  <tr key={a.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">{fmtDT(a.startAt)}</td>
                    <td className="px-4 py-3">{a.service?.name ?? a.serviceName ?? "—"}</td>
                    <td className="px-4 py-3">{a.branch?.name ?? a.branchName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        STATUS_COLOR[a.status] ?? "bg-gray-100 text-gray-700"
                      )}>
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Tab: Ventas ───────────────────────────────────────────────────────── */}
      {tab === "sales" && <SalesTab customerId={id} />}

      {/* ── Tab: Notas clínicas ───────────────────────────────────────────────── */}
      {tab === "notes" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <p className="text-sm font-medium">Nueva nota clínica</p>
            <Textarea
              placeholder="Escribe una observación, diagnóstico, indicación..."
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <div className="flex justify-end">
              <Button size="sm" disabled={!noteText.trim() || createNote.isPending} onClick={handleAddNote}>
                <Plus className="h-4 w-4 mr-1.5" />
                {createNote.isPending ? "Guardando..." : "Guardar nota"}
              </Button>
            </div>
          </div>
          {!notes?.length ? (
            <EmptyState icon={<FileText className="h-8 w-8 opacity-30" />} text="Sin notas registradas" />
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm whitespace-pre-wrap flex-1">{note.content}</p>
                    <button className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      onClick={() => deleteNote.mutate(note.id)}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {fmtDT(note.createdAt)}
                    {note.author && <span>· {note.author.fullName}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Familia ─────────────────────────────────────────────────────── */}
      {tab === "family" && <FamilyTab customerId={id} />}

      {/* ── Tab: Actividad ───────────────────────────────────────────────────── */}
      {tab === "timeline" && (
        <div className="space-y-3">
          {!timeline?.length ? (
            <EmptyState icon={<Clock className="h-8 w-8 opacity-30" />} text="Sin actividad registrada" />
          ) : (
            <div className="space-y-0">
              {timeline.map((item: any, idx) => (
                <div key={item.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-1",
                      item.type === "APPOINTMENT" ? "bg-blue-100 text-blue-600"
                      : item.type === "SALE"      ? "bg-green-100 text-green-600"
                      :                             "bg-purple-100 text-purple-600"
                    )}>
                      {item.type === "APPOINTMENT"  && <Calendar className="h-4 w-4" />}
                      {item.type === "SALE"         && <ShoppingBag className="h-4 w-4" />}
                      {item.type === "SUBSCRIPTION" && <Clock className="h-4 w-4" />}
                    </div>
                    {idx < (timeline.length - 1) && <div className="w-px flex-1 bg-border my-1" />}
                  </div>
                  <div className="pb-4 flex-1">
                    <p className="text-sm font-medium">{item.description ?? item.summary}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{fmtDT(item.date)}</span>
                      {item.status && (
                        <span className={cn(
                          "inline-flex text-xs px-1.5 py-0 rounded-full",
                          STATUS_COLOR[item.status] ?? "bg-gray-100 text-gray-700"
                        )}>
                          {STATUS_LABEL[item.status] ?? item.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <EditCustomerDialog open={editOpen} onClose={() => setEditOpen(false)} customer={customer} />

      <AddCompanyDialog
        customerId={id}
        open={addCompanyOpen}
        onClose={() => setAddCompanyOpen(false)}
      />

      <Dialog open={confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(false)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Eliminar cliente
            </DialogTitle>
            <DialogDescription>
              ¿Eliminar a <strong>{fullName}</strong>? El registro quedará inactivo y puede restaurarse.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={deleteCustomer.isPending} onClick={handleDelete}>
              {deleteCustomer.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

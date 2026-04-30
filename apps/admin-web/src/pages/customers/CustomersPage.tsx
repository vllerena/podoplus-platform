import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  Download,
  Users,
  Tag,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Check,
  X,
  ScanLine,
  MoreHorizontal,
  Eye,
  RotateCcw,
  MessageCircle,
  Phone,
  Mail,
  AlertTriangle,
  Calendar,
  Loader2,
  Building2,
} from "lucide-react";
import {
  Button,
  Input,
  Badge,
  Skeleton,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@podoplus/ui";
import { toast } from "@podoplus/ui";
import {
  useInfiniteCustomers,
  useCustomerTags,
  useMarketingChannels,
  useDniLookup,
  type Customer,
  type CustomerFilters,
  type CustomerTag,
} from "@/hooks/use-customers";
import {
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useRestoreCustomer,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  type CreateCustomerInput,
} from "@/hooks/use-customer-actions";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────────────────────

const DOCUMENT_TYPES = ["DNI", "CE", "PASSPORT", "RUC", "OTHER"] as const;
const GENDERS = [
  { value: "M",     label: "Masculino" },
  { value: "F",     label: "Femenino"  },
  { value: "OTHER", label: "Otro"      },
] as const;

const GENDER_LABEL: Record<string, string> = { M: "Masculino", F: "Femenino", OTHER: "Otro" };

// ── CustomerFormSheet ─────────────────────────────────────────────────────────

interface FormValues {
  firstName:             string;
  lastName:              string;
  documentType:          string;
  documentNumber:        string;
  phone:                 string;
  email:                 string;
  birthDate:             string;
  gender:                string;
  notes:                 string;
  whatsappOptIn:         boolean;
  occupation:            string;
  emergencyContactName:  string;
  emergencyContactPhone: string;
}

const EMPTY_FORM: FormValues = {
  firstName: "", lastName: "", documentType: "", documentNumber: "",
  phone: "", email: "", birthDate: "", gender: "", notes: "",
  whatsappOptIn: false, occupation: "",
  emergencyContactName: "", emergencyContactPhone: "",
};

function CustomerFormSheet({
  open, onClose, customer,
}: {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
}) {
  const isEdit = !!customer;
  const [form, setForm]         = useState<FormValues>(EMPTY_FORM);
  const [allergyInput, setAllergyInput] = useState("");
  const [allergies, setAllergies]       = useState<string[]>([]);
  const [marketingChannelId, setMarketingChannelId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const create       = useCreateCustomer();
  const update       = useUpdateCustomer(customer?.id ?? "");
  const dniLookup    = useDniLookup();
  const { data: channels = [] } = useMarketingChannels();

  // Populate when editing
  useEffect(() => {
    if (open) {
      if (customer) {
        setForm({
          firstName:             customer.firstName,
          lastName:              customer.lastName,
          documentType:          customer.documentType  ?? "",
          documentNumber:        customer.documentNumber ?? "",
          phone:                 customer.phone          ?? "",
          email:                 customer.email          ?? "",
          birthDate:             customer.birthDate      ?? "",
          gender:                customer.gender         ?? "",
          notes:                 customer.notes          ?? "",
          whatsappOptIn:         customer.whatsappOptIn,
          occupation:            customer.occupation     ?? "",
          emergencyContactName:  customer.emergencyContactName  ?? "",
          emergencyContactPhone: customer.emergencyContactPhone ?? "",
        });
        setAllergies(customer.allergies ?? []);
        setMarketingChannelId(customer.marketingChannelId ?? "");
      } else {
        setForm(EMPTY_FORM);
        setAllergies([]);
        setMarketingChannelId("");
      }
      setAllergyInput("");
    }
  }, [open, customer]);

  const set = (field: keyof FormValues, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const isDni = form.documentType === "DNI" && form.documentNumber.length === 8;

  const handleDniSearch = async () => {
    if (!form.documentNumber) return;
    try {
      const result = await dniLookup.mutateAsync(form.documentNumber);
      set("firstName", result.firstName);
      set("lastName",  result.lastName);
      toast({ title: "DNI encontrado", description: result.fullName });
    } catch {
      toast({ title: "DNI no encontrado", variant: "destructive" });
    }
  };

  const addAllergy = () => {
    const v = allergyInput.trim();
    if (!v || allergies.includes(v)) return;
    setAllergies((prev) => [...prev, v]);
    setAllergyInput("");
  };

  const removeAllergy = (a: string) => setAllergies((prev) => prev.filter((x) => x !== a));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast({ title: "Nombre y apellido son requeridos", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const payload: CreateCustomerInput & { allergies?: string[]; occupation?: string; emergencyContactName?: string; emergencyContactPhone?: string; marketingChannelId?: string } = {
      firstName:             form.firstName.trim(),
      lastName:              form.lastName.trim(),
      ...(form.documentType   && { documentType:   form.documentType }),
      ...(form.documentNumber && { documentNumber: form.documentNumber.trim() }),
      ...(form.phone          && { phone:          form.phone.trim() }),
      ...(form.email          && { email:          form.email.trim() }),
      ...(form.birthDate      && { birthDate:      form.birthDate }),
      ...(form.gender         && { gender:         form.gender }),
      ...(form.notes.trim()   && { notes:          form.notes.trim() }),
      whatsappOptIn: form.whatsappOptIn,
      ...(allergies.length    && { allergies }),
      ...(form.occupation.trim() && { occupation: form.occupation.trim() }),
      ...(form.emergencyContactName.trim()  && { emergencyContactName:  form.emergencyContactName.trim() }),
      ...(form.emergencyContactPhone.trim() && { emergencyContactPhone: form.emergencyContactPhone.trim() }),
      ...(marketingChannelId  && { marketingChannelId }),
    };
    try {
      if (isEdit) await update.mutateAsync(payload);
      else        await create.mutateAsync(payload);
      onClose();
    } catch { /* toasted in hook */ }
    finally { setIsSubmitting(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar cliente" : "Nuevo cliente"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Modifica los datos del cliente." : "Completa los datos para registrar un nuevo cliente."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-5">

          {/* Documento — primero */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documento de identidad</p>
            <div className="flex gap-2">
              <Select value={form.documentType} onValueChange={(v) => set("documentType", v)}>
                <SelectTrigger className="w-32 shrink-0">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent aria-describedby={undefined}>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex-1 relative">
                <Input
                  placeholder="Número de documento"
                  value={form.documentNumber}
                  onChange={(e) => set("documentNumber", e.target.value)}
                />
              </div>
              {form.documentType === "DNI" && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={form.documentNumber.length !== 8 || dniLookup.isPending}
                  onClick={handleDniSearch}
                  title="Buscar por DNI"
                >
                  {dniLookup.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ScanLine className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Nombre */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nombre</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Nombre *</Label>
                <Input
                  id="firstName"
                  placeholder="Juan"
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Apellido *</Label>
                <Input
                  id="lastName"
                  placeholder="Pérez"
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Contacto */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contacto</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  placeholder="+51 987 654 321"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Datos personales */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Datos personales</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="birthDate">Fecha de nacimiento</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => set("birthDate", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Género</Label>
                <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent aria-describedby={undefined}>
                    {GENDERS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="occupation">Ocupación</Label>
              <Input
                id="occupation"
                placeholder="Ej: Ingeniero, Profesor..."
                value={form.occupation}
                onChange={(e) => set("occupation", e.target.value)}
              />
            </div>
          </div>

          {/* Canal de marketing */}
          {channels.length > 0 && (
            <div className="space-y-1.5">
              <Label>¿Cómo nos conoció?</Label>
              <Select value={marketingChannelId} onValueChange={setMarketingChannelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar canal..." />
                </SelectTrigger>
                <SelectContent aria-describedby={undefined}>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Alergias */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alergias</p>
            <div className="flex gap-2">
              <Input
                placeholder="Agregar alergia..."
                value={allergyInput}
                onChange={(e) => setAllergyInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAllergy(); } }}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={addAllergy}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {allergies.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {allergies.map((a) => (
                  <span
                    key={a}
                    className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 text-xs rounded-full px-2.5 py-0.5"
                  >
                    {a}
                    <button type="button" onClick={() => removeAllergy(a)} className="hover:text-orange-900">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Contacto de emergencia */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contacto de emergencia</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="emergencyName">Nombre</Label>
                <Input
                  id="emergencyName"
                  placeholder="María García"
                  value={form.emergencyContactName}
                  onChange={(e) => set("emergencyContactName", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emergencyPhone">Teléfono</Label>
                <Input
                  id="emergencyPhone"
                  placeholder="+51 999 888 777"
                  value={form.emergencyContactPhone}
                  onChange={(e) => set("emergencyContactPhone", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* WhatsApp + notas */}
          <div className="flex items-center gap-2">
            <input
              id="whatsappOptIn"
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              checked={form.whatsappOptIn}
              onChange={(e) => set("whatsappOptIn", e.target.checked)}
            />
            <Label htmlFor="whatsappOptIn" className="font-normal cursor-pointer">
              Acepta mensajes por WhatsApp
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas clínicas</Label>
            <Textarea
              id="notes"
              placeholder="Observaciones, condiciones relevantes..."
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <SheetFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEdit ? "Guardando..." : "Creando..."
                : isEdit ? "Guardar cambios" : "Crear cliente"
              }
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ── Tags Manager ──────────────────────────────────────────────────────────────

function TagsManager() {
  const [open, setOpen]           = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [editName, setEditName]   = useState("");
  const [editColor, setEditColor] = useState("#6366f1");
  const [newName, setNewName]     = useState("");
  const [newColor, setNewColor]   = useState("#6366f1");

  const { data: tags = [], isLoading } = useCustomerTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const startEdit = (tag: CustomerTag) => {
    setEditId(tag.id); setEditName(tag.name); setEditColor(tag.color);
  };
  const cancelEdit = () => { setEditId(null); setEditName(""); setEditColor("#6366f1"); };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    try { await updateTag.mutateAsync({ id, name: editName.trim(), color: editColor }); cancelEdit(); }
    catch { /* toasted */ }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try { await createTag.mutateAsync({ name: newName.trim(), color: newColor }); setNewName(""); setNewColor("#6366f1"); }
    catch { /* toasted */ }
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <span>Gestión de etiquetas</span>
          {tags.length > 0 && <Badge variant="secondary" className="text-xs">{tags.length}</Badge>}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-4 space-y-3">
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : tags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">No hay etiquetas. Crea la primera.</p>
          ) : (
            <div className="space-y-2">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center gap-2">
                  {editId === tag.id ? (
                    <>
                      <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)}
                        className="h-7 w-7 rounded cursor-pointer border border-input shrink-0" />
                      <Input className="h-7 text-sm flex-1" value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleUpdate(tag.id)} autoFocus />
                      <button onClick={() => handleUpdate(tag.id)} disabled={updateTag.isPending}
                        className="text-primary hover:text-primary/80 transition-colors">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                      <span className="text-sm flex-1 font-medium" style={{ color: tag.color }}>{tag.name}</span>
                      <button onClick={() => startEdit(tag)} className="text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => deleteTag.mutate(tag.id)} disabled={deleteTag.isPending}
                        className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 pt-2 border-t">
            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
              className="h-7 w-7 rounded cursor-pointer border border-input shrink-0" />
            <Input className="h-7 text-sm flex-1" placeholder="Nombre de la etiqueta..."
              value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
            <Button size="sm" className="h-7 px-3 text-xs" disabled={!newName.trim() || createTag.isPending} onClick={handleCreate}>
              <Plus className="h-3 w-3 mr-1" /> Crear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CustomerCard (list item) ──────────────────────────────────────────────────

function CustomerCard({
  customer, onEdit, onDelete, onRestore,
}: {
  customer:  Customer;
  onEdit:    (c: Customer) => void;
  onDelete:  (c: Customer) => void;
  onRestore: (c: Customer) => void;
}) {
  const navigate  = useNavigate();
  const isDeleted = !!customer.deletedAt;
  const fullName  = customer.fullName ?? `${customer.firstName} ${customer.lastName}`;
  const initials  = `${customer.firstName[0] ?? ""}${customer.lastName[0] ?? ""}`.toUpperCase();

  const lastApptDate = customer.lastAppointmentDate
    ? new Date(customer.lastAppointmentDate).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })
    : null;

  return (
    <tr
      className={cn(
        "border-b transition-colors hover:bg-muted/40 cursor-pointer",
        isDeleted && "opacity-50"
      )}
      onClick={() => navigate(`/customers/${customer.id}`)}
    >
      {/* Avatar + nombre */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className={cn("font-medium text-sm truncate max-w-[200px]", isDeleted && "line-through")}>{fullName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {customer.whatsappOptIn && (
                <span className="inline-flex items-center gap-0.5 text-xs text-green-600">
                  <MessageCircle className="h-3 w-3" /> WA
                </span>
              )}
              {(customer.allergies?.length ?? 0) > 0 && (
                <span className="inline-flex items-center gap-0.5 text-xs text-orange-500">
                  <AlertTriangle className="h-3 w-3" /> Alergias
                </span>
              )}
              {isDeleted && <span className="text-xs text-destructive">Eliminado</span>}
            </div>
          </div>
        </div>
      </td>

      {/* Documento */}
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {customer.documentNumber ? (
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
            {customer.documentType && <span className="text-muted-foreground mr-1">{customer.documentType}</span>}
            {customer.documentNumber}
          </span>
        ) : "—"}
      </td>

      {/* Teléfono */}
      <td className="px-4 py-3 text-sm">
        {customer.phone ? (
          <span className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {customer.phone}
          </span>
        ) : <span className="text-muted-foreground">—</span>}
      </td>

      {/* Última cita */}
      <td className="px-4 py-3 text-sm">
        {lastApptDate ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            {lastApptDate}
          </span>
        ) : <span className="text-muted-foreground text-xs">Sin citas</span>}
      </td>

      {/* Tags */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {customer.tags?.slice(0, 2).map((tag) => (
            <Badge key={tag.id} variant="outline" className="text-xs px-1.5 py-0"
              style={{ borderColor: tag.color, color: tag.color }}>
              {tag.name}
            </Badge>
          ))}
          {(customer.tags?.length ?? 0) > 2 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              +{(customer.tags?.length ?? 0) - 2}
            </Badge>
          )}
        </div>
      </td>

      {/* Acciones */}
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => navigate(`/customers/${customer.id}`)}>
              <Eye className="mr-2 h-4 w-4" /> Ver ficha
            </DropdownMenuItem>
            {!isDeleted && (
              <DropdownMenuItem onClick={() => onEdit(customer)}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {isDeleted ? (
              <DropdownMenuItem onClick={() => onRestore(customer)}>
                <RotateCcw className="mr-2 h-4 w-4" /> Restaurar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onDelete(customer)}
                className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function CustomersPage() {
  const [search,      setSearch]      = useState("");
  const [tagFilter,   setTagFilter]   = useState<string[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [sheetOpen,   setSheetOpen]   = useState(false);
  const [editTarget,  setEditTarget]  = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const isAdmin        = useAuthStore((s) => s.hasAnyRole(["SUPER_ADMIN", "GENERAL_MANAGER"]));
  const debouncedSearch = useDebounce(search, 350);

  const filters: Omit<CustomerFilters, "cursor"> = {
    q:       debouncedSearch || undefined,
    tagIds:  tagFilter.length ? tagFilter : undefined,
    deleted: showDeleted || undefined,
    limit:   50,
  };

  const {
    data,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteCustomers(filters);

  const { data: tags }       = useCustomerTags();
  const deleteCustomer       = useDeleteCustomer();
  const restoreCustomer      = useRestoreCustomer();

  const customers    = data?.pages.flatMap((p) => p.data) ?? [];
  const firstPage    = data?.pages[0];
  const total        = firstPage?.total ?? customers.length;

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage(); },
      { rootMargin: "200px" }
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const openCreate = useCallback(() => { setEditTarget(null); setSheetOpen(true); }, []);
  const openEdit   = useCallback((c: Customer) => { setEditTarget(c); setSheetOpen(true); }, []);

  const handleDelete = useCallback((c: Customer) => { setDeleteTarget(c); }, []);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteCustomer.mutate(deleteTarget.id);
    setDeleteTarget(null);
  };

  const toggleTag = (tagId: string) =>
    setTagFilter((prev) => prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (tagFilter.length) params.set("tagIds", tagFilter.join(","));
    if (showDeleted)      params.set("deleted", "true");
    const token = localStorage.getItem("pdo_access");
    window.open(
      `${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/v1/customers/export?${params}&token=${token}`,
      "_blank"
    );
  };

  const withWhatsapp = customers.filter((c) => c.whatsappOptIn).length;
  const withAllergies = customers.filter((c) => (c.allergies?.length ?? 0) > 0).length;

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading
              ? "Cargando..."
              : `${total.toLocaleString()} clientes registrados`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo cliente
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      {!isLoading && customers.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Cargados</p>
            <p className="text-xl font-bold mt-0.5">{customers.length.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Con WhatsApp</p>
            <p className="text-xl font-bold mt-0.5 text-green-600">{withWhatsapp}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Con alergias</p>
            <p className="text-xl font-bold mt-0.5 text-orange-500">{withAllergies}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Total registro</p>
            <p className="text-xl font-bold mt-0.5">{total.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="flex flex-col gap-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, apellido, DNI, teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tags?.map((tag) => (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors",
                tagFilter.includes(tag.id) ? "text-white" : "bg-background text-foreground"
              )}
              style={
                tagFilter.includes(tag.id)
                  ? { backgroundColor: tag.color, borderColor: tag.color }
                  : { borderColor: tag.color, color: tag.color }
              }
            >
              {tag.name}
            </button>
          ))}
          <button
            onClick={() => setShowDeleted((v) => !v)}
            className={cn(
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors",
              showDeleted
                ? "bg-destructive text-destructive-foreground border-destructive"
                : "border-border text-muted-foreground"
            )}
          >
            Mostrar eliminados
          </button>
          {(tagFilter.length > 0 || showDeleted) && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              onClick={() => { setTagFilter([]); setShowDeleted(false); }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {isError ? (
          <div className="p-8 text-center text-sm text-destructive">
            Error al cargar clientes: {(error as Error)?.message}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Documento</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Teléfono</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Última cita</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Etiquetas</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-9 w-9 rounded-full" />
                          <div className="space-y-1">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-24 rounded" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3" />
                    </tr>
                  ))
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <Users className="h-10 w-10 mb-3 opacity-30" />
                        <p className="font-medium">No se encontraron clientes</p>
                        <p className="text-sm mt-1">
                          {search || tagFilter.length ? "Intenta con otros filtros" : "Crea el primer cliente"}
                        </p>
                        {!search && !tagFilter.length && (
                          <Button className="mt-4" size="sm" onClick={openCreate}>
                            <Plus className="h-4 w-4 mr-2" /> Nuevo cliente
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <CustomerCard
                      key={c.id}
                      customer={c}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onRestore={(cust) => restoreCustomer.mutate(cust.id)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="flex justify-center py-2">
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando más...
          </div>
        )}
      </div>

      {/* Tags manager — admin only */}
      {isAdmin && <TagsManager />}

      {/* Create / Edit sheet */}
      <CustomerFormSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        customer={editTarget}
      />

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Eliminar cliente
            </DialogTitle>
            <DialogDescription>
              ¿Eliminar a{" "}
              <strong>{deleteTarget?.firstName} {deleteTarget?.lastName}</strong>?
              Esta acción puede revertirse.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteCustomer.isPending}>
              {deleteCustomer.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  UserCog, Plus, Search, ChevronLeft, ChevronRight,
  ToggleLeft, ToggleRight, KeyRound, Loader2,
  Mail, Phone, ExternalLink, AlertTriangle, ScanLine,
} from "lucide-react";
import {
  Button, Input, Label, Skeleton,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@podoplus/ui";
import {
  useUsers, useCreateUser, useActivateUser,
  useDeactivateUser, useAdminResetPassword, useRbacRoles, useDniLookup,
  getRoleCode,
  type UserListItem,
} from "@/hooks/use-users";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";

// ── Constantes ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN:          "Superadministrador",
  GENERAL_MANAGER:      "Gerente General",
  OPS_MANAGER:          "Gerente de Operaciones",
  SUPERVISOR:           "Supervisor",
  SUPERVISOR_ASSISTANT: "Asistente de Supervisión",
  QUALITY:              "Control de Calidad",
  ACCOUNTING_HR:        "Contabilidad / RRHH",
  LOGISTICS:            "Logística",
  RECEPTIONIST:         "Recepcionista",
};

// Tabs visibles — excluye CUSTOMER y SUPER_ADMIN
const ROLE_TABS = [
  { code: "ALL",                  label: "Todos" },
  { code: "GENERAL_MANAGER",      label: "Gerencia" },
  { code: "OPS_MANAGER",          label: "Operaciones" },
  { code: "SUPERVISOR",           label: "Supervisores" },
  { code: "SUPERVISOR_ASSISTANT", label: "Asistentes" },
  { code: "QUALITY",              label: "Calidad" },
  { code: "ACCOUNTING_HR",        label: "Contabilidad" },
  { code: "LOGISTICS",            label: "Logística" },
  { code: "RECEPTIONIST",         label: "Recepción" },
];

const DOCUMENT_TYPES = [
  { value: "DNI",      label: "DNI" },
  { value: "RUC",      label: "RUC" },
  { value: "PASSPORT", label: "Pasaporte" },
  { value: "CE",       label: "Carné de extranjería" },
  { value: "OTHER",    label: "Otro" },
];

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN:          "bg-violet-100 text-violet-700",
  GENERAL_MANAGER:      "bg-blue-100 text-blue-700",
  OPS_MANAGER:          "bg-cyan-100 text-cyan-700",
  SUPERVISOR:           "bg-teal-100 text-teal-700",
  SUPERVISOR_ASSISTANT: "bg-teal-50 text-teal-600",
  QUALITY:              "bg-amber-100 text-amber-700",
  ACCOUNTING_HR:        "bg-orange-100 text-orange-700",
  LOGISTICS:            "bg-lime-100 text-lime-700",
  RECEPTIONIST:         "bg-green-100 text-green-700",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

/**
 * Búsqueda inteligente por iniciales.
 * "vi lle" → busca palabras que empiecen con "vi" Y palabras que empiecen con "lle"
 * en el nombre completo + email + documento.
 */
function matchesSearch(user: UserListItem, query: string): boolean {
  if (!query.trim()) return true;
  const terms = query.trim().toLowerCase().split(/\s+/);
  const haystack = `${user.firstName} ${user.lastName} ${user.email} ${user.documentNumber ?? ""}`.toLowerCase();
  const words = haystack.split(/\s+/);
  return terms.every((term) => words.some((w) => w.startsWith(term)));
}

// ── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ code }: { code: string }) {
  const cls = ROLE_COLORS[code] ?? "bg-muted text-muted-foreground";
  return (
    <span className={cn("text-[10px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap", cls)}>
      {ROLE_LABELS[code] ?? code}
    </span>
  );
}

// ── Create User Dialog ────────────────────────────────────────────────────────

const createSchema = z.object({
  documentType:   z.string().optional(),
  documentNumber: z.string().max(20).optional().or(z.literal("")),
  firstName:      z.string().min(1, "Requerido").max(100),
  lastName:       z.string().min(1, "Requerido").max(100),
  email:          z.string().email("Email inválido"),
  password:       z.string().min(8, "Mínimo 8 caracteres").regex(
    /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/,
    "Debe contener mayúscula, número y carácter especial"
  ),
  phone:    z.string().max(20).optional().or(z.literal("")),
  address:  z.string().max(300).optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")),
  roleCode: z.string().optional().or(z.literal("")),
  branchId: z.string().optional().or(z.literal("")),
});
type CreateFormData = z.infer<typeof createSchema>;

function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: roles = [] } = useRbacRoles();
  const createMut  = useCreateUser();
  const dniLookup  = useDniLookup();

  const { register, handleSubmit, watch, setValue, control, reset,
    formState: { errors, isSubmitting } } = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: { documentType: "", documentNumber: "", firstName: "", lastName: "",
      email: "", password: "", phone: "", address: "", birthDate: "", roleCode: "", branchId: "" },
  });

  const docType   = watch("documentType");
  const docNumber = watch("documentNumber");
  const isDni     = docType === "DNI";

  const handleDniSearch = async () => {
    const num = (docNumber ?? "").trim();
    if (num.length !== 8) return;
    const result = await dniLookup.mutateAsync(num);
    setValue("firstName", result.firstName, { shouldValidate: true });
    setValue("lastName",  result.lastName,  { shouldValidate: true });
  };

  const onSubmit = async (vals: CreateFormData) => {
    try {
      await createMut.mutateAsync({
        firstName:      vals.firstName,
        lastName:       vals.lastName,
        email:          vals.email,
        password:       vals.password,
        phone:          vals.phone      || undefined,
        documentType:   vals.documentType  || undefined,
        documentNumber: vals.documentNumber || undefined,
        address:        vals.address    || undefined,
        birthDate:      vals.birthDate  || undefined,
        roleCode:       vals.roleCode   || undefined,
        branchId:       vals.branchId   || undefined,
      });
      reset();
      onClose();
    } catch { /* toasted in hook */ }
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Nuevo colaborador</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">

          {/* Documento */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Documento de identidad
            </p>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <Controller
                name="documentType"
                control={control}
                render={({ field }) => (
                  <select {...field} className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25">
                    <option value="">Tipo</option>
                    {DOCUMENT_TYPES.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                )}
              />
              <div className="flex gap-1.5">
                <Input
                  {...register("documentNumber")}
                  placeholder="Número"
                  className="flex-1"
                />
                {isDni && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDniSearch}
                    disabled={dniLookup.isPending || (docNumber ?? "").length !== 8}
                    className="shrink-0 px-3"
                  >
                    {dniLookup.isPending
                      ? <Loader2 size={14} className="animate-spin" />
                      : <><ScanLine size={13} className="mr-1" />Buscar</>
                    }
                  </Button>
                )}
              </div>
            </div>
            {isDni && (
              <p className="text-[11px] text-muted-foreground">
                Ingresa los 8 dígitos y haz clic en "Buscar" para autocompletar nombres.
              </p>
            )}
          </div>

          {/* Nombre y apellido */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input {...register("firstName")} placeholder="Juan" />
              {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Apellido *</Label>
              <Input {...register("lastName")} placeholder="Pérez" />
              {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input type="email" {...register("email")} placeholder="juan@empresa.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          {/* Contraseña */}
          <div className="space-y-1.5">
            <Label>Contraseña *</Label>
            <Input type="password" {...register("password")} placeholder="••••••••" />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          {/* Teléfono y Fecha de nacimiento */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input {...register("phone")} placeholder="+51 999 999 999" />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de nacimiento</Label>
              <Input type="date" {...register("birthDate")} />
            </div>
          </div>

          {/* Dirección */}
          <div className="space-y-1.5">
            <Label>Dirección</Label>
            <Input {...register("address")} placeholder="Av. Principal 123, Lima" />
          </div>

          {/* Rol */}
          <div className="space-y-1.5">
            <Label>Rol inicial</Label>
            <select
              {...register("roleCode")}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              <option value="">Sin rol</option>
              {roles
                .filter((r) => r.code !== "CUSTOMER" && r.code !== "SUPER_ADMIN")
                .map((r) => (
                  <option key={r.code} value={r.code}>
                    {ROLE_LABELS[r.code] ?? r.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear colaborador
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Reset Password Dialog ─────────────────────────────────────────────────────

const resetSchema = z.object({
  newPassword: z.string().min(8).regex(
    /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/,
    "Debe contener mayúscula, número y carácter especial"
  ),
});
type ResetFormData = z.infer<typeof resetSchema>;

function ResetPasswordDialog({ userId, open, onClose }: { userId: string; open: boolean; onClose: () => void }) {
  const resetMut = useAdminResetPassword();
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  });

  const onSubmit = async ({ newPassword }: ResetFormData) => {
    try {
      await resetMut.mutateAsync({ id: userId, newPassword });
      reset();
      onClose();
    } catch { /* toasted in hook */ }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Resetear contraseña</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">
            Se asignará una nueva contraseña y se revocarán todas las sesiones activas del usuario.
          </p>
          <div className="space-y-1.5">
            <Label>Nueva contraseña</Label>
            <Input type="password" {...register("newPassword")} placeholder="••••••••" />
            {errors.newPassword && <p className="text-xs text-destructive">{String(errors.newPassword.message)}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Resetear
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Deactivate Confirmation Dialog ────────────────────────────────────────────

function DeactivateDialog({
  user, open, onClose, onConfirm, loading,
}: {
  user: UserListItem | null;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-destructive" />
            </div>
            <DialogTitle>Desactivar usuario</DialogTitle>
          </div>
          <DialogDescription>
            ¿Confirmas que deseas desactivar a{" "}
            <span className="font-semibold text-foreground">
              {user?.firstName} {user?.lastName}
            </span>?
            <br />
            <span className="text-xs mt-1 block">
              El usuario no podrá iniciar sesión. Puedes reactivarlo en cualquier momento.
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sí, desactivar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── User row ──────────────────────────────────────────────────────────────────

function UserRow({
  user, onToggle, onReset, onDetail, canManage,
}: {
  user:      UserListItem;
  onToggle:  (u: UserListItem) => void;
  onReset:   (u: UserListItem) => void;
  onDetail:  (u: UserListItem) => void;
  canManage: boolean;
}) {
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  return (
    <tr className="border-b hover:bg-muted/30 transition-colors">
      {/* Avatar + nombre */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={initials}
              className="h-9 w-9 rounded-full object-cover shrink-0 ring-1 ring-border"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary">{initials}</span>
            </div>
          )}
          <div>
            <p className="font-medium text-sm text-foreground">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Mail size={10} />{user.email}
            </p>
          </div>
        </div>
      </td>

      {/* Documento */}
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-xs text-muted-foreground">
          {user.documentNumber
            ? <>{user.documentType && <span className="font-medium text-foreground">{user.documentType} </span>}{user.documentNumber}</>
            : "—"
          }
        </span>
      </td>

      {/* Teléfono */}
      <td className="px-4 py-3 hidden sm:table-cell">
        <span className="text-xs text-muted-foreground">
          {user.phone
            ? <span className="flex items-center gap-1"><Phone size={11} />{user.phone}</span>
            : "—"}
        </span>
      </td>

      {/* Roles */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {user.roles.length > 0
            ? user.roles.slice(0, 2).map((r, i) => {
                const code = getRoleCode(r);
                return code ? <RoleBadge key={code + i} code={code} /> : null;
              })
            : <span className="text-xs text-muted-foreground">Sin rol</span>
          }
          {user.roles.length > 2 && (
            <span className="text-xs text-muted-foreground">+{user.roles.length - 2}</span>
          )}
        </div>
      </td>

      {/* Estado */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full text-[11px] font-medium px-2 py-0.5",
          user.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
        )}>
          <span className={cn("h-1.5 w-1.5 rounded-full", user.isActive ? "bg-green-500" : "bg-gray-400")} />
          {user.isActive ? "Activo" : "Inactivo"}
        </span>
      </td>

      {/* Acciones */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-primary" onClick={() => onDetail(user)} title="Ver ficha">
            <ExternalLink size={13} />
          </Button>
          {canManage && (
            <>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onReset(user)} title="Resetear contraseña">
                <KeyRound size={13} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className={cn("h-7 px-2", user.isActive ? "hover:text-destructive" : "hover:text-primary")}
                onClick={() => onToggle(user)}
                title={user.isActive ? "Desactivar" : "Activar"}
              >
                {user.isActive ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

const LIMIT = 25;

export function UsersPage() {
  const navigate    = useNavigate();
  const canManage   = useAuthStore((s) => s.hasPermission("user.manage"));

  // Filtros
  const [search,       setSearch]       = useState("");
  const [roleTab,      setRoleTab]      = useState("ALL");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "true" | "false">("ALL");
  const [cursor,       setCursor]       = useState<string | undefined>();
  const cursorStack = useRef<string[]>([]);

  // Modales
  const [createOpen,      setCreateOpen]      = useState(false);
  const [resetUser,       setResetUser]       = useState<UserListItem | null>(null);
  const [deactivateUser,  setDeactivateUser]  = useState<UserListItem | null>(null);

  const debouncedSearch = useDebounce(search, 300);
  const activateMut     = useActivateUser();
  const deactivateMut   = useDeactivateUser();

  const params = {
    q:        debouncedSearch || undefined,
    role:     roleTab !== "ALL" ? roleTab : undefined,
    isActive: activeFilter !== "ALL" ? activeFilter === "true" : undefined,
    limit:    LIMIT,
    cursor,
  };

  const { data, isLoading } = useUsers(params);

  // Filtro client-side con lógica de iniciales
  const filtered = (data?.data ?? []).filter((u) => {
    // Excluir usuarios con rol CUSTOMER (por si el backend no lo filtra)
    const codes = u.roles.map(getRoleCode);
    if (codes.includes("CUSTOMER")) return false;
    return matchesSearch(u, search);
  });

  const handleToggle = (u: UserListItem) => {
    if (u.isActive) {
      setDeactivateUser(u);
    } else {
      activateMut.mutate(u.id);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivateUser) return;
    try {
      await deactivateMut.mutateAsync(deactivateUser.id);
    } finally {
      setDeactivateUser(null);
    }
  };

  const resetPagination = () => { setCursor(undefined); cursorStack.current = []; };

  const goNext = () => {
    if (data?.nextCursor) {
      cursorStack.current.push(cursor ?? "");
      setCursor(data.nextCursor);
    }
  };
  const goPrev = () => {
    const prev = cursorStack.current.pop();
    setCursor(prev || undefined);
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Colaboradores</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestión de trabajadores, roles y accesos
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nuevo colaborador
          </Button>
        )}
      </div>

      {/* Role tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b">
        {ROLE_TABS.map((tab) => (
          <button
            key={tab.code}
            onClick={() => { setRoleTab(tab.code); resetPagination(); }}
            className={cn(
              "shrink-0 px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
              roleTab === tab.code
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filtros de búsqueda */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Nombre, email, DNI… (ej: vi lle)"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPagination(); }}
          />
        </div>

        <select
          value={activeFilter}
          onChange={(e) => { setActiveFilter(e.target.value as "ALL" | "true" | "false"); resetPagination(); }}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
        >
          <option value="ALL">Todos los estados</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>

        <span className="text-sm text-muted-foreground self-center ml-auto">
          {filtered.length} colaborador{filtered.length !== 1 ? "es" : ""}
        </span>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Colaborador</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Documento</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Teléfono</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Roles</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Estado</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-5 w-14 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-7 w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <UserCog className="h-10 w-10 text-muted-foreground/40" />
                      <p className="text-muted-foreground text-sm">No se encontraron colaboradores</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    onToggle={handleToggle}
                    onReset={(u) => setResetUser(u)}
                    onDetail={(u) => navigate(`/users/${u.id}`)}
                    canManage={canManage}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
          <span className="text-xs text-muted-foreground">
            {filtered.length > 0 ? `Mostrando ${filtered.length} colaboradores` : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 w-7 p-0"
              onClick={goPrev} disabled={cursorStack.current.length === 0}>
              <ChevronLeft size={14} />
            </Button>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0"
              onClick={goNext} disabled={!data?.hasNext}>
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </div>

      {/* Modales */}
      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {resetUser && (
        <ResetPasswordDialog
          userId={resetUser.id}
          open={!!resetUser}
          onClose={() => setResetUser(null)}
        />
      )}

      <DeactivateDialog
        user={deactivateUser}
        open={!!deactivateUser}
        onClose={() => setDeactivateUser(null)}
        onConfirm={handleConfirmDeactivate}
        loading={deactivateMut.isPending}
      />
    </div>
  );
}

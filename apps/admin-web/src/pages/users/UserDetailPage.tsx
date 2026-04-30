import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, Mail, Phone, Building2, Calendar, DollarSign,
  Shield, Plus, Trash2, KeyRound, ToggleLeft, ToggleRight,
  Edit2, Loader2, CheckCircle, XCircle, Clock, Camera, Lock,
  MapPin, CreditCard, TrendingUp, AlertTriangle, ScanLine,
  Users, CheckSquare, Ban,
} from "lucide-react";
import {
  Button, Input, Label, Skeleton,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@podoplus/ui";
import {
  useUser, useUserStats, useRbacRoles, useUpdateUser,
  useActivateUser, useDeactivateUser, useAdminResetPassword,
  useAssignRole, useRemoveRole, useUploadUserAvatar, useDeleteUserAvatar,
  useAssignUserBranch, useRemoveUserBranch,
  useDniLookup,
  getRoleCode, getRoleName,
  type UserRole,
} from "@/hooks/use-users";
import { useBranches } from "@/hooks/use-branches";
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

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN:          "bg-violet-100 text-violet-700 border-violet-200",
  GENERAL_MANAGER:      "bg-blue-100 text-blue-700 border-blue-200",
  OPS_MANAGER:          "bg-cyan-100 text-cyan-700 border-cyan-200",
  SUPERVISOR:           "bg-teal-100 text-teal-700 border-teal-200",
  SUPERVISOR_ASSISTANT: "bg-teal-50 text-teal-600 border-teal-100",
  QUALITY:              "bg-amber-100 text-amber-700 border-amber-200",
  ACCOUNTING_HR:        "bg-orange-100 text-orange-700 border-orange-200",
  LOGISTICS:            "bg-lime-100 text-lime-700 border-lime-200",
  RECEPTIONIST:         "bg-green-100 text-green-700 border-green-200",
};

const DOCUMENT_TYPES = [
  { value: "DNI",      label: "DNI" },
  { value: "RUC",      label: "RUC" },
  { value: "PASSPORT", label: "Pasaporte" },
  { value: "CE",       label: "Carné de extranjería" },
  { value: "OTHER",    label: "Otro" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit", month: "long", year: "numeric",
  });
}
function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtRevenue(v: number | undefined) {
  if (v === undefined || v === null) return "S/ 0.00";
  return `S/ ${Number(v).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, colorClass, loading, sub,
}: {
  label:      string;
  value:      string | number;
  icon:       React.ElementType;
  colorClass: string;
  loading?:   boolean;
  sub?:       string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-start gap-3">
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", colorClass)}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        {loading
          ? <Skeleton className="h-7 w-16 mb-1" />
          : <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
        }
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {sub && !loading && (
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  );
}

// ── Edit user dialog ──────────────────────────────────────────────────────────

const editSchema = z.object({
  documentType:   z.string().optional(),
  documentNumber: z.string().max(20).optional().or(z.literal("")),
  firstName:      z.string().min(1, "Requerido").max(100),
  lastName:       z.string().min(1, "Requerido").max(100),
  email:          z.string().email("Email inválido"),
  phone:          z.string().max(20).optional().or(z.literal("")),
  address:        z.string().max(300).optional().or(z.literal("")),
  birthDate:      z.string().optional().or(z.literal("")),
});
type EditFormData = z.infer<typeof editSchema>;

function EditUserDialog({ open, onClose, userId, defaultValues }: {
  open:          boolean;
  onClose:       () => void;
  userId:        string;
  defaultValues: EditFormData;
}) {
  const updateMut  = useUpdateUser(userId);
  const dniLookup  = useDniLookup();

  const { register, handleSubmit, watch, setValue, control, formState: { errors, isSubmitting } } =
    useForm<EditFormData>({ resolver: zodResolver(editSchema), defaultValues });

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

  const onSubmit = async (vals: EditFormData) => {
    try {
      await updateMut.mutateAsync({
        firstName:      vals.firstName,
        lastName:       vals.lastName,
        email:          vals.email,
        phone:          vals.phone      || undefined,
        documentType:   vals.documentType  || undefined,
        documentNumber: vals.documentNumber || undefined,
        address:        vals.address    || undefined,
        birthDate:      vals.birthDate  || undefined,
      });
      onClose();
    } catch { /* toasted in hook */ }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Editar colaborador</DialogTitle>
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
                <Input {...register("documentNumber")} placeholder="Número" className="flex-1" />
                {isDni && (
                  <Button type="button" variant="outline" size="sm" onClick={handleDniSearch}
                    disabled={dniLookup.isPending || (docNumber ?? "").length !== 8} className="shrink-0 px-3">
                    {dniLookup.isPending
                      ? <Loader2 size={14} className="animate-spin" />
                      : <><ScanLine size={13} className="mr-1" />Buscar</>}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Nombre y apellido */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input {...register("firstName")} />
              {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Apellido *</Label>
              <Input {...register("lastName")} />
              {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input type="email" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

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

          <div className="space-y-1.5">
            <Label>Dirección</Label>
            <Input {...register("address")} placeholder="Av. Principal 123, Lima" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Reset password dialog ─────────────────────────────────────────────────────

const resetSchema = z.object({
  newPassword: z.string().min(8).regex(
    /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/,
    "Debe contener mayúscula, número y carácter especial"
  ),
});
type ResetFormData = z.infer<typeof resetSchema>;

function ResetPasswordDialog({ userId, open, onClose }: {
  userId: string; open: boolean; onClose: () => void;
}) {
  const resetMut = useAdminResetPassword();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ResetFormData>({
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
        <DialogHeader><DialogTitle>Resetear contraseña</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">
            Se asignará la nueva contraseña y se revocarán todas las sesiones activas del usuario.
          </p>
          <div className="space-y-1.5">
            <Label>Nueva contraseña</Label>
            <Input type="password" {...register("newPassword")} placeholder="••••••••" />
            {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
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

// ── Deactivate confirmation dialog ────────────────────────────────────────────

function DeactivateDialog({ open, onClose, onConfirm, loading, name }: {
  open: boolean; onClose: () => void; onConfirm: () => void; loading: boolean; name: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-destructive" />
            </div>
            <DialogTitle>Desactivar usuario</DialogTitle>
          </div>
          <DialogDescription>
            ¿Confirmas que deseas desactivar a <span className="font-semibold text-foreground">{name}</span>?
            El usuario no podrá iniciar sesión hasta ser reactivado.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sí, desactivar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Assign role dialog ────────────────────────────────────────────────────────

function AssignRoleDialog({ userId, open, onClose, existingCodes }: {
  userId: string; open: boolean; onClose: () => void; existingCodes: string[];
}) {
  const { data: allRoles = [] } = useRbacRoles();
  const assignMut = useAssignRole();
  const [selected, setSelected] = useState("");
  const [loading,  setLoading]  = useState(false);

  const available = allRoles.filter(
    (r) => !existingCodes.includes(r.code) && r.code !== "CUSTOMER"
  );

  const handleAssign = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await assignMut.mutateAsync({ userId, roleCode: selected });
      setSelected("");
      onClose();
    } catch { /* toasted in hook */ }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Asignar rol</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              <option value="">Selecciona un rol…</option>
              {available.map((r) => (
                <option key={r.code} value={r.code}>{ROLE_LABELS[r.code] ?? r.name}</option>
              ))}
            </select>
          </div>
          {available.length === 0 && (
            <p className="text-xs text-muted-foreground">El usuario ya tiene todos los roles disponibles.</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={!selected || loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Asignar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Assign branch dialog ──────────────────────────────────────────────────────

function AssignBranchDialog({ userId, open, onClose, assignedIds }: {
  userId: string; open: boolean; onClose: () => void; assignedIds: string[];
}) {
  const { data: allBranches = [] } = useBranches();
  const assignMut = useAssignUserBranch();
  const [selected, setSelected] = useState("");
  const [loading,  setLoading]  = useState(false);

  const available = allBranches.filter((b) => !assignedIds.includes(b.id));

  const handleAssign = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await assignMut.mutateAsync({ userId, branchId: selected });
      setSelected("");
      onClose();
    } catch { /* toasted in hook */ }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Asignar sede</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Sede</Label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              <option value="">Selecciona una sede…</option>
              {available.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          {available.length === 0 && (
            <p className="text-xs text-muted-foreground">El usuario ya tiene todas las sedes disponibles.</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={!selected || loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Asignar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Role chip ─────────────────────────────────────────────────────────────────

function RoleChip({ role, onRemove, canRemove }: {
  role: UserRole; onRemove: (code: string) => void; canRemove: boolean;
}) {
  const code   = getRoleCode(role);
  const name   = getRoleName(role) || ROLE_LABELS[code] || code;
  const colors = ROLE_COLORS[code] ?? "bg-muted text-muted-foreground border-border";

  return (
    <div className={cn(
      "group inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all",
      colors
    )}>
      <Shield size={11} />
      <span>{name}</span>
      {canRemove && (
        <button
          onClick={() => onRemove(code)}
          className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
          title={`Quitar rol ${name}`}
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export function UserDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: user,  isLoading: loadUser,  error: userError } = useUser(id);
  const { data: stats, isLoading: loadStats }                   = useUserStats(id);

  const activateMut      = useActivateUser();
  const deactivateMut    = useDeactivateUser();
  const removeRoleMut    = useRemoveRole();
  const uploadAvatarMut  = useUploadUserAvatar(id ?? "");
  const deleteAvatarMut  = useDeleteUserAvatar(id ?? "");
  const removeBranchMut  = useRemoveUserBranch();

  const canManageUsers = useAuthStore((s) => s.hasPermission("user.manage"));
  const canManageRoles = useAuthStore((s) => s.hasPermission("role.manage"));

  const fileRef = useRef<HTMLInputElement>(null);

  const [editOpen,         setEditOpen]         = useState(false);
  const [resetOpen,        setResetOpen]        = useState(false);
  const [assignRoleOpen,   setAssignRoleOpen]   = useState(false);
  const [assignBranchOpen, setAssignBranchOpen] = useState(false);
  const [deactivateOpen,   setDeactivateOpen]   = useState(false);

  const handleToggleActive = async () => {
    if (!user) return;
    if (user.isActive) {
      setDeactivateOpen(true);
    } else {
      await activateMut.mutateAsync(user.id);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!user) return;
    try { await deactivateMut.mutateAsync(user.id); }
    finally { setDeactivateOpen(false); }
  };

  const handleRemoveRole = async (code: string) => {
    if (!user) return;
    try { await removeRoleMut.mutateAsync({ userId: user.id, roleCode: code }); }
    catch { /* toasted in hook */ }
  };

  const handleRemoveBranch = async (branchId: string) => {
    if (!user) return;
    try { await removeBranchMut.mutateAsync({ userId: user.id, branchId }); }
    catch { /* toasted in hook */ }
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try { await uploadAvatarMut.mutateAsync(file); }
    catch { /* toasted in hook */ }
  };

  const existingCodes = (user?.roles ?? []).map(getRoleCode).filter(Boolean);

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loadUser) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-32" />
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (userError && (userError as any).statusCode === 403) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
          <Lock className="h-7 w-7 text-muted-foreground/60" />
        </div>
        <p className="font-semibold">Acceso restringido</p>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          No tienes permisos para ver el detalle de este usuario.
        </p>
        <Button variant="outline" onClick={() => navigate("/users")}>
          <ArrowLeft size={14} className="mr-1.5" />Volver a usuarios
        </Button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <XCircle className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="font-semibold">Usuario no encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/users")}>
          <ArrowLeft size={14} className="mr-1.5" />Volver a usuarios
        </Button>
      </div>
    );
  }

  const initials      = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  const primaryRole   = user.roles[0];
  const primaryRoleCode = primaryRole ? getRoleCode(primaryRole) : null;
  const completionRate = stats?.completionRate ?? 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate("/users")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} />
        Volver a colaboradores
      </button>

      {/* ── Perfil header ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">

          {/* Avatar */}
          <div className="relative shrink-0 group">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={initials}
                className="h-24 w-24 rounded-full object-cover ring-2 ring-border"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-border">
                <span className="text-3xl font-bold text-primary">{initials}</span>
              </div>
            )}
            {canManageUsers && (
              <>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadAvatarMut.isPending || deleteAvatarMut.isPending}
                  className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  title="Cambiar foto"
                >
                  {(uploadAvatarMut.isPending || deleteAvatarMut.isPending)
                    ? <Loader2 size={20} className="text-white animate-spin" />
                    : <Camera size={20} className="text-white" />
                  }
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
                  className="hidden" onChange={handleAvatarFile} />
              </>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-foreground">
                {user.firstName} {user.lastName}
              </h1>
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full text-xs font-semibold px-2.5 py-1",
                user.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
              )}>
                {user.isActive
                  ? <><CheckCircle size={11} />Activo</>
                  : <><XCircle    size={11} />Inactivo</>
                }
              </span>
            </div>

            {/* Rol principal */}
            {primaryRoleCode && (
              <p className="text-sm font-semibold text-primary mb-2">
                {ROLE_LABELS[primaryRoleCode] ?? primaryRoleCode}
              </p>
            )}

            {/* Datos de contacto */}
            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="flex items-center gap-2"><Mail size={13} />{user.email}</p>
              {user.phone && <p className="flex items-center gap-2"><Phone size={13} />{user.phone}</p>}
              {user.documentNumber && (
                <p className="flex items-center gap-2">
                  <CreditCard size={13} />
                  {user.documentType && <span className="font-medium text-foreground">{user.documentType}</span>}
                  {" "}{user.documentNumber}
                </p>
              )}
              {user.address && (
                <p className="flex items-center gap-2"><MapPin size={13} />{user.address}</p>
              )}
              {user.birthDate && (
                <p className="flex items-center gap-2">
                  <Calendar size={13} />
                  Nacido el {fmtDate(user.birthDate)}
                </p>
              )}
              <p className="flex items-center gap-2 text-xs">
                <Clock size={11} />
                Último acceso: {fmtDateTime(user.lastLoginAt)}
              </p>
              <p className="flex items-center gap-2 text-xs">
                <Calendar size={11} />
                Registrado el {fmtDate(user.createdAt)}
              </p>
            </div>

            {/* Sedes asignadas */}
            {user.branches?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {user.branches.map((b) => (
                  <span key={b.id} className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2.5 py-0.5 text-muted-foreground">
                    <Building2 size={10} />{b.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Acciones */}
          {canManageUsers && (
            <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Edit2 size={13} className="mr-1.5" />Editar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setResetOpen(true)}>
                <KeyRound size={13} className="mr-1.5" />Resetear clave
              </Button>
              {user.avatarUrl && (
                <Button size="sm" variant="outline"
                  className="hover:text-destructive hover:border-destructive"
                  onClick={() => deleteAvatarMut.mutate()}
                  disabled={deleteAvatarMut.isPending}>
                  <Trash2 size={13} className="mr-1.5" />Quitar foto
                </Button>
              )}
              <Button
                size="sm" variant="outline"
                className={user.isActive
                  ? "hover:text-destructive hover:border-destructive"
                  : "hover:text-primary hover:border-primary"}
                onClick={handleToggleActive}
                disabled={activateMut.isPending || deactivateMut.isPending}
              >
                {user.isActive
                  ? <><ToggleLeft size={13} className="mr-1.5" />Desactivar</>
                  : <><ToggleRight size={13} className="mr-1.5" />Activar</>
                }
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── KPIs de rendimiento ───────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Desempeño
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Citas agendadas"
            value={loadStats ? "…" : (stats?.scheduledAppointments ?? 0)}
            icon={Users}
            colorClass="bg-primary"
            loading={loadStats}
          />
          <StatCard
            label="Citas completadas"
            value={loadStats ? "…" : (stats?.completedAppointments ?? 0)}
            icon={CheckSquare}
            colorClass="bg-green-500"
            loading={loadStats}
            sub={loadStats ? undefined : `${completionRate}% de completitud`}
          />
          <StatCard
            label="Citas canceladas"
            value={loadStats ? "…" : (stats?.cancelledAppointments ?? 0)}
            icon={Ban}
            colorClass="bg-orange-500"
            loading={loadStats}
          />
          <StatCard
            label="Ventas registradas"
            value={loadStats ? "…" : (stats?.totalSales ?? 0)}
            icon={DollarSign}
            colorClass="bg-blue-500"
            loading={loadStats}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <StatCard
            label="Ingresos generados"
            value={loadStats ? "…" : fmtRevenue(stats?.totalRevenue)}
            icon={TrendingUp}
            colorClass="bg-violet-500"
            loading={loadStats}
          />
          <StatCard
            label="Último acceso"
            value={user.lastLoginAt ? fmtDateTime(user.lastLoginAt) : "Sin registros"}
            icon={Clock}
            colorClass="bg-slate-500"
          />
        </div>
      </div>

      {/* ── Roles ────────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-primary" />
            <h2 className="font-semibold text-foreground text-sm">Roles asignados</h2>
          </div>
          {canManageRoles && (
            <Button size="sm" variant="outline" onClick={() => setAssignRoleOpen(true)}>
              <Plus size={13} className="mr-1.5" />Asignar rol
            </Button>
          )}
        </div>

        {user.roles.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Shield size={14} className="opacity-40" />Sin roles asignados
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {user.roles.map((role, i) => (
              <RoleChip
                key={getRoleCode(role) || i}
                role={role}
                canRemove={canManageRoles}
                onRemove={handleRemoveRole}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Sedes asignadas ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-primary" />
            <h2 className="font-semibold text-foreground text-sm">Sedes asignadas</h2>
          </div>
          {canManageUsers && (
            <Button size="sm" variant="outline" onClick={() => setAssignBranchOpen(true)}>
              <Plus size={13} className="mr-1.5" />Asignar sede
            </Button>
          )}
        </div>

        {user.branches?.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {user.branches.map((b) => (
              <div
                key={b.id}
                className="group inline-flex items-center gap-1.5 rounded-lg border bg-muted px-3 py-1.5 text-sm font-medium text-foreground"
              >
                <Building2 size={13} className="text-muted-foreground shrink-0" />
                <span>{b.name}</span>
                {canManageUsers && (
                  <button
                    onClick={() => handleRemoveBranch(b.id)}
                    disabled={removeBranchMut.isPending}
                    className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                    title={`Quitar sede ${b.name}`}
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin sedes asignadas</p>
        )}
      </div>

      {/* ── Información del sistema ───────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold text-foreground text-sm mb-4">Información del sistema</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground mb-0.5">ID de usuario</dt>
            <dd className="font-mono text-xs text-foreground bg-muted rounded px-2 py-1 truncate">{user.id}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground mb-0.5">Estado</dt>
            <dd className={cn("font-semibold", user.isActive ? "text-green-600" : "text-muted-foreground")}>
              {user.isActive ? "Activo" : "Inactivo"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground mb-0.5">Fecha de registro</dt>
            <dd>{fmtDateTime(user.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground mb-0.5">Último acceso</dt>
            <dd>{fmtDateTime(user.lastLoginAt)}</dd>
          </div>
          {user.documentType && (
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Tipo de documento</dt>
              <dd>{user.documentType}</dd>
            </div>
          )}
          {user.documentNumber && (
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">N° de documento</dt>
              <dd>{user.documentNumber}</dd>
            </div>
          )}
          {user.birthDate && (
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Fecha de nacimiento</dt>
              <dd>{fmtDate(user.birthDate)}</dd>
            </div>
          )}
          {user.address && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground mb-0.5">Dirección</dt>
              <dd>{user.address}</dd>
            </div>
          )}
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground mb-0.5">Sedes</dt>
            <dd>{user.branches?.length > 0 ? user.branches.map((b) => b.name).join(", ") : "Sin sedes asignadas"}</dd>
          </div>
        </dl>
      </div>

      {/* ── Modales ───────────────────────────────────────────────────────────── */}
      <EditUserDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        userId={user.id}
        defaultValues={{
          documentType:   user.documentType   ?? "",
          documentNumber: user.documentNumber ?? "",
          firstName:      user.firstName,
          lastName:       user.lastName,
          email:          user.email,
          phone:          user.phone     ?? "",
          address:        user.address   ?? "",
          birthDate:      user.birthDate ? user.birthDate.slice(0, 10) : "",
        }}
      />

      <ResetPasswordDialog userId={user.id} open={resetOpen} onClose={() => setResetOpen(false)} />

      <AssignRoleDialog
        userId={user.id}
        open={assignRoleOpen}
        onClose={() => setAssignRoleOpen(false)}
        existingCodes={existingCodes}
      />

      <AssignBranchDialog
        userId={user.id}
        open={assignBranchOpen}
        onClose={() => setAssignBranchOpen(false)}
        assignedIds={(user.branches ?? []).map((b) => b.id)}
      />

      <DeactivateDialog
        open={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        onConfirm={handleConfirmDeactivate}
        loading={deactivateMut.isPending}
        name={`${user.firstName} ${user.lastName}`}
      />
    </div>
  );
}

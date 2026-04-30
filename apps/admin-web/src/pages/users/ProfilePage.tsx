import { useRef, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  User, Mail, Phone, Building2, Calendar, Shield,
  Camera, Trash2, Loader2, KeyRound, Clock,
  MonitorSmartphone, Monitor, Smartphone, Wifi, LogOut,
  CreditCard, MapPin, Cake,
} from "lucide-react";
import {
  Button, Input, Label, Skeleton,
} from "@podoplus/ui";
import {
  useMyProfile,
  useUpdateMyProfile,
  useChangeMyPassword,
  useUploadMyAvatar,
  useDeleteMyAvatar,
  useActiveSessions,
  useRevokeSession,
  getCurrentJti,
  type UpdateMyProfileDto,
  type ChangeMyPasswordDto,
} from "@/hooks/use-users";
import { cn } from "@/lib/utils";

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

/** Convierte ISO timestamp a valor YYYY-MM-DD para input[type=date] */
function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.split("T")[0];
}

function roleLabel(code: string) {
  return code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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

const DOCUMENT_TYPE_OPTIONS = [
  { value: "",          label: "Sin especificar" },
  { value: "DNI",       label: "DNI" },
  { value: "RUC",       label: "RUC" },
  { value: "PASSPORT",  label: "Pasaporte" },
  { value: "CE",        label: "Carnet de Extranjería" },
  { value: "OTHER",     label: "Otro" },
];

// ── Schemas ───────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  firstName:      z.string().min(1, "Requerido").max(100),
  lastName:       z.string().min(1, "Requerido").max(100),
  phone:          z.string().max(20).optional().or(z.literal("")),
  documentType:   z.string().optional(),
  documentNumber: z.string().max(20).optional().or(z.literal("")),
  address:        z.string().max(300).optional().or(z.literal("")),
  birthDate:      z.string().optional().or(z.literal("")),
});
type ProfileFormData = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Requerido"),
    newPassword: z.string()
      .min(8, "Mínimo 8 caracteres")
      .regex(
        /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/,
        "Debe contener mayúscula, número y carácter especial",
      ),
    confirmPassword: z.string().min(1, "Requerido"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });
type PasswordFormData = z.infer<typeof passwordSchema>;

// ── Shared select style (matches shadcn Input) ────────────────────────────────

const selectCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm " +
  "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 " +
  "text-foreground";

// ── Avatar ────────────────────────────────────────────────────────────────────

function AvatarSection({
  firstName,
  lastName,
  avatarUrl,
}: {
  firstName: string;
  lastName:  string;
  avatarUrl: string | null;
}) {
  const fileRef   = useRef<HTMLInputElement>(null);
  const uploadMut = useUploadMyAvatar();
  const deleteMut = useDeleteMyAvatar();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try { await uploadMut.mutateAsync(file); } catch { /* toasted */ }
  };

  const handleDelete = async () => {
    try { await deleteMut.mutateAsync(); } catch { /* toasted */ }
  };

  const busy = uploadMut.isPending || deleteMut.isPending;
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Color bar */}
      <div className="h-16 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5" />

      <div className="px-5 pb-5 -mt-8 flex flex-col items-center text-center">
        {/* Avatar */}
        <div className="relative shrink-0 mb-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`${firstName} ${lastName}`}
              className="h-20 w-20 rounded-full object-cover ring-4 ring-card"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center ring-4 ring-card">
              <span className="text-2xl font-bold text-primary">{initials}</span>
            </div>
          )}
          {busy && (
            <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center">
              <Loader2 size={18} className="text-white animate-spin" />
            </div>
          )}
        </div>

        <p className="font-semibold text-foreground leading-tight">
          {firstName} {lastName}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 mb-3">
          JPG, PNG o WEBP · Máx. 5 MB
        </p>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="text-xs"
          >
            <Camera size={12} className="mr-1.5" />
            {avatarUrl ? "Cambiar foto" : "Subir foto"}
          </Button>

          {avatarUrl && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs hover:text-destructive hover:border-destructive"
              onClick={handleDelete}
              disabled={busy}
            >
              <Trash2 size={12} className="mr-1.5" />
              Eliminar
            </Button>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}

// ── Account info (read-only) ──────────────────────────────────────────────────

function AccountInfoSection({
  email,
  roles,
  branches,
  createdAt,
  lastLoginAt,
  isActive,
}: {
  email:       string;
  roles:       { code?: string; role?: { code: string } }[];
  branches:    { id: string; name: string }[];
  createdAt:   string;
  lastLoginAt: string | null;
  isActive:    boolean;
}) {
  const roleCodes = roles.map((r) => r.code ?? r.role?.code ?? "").filter(Boolean);

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Información de cuenta
      </h3>

      <dl className="space-y-3 text-sm">
        {/* Email */}
        <div className="flex items-start gap-2.5">
          <Mail size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <dt className="text-[11px] text-muted-foreground">Email</dt>
            <dd className="font-medium text-foreground truncate">{email}</dd>
          </div>
        </div>

        {/* Estado */}
        <div className="flex items-start gap-2.5">
          <div className={cn(
            "mt-1 h-2 w-2 rounded-full shrink-0",
            isActive ? "bg-green-500" : "bg-gray-400",
          )} />
          <div>
            <dt className="text-[11px] text-muted-foreground">Estado</dt>
            <dd className={cn(
              "text-sm font-medium",
              isActive ? "text-green-700" : "text-muted-foreground",
            )}>
              {isActive ? "Activo" : "Inactivo"}
            </dd>
          </div>
        </div>

        {/* Registro */}
        <div className="flex items-start gap-2.5">
          <Calendar size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
          <div>
            <dt className="text-[11px] text-muted-foreground">Registrado el</dt>
            <dd className="text-foreground">{fmtDate(createdAt)}</dd>
          </div>
        </div>

        {/* Último acceso */}
        <div className="flex items-start gap-2.5">
          <Clock size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
          <div>
            <dt className="text-[11px] text-muted-foreground">Último acceso</dt>
            <dd className="text-foreground">{fmtDateTime(lastLoginAt)}</dd>
          </div>
        </div>
      </dl>

      {/* Roles */}
      {roleCodes.length > 0 && (
        <div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-2">
            <Shield size={11} /> Roles
          </p>
          <div className="flex flex-wrap gap-1.5">
            {roleCodes.map((code) => {
              const cls = ROLE_COLORS[code] ?? "bg-muted text-muted-foreground";
              return (
                <span
                  key={code}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full text-[11px] font-semibold px-2.5 py-0.5",
                    cls,
                  )}
                >
                  <Shield size={9} />
                  {roleLabel(code)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Sucursales */}
      {branches.length > 0 && (
        <div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-2">
            <Building2 size={11} /> Sucursales
          </p>
          <div className="flex flex-wrap gap-1.5">
            {branches.map((b) => (
              <span
                key={b.id}
                className="inline-flex items-center gap-1 text-[11px] bg-muted rounded-full px-2.5 py-0.5 text-muted-foreground"
              >
                <Building2 size={9} />
                {b.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Edit profile form ─────────────────────────────────────────────────────────

function EditProfileSection({
  defaultValues,
}: {
  defaultValues: ProfileFormData;
}) {
  const updateMut = useUpdateMyProfile();

  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } =
    useForm<ProfileFormData>({
      resolver: zodResolver(profileSchema),
      defaultValues,
    });

  const onSubmit = async (vals: ProfileFormData) => {
    const body: UpdateMyProfileDto = {
      firstName:      vals.firstName,
      lastName:       vals.lastName,
      phone:          vals.phone      || undefined,
      documentType:   vals.documentType   || undefined,
      documentNumber: vals.documentNumber || undefined,
      address:        vals.address        || undefined,
      birthDate:      vals.birthDate      || undefined,
    };
    try {
      await updateMut.mutateAsync(body);
    } catch { /* toasted */ }
  };

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-5">
      {/* Header */}
      <div>
        <h2 className="font-semibold text-foreground">Información personal</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Actualiza tus datos de perfil y documento de identidad
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Nombre y apellido */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Nombre completo
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input {...register("firstName")} placeholder="Juan" />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Apellido <span className="text-destructive">*</span></Label>
              <Input {...register("lastName")} placeholder="Pérez" />
              {errors.lastName && (
                <p className="text-xs text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Separador */}
        <div className="border-t border-dashed" />

        {/* Documento */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
            <CreditCard size={11} />
            Documento de identidad
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo de documento</Label>
              <select
                {...register("documentType")}
                className={selectCls}
              >
                {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Número de documento</Label>
              <Input
                {...register("documentNumber")}
                placeholder="12345678"
                maxLength={20}
              />
              {errors.documentNumber && (
                <p className="text-xs text-destructive">{errors.documentNumber.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Separador */}
        <div className="border-t border-dashed" />

        {/* Contacto y fecha de nacimiento */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Contacto y datos adicionales
          </p>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Teléfono */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Phone size={12} className="text-muted-foreground" />
                  Teléfono
                </Label>
                <Input {...register("phone")} placeholder="+51 999 999 999" type="tel" />
                {errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone.message}</p>
                )}
              </div>

              {/* Fecha de nacimiento */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Cake size={12} className="text-muted-foreground" />
                  Fecha de nacimiento
                </Label>
                <Input {...register("birthDate")} type="date" />
                {errors.birthDate && (
                  <p className="text-xs text-destructive">{errors.birthDate.message}</p>
                )}
              </div>
            </div>

            {/* Dirección */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <MapPin size={12} className="text-muted-foreground" />
                Dirección
              </Label>
              <Input
                {...register("address")}
                placeholder="Av. Ejemplo 123, Lima"
                maxLength={300}
              />
              {errors.address && (
                <p className="text-xs text-destructive">{errors.address.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-1">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar cambios
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Change password form ──────────────────────────────────────────────────────

function ChangePasswordSection() {
  const changeMut = useChangeMyPassword();

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const onSubmit = async (vals: PasswordFormData) => {
    const body: ChangeMyPasswordDto = {
      currentPassword: vals.currentPassword,
      newPassword:     vals.newPassword,
    };
    try {
      await changeMut.mutateAsync(body);
      reset();
    } catch { /* toasted */ }
  };

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-primary" />
          <h2 className="font-semibold text-foreground">Cambiar contraseña</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Usa una combinación de letras, números y símbolos para mayor seguridad
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Contraseña actual <span className="text-destructive">*</span></Label>
          <Input type="password" {...register("currentPassword")} placeholder="••••••••" />
          {errors.currentPassword && (
            <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Nueva contraseña <span className="text-destructive">*</span></Label>
            <Input type="password" {...register("newPassword")} placeholder="••••••••" />
            {errors.newPassword && (
              <p className="text-xs text-destructive">{errors.newPassword.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Confirmar contraseña <span className="text-destructive">*</span></Label>
            <Input type="password" {...register("confirmPassword")} placeholder="••••••••" />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-200/60 px-3 py-2 text-xs text-amber-700 flex items-start gap-2">
          <Shield size={13} className="mt-0.5 shrink-0" />
          Al cambiar la contraseña, todas las demás sesiones activas serán cerradas automáticamente.
        </div>

        <div className="flex justify-end">
          <Button type="submit" variant="destructive" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cambiar contraseña
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Active sessions ───────────────────────────────────────────────────────────

function fmtRelative(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "Ahora mismo";
  if (mins  < 60) return `Hace ${mins} min`;
  if (hours < 24) return `Hace ${hours} h`;
  return `Hace ${days} día${days !== 1 ? "s" : ""}`;
}

function deviceIcon(deviceName?: string) {
  const d = (deviceName ?? "").toLowerCase();
  if (d.includes("mobile") || d.includes("android") || d.includes("iphone")) {
    return <Smartphone size={16} className="text-muted-foreground" />;
  }
  if (d.includes("tablet") || d.includes("ipad")) {
    return <MonitorSmartphone size={16} className="text-muted-foreground" />;
  }
  return <Monitor size={16} className="text-muted-foreground" />;
}

function ActiveSessionsSection() {
  const { data: sessions = [], isLoading } = useActiveSessions();
  const revokeSession = useRevokeSession();

  const currentJti    = useMemo(() => getCurrentJti(), []);
  const otherSessions = sessions.filter((s) => s.jti !== currentJti);

  const handleRevokeAll = async () => {
    for (const s of otherSessions) {
      try { await revokeSession.mutateAsync(s.jti); } catch { /* toasted */ }
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <MonitorSmartphone size={16} className="text-primary" />
            <h2 className="font-semibold text-foreground">Sesiones activas</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dispositivos donde tienes la sesión abierta
          </p>
        </div>
        {otherSessions.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 text-xs text-destructive border-destructive/40 hover:bg-destructive/5"
            disabled={revokeSession.isPending}
            onClick={handleRevokeAll}
          >
            <LogOut size={12} className="mr-1.5" />
            Cerrar otras
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-7 w-16 rounded-md" />
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2">
          <MonitorSmartphone size={28} className="opacity-20" />
          <p className="text-sm">Sin sesiones activas</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => {
            const isCurrent = session.jti === currentJti;
            return (
              <li
                key={session.jti}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                  isCurrent
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-background",
                )}
              >
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                  isCurrent ? "bg-primary/10" : "bg-muted",
                )}>
                  {deviceIcon(session.deviceName)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">
                      {session.deviceName || "Dispositivo desconocido"}
                    </p>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary whitespace-nowrap">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                        Esta sesión
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    {session.ip && (
                      <span className="flex items-center gap-1">
                        <Wifi size={10} /> {session.ip}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock size={10} /> {fmtRelative(session.issuedAt)}
                    </span>
                  </div>
                </div>

                {!isCurrent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs"
                    disabled={revokeSession.isPending}
                    onClick={() => revokeSession.mutate(session.jti)}
                  >
                    <LogOut size={12} className="mr-1" />
                    Cerrar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        {/* Left */}
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card overflow-hidden">
            <Skeleton className="h-16 w-full" />
            <div className="px-5 pb-5 -mt-8 flex flex-col items-center gap-3">
              <Skeleton className="h-20 w-20 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-24 rounded-md" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <Skeleton className="h-3 w-36" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-2.5">
                <Skeleton className="h-3 w-3 mt-1 rounded" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-2.5 w-16" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border bg-card p-5 space-y-4">
              <Skeleton className="h-5 w-44" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-10 rounded-md" />
                <Skeleton className="h-10 rounded-md" />
              </div>
              <Skeleton className="h-10 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export function ProfilePage() {
  const { data: profile, isLoading } = useMyProfile();

  if (isLoading) return <ProfileSkeleton />;
  if (!profile)  return null;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mi perfil</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gestiona tu información personal, documento de identidad y seguridad de cuenta
        </p>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">

        {/* ── Left: Avatar + Account info ── */}
        <div className="space-y-4">
          <AvatarSection
            firstName={profile.firstName}
            lastName={profile.lastName}
            avatarUrl={profile.avatarUrl}
          />
          <AccountInfoSection
            email={profile.email}
            roles={profile.roles}
            branches={profile.branches ?? []}
            createdAt={profile.createdAt}
            lastLoginAt={profile.lastLoginAt}
            isActive={profile.isActive}
          />
        </div>

        {/* ── Right: Forms ── */}
        <div className="space-y-4">
          <EditProfileSection
            defaultValues={{
              firstName:      profile.firstName,
              lastName:       profile.lastName,
              phone:          profile.phone          ?? "",
              documentType:   profile.documentType   ?? "",
              documentNumber: profile.documentNumber ?? "",
              address:        profile.address        ?? "",
              birthDate:      toDateInputValue(profile.birthDate),
            }}
          />
          <ChangePasswordSection />
          <ActiveSessionsSection />
        </div>

      </div>
    </div>
  );
}

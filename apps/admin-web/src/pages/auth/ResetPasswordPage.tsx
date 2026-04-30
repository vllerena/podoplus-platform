import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Eye, EyeOff, Loader2, Lock, CheckCircle2,
  AlertTriangle, ArrowLeft, CalendarCheck, Users, DollarSign,
} from "lucide-react";
import { apiResetPassword } from "@/lib/auth";
import { cn } from "@/lib/utils";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
      .regex(/\d/, "Debe contener al menos un número")
      .regex(/[^A-Za-z0-9]/, "Debe contener al menos un carácter especial"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });

type FormData = z.infer<typeof schema>;

// ── Password strength ─────────────────────────────────────────────────────────

const RULES = [
  { label: "Mínimo 8 caracteres",           test: (v: string) => v.length >= 8 },
  { label: "Al menos una mayúscula",         test: (v: string) => /[A-Z]/.test(v) },
  { label: "Al menos un número",             test: (v: string) => /\d/.test(v) },
  { label: "Al menos un carácter especial",  test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

function strengthLevel(password: string): 0 | 1 | 2 | 3 {
  const passed = RULES.filter((r) => r.test(password)).length;
  if (passed <= 1) return 0;
  if (passed === 2) return 1;
  if (passed === 3) return 2;
  return 3;
}

const STRENGTH_LABELS = ["Muy débil", "Débil", "Buena", "Fuerte"];
const STRENGTH_COLORS = [
  "bg-red-500",
  "bg-orange-400",
  "bg-yellow-400",
  "bg-green-500",
];

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const level = strengthLevel(password);
  return (
    <div className="space-y-2 mt-1">
      {/* Barra de fuerza */}
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-300",
              i <= level ? STRENGTH_COLORS[level] : "bg-muted"
            )}
          />
        ))}
      </div>
      <p className={cn("text-xs font-medium", level < 2 ? "text-red-500" : level === 2 ? "text-yellow-600" : "text-green-600")}>
        {STRENGTH_LABELS[level]}
      </p>
      {/* Reglas */}
      <ul className="space-y-0.5">
        {RULES.map((r) => (
          <li key={r.label} className={cn("flex items-center gap-1.5 text-xs", r.test(password) ? "text-green-600" : "text-muted-foreground")}>
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", r.test(password) ? "bg-green-500" : "bg-muted-foreground/40")} />
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Brand panel ───────────────────────────────────────────────────────────────

const features = [
  { icon: CalendarCheck, text: "Control integral de citas y agenda" },
  { icon: Users,         text: "Gestión de pacientes y suscripciones" },
  { icon: DollarSign,    text: "Caja, ventas e inventario en tiempo real" },
];

function BrandPanel() {
  return (
    <div
      className="hidden lg:flex lg:w-[45%] relative overflow-hidden flex-col justify-between p-10"
      style={{ background: "linear-gradient(145deg, #45AEBA 0%, #2d8a95 60%, #1e6b75 100%)" }}
    >
      {/* Decorative circles */}
      <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute top-1/3 -left-24 h-64 w-64 rounded-full bg-white/[0.08] pointer-events-none" />
      <div className="absolute -bottom-16 right-10 h-56 w-56 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute bottom-32 -right-12 h-32 w-32 rounded-full bg-white/15 pointer-events-none" />

      {/* Logo */}
      <div className="relative z-10">
        <img
          src="/logo.png"
          alt="Podoplus"
          className="h-12 object-contain brightness-0 invert"
          onError={(e) => {
            const el = e.target as HTMLImageElement;
            el.style.display = "none";
            (el.nextElementSibling as HTMLElement)?.removeAttribute("hidden");
          }}
        />
        <div hidden className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
            <span className="text-white font-bold text-xl">P</span>
          </div>
          <div>
            <p className="text-white font-bold text-xl leading-tight">PODOPLUS</p>
            <p className="text-white/70 text-xs tracking-widest">CENTRO PODOLÓGICO</p>
          </div>
        </div>
      </div>

      {/* Tagline */}
      <div className="relative z-10 space-y-6">
        <div>
          <h2 className="text-white text-3xl font-bold leading-tight">
            Gestión inteligente<br />para tu centro
          </h2>
          <p className="text-white/75 mt-3 text-sm leading-relaxed">
            Administra citas, pacientes, inventario y mucho más desde un solo lugar.
          </p>
        </div>
        <ul className="space-y-3">
          {features.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <Icon size={16} className="text-white" />
              </div>
              <span className="text-white/85 text-sm">{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Countdown redirect ────────────────────────────────────────────────────────

function CountdownRedirect({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) { onDone(); return; }
    const t = setTimeout(() => setRemaining((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onDone]);

  return (
    <span className="text-muted-foreground text-sm">
      Redirigiendo al inicio de sesión en{" "}
      <span className="font-semibold text-primary">{remaining}s</span>…
    </span>
  );
}

// ── Vista: éxito ──────────────────────────────────────────────────────────────

function SuccessView({ onGoLogin }: { onGoLogin: () => void }) {
  return (
    <div className="flex flex-col items-center text-center space-y-5">
      <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground">¡Contraseña actualizada!</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Tu contraseña ha sido cambiada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.
        </p>
      </div>
      <CountdownRedirect seconds={4} onDone={onGoLogin} />
      <button
        onClick={onGoLogin}
        className="text-sm text-primary font-medium hover:underline underline-offset-4"
      >
        Ir al inicio de sesión ahora
      </button>
    </div>
  );
}

// ── Vista: token inválido ─────────────────────────────────────────────────────

function InvalidTokenView({ onGoLogin }: { onGoLogin: () => void }) {
  return (
    <div className="flex flex-col items-center text-center space-y-5">
      <div className="h-16 w-16 rounded-full bg-amber-50 flex items-center justify-center">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground">Enlace inválido o expirado</h2>
        <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
          Este enlace de recuperación ya fue utilizado o ha expirado. Por seguridad, los enlaces solo son válidos por 30 minutos.
        </p>
      </div>
      <button
        onClick={onGoLogin}
        className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline underline-offset-4"
      >
        <ArrowLeft size={14} />
        Solicitar un nuevo enlace
      </button>
    </div>
  );
}

// ── Vista: formulario ─────────────────────────────────────────────────────────

function ResetForm({
  token,
  onSuccess,
  onInvalidToken,
}: {
  token:          string;
  onSuccess:      () => void;
  onInvalidToken: () => void;
}) {
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const passwordValue = watch("password") ?? "";

  const onSubmit = async ({ password }: FormData) => {
    setServerError(null);
    try {
      await apiResetPassword(token, password);
      onSuccess();
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (
        msg.toLowerCase().includes("expirado") ||
        msg.toLowerCase().includes("inválido") ||
        msg.toLowerCase().includes("invalid") ||
        msg.toLowerCase().includes("expired") ||
        msg.toLowerCase().includes("not found")
      ) {
        onInvalidToken();
      } else {
        setServerError(msg || "No se pudo actualizar la contraseña. Intenta de nuevo.");
      }
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Encabezado */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Nueva contraseña</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Crea una contraseña segura para tu cuenta. No la compartas con nadie.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Error de servidor */}
        {serverError && (
          <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        {/* Nueva contraseña */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Nueva contraseña</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type={showPass ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              {...register("password")}
              className={cn(
                "w-full rounded-xl border bg-background pl-10 pr-10 py-2.5 text-sm outline-none transition-all",
                "focus:ring-2 focus:ring-primary/25 focus:border-primary",
                errors.password ? "border-red-400 focus:ring-red-200" : "border-input"
              )}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {/* Indicador de fortaleza */}
          <PasswordStrength password={passwordValue} />
          {errors.password && !passwordValue && (
            <p className="text-xs text-red-500">{errors.password.message}</p>
          )}
        </div>

        {/* Confirmar contraseña */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Confirmar contraseña</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              {...register("confirm")}
              className={cn(
                "w-full rounded-xl border bg-background pl-10 pr-10 py-2.5 text-sm outline-none transition-all",
                "focus:ring-2 focus:ring-primary/25 focus:border-primary",
                errors.confirm ? "border-red-400 focus:ring-red-200" : "border-input"
              )}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.confirm && (
            <p className="text-xs text-red-500">{errors.confirm.message}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all",
            "bg-primary hover:bg-[#2d8a95] shadow-md shadow-primary/25 active:scale-[0.98]",
            "disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
          )}
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? "Actualizando…" : "Establecer nueva contraseña"}
        </button>
      </form>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

type ViewState = "form" | "success" | "invalid-token";

export function ResetPasswordPage() {
  const navigate      = useNavigate();
  const [params]      = useSearchParams();
  const token         = params.get("token") ?? "";
  const [view, setView] = useState<ViewState>(token ? "form" : "invalid-token");

  const goLogin = () => navigate("/login", { replace: true });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Panel izquierdo — branding */}
      <BrandPanel />

      {/* Panel derecho — formulario */}
      <div className="flex flex-1 flex-col">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 px-6 pt-6 pb-2">
          <img
            src="/logo-icon.png"
            alt="Podoplus"
            className="h-8 w-8 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <span className="text-base font-bold text-foreground">PODOPLUS</span>
        </div>

        {/* Contenido centrado */}
        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-[400px]">
            {view === "form" && (
              <ResetForm
                token={token}
                onSuccess={() => setView("success")}
                onInvalidToken={() => setView("invalid-token")}
              />
            )}
            {view === "success" && (
              <SuccessView onGoLogin={goLogin} />
            )}
            {view === "invalid-token" && (
              <InvalidTokenView onGoLogin={goLogin} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Podoplus — Todos los derechos reservados
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Eye, EyeOff, Loader2, Lock, Mail, AlertTriangle,
  CheckCircle2, ArrowLeft, CalendarCheck, Users, DollarSign,
} from "lucide-react";
import { apiLogin, apiForgotPassword, type AuthError } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";

// ── Schemas ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email:    z.string().email("Ingresa un correo válido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

const forgotSchema = z.object({
  email: z.string().email("Ingresa un correo válido"),
});

type LoginForm  = z.infer<typeof loginSchema>;
type ForgotForm = z.infer<typeof forgotSchema>;

// ── Tipos internos ────────────────────────────────────────────────────────────

type View = "login" | "forgot" | "forgot-sent";

// ── Left brand panel ──────────────────────────────────────────────────────────

const features = [
  { icon: CalendarCheck, text: "Control integral de citas y agenda" },
  { icon: Users,         text: "Gestión de pacientes y suscripciones" },
  { icon: DollarSign,    text: "Caja, ventas e inventario en tiempo real" },
];

function BrandPanel() {
  return (
    <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden flex-col justify-between p-10"
      style={{ background: "linear-gradient(145deg, #45AEBA 0%, #2d8a95 60%, #1e6b75 100%)" }}
    >
      {/* Decorative circles */}
      <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute top-1/3 -left-24 h-64 w-64 rounded-full bg-white/8 pointer-events-none" />
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
            el.nextElementSibling?.removeAttribute("hidden");
          }}
        />
        <div hidden className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
            <span className="text-xl font-black text-white">P</span>
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-tight tracking-tight">PODOPLUS</p>
            <p className="text-white/70 text-xs tracking-widest uppercase">Centro Podológico</p>
          </div>
        </div>
      </div>

      {/* Center content */}
      <div className="relative z-10 space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-white leading-snug">
            Gestión integral para tu centro podológico
          </h2>
          <p className="text-white/70 mt-3 text-base leading-relaxed">
            Todo lo que necesitas en una sola plataforma — desde citas hasta cierre de caja.
          </p>
        </div>

        {/* Feature list */}
        <ul className="space-y-3">
          {features.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                <Icon size={15} className="text-white" />
              </div>
              <span className="text-white/90 text-sm font-medium">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <p className="relative z-10 text-white/40 text-xs">
        © {new Date().getFullYear()} Podoplus · Sistema de gestión
      </p>
    </div>
  );
}

// ── Lockout countdown ─────────────────────────────────────────────────────────

function LockoutBanner({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3.5 flex gap-3">
      <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
        <Lock size={15} className="text-amber-600" />
      </div>
      <div>
        <p className="text-sm font-semibold text-amber-800">Cuenta bloqueada temporalmente</p>
        <p className="text-xs text-amber-700 mt-0.5">
          {remaining > 0
            ? <>Podrás intentarlo de nuevo en <span className="font-bold tabular-nums">{mins}:{String(secs).padStart(2, "0")}</span> minutos.</>
            : "Ya puedes intentar iniciar sesión nuevamente."
          }
        </p>
      </div>
    </div>
  );
}

// ── Error banner genérico ──────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex gap-2.5 items-start">
      <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
      <p className="text-sm text-red-700 font-medium">{message}</p>
    </div>
  );
}

// ── Formulario de login ───────────────────────────────────────────────────────

function LoginForm({ onForgot }: { onForgot: () => void }) {
  const navigate  = useNavigate();
  const setAuth   = useAuthStore((s) => s.setAuth);
  const [showPass, setShowPass]   = useState(false);
  const [authErr,  setAuthErr]    = useState<AuthError | null>(null);
  const [attempts, setAttempts]   = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setAuthErr(null);
    try {
      const result = await apiLogin(data.email, data.password, "Web Admin");

      // El backend embebe usuario completo (roles + permisos + sucursales)
      setAuth(
        {
          id:          result.user.id,
          email:       result.user.email,
          firstName:   result.user.firstName,
          lastName:    result.user.lastName,
          roles:       result.user.roles,
          permissions: result.user.permissions ?? [],
          branches:    result.user.branches    ?? [],
        },
        result.accessToken,
        result.refreshToken,
      );

      navigate("/", { replace: true });
    } catch (err) {
      const authError = err as AuthError;
      setAuthErr(authError);
      setAttempts((n) => n + 1);
    }
  };

  const remainingAttempts = 5 - attempts;
  const showAttemptsWarn  = attempts > 0 && authErr?.kind === "invalid_credentials" && remainingAttempts > 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* Lockout */}
      {authErr?.kind === "account_locked" && (
        <LockoutBanner seconds={authErr.lockSeconds ?? 900} />
      )}

      {/* Error genérico */}
      {authErr && authErr.kind !== "account_locked" && (
        <ErrorBanner message={authErr.message} />
      )}

      {/* Aviso de intentos restantes */}
      {showAttemptsWarn && remainingAttempts <= 3 && (
        <div className="rounded-xl bg-orange-50 border border-orange-200 px-4 py-2.5">
          <p className="text-xs text-orange-700 font-medium">
            {remainingAttempts === 1
              ? "⚠️ Último intento. Después tu cuenta será bloqueada por 15 minutos."
              : `⚠️ ${remainingAttempts} intentos restantes antes del bloqueo temporal.`}
          </p>
        </div>
      )}

      {/* Email */}
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-semibold text-foreground">
          Correo electrónico
        </label>
        <div className="relative">
          <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="correo@podoplus.pe"
            disabled={authErr?.kind === "account_locked"}
            className={cn(
              "w-full pl-9 pr-3.5 py-2.5 rounded-xl border text-sm bg-white transition-all",
              "placeholder:text-muted-foreground/50 disabled:opacity-50 disabled:cursor-not-allowed",
              "focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary",
              errors.email ? "border-red-400 ring-1 ring-red-200" : "border-input hover:border-primary/40"
            )}
            {...register("email")}
          />
        </div>
        {errors.email && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <span>·</span> {errors.email.message}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-semibold text-foreground">
            Contraseña
          </label>
          <button
            type="button"
            onClick={onForgot}
            className="text-xs text-primary hover:text-[#2d8a95] font-medium transition-colors underline-offset-2 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
        <div className="relative">
          <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            id="password"
            type={showPass ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            disabled={authErr?.kind === "account_locked"}
            className={cn(
              "w-full pl-9 pr-11 py-2.5 rounded-xl border text-sm bg-white transition-all",
              "placeholder:text-muted-foreground/50 disabled:opacity-50 disabled:cursor-not-allowed",
              "focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary",
              errors.password ? "border-red-400 ring-1 ring-red-200" : "border-input hover:border-primary/40"
            )}
            {...register("password")}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPass((v) => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-500">· {errors.password.message}</p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting || authErr?.kind === "account_locked"}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl",
          "bg-primary text-white text-sm font-semibold",
          "shadow-md shadow-primary/25",
          "hover:bg-[#2d8a95] active:scale-[0.98]",
          "disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none",
          "transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2"
        )}
      >
        {isSubmitting && <Loader2 size={15} className="animate-spin" />}
        {isSubmitting ? "Verificando…" : "Ingresar al sistema"}
      </button>
    </form>
  );
}

// ── Formulario de recuperación ────────────────────────────────────────────────

function ForgotForm({ onBack, onSent }: { onBack: () => void; onSent: (email: string) => void }) {
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async (data: ForgotForm) => {
    setApiError(null);
    try {
      await apiForgotPassword(data.email);
      onSent(data.email);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Error inesperado. Inténtalo de nuevo.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {apiError && <ErrorBanner message={apiError} />}

      <div className="space-y-1.5">
        <label htmlFor="forgot-email" className="text-sm font-semibold text-foreground">
          Correo electrónico
        </label>
        <div className="relative">
          <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            placeholder="correo@podoplus.pe"
            className={cn(
              "w-full pl-9 pr-3.5 py-2.5 rounded-xl border text-sm bg-white transition-all",
              "placeholder:text-muted-foreground/50",
              "focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary",
              errors.email ? "border-red-400 ring-1 ring-red-200" : "border-input hover:border-primary/40"
            )}
            {...register("email")}
          />
        </div>
        {errors.email && <p className="text-xs text-red-500">· {errors.email.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl",
          "bg-primary text-white text-sm font-semibold",
          "shadow-md shadow-primary/25 hover:bg-[#2d8a95] active:scale-[0.98]",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2"
        )}
      >
        {isSubmitting && <Loader2 size={15} className="animate-spin" />}
        {isSubmitting ? "Enviando…" : "Enviar instrucciones"}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto"
      >
        <ArrowLeft size={14} />
        Volver al inicio de sesión
      </button>
    </form>
  );
}

// ── Vista de éxito de recuperación ───────────────────────────────────────────

function ForgotSentView({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <div className="text-center space-y-5">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-green-50 flex items-center justify-center">
        <CheckCircle2 size={32} className="text-green-500" />
      </div>
      <div>
        <h3 className="font-bold text-foreground text-lg">Revisa tu correo</h3>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Si el correo <span className="font-semibold text-foreground">{email}</span> está registrado,
          recibirás las instrucciones para restablecer tu contraseña en los próximos minutos.
        </p>
        <p className="text-xs text-muted-foreground mt-3">
          ¿No llegó? Revisa tu carpeta de spam.
        </p>
      </div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-primary hover:text-[#2d8a95] font-medium transition-colors mx-auto"
      >
        <ArrowLeft size={14} />
        Volver al inicio de sesión
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const VIEW_TITLE: Record<View, { heading: string; sub: string }> = {
  "login":       { heading: "Bienvenido de nuevo",       sub: "Ingresa tus credenciales para acceder al panel" },
  "forgot":      { heading: "Recuperar contraseña",      sub: "Te enviaremos las instrucciones a tu correo" },
  "forgot-sent": { heading: "",                           sub: "" },
};

export function LoginPage() {
  const [view,       setView]       = useState<View>("login");
  const [sentEmail,  setSentEmail]  = useState("");

  const { heading, sub } = VIEW_TITLE[view];

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Left brand panel (desktop) ── */}
      <BrandPanel />

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 sm:px-10 lg:px-16 bg-white">
        <div className="w-full max-w-[400px] animate-fade-in space-y-8">

          {/* Mobile logo — oculto en desktop donde está el panel izquierdo */}
          <div className="flex justify-center lg:hidden">
            <img
              src="/logo.png"
              alt="Podoplus"
              className="h-12 object-contain"
              onError={(e) => {
                const el = e.target as HTMLImageElement;
                el.style.display = "none";
                el.nextElementSibling?.removeAttribute("hidden");
              }}
            />
            <div hidden className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
                <span className="text-lg font-black text-white">P</span>
              </div>
              <div>
                <p className="text-base font-bold text-foreground leading-tight">PODOPLUS</p>
                <p className="text-[10px] text-muted-foreground tracking-widest uppercase">Centro Podológico</p>
              </div>
            </div>
          </div>

          {/* Heading */}
          {view !== "forgot-sent" && (
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">{heading}</h1>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{sub}</p>
            </div>
          )}

          {/* Form content */}
          {view === "login" && (
            <LoginForm onForgot={() => setView("forgot")} />
          )}
          {view === "forgot" && (
            <ForgotForm
              onBack={() => setView("login")}
              onSent={(email) => { setSentEmail(email); setView("forgot-sent"); }}
            />
          )}
          {view === "forgot-sent" && (
            <ForgotSentView email={sentEmail} onBack={() => setView("login")} />
          )}

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground/60 lg:hidden">
            © {new Date().getFullYear()} Podoplus · Sistema de gestión
          </p>
        </div>
      </div>
    </div>
  );
}

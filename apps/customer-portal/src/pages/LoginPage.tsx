import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/lib/auth-store";

// ── Logo component ────────────────────────────────────────────────────────────

function PodoplusLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-16 w-16 text-2xl" : size === "md" ? "h-12 w-12 text-xl" : "h-8 w-8 text-sm";
  const wordmark = size === "lg" ? "text-2xl" : size === "md" ? "text-xl" : "text-base";
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`${dims} rounded-2xl bg-brand-gradient flex items-center justify-center shadow-lg`}>
        <span className="font-black text-white tracking-tight">P+</span>
      </div>
      <div className="text-center">
        <p className={`font-black text-slate-900 tracking-tight ${wordmark}`}>podoplus</p>
        <p className="text-xs text-slate-500 tracking-wide uppercase mt-0.5">Centro Podológico</p>
      </div>
    </div>
  );
}

// ── Phone input (Peru +51) ────────────────────────────────────────────────────

function PhoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center border-2 border-slate-200 rounded-xl overflow-hidden
                    focus-within:border-brand-500 transition-colors bg-white">
      <div className="flex items-center gap-1.5 pl-4 pr-3 shrink-0 border-r border-slate-200 py-3.5">
        <span className="text-base">🇵🇪</span>
        <span className="text-sm font-semibold text-slate-600">+51</span>
      </div>
      <input
        type="tel"
        inputMode="numeric"
        maxLength={9}
        placeholder="987 654 321"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 9))}
        className="flex-1 px-4 py-3.5 text-base font-medium text-slate-900 bg-transparent
                   outline-none placeholder:text-slate-400 tracking-widest"
      />
    </div>
  );
}

// ── Login tab ─────────────────────────────────────────────────────────────────

function LoginTab() {
  const [phone,   setPhone]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const navigate  = useNavigate();
  const login     = useAuthStore((s) => s.login);

  const handleContinue = () => {
    if (phone.length < 9) { setError("Ingresa un número válido de 9 dígitos"); return; }
    setError("");
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      login(phone);
      navigate("/", { replace: true });
    }, 900);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700">
          Número de celular
        </label>
        <PhoneInput value={phone} onChange={setPhone} />
        {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
      </div>

      <button
        onClick={handleContinue}
        disabled={loading}
        className="w-full py-3.5 rounded-xl bg-brand-gradient text-white font-bold text-base
                   shadow-lg shadow-violet-400/40 active:scale-[0.98] transition-all
                   disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
              <path className="opacity-75" fill="white"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Verificando...
          </>
        ) : (
          <>Continuar <span>→</span></>
        )}
      </button>

      {/* Demo hint */}
      <div className="flex items-start gap-2.5 p-3 bg-brand-50 rounded-xl border border-brand-100">
        <span className="text-base shrink-0 mt-0.5">✨</span>
        <div>
          <p className="text-xs font-semibold text-brand-700">Modo Demo</p>
          <p className="text-xs text-brand-600 mt-0.5">
            Ingresa cualquier número de 9 dígitos para acceder como paciente de demo.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Register tab ──────────────────────────────────────────────────────────────

function RegisterTab() {
  const [form, setForm] = useState({
    firstName: "",
    lastName:  "",
    phone:     "",
    dni:       "",
  });
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const navigate  = useNavigate();
  const register  = useAuthStore((s) => s.register);

  const set = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = "Ingresa tu nombre";
    if (!form.lastName.trim())  e.lastName  = "Ingresa tu apellido";
    if (form.phone.length < 9)  e.phone     = "Número de 9 dígitos";
    return e;
  };

  const handleCreate = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    setTimeout(() => {
      register(form);
      navigate("/", { replace: true });
    }, 1000);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600">Nombres *</label>
          <input
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            placeholder="María"
            className={`w-full px-3.5 py-3 rounded-xl border-2 text-sm font-medium bg-white outline-none
                        focus:border-brand-500 transition-colors text-slate-900 placeholder:text-slate-400
                        ${errors.firstName ? "border-red-400" : "border-slate-200"}`}
          />
          {errors.firstName && <p className="text-[11px] text-red-500">{errors.firstName}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600">Apellidos *</label>
          <input
            value={form.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            placeholder="Quispe"
            className={`w-full px-3.5 py-3 rounded-xl border-2 text-sm font-medium bg-white outline-none
                        focus:border-brand-500 transition-colors text-slate-900 placeholder:text-slate-400
                        ${errors.lastName ? "border-red-400" : "border-slate-200"}`}
          />
          {errors.lastName && <p className="text-[11px] text-red-500">{errors.lastName}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-600">Celular *</label>
        <PhoneInput value={form.phone} onChange={(v) => set("phone", v)} />
        {errors.phone && <p className="text-[11px] text-red-500">{errors.phone}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-600">
          DNI <span className="text-slate-400 font-normal">(opcional)</span>
        </label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={8}
          value={form.dni}
          onChange={(e) => set("dni", e.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="12345678"
          className="w-full px-3.5 py-3 rounded-xl border-2 border-slate-200 text-sm font-medium bg-white
                     outline-none focus:border-brand-500 transition-colors text-slate-900 placeholder:text-slate-400"
        />
      </div>

      <button
        onClick={handleCreate}
        disabled={loading}
        className="w-full py-3.5 rounded-xl bg-brand-gradient text-white font-bold text-base
                   shadow-lg shadow-violet-400/40 active:scale-[0.98] transition-all
                   disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
              <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Creando cuenta...
          </>
        ) : "Crear cuenta"}
      </button>

      <p className="text-[11px] text-center text-slate-400">
        Al continuar aceptas los{" "}
        <span className="text-brand-600 font-semibold underline">Términos de uso</span>
        {" "}y la{" "}
        <span className="text-brand-600 font-semibold underline">Política de privacidad</span>
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function LoginPage() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const navigate   = useNavigate();

  // Already logged in → redirect
  if (isLoggedIn) { navigate("/", { replace: true }); return null; }

  return (
    <div className="flex flex-col min-h-full bg-white">

      {/* ── Top hero section ── */}
      <div className="relative flex-none bg-brand-gradient px-6 pt-14 pb-10 overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute top-8 right-16 h-16 w-16 rounded-full bg-white/5" />

        {/* Logo */}
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center
                          border border-white/30 shadow-lg">
            <span className="font-black text-white text-2xl">P+</span>
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-black text-white tracking-tight">podoplus</h1>
            <p className="text-white/70 text-sm mt-1 tracking-wide">Centro Podológico</p>
          </div>
        </div>

        {/* Tagline */}
        <p className="text-center text-white/80 text-sm mt-6 relative z-10 leading-relaxed">
          Agenda tu cita, gestiona tus visitas y<br />cuida tus pies con un solo toque 🦶
        </p>
      </div>

      {/* ── Form card ── */}
      <div className="flex-1 px-5 py-6 space-y-5">

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-slate-100 p-1">
          {(["login", "register"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === t
                  ? "bg-white text-brand-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "login" ? "Iniciar sesión" : "Registrarse"}
            </button>
          ))}
        </div>

        {/* Subheading */}
        <div>
          {tab === "login" ? (
            <>
              <h2 className="text-xl font-bold text-slate-900">Bienvenido de nuevo</h2>
              <p className="text-sm text-slate-500 mt-1">Ingresa tu celular para continuar</p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-slate-900">Crea tu cuenta</h2>
              <p className="text-sm text-slate-500 mt-1">Es rápido y gratuito</p>
            </>
          )}
        </div>

        {/* Form content */}
        {tab === "login" ? <LoginTab /> : <RegisterTab />}
      </div>

      {/* ── Footer ── */}
      <div className="px-5 pb-8 pt-2 text-center">
        <p className="text-[11px] text-slate-400">
          ¿Tienes problemas para acceder?{" "}
          <span className="text-brand-600 font-semibold">Llámanos al (01) 234-5678</span>
        </p>
      </div>
    </div>
  );
}

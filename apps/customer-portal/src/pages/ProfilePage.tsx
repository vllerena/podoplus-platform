import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore }  from "@/lib/auth-store";
import { DEMO_ACTIVE_PLAN, DEMO_APPOINTMENTS } from "@/lib/demo-data";

// ── Helpers ───────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 py-3.5">
      <div className="h-9 w-9 rounded-xl bg-brand-50 flex items-center justify-center text-base shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

// ── Edit Profile Modal ────────────────────────────────────────────────────────

function EditProfileModal({
  patient,
  onSave,
  onClose,
}: {
  patient: ReturnType<typeof useAuthStore.getState>["patient"];
  onSave:  (data: { email: string; address: string }) => void;
  onClose: () => void;
}) {
  const [email,   setEmail]   = useState(patient?.email   ?? "");
  const [address, setAddress] = useState(patient?.address ?? "");
  const [saving,  setSaving]  = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      onSave({ email, address });
      setSaving(false);
      onClose();
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Sheet */}
      <div
        className="relative w-full bg-white rounded-t-3xl px-5 pt-5 pb-10 space-y-5
                   animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 h-1 w-10 bg-slate-200 rounded-full" />

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Editar perfil</h3>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100
                       text-slate-500 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Nombre completo</label>
            <input
              value={patient?.fullName ?? ""}
              disabled
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50
                         text-sm font-medium text-slate-400"
            />
            <p className="text-[11px] text-slate-400">
              Para cambiar tu nombre, visita tu sede más cercana
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-white
                         text-sm font-medium text-slate-900 outline-none
                         focus:border-brand-500 transition-colors placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Dirección</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Av. Ejemplo 123, Lima"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-white
                         text-sm font-medium text-slate-900 outline-none
                         focus:border-brand-500 transition-colors placeholder:text-slate-400"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-brand-gradient text-white font-bold text-base
                     shadow-lg shadow-violet-400/40 active:scale-[0.98] transition-all
                     disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Guardando...
            </>
          ) : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ProfilePage() {
  const navigate      = useNavigate();
  const patient       = useAuthStore((s) => s.patient);
  const logout        = useAuthStore((s) => s.logout);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [editOpen,       setEditOpen]       = useState(false);
  const [logoutConfirm,  setLogoutConfirm]  = useState(false);

  if (!patient) { navigate("/login", { replace: true }); return null; }

  const completedAppts = DEMO_APPOINTMENTS.filter((a) => a.status === "completed").length;
  const plan           = DEMO_ACTIVE_PLAN;

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="pb-6">

      {/* ── Header / Avatar section ── */}
      <div className="relative bg-brand-gradient px-5 pt-12 pb-16 overflow-hidden">
        {/* Decorative */}
        <div className="absolute -top-8 -right-8 h-36 w-36 rounded-full bg-white/5" />
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-slate-50 rounded-t-3xl" />

        {/* Avatar */}
        <div className="flex flex-col items-center gap-3 relative z-10">
          <div className="h-20 w-20 rounded-full bg-white/20 backdrop-blur border-4 border-white/40
                          flex items-center justify-center shadow-xl">
            <span className="text-2xl font-black text-white tracking-tight">
              {patient.initials}
            </span>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-black text-white">{patient.fullName}</h1>
            <p className="text-white/70 text-sm mt-0.5">
              Paciente desde {patient.joinedAt}
            </p>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="mx-4 -mt-1 grid grid-cols-3 gap-2 relative z-10">
        {[
          { value: String(completedAppts), label: "Citas\nrealizadas", emoji: "📅" },
          { value: plan.sessionsLeft + " left", label: "Sesiones\ndisponibles", emoji: "💊" },
          { value: plan.name.split(" ")[1], label: "Plan\nactivo", emoji: "⭐" },
        ].map((stat) => (
          <div key={stat.label}
               className="bg-white rounded-2xl shadow-card p-3 flex flex-col items-center text-center gap-1">
            <span className="text-lg">{stat.emoji}</span>
            <p className="text-base font-black text-slate-900 leading-tight">{stat.value}</p>
            <p className="text-[10px] text-slate-400 font-medium leading-tight whitespace-pre-line">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Plan banner ── */}
      <div className="mx-4 mt-4 rounded-2xl bg-brand-gradient p-4 flex items-center gap-4">
        <div className="h-11 w-11 rounded-xl bg-white/20 flex items-center justify-center text-xl shrink-0">
          💳
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm">{plan.name}</p>
          <div className="mt-1.5">
            <div className="flex items-center justify-between text-white/70 text-[11px] mb-1">
              <span>{plan.sessionsUsed} sesiones usadas</span>
              <span>{plan.sessionsLeft} restantes</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${(plan.sessionsUsed / plan.sessions) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-white text-[10px]">Vence</p>
          <p className="text-white font-bold text-xs">1 ago.</p>
        </div>
      </div>

      {/* ── Personal info ── */}
      <div className="mx-4 mt-4 bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="px-4 pt-4 pb-1">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Información personal
          </h2>
        </div>
        <div className="px-4 divide-y divide-slate-100">
          <InfoRow icon="📱" label="Celular"           value={patient.phone} />
          <InfoRow icon="🪪" label="DNI"               value={patient.dni} />
          <InfoRow icon="📧" label="Correo"            value={patient.email} />
          <InfoRow icon="🎂" label="Fecha de nacimiento" value={patient.birthLabel ?? ""} />
          <InfoRow icon="📍" label="Dirección"         value={patient.address} />
        </div>

        {/* Edit button */}
        <div className="px-4 py-3 border-t border-slate-100">
          <button
            onClick={() => setEditOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                       bg-brand-50 text-brand-700 font-semibold text-sm
                       hover:bg-brand-100 active:scale-[0.98] transition-all"
          >
            ✏️ Editar perfil
          </button>
        </div>
      </div>

      {/* ── Medical info ── */}
      <div className="mx-4 mt-4 bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="px-4 pt-4 pb-1">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Datos médicos
          </h2>
        </div>
        <div className="px-4 divide-y divide-slate-100">
          <InfoRow icon="🩸" label="Grupo sanguíneo" value="O+" />
          <InfoRow icon="⚕️" label="Alergias"        value="Ninguna registrada" />
          <InfoRow icon="💊" label="Medicamentos"    value="Ninguno registrado" />
        </div>
        <div className="px-4 py-3 border-t border-slate-100">
          <p className="text-[11px] text-slate-400 text-center">
            Para actualizar datos médicos, consulta con tu especialista
          </p>
        </div>
      </div>

      {/* ── Account section ── */}
      <div className="mx-4 mt-4 bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="px-4 pt-4 pb-1">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cuenta</h2>
        </div>
        <div className="px-4 pb-3 space-y-2 pt-2">
          {/* Notifications */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <span className="text-lg">🔔</span>
              <span className="text-sm font-semibold text-slate-700">Notificaciones WhatsApp</span>
            </div>
            {/* Toggle */}
            <button className="relative w-12 h-6 rounded-full bg-brand-600 transition-colors">
              <span className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm" />
            </button>
          </div>

          {/* Recordatorios */}
          <div className="flex items-center justify-between py-2 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <span className="text-lg">⏰</span>
              <span className="text-sm font-semibold text-slate-700">Recordatorio de citas</span>
            </div>
            <button className="relative w-12 h-6 rounded-full bg-brand-600 transition-colors">
              <span className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Logout ── */}
      <div className="mx-4 mt-4">
        {logoutConfirm ? (
          <div className="bg-red-50 rounded-2xl p-4 space-y-3 border border-red-100">
            <p className="text-sm font-semibold text-red-800 text-center">
              ¿Seguro que quieres cerrar sesión?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold shadow-sm"
              >
                Sí, salir
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl
                       border-2 border-red-100 text-red-600 font-semibold text-sm bg-red-50
                       hover:bg-red-100 active:scale-[0.98] transition-all"
          >
            🚪 Cerrar sesión
          </button>
        )}
      </div>

      {/* ── App version ── */}
      <p className="text-center text-[11px] text-slate-300 mt-6">
        Podoplus Portal v1.0 · © 2026
      </p>

      {/* ── Edit modal ── */}
      {editOpen && (
        <EditProfileModal
          patient={patient}
          onSave={(data) => updateProfile(data)}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}

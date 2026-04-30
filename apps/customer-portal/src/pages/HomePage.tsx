import { useNavigate } from "react-router-dom";
import { useAuthStore }  from "@/lib/auth-store";
import { DEMO_APPOINTMENTS, DEMO_ACTIVE_PLAN, DEMO_BRANCHES } from "@/lib/demo-data";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "¡Buenos días";
  if (h < 19) return "¡Buenas tardes";
  return "¡Buenas noches";
}

export function HomePage() {
  const navigate  = useNavigate();
  const patient   = useAuthStore((s) => s.patient);

  const upcoming  = DEMO_APPOINTMENTS.find((a) => a.isUpcoming);
  const plan      = DEMO_ACTIVE_PLAN;
  const branch    = DEMO_BRANCHES.find((b) => b.isFavorite);

  return (
    <div className="pb-6">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <div>
          <p className="text-sm text-slate-500">{greeting()},</p>
          <h1 className="text-xl font-black text-slate-900">{patient?.firstName} 👋</h1>
        </div>
        <button
          onClick={() => navigate("/perfil")}
          className="h-10 w-10 rounded-full bg-brand-gradient flex items-center justify-center
                     shadow-md text-white font-bold text-sm"
        >
          {patient?.initials}
        </button>
      </div>

      {/* ── Next appointment card ── */}
      {upcoming ? (
        <div className="mx-4 rounded-2xl bg-brand-gradient p-4 shadow-lg shadow-brand-500/20">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">
                Próxima cita
              </p>
              <h2 className="text-white font-bold text-lg mt-0.5">{upcoming.serviceName}</h2>
            </div>
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
              🦶
            </div>
          </div>

          <div className="space-y-1.5 mb-4">
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <span>📅</span>
              <span>{upcoming.dateLabel} · {upcoming.timeLabel}</span>
            </div>
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <span>📍</span>
              <span>{upcoming.branchName}</span>
            </div>
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <span>👩‍⚕️</span>
              <span>{upcoming.specialist}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => navigate("/citas")}
              className="flex-1 py-2.5 rounded-xl bg-white text-brand-700 font-bold text-sm
                         active:scale-[0.98] transition-all"
            >
              Ver detalles
            </button>
            <button
              onClick={() => navigate("/agendar")}
              className="flex-1 py-2.5 rounded-xl bg-white/20 text-white font-semibold text-sm
                         active:scale-[0.98] transition-all"
            >
              Reagendar
            </button>
          </div>
        </div>
      ) : (
        <div className="mx-4 rounded-2xl border-2 border-dashed border-brand-200 p-5 text-center">
          <p className="text-3xl mb-2">📅</p>
          <p className="text-sm font-bold text-slate-700">Sin citas programadas</p>
          <p className="text-xs text-slate-400 mt-1 mb-3">Agenda tu próxima visita podológica</p>
          <button
            onClick={() => navigate("/agendar")}
            className="px-5 py-2.5 rounded-xl bg-brand-gradient text-white font-bold text-sm shadow-md"
          >
            Agendar cita
          </button>
        </div>
      )}

      {/* ── Quick actions ── */}
      <div className="px-4 mt-5">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Acciones rápidas
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: "➕", label: "Agendar\ncita",  path: "/agendar", color: "bg-brand-50 text-brand-600" },
            { icon: "📋", label: "Mis\ncitas",     path: "/citas",   color: "bg-emerald-50 text-emerald-600" },
            { icon: "💳", label: "Mis\nplanes",    path: "/planes",  color: "bg-amber-50 text-amber-600" },
          ].map((action) => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl shadow-card
                         active:scale-[0.97] transition-all"
            >
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center text-xl ${action.color}`}>
                {action.icon}
              </div>
              <span className="text-[11px] font-semibold text-slate-600 leading-tight text-center whitespace-pre-line">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Plan widget ── */}
      <div className="mx-4 mt-5">
        <div className="bg-white rounded-2xl shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">💳</span>
              <span className="text-sm font-bold text-slate-800">{plan.name}</span>
            </div>
            <button
              onClick={() => navigate("/planes")}
              className="text-xs text-brand-600 font-semibold"
            >
              Ver planes →
            </button>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>{plan.sessionsUsed} de {plan.sessions} sesiones usadas</span>
              <span className="font-semibold text-brand-600">{plan.sessionsLeft} disponibles</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-gradient"
                style={{ width: `${(plan.sessionsUsed / plan.sessions) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400">Vence el {plan.expiresAt}</p>
          </div>
        </div>
      </div>

      {/* ── Favorite branch ── */}
      {branch && (
        <div className="mx-4 mt-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Tu sede habitual
          </h2>
          <div className="bg-white rounded-2xl shadow-card p-4 flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-brand-50 flex items-center justify-center text-xl shrink-0">
              📍
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-sm">{branch.name}</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{branch.address}</p>
              <p className="text-xs text-slate-400">{branch.hours}</p>
            </div>
            <button
              onClick={() => navigate("/agendar")}
              className="shrink-0 px-3 py-2 rounded-xl bg-brand-50 text-brand-700 text-xs font-bold"
            >
              Ir →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

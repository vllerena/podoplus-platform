import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEMO_APPOINTMENTS } from "@/lib/demo-data";

// ── Types ──────────────────────────────────────────────────────────────────────

type Appointment = (typeof DEMO_APPOINTMENTS)[number];

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  confirmed: {
    label: "Confirmada",
    bg:    "bg-emerald-50",
    text:  "text-emerald-700",
    dot:   "bg-emerald-500",
  },
  pending: {
    label: "Pendiente",
    bg:    "bg-amber-50",
    text:  "text-amber-700",
    dot:   "bg-amber-400",
  },
  completed: {
    label: "Completada",
    bg:    "bg-slate-100",
    text:  "text-slate-600",
    dot:   "bg-slate-400",
  },
  cancelled: {
    label: "Cancelada",
    bg:    "bg-red-50",
    text:  "text-red-700",
    dot:   "bg-red-400",
  },
  no_show: {
    label: "No asistió",
    bg:    "bg-orange-50",
    text:  "text-orange-700",
    dot:   "bg-orange-400",
  },
  rescheduled: {
    label: "Reprogramada",
    bg:    "bg-indigo-50",
    text:  "text-indigo-700",
    dot:   "bg-indigo-400",
  },
};

const UPCOMING_STATUSES  = new Set(["confirmed", "pending"]);
const HISTORY_STATUSES   = new Set(["completed", "cancelled", "no_show", "rescheduled"]);

// ── Appointment card ───────────────────────────────────────────────────────────

function AppointmentCard({
  appt,
  onCancel,
  onReschedule,
}: {
  appt:         Appointment;
  onCancel?:    (appt: Appointment) => void;
  onReschedule?: (appt: Appointment) => void;
}) {
  const cfg     = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.completed;
  const isUpcoming = UPCOMING_STATUSES.has(appt.status);

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden">
      {/* Color accent bar */}
      <div className="h-1 w-full" style={{ backgroundColor: appt.serviceColor }} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ backgroundColor: `${appt.serviceColor}18` }}
          >
            🦶
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-sm truncate">{appt.serviceName}</p>
            <p className="text-xs text-slate-400 mt-0.5">{appt.specialist}</p>
          </div>
          {/* Status badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${cfg.bg} ${cfg.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center gap-2 text-slate-600 text-xs">
            <span className="text-base">📅</span>
            <span>{appt.dateLabel} · {appt.timeLabel}</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400">{appt.duration} min</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600 text-xs">
            <span className="text-base">📍</span>
            <span className="truncate">{appt.branchName}</span>
          </div>
          {appt.notes ? (
            <div className="flex items-start gap-2 text-slate-500 text-xs">
              <span className="text-base mt-0.5">📝</span>
              <span className="leading-relaxed">{appt.notes}</span>
            </div>
          ) : null}
        </div>

        {/* Price tag */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-slate-400">Costo de sesión</span>
          <span className="text-sm font-bold text-slate-700">S/ {appt.price}.00</span>
        </div>

        {/* Actions — only for upcoming */}
        {isUpcoming && (
          <div className="flex gap-2 pt-1 border-t border-slate-100">
            <button
              onClick={() => onReschedule?.(appt)}
              className="flex-1 py-2 rounded-xl bg-brand-50 text-brand-700 font-semibold text-xs
                         active:scale-[0.98] transition-all"
            >
              Reagendar
            </button>
            <button
              onClick={() => onCancel?.(appt)}
              className="flex-1 py-2 rounded-xl bg-red-50 text-red-600 font-semibold text-xs
                         active:scale-[0.98] transition-all"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Cancel modal ───────────────────────────────────────────────────────────────

function CancelModal({
  appt,
  onClose,
  onConfirm,
}: {
  appt:      Appointment;
  onClose:   () => void;
  onConfirm: () => void;
}) {
  const [reason, setReason] = useState("");

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Sheet */}
      <div
        className="w-full max-w-sm bg-white rounded-t-3xl p-6 pb-10 space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />

        <div>
          <h2 className="text-base font-black text-slate-800">Cancelar cita</h2>
          <p className="text-xs text-slate-500 mt-1">
            {appt.serviceName} · {appt.dateLabel}
          </p>
        </div>

        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-xs text-red-700 leading-relaxed">
          ⚠️ Esta acción no se puede deshacer. La sesión quedará disponible para otros pacientes.
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600 block">
            Motivo de cancelación <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            placeholder="Ej: Viaje de trabajo, emergencia médica…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700
                       placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-red-300
                       focus:border-red-400 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold
                       text-slate-600 active:scale-[0.98] transition-all"
          >
            Volver
          </button>
          <button
            onClick={onConfirm}
            disabled={reason.trim().length < 3}
            className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-bold
                       disabled:opacity-40 active:scale-[0.98] transition-all"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reschedule toast ───────────────────────────────────────────────────────────

function RescheduleToast({ appt, onClose }: { appt: Appointment; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-t-3xl p-6 pb-10 space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />

        <div className="text-center">
          <div className="text-4xl mb-3">🗓️</div>
          <h2 className="text-base font-black text-slate-800">Reagendar cita</h2>
          <p className="text-xs text-slate-500 mt-1">
            {appt.serviceName} · {appt.dateLabel}
          </p>
        </div>

        <div className="rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 text-xs text-brand-700 leading-relaxed text-center">
          El reagendamiento lo puedes realizar llamando a tu sede o por WhatsApp. En la próxima versión podrás hacerlo directamente aquí.
        </div>

        <div className="space-y-2">
          <a
            href="https://wa.me/51987654321"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                       bg-emerald-500 text-white text-sm font-bold active:scale-[0.98] transition-all"
          >
            <span className="text-base">💬</span>
            Contactar por WhatsApp
          </a>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl border border-slate-200 text-sm font-semibold
                       text-slate-600 active:scale-[0.98] transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: "upcoming" | "history" }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-4">
      <div className="text-5xl">{tab === "upcoming" ? "📅" : "🗂️"}</div>
      <div>
        <p className="font-bold text-slate-700 text-sm">
          {tab === "upcoming" ? "Sin citas próximas" : "Sin historial aún"}
        </p>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          {tab === "upcoming"
            ? "No tienes citas programadas. ¡Agenda tu próxima sesión!"
            : "Aquí aparecerán tus citas completadas y canceladas."}
        </p>
      </div>
      {tab === "upcoming" && (
        <button
          onClick={() => navigate("/agendar")}
          className="px-6 py-3 rounded-xl bg-brand-gradient text-white font-bold text-sm shadow-md
                     active:scale-[0.98] transition-all"
        >
          Agendar cita
        </button>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

type Tab = "upcoming" | "history";

export function AppointmentsPage() {
  const navigate                         = useNavigate();
  const [tab, setTab]                   = useState<Tab>("upcoming");
  const [cancelAppt,  setCancelAppt]    = useState<Appointment | null>(null);
  const [reschedAppt, setReschedAppt]   = useState<Appointment | null>(null);
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());

  // Split appointments
  const upcomingAppts = DEMO_APPOINTMENTS
    .filter((a) => UPCOMING_STATUSES.has(a.status) && !cancelledIds.has(a.id));
  const historyAppts  = DEMO_APPOINTMENTS
    .filter((a) => HISTORY_STATUSES.has(a.status) || cancelledIds.has(a.id));

  const handleConfirmCancel = () => {
    if (!cancelAppt) return;
    setCancelledIds((prev) => new Set([...prev, cancelAppt.id]));
    setCancelAppt(null);
  };

  const displayList = tab === "upcoming" ? upcomingAppts : historyAppts;

  return (
    <div className="pb-6">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <h1 className="text-xl font-black text-slate-900">Mis citas</h1>
        <button
          onClick={() => navigate("/agendar")}
          className="h-9 px-4 rounded-xl bg-brand-gradient text-white font-bold text-xs
                     shadow-md active:scale-[0.98] transition-all"
        >
          + Agendar
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="mx-4 mb-4 flex gap-1 bg-slate-100 p-1 rounded-2xl">
        {(["upcoming", "history"] as Tab[]).map((t) => {
          const labels: Record<Tab, string> = {
            upcoming: `Próximas${upcomingAppts.length > 0 ? ` (${upcomingAppts.length})` : ""}`,
            history:  "Historial",
          };
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                tab === t
                  ? "bg-white text-brand-700 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              {labels[t]}
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div className="px-4 space-y-3">
        {displayList.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          displayList.map((appt) => {
            const isEffectivelyCancelled = cancelledIds.has(appt.id);
            const effectiveAppt = isEffectivelyCancelled
              ? { ...appt, status: "cancelled", statusLabel: "Cancelada" }
              : appt;
            return (
              <AppointmentCard
                key={appt.id}
                appt={effectiveAppt as Appointment}
                onCancel={() => setCancelAppt(appt)}
                onReschedule={() => setReschedAppt(appt)}
              />
            );
          })
        )}
      </div>

      {/* ── Modals ── */}
      {cancelAppt && (
        <CancelModal
          appt={cancelAppt}
          onClose={() => setCancelAppt(null)}
          onConfirm={handleConfirmCancel}
        />
      )}
      {reschedAppt && (
        <RescheduleToast
          appt={reschedAppt}
          onClose={() => setReschedAppt(null)}
        />
      )}
    </div>
  );
}

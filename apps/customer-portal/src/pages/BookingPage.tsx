import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DEMO_SERVICES, DEMO_BRANCHES } from "@/lib/demo-data";

// ── Types ──────────────────────────────────────────────────────────────────────

type Service = (typeof DEMO_SERVICES)[number];
type Branch  = (typeof DEMO_BRANCHES)[number];

interface BookingState {
  service:  Service | null;
  branch:   Branch  | null;
  date:     string  | null; // "YYYY-MM-DD"
  timeSlot: string  | null; // "HH:MM"
}

// ── Date / time helpers ────────────────────────────────────────────────────────

function padTwo(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}`;
}

const TODAY = toDateStr(new Date());

const DOW_LABELS  = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

/** Calendar days for a month, with null-padding for the leading offset (Mon-first). */
function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDow   = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMo   = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDow + 6) % 7; // Mon=0
  const days: (number | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMo; d++) days.push(d);
  return days;
}

/** Dates that are "fully booked" (fake). */
const FULL_DATES = new Set([
  "2026-04-22", "2026-04-25", "2026-04-28",
  "2026-05-02", "2026-05-08", "2026-05-14",
]);

function isDayAvailable(dateStr: string): boolean {
  if (dateStr < TODAY)            return false; // past
  if (FULL_DATES.has(dateStr))    return false; // full
  const dow = new Date(dateStr + "T00:00:00").getDay();
  if (dow === 0)                  return false; // no Sundays
  return true;
}

/** Generate fake time slots for a service + branch + date. */
function generateSlots(
  durationMin: number,
  branchId:    string,
  date:        string,
): { time: string; available: boolean }[] {
  const slots: { time: string; available: boolean }[] = [];
  let minutes     = 8 * 60;
  const endMins   = 18 * 60;

  while (minutes + durationMin <= endMins) {
    const inLunch = minutes >= 13 * 60 && minutes < 14 * 60;
    if (!inLunch) {
      const h    = Math.floor(minutes / 60);
      const m    = minutes % 60;
      const time = `${padTwo(h)}:${padTwo(m)}`;
      // Deterministic "taken" via cheap hash — 2 out of 7 slots unavailable
      const hash      = (branchId.charCodeAt(3) + date.charCodeAt(8) + h + m) % 7;
      const available = hash !== 0 && hash !== 3;
      slots.push({ time, available });
    }
    minutes += durationMin;
  }
  return slots;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const h12    = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${padTwo(m)} ${suffix}`;
}

function formatDateLabel(dateStr: string): string {
  const d      = new Date(dateStr + "T00:00:00");
  const days   = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  const months = [
    "enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre",
  ];
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]}`;
}

function genConfirmationCode() {
  return "PD" + Math.floor(100_000 + Math.random() * 900_000);
}

// ── Step progress bar ──────────────────────────────────────────────────────────

const STEP_LABELS = ["Servicio", "Sede", "Fecha", "Hora", "Confirmar"];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-end px-4 py-3 gap-1">
      {STEP_LABELS.map((label, i) => (
        <div key={i} className="flex items-end gap-1 flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <div
              className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                i < current
                  ? "bg-brand-600 text-white"
                  : i === current
                  ? "bg-brand-gradient text-white shadow-md"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {i < current ? "✓" : i + 1}
            </div>
            <span
              className={`text-[9px] font-semibold whitespace-nowrap ${
                i === current
                  ? "text-brand-700"
                  : i < current
                  ? "text-brand-500"
                  : "text-slate-400"
              }`}
            >
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div
              className={`flex-1 h-0.5 mb-3.5 rounded-full transition-all ${
                i < current ? "bg-brand-600" : "bg-slate-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 1 — Seleccionar servicio ─────────────────────────────────────────────

function Step1Service({ onSelect }: { onSelect: (s: Service) => void }) {
  return (
    <div className="px-4 pb-6 space-y-3">
      <div className="mb-2">
        <h2 className="text-lg font-black text-slate-900">¿Qué servicio necesitas?</h2>
        <p className="text-sm text-slate-500 mt-0.5">Selecciona el tipo de atención</p>
      </div>

      {DEMO_SERVICES.map((svc) => (
        <button
          key={svc.id}
          onClick={() => onSelect(svc)}
          className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl shadow-card
                     border-2 border-transparent hover:border-brand-200 active:scale-[0.98]
                     transition-all text-left"
        >
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{ backgroundColor: svc.color + "18" }}
          >
            {svc.emoji}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-slate-900 text-sm">{svc.name}</p>
              <span className="text-sm font-black shrink-0" style={{ color: svc.color }}>
                S/ {svc.price}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{svc.description}</p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[11px] text-slate-400 font-medium">⏱ {svc.duration} min</span>
              <span
                className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                style={{ backgroundColor: svc.color + "15", color: svc.color }}
              >
                {svc.category}
              </span>
            </div>
          </div>

          <span className="text-slate-300 text-xl shrink-0">›</span>
        </button>
      ))}
    </div>
  );
}

// ── Step 2 — Seleccionar sede ─────────────────────────────────────────────────

function Step2Branch({ onSelect }: { onSelect: (b: Branch) => void }) {
  return (
    <div className="px-4 pb-6 space-y-3">
      <div className="mb-2">
        <h2 className="text-lg font-black text-slate-900">Elige tu sede</h2>
        <p className="text-sm text-slate-500 mt-0.5">Selecciona la clínica más cercana</p>
      </div>

      {DEMO_BRANCHES.map((branch) => (
        <button
          key={branch.id}
          onClick={() => onSelect(branch)}
          className="w-full p-4 bg-white rounded-2xl shadow-card border-2 border-transparent
                     hover:border-brand-200 active:scale-[0.98] transition-all text-left"
        >
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-brand-50 flex items-center justify-center text-xl shrink-0">
              🏥
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-slate-900 text-sm">{branch.name}</p>
                {branch.isFavorite && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                    ⭐ Favorita
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{branch.address}</p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-[11px] text-slate-400">📏 {branch.distance}</span>
                <span className="text-[11px] text-slate-400">⭐ {branch.rating}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">🕐 {branch.hours}</p>
            </div>

            <span className="text-slate-300 text-xl shrink-0 mt-1">›</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Step 3 — Seleccionar fecha ────────────────────────────────────────────────

function Step3Date({ onSelect }: { onSelect: (d: string) => void }) {
  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selected,  setSelected]  = useState<string | null>(null);

  const calDays   = useMemo(() => getCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);
  const atMinMo   = viewYear === now.getFullYear() && viewMonth === now.getMonth();

  const prevMonth = () => {
    if (atMinMo) return;
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  return (
    <div className="px-4 pb-6">
      <div className="mb-4">
        <h2 className="text-lg font-black text-slate-900">Elige una fecha</h2>
        <p className="text-sm text-slate-500 mt-0.5">Selecciona el día de tu cita</p>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            disabled={atMinMo}
            className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center
                       text-slate-600 text-lg font-bold disabled:opacity-30 transition-opacity"
          >
            ‹
          </button>
          <h3 className="font-bold text-slate-900">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h3>
          <button
            onClick={nextMonth}
            className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center
                       text-slate-600 text-lg font-bold"
          >
            ›
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DOW_LABELS.map((d) => (
            <div key={d} className="text-center text-[10px] font-bold text-slate-400 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {calDays.map((day, i) => {
            if (!day) return <div key={`e${i}`} />;

            const dateStr    = `${viewYear}-${padTwo(viewMonth + 1)}-${padTwo(day)}`;
            const isToday    = dateStr === TODAY;
            const available  = isDayAvailable(dateStr);
            const isPast     = dateStr < TODAY;
            const isFull     = FULL_DATES.has(dateStr);
            const isSelected = dateStr === selected;

            return (
              <button
                key={dateStr}
                onClick={() => available && setSelected(dateStr)}
                disabled={!available}
                className={`relative mx-auto h-9 w-9 rounded-full flex items-center justify-center
                            text-sm font-semibold transition-all ${
                  isSelected
                    ? "bg-brand-gradient text-white shadow-md"
                    : isToday && available
                    ? "border-2 border-brand-500 text-brand-700"
                    : isPast || isFull
                    ? "text-slate-300"
                    : "text-slate-800 hover:bg-brand-50 hover:text-brand-700"
                }`}
              >
                {day}
                {/* Red dot = fully booked */}
                {isFull && !isPast && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2
                                   h-1 w-1 rounded-full bg-red-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-brand-600" />
            <span className="text-[10px] text-slate-500">Disponible</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-slate-200" />
            <span className="text-[10px] text-slate-500">No disponible</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="text-[10px] text-slate-500">Completo</span>
          </div>
        </div>
      </div>

      {/* Selection confirm */}
      {selected && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2.5 p-3 bg-brand-50 rounded-xl border border-brand-100">
            <span className="text-brand-600 text-base">📅</span>
            <span className="text-sm font-semibold text-brand-800">{formatDateLabel(selected)}</span>
          </div>
          <button
            onClick={() => onSelect(selected)}
            className="w-full py-3.5 rounded-xl bg-brand-gradient text-white font-bold text-base
                       shadow-lg shadow-violet-400/40 active:scale-[0.98] transition-all"
          >
            Continuar →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Step 4 — Seleccionar hora ─────────────────────────────────────────────────

function Step4Time({
  service,
  branch,
  date,
  onSelect,
}: {
  service:  Service;
  branch:   Branch;
  date:     string;
  onSelect: (t: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const slots = useMemo(
    () => generateSlots(service.duration, branch.id, date),
    [service.duration, branch.id, date],
  );

  const availableCount = slots.filter((s) => s.available).length;

  return (
    <div className="px-4 pb-6">
      <div className="mb-4">
        <h2 className="text-lg font-black text-slate-900">Elige el horario</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {availableCount} horarios disponibles · {formatDateLabel(date)}
        </p>
      </div>

      {/* Specialist chip */}
      <div className="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-card mb-4">
        <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center
                        text-sm font-black text-brand-700 shrink-0">
          CS
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">Dra. Carmen Salinas</p>
          <p className="text-xs text-slate-500">Podóloga especialista · {branch.district}</p>
        </div>
        <div className="ml-auto text-right shrink-0">
          <p className="text-[10px] text-slate-400">Duración</p>
          <p className="text-xs font-bold text-slate-700">{service.duration} min</p>
        </div>
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {slots.map(({ time, available }) => (
          <button
            key={time}
            onClick={() => available && setSelected(time)}
            disabled={!available}
            className={`py-3 rounded-xl text-sm font-bold transition-all border-2 flex flex-col
                        items-center justify-center leading-tight ${
              selected === time
                ? "bg-brand-gradient text-white border-transparent shadow-md shadow-violet-400/30"
                : available
                ? "bg-white text-slate-800 border-slate-200 hover:border-brand-300 hover:text-brand-700"
                : "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
            }`}
          >
            {formatTime(time)}
            {!available && (
              <span className="text-[9px] font-normal text-slate-300 mt-0.5">Ocupado</span>
            )}
          </button>
        ))}
      </div>

      {selected && (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 p-3 bg-brand-50 rounded-xl border border-brand-100">
            <span className="text-brand-600 text-base">⏰</span>
            <span className="text-sm font-semibold text-brand-800">{formatTime(selected)}</span>
          </div>
          <button
            onClick={() => onSelect(selected)}
            className="w-full py-3.5 rounded-xl bg-brand-gradient text-white font-bold text-base
                       shadow-lg shadow-violet-400/40 active:scale-[0.98] transition-all"
          >
            Continuar →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Step 5 — Confirmación ─────────────────────────────────────────────────────

function Step5Confirm({
  booking,
  onConfirm,
  loading,
}: {
  booking:   Required<BookingState>;
  onConfirm: () => void;
  loading:   boolean;
}) {
  const rows = [
    { icon: "📍", label: "Sede",          value: `${booking.branch.name} · ${booking.branch.district}` },
    { icon: "📅", label: "Fecha",         value: formatDateLabel(booking.date) },
    { icon: "⏰", label: "Hora",          value: formatTime(booking.timeSlot) },
    { icon: "👩‍⚕️", label: "Especialista", value: "Dra. Carmen Salinas" },
  ];

  return (
    <div className="px-4 pb-6">
      <div className="mb-4">
        <h2 className="text-lg font-black text-slate-900">Confirma tu cita</h2>
        <p className="text-sm text-slate-500 mt-0.5">Revisa los detalles antes de agendar</p>
      </div>

      {/* Summary card */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden mb-4">
        {/* Service color strip */}
        <div className="h-1.5 w-full" style={{ backgroundColor: booking.service.color }} />
        <div className="p-4">
          {/* Service header */}
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
              style={{ backgroundColor: booking.service.color + "15" }}
            >
              {booking.service.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-slate-900">{booking.service.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {booking.service.duration} min · S/ {booking.service.price}
              </p>
            </div>
            <span
              className="text-base font-black"
              style={{ color: booking.service.color }}
            >
              S/ {booking.service.price}
            </span>
          </div>

          {/* Detail rows */}
          <div className="space-y-2.5 pt-3">
            {rows.map(({ icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <span className="text-base mt-0.5 shrink-0">{icon}</span>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {label}
                  </p>
                  <p className="text-sm font-semibold text-slate-800">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Plan note */}
      <div className="flex items-start gap-2.5 p-3.5 bg-brand-50 rounded-2xl border border-brand-100 mb-5">
        <span className="text-xl shrink-0">💳</span>
        <div>
          <p className="text-xs font-bold text-brand-700">
            Se descontará 1 sesión de tu Plan Estándar
          </p>
          <p className="text-xs text-brand-600 mt-0.5">
            Te quedarán 2 sesiones disponibles tras esta cita
          </p>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={onConfirm}
        disabled={loading}
        className="w-full py-3.5 rounded-xl bg-brand-gradient text-white font-bold text-base
                   shadow-lg shadow-violet-400/40 active:scale-[0.98] transition-all
                   disabled:opacity-70 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
              <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Agendando cita...
          </>
        ) : (
          "✅ Confirmar cita"
        )}
      </button>

      <p className="text-center text-[11px] text-slate-400 mt-3 leading-relaxed">
        Recibirás una confirmación por WhatsApp al<br />
        <span className="font-semibold">+51 987 654 321</span>
      </p>
    </div>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────

function SuccessScreen({
  booking,
  code,
}: {
  booking: Required<BookingState>;
  code:    string;
}) {
  const navigate = useNavigate();

  const summaryItems = [
    { icon: booking.service.emoji, value: booking.service.name },
    { icon: "📍",                   value: booking.branch.name },
    { icon: "📅",                   value: formatDateLabel(booking.date) },
    { icon: "⏰",                   value: formatTime(booking.timeSlot) },
    { icon: "👩‍⚕️",                   value: "Dra. Carmen Salinas" },
  ];

  return (
    <div className="flex flex-col items-center px-5 pt-8 pb-6 gap-5 text-center">
      {/* Success icon */}
      <div className="h-24 w-24 rounded-full bg-brand-gradient flex items-center justify-center
                      shadow-xl shadow-violet-400/40">
        <span className="text-4xl">✅</span>
      </div>

      <div>
        <h2 className="text-2xl font-black text-slate-900">¡Cita agendada!</h2>
        <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
          Tu cita ha sido confirmada exitosamente.<br />
          Te esperamos pronto en Podoplus 🦶
        </p>
      </div>

      {/* Confirmation card */}
      <div className="w-full bg-white rounded-2xl shadow-card-lg overflow-hidden">
        <div className="h-1.5 w-full bg-brand-gradient" />
        <div className="p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center mb-1">
            Código de confirmación
          </p>
          <p className="text-2xl font-black text-brand-700 tracking-widest text-center mb-4">
            {code}
          </p>

          <div className="space-y-2.5 pt-3 border-t border-slate-100 text-left">
            {summaryItems.map(({ icon, value }) => (
              <div key={value} className="flex items-center gap-3">
                <span className="text-base w-6 text-center shrink-0">{icon}</span>
                <span className="text-sm font-semibold text-slate-700">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* WhatsApp reminder note */}
      <div className="flex items-start gap-2.5 w-full p-3.5 bg-green-50 rounded-2xl border border-green-100 text-left">
        <span className="text-xl shrink-0">💬</span>
        <div>
          <p className="text-xs font-bold text-green-800">Confirmación por WhatsApp</p>
          <p className="text-xs text-green-700 mt-0.5">
            Recibirás un recordatorio 24h antes de tu cita al +51 987 654 321
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="w-full flex flex-col gap-2">
        <button
          onClick={() => navigate("/citas")}
          className="w-full py-3.5 rounded-xl bg-brand-gradient text-white font-bold text-base
                     shadow-lg shadow-violet-400/40 active:scale-[0.98] transition-all"
        >
          Ver mis citas
        </button>
        <button
          onClick={() => navigate("/")}
          className="w-full py-3 rounded-xl border-2 border-slate-200 text-slate-600
                     font-semibold text-sm active:scale-[0.98] transition-all"
        >
          Volver al inicio
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function BookingPage() {
  const navigate = useNavigate();

  const [step, setStep]         = useState(0);
  const [booking, setBooking]   = useState<BookingState>({
    service: null, branch: null, date: null, timeSlot: null,
  });
  const [confirming, setConfirming] = useState(false);
  const [confirmed,  setConfirmed]  = useState(false);
  const [confCode,   setConfCode]   = useState("");

  const goBack = () => {
    if (step === 0) navigate(-1);
    else setStep((s) => s - 1);
  };

  const handleConfirm = () => {
    setConfirming(true);
    setTimeout(() => {
      setConfCode(genConfirmationCode());
      setConfirming(false);
      setConfirmed(true);
    }, 1500);
  };

  // ── Success screen ──
  if (confirmed && booking.service && booking.branch && booking.date && booking.timeSlot) {
    return (
      <div className="pb-4">
        <SuccessScreen booking={booking as Required<BookingState>} code={confCode} />
      </div>
    );
  }

  return (
    <div className="pb-6">
      {/* Sticky header + step bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-100">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <button
            onClick={goBack}
            className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center
                       text-slate-600 text-lg font-bold shrink-0"
          >
            ←
          </button>
          <div className="flex-1">
            <h1 className="text-base font-black text-slate-900">Agendar cita</h1>
            <p className="text-[11px] text-slate-400">
              {["Selecciona el servicio", "Elige tu sede", "Elige una fecha",
                "Elige el horario", "Confirma tu cita"][step]}
            </p>
          </div>
        </div>
        <StepBar current={step} />
      </div>

      {/* Step content */}
      <div className="pt-4">
        {step === 0 && (
          <Step1Service
            onSelect={(svc) => {
              setBooking((b) => ({ ...b, service: svc }));
              setStep(1);
            }}
          />
        )}

        {step === 1 && (
          <Step2Branch
            onSelect={(br) => {
              setBooking((b) => ({ ...b, branch: br }));
              setStep(2);
            }}
          />
        )}

        {step === 2 && (
          <Step3Date
            onSelect={(d) => {
              setBooking((b) => ({ ...b, date: d }));
              setStep(3);
            }}
          />
        )}

        {step === 3 && booking.service && booking.branch && booking.date && (
          <Step4Time
            service={booking.service}
            branch={booking.branch}
            date={booking.date}
            onSelect={(t) => {
              setBooking((b) => ({ ...b, timeSlot: t }));
              setStep(4);
            }}
          />
        )}

        {step === 4 && booking.service && booking.branch && booking.date && booking.timeSlot && (
          <Step5Confirm
            booking={booking as Required<BookingState>}
            onConfirm={handleConfirm}
            loading={confirming}
          />
        )}
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, Plus, CalendarDays, RefreshCw, Clock,
} from "lucide-react";
import {
  Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@podoplus/ui";
import { useAppointmentsRange, useBranches, type Appointment } from "@/hooks/use-appointments";
import { WeekCalendar }           from "./components/WeekCalendar";
import { BookingModal }           from "./components/BookingModal";
import { AppointmentDetailSheet } from "./components/AppointmentDetailSheet";
import { NewSaleModal, type SalePrefill } from "@/pages/sales/components/NewSaleModal";
import { cn } from "@/lib/utils";
import { type AppointmentStatus, STATUS_LABEL } from "@/lib/appointment-status";

// ── Week helpers ──────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d   = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** Devuelve la fecha YYYY-MM-DD del timestamp naive Lima (UTC = Lima local). */
function toDateStr(date: Date): string {
  if (!date || isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

const MONTH_LABELS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const MONTH_SHORT = [
  "ene","feb","mar","abr","may","jun",
  "jul","ago","sep","oct","nov","dic",
];

const DAY_NAMES_FULL = [
  "Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado",
];

// Single-letter day labels for mobile week strip (Mon → Sun)
// weekDates[0] = Monday (index 1 in getDay())
const MOBILE_DAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];

// ── Mobile appointment card ───────────────────────────────────────────────────

function fmtTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  // timeZone: "UTC" muestra la hora naive Lima almacenada en el campo UTC.
  return d.toLocaleTimeString("es-PE", {
    hour: "numeric", minute: "2-digit", hour12: true,
    timeZone: "UTC",
  });
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

function getApptColor(appt: Appointment): string {
  return appt.service?.color ?? appt.color ?? "#6B7280";
}

function customerName(appt: Appointment): string {
  if (!appt.customer) return "Cliente";
  return `${appt.customer.firstName} ${appt.customer.lastName}`.trim();
}

function initials(appt: Appointment): string {
  if (!appt.customer) return "?";
  return ((appt.customer.firstName?.[0] ?? "") + (appt.customer.lastName?.[0] ?? "")).toUpperCase() || "?";
}

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cancelled:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  no_show:    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  noshow:     "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  confirmed:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  pending:    "bg-muted text-muted-foreground",
};

function MobileApptCard({ appt, onClick }: { appt: Appointment; onClick: () => void }) {
  const color  = getApptColor(appt);
  const rgb    = hexToRgb(color);
  const bgChip = rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},0.15)` : `${color}26`;
  const statusCls = STATUS_STYLE[appt.status] ?? "bg-muted text-muted-foreground";
  const statusLabel = STATUS_LABEL[appt.status as AppointmentStatus] ?? appt.status;

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 p-3 rounded-xl border border-border bg-card
                 hover:bg-muted/30 active:scale-[0.99] transition-all"
    >
      {/* Color strip */}
      <div className="w-1 self-stretch rounded-full shrink-0 mt-0.5" style={{ backgroundColor: color }} />

      {/* Avatar initials */}
      <div
        className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{ backgroundColor: bgChip, color }}
      >
        {initials(appt)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">
            {customerName(appt)}
          </p>
          <span className={cn("shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full", statusCls)}>
            {statusLabel}
          </span>
        </div>
        {appt.service?.name && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{appt.service.name}</p>
        )}
        <div className="flex items-center gap-1 mt-1">
          <Clock size={10} className="text-muted-foreground/60" />
          <span className="text-[11px] text-muted-foreground">
            {fmtTime(appt.startAt)} – {fmtTime(appt.endAt)}
          </span>
          {appt.branch?.name && (
            <span className="text-[11px] text-muted-foreground/60 truncate">· {appt.branch.name}</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Mobile day agenda (list view) ─────────────────────────────────────────────

function MobileDayAgenda({
  date,
  appointments,
  onNewAppt,
  onApptClick,
  isLoading,
}: {
  date:         Date;
  appointments: Appointment[];
  onNewAppt:    () => void;
  onApptClick:  (id: string) => void;
  isLoading:    boolean;
}) {
  const dateStr  = toDateStr(date);
  const dayAppts = appointments
    .filter((a) => a.startAt && toDateStr(new Date(a.startAt)) === dateStr)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-border bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (dayAppts.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
        <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
          <CalendarDays size={28} className="text-muted-foreground/40" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Sin citas para este día</p>
          <p className="text-xs text-muted-foreground mt-1">Toca el botón para agendar una cita</p>
        </div>
        <Button size="sm" onClick={onNewAppt} className="gap-1.5">
          <Plus size={14} /> Nueva cita
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
      {dayAppts.map((appt) => (
        <MobileApptCard
          key={appt.id}
          appt={appt}
          onClick={() => onApptClick(appt.id)}
        />
      ))}

      {/* Add appointment CTA at bottom */}
      <div className="pt-1 pb-4">
        <button
          onClick={onNewAppt}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed
                     border-border text-muted-foreground text-sm font-medium
                     hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
        >
          <Plus size={15} /> Agregar cita
        </button>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CalendarPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── Shared state ──
  const [weekStart,      setWeekStart]      = useState(getWeekStart(today));
  const [mobileDate,     setMobileDate]     = useState(new Date(today));
  const [branchFilter,   setBranchFilter]   = useState("ALL");
  const [bookingOpen,    setBookingOpen]    = useState(false);
  const [bookingDate,    setBookingDate]    = useState<string | undefined>();
  const [bookingHour,    setBookingHour]    = useState<number | undefined>();
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);
  /** "timeline" = hour grid (desktop-style), "agenda" = card list */
  const [mobileView,     setMobileView]     = useState<"agenda" | "timeline">("agenda");

  // Modal de nueva venta — se abre automáticamente al completar una cita
  const [saleOpen,    setSaleOpen]    = useState(false);
  const [salePrefill, setSalePrefill] = useState<SalePrefill | undefined>();

  const handleApptCompleted = (appt: Appointment) => {
    setSalePrefill({
      appointmentId: appt.id,
      customerId:    appt.customerId   ?? appt.customer?.id,
      customerName:  appt.customer
        ? `${appt.customer.firstName} ${appt.customer.lastName}`.trim()
        : undefined,
      customerDoc:   appt.customer?.documentNumber,
      serviceId:     appt.serviceId    ?? appt.service?.id,
    });
    setSaleOpen(true);
  };

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const fromStr   = toDateStr(weekDates[0]);
  const toStr     = toDateStr(weekDates[6]);

  const { data: branches } = useBranches();
  const activeBranches     = (branches ?? []).filter((b) => b.isActive);

  const { data: appointments = [], isLoading, refetch } = useAppointmentsRange({
    from:     fromStr,
    to:       toStr,
    branchId: branchFilter !== "ALL" ? branchFilter : undefined,
  });

  // ── Desktop navigation ──
  const goToPrevWeek = () => setWeekStart((p) => { const d = new Date(p); d.setDate(d.getDate() - 7); return d; });
  const goToNextWeek = () => setWeekStart((p) => { const d = new Date(p); d.setDate(d.getDate() + 7); return d; });

  // ── Mobile navigation ──
  const goToPrevDay = () => {
    const prev = new Date(mobileDate);
    prev.setDate(prev.getDate() - 1);
    setMobileDate(prev);
    if (toDateStr(prev) < fromStr) setWeekStart(getWeekStart(prev));
  };
  const goToNextDay = () => {
    const next = new Date(mobileDate);
    next.setDate(next.getDate() + 1);
    setMobileDate(next);
    if (toDateStr(next) > toStr) setWeekStart(getWeekStart(next));
  };

  // ── Shared ──
  const goToToday = () => {
    setWeekStart(getWeekStart(today));
    setMobileDate(new Date(today));
  };

  const handleCellClick = (date: string, hour: number) => {
    setBookingDate(date);
    setBookingHour(hour);
    setBookingOpen(true);
  };
  const handleNewAppt = () => {
    setBookingDate(mobileView === "agenda" ? toDateStr(mobileDate) : toDateStr(today));
    setBookingHour(undefined);
    setBookingOpen(true);
  };

  // ── Labels ──
  const isCurrentWeek  = toDateStr(weekStart) === toDateStr(getWeekStart(today));
  const todayAppts     = appointments.filter(
    (a) => toDateStr(new Date(a.startAt)) === toDateStr(today),
  );

  const weekLabel = (() => {
    const first = weekDates[0];
    const last  = weekDates[6];
    if (first.getMonth() === last.getMonth()) {
      return `${first.getDate()} – ${last.getDate()} de ${MONTH_LABELS[first.getMonth()]} ${first.getFullYear()}`;
    }
    return `${first.getDate()} ${MONTH_LABELS[first.getMonth()].slice(0, 3)} – ${last.getDate()} ${MONTH_LABELS[last.getMonth()].slice(0, 3)} ${last.getFullYear()}`;
  })();

  const mobileDateStr   = toDateStr(mobileDate);
  const isMobileToday   = mobileDateStr === toDateStr(today);
  const mobileDayLabel  = `${DAY_NAMES_FULL[mobileDate.getDay()]}, ${mobileDate.getDate()} de ${MONTH_SHORT[mobileDate.getMonth()]}`;

  // Appointment count per date (for week strip dots)
  const apptCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments) {
      if (!a.startAt) continue;
      const key = toDateStr(new Date(a.startAt));
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [appointments]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ════════════════════════════════════════════════════════════════════
          MOBILE VIEW  (hidden on md+)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col h-full overflow-hidden bg-background md:hidden">

        {/* ── Mobile top bar ── */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card shrink-0">
          {/* Day navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={goToPrevDay}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted active:bg-muted/80 transition-colors"
              aria-label="Día anterior"
            >
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </button>
            <button
              onClick={goToToday}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors",
                isMobileToday
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted text-muted-foreground",
              )}
            >
              {isMobileToday ? "Hoy" : mobileDayLabel}
            </button>
            {isMobileToday && (
              <p className="text-xs font-medium text-foreground">{mobileDayLabel}</p>
            )}
            <button
              onClick={goToNextDay}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted active:bg-muted/80 transition-colors"
              aria-label="Día siguiente"
            >
              <ChevronRight className="h-5 w-5 text-foreground" />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            {/* Appointments count pill */}
            {(apptCountByDate.get(mobileDateStr) ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {apptCountByDate.get(mobileDateStr)}
              </span>
            )}
            {/* Refresh */}
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
              aria-label="Actualizar"
            >
              <RefreshCw className={cn("h-4 w-4 text-muted-foreground", isLoading && "animate-spin")} />
            </button>
            {/* New appointment */}
            <button
              onClick={handleNewAppt}
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all shadow-sm"
              aria-label="Nueva cita"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Mini week strip ── */}
        <div className="flex border-b border-border bg-card shrink-0 px-3 py-1.5">
          {weekDates.map((date, i) => {
            const ds         = toDateStr(date);
            const isSelected = ds === mobileDateStr;
            const isDayToday = ds === toDateStr(today);
            const count      = apptCountByDate.get(ds) ?? 0;

            return (
              <button
                key={i}
                onClick={() => {
                  setMobileDate(new Date(date));
                }}
                className="flex-1 flex flex-col items-center gap-0.5 py-0.5"
              >
                {/* Day letter */}
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-widest",
                  isSelected ? "text-primary" : "text-muted-foreground/60",
                )}>
                  {MOBILE_DAY_LETTERS[i]}
                </span>

                {/* Date circle */}
                <span className={cn(
                  "h-7 w-7 flex items-center justify-center rounded-full text-sm font-semibold transition-all",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : isDayToday
                    ? "text-primary font-bold"
                    : "text-foreground hover:bg-muted",
                )}>
                  {date.getDate()}
                </span>

                {/* Appointment dot */}
                <span className={cn(
                  "h-1 w-1 rounded-full transition-colors",
                  count > 0
                    ? isSelected ? "bg-primary-foreground" : "bg-primary"
                    : "bg-transparent",
                )} />
              </button>
            );
          })}
        </div>

        {/* ── Branch filter (only when multiple branches) ── */}
        {activeBranches.length > 1 && (
          <div className="px-4 py-2 border-b border-border bg-card/60 shrink-0">
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todas las sedes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las sedes</SelectItem>
                {activeBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* ── View toggle (Agenda / Timeline) ── */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-muted/20 shrink-0">
          <div className="flex rounded-lg border border-border bg-card overflow-hidden text-xs font-medium">
            <button
              onClick={() => setMobileView("agenda")}
              className={cn(
                "px-3 py-1.5 transition-colors",
                mobileView === "agenda"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              Lista
            </button>
            <button
              onClick={() => setMobileView("timeline")}
              className={cn(
                "px-3 py-1.5 border-l border-border transition-colors",
                mobileView === "timeline"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              Horario
            </button>
          </div>
          {/* Today shortcut */}
          {!isMobileToday && (
            <button
              onClick={goToToday}
              className="ml-auto flex items-center gap-1 text-xs text-primary font-medium"
            >
              <CalendarDays size={12} /> Ir a hoy
            </button>
          )}
        </div>

        {/* ── Day content ── */}
        {mobileView === "agenda" ? (
          <MobileDayAgenda
            date={mobileDate}
            appointments={appointments}
            onNewAppt={handleNewAppt}
            onApptClick={setSelectedApptId}
            isLoading={isLoading}
          />
        ) : (
          /* Timeline: single-day WeekCalendar */
          <div className="flex-1 overflow-hidden">
            <WeekCalendar
              weekDates={[mobileDate]}
              appointments={appointments}
              isLoading={isLoading}
              onCellClick={handleCellClick}
              onAppointmentClick={setSelectedApptId}
              hideHeader
              className="rounded-none border-0 border-t border-border"
            />
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          DESKTOP VIEW  (hidden on mobile) — UNTOUCHED
      ════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col h-full overflow-hidden bg-background">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-card shrink-0">
          {/* Left: nav */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border overflow-hidden">
              <button
                onClick={goToPrevWeek}
                className="px-2.5 py-1.5 hover:bg-muted transition-colors"
                aria-label="Semana anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={goToNextWeek}
                className="px-2.5 py-1.5 hover:bg-muted transition-colors border-l"
                aria-label="Semana siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <Button
              variant={isCurrentWeek ? "default" : "outline"}
              size="sm"
              onClick={goToToday}
              className="gap-1.5"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Hoy
            </Button>

            <h2 className="text-sm font-semibold text-foreground ml-1 hidden sm:block">
              {weekLabel}
            </h2>
          </div>

          {/* Right: filters + actions */}
          <div className="flex items-center gap-2">
            {isCurrentWeek && todayAppts.length > 0 && (
              <span className="hidden md:flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                {todayAppts.length} hoy
              </span>
            )}

            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Todas las sedes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las sedes</SelectItem>
                {activeBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="ghost" size="sm" className="h-8 w-8 p-0"
              onClick={() => refetch()}
              disabled={isLoading}
              aria-label="Actualizar"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>

            <Button size="sm" className="gap-1.5" onClick={handleNewAppt}>
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nueva cita</span>
            </Button>
          </div>
        </div>

        {/* Week label on small screens (sm only) */}
        <div className="sm:hidden px-5 py-1.5 border-b bg-muted/20 shrink-0">
          <p className="text-xs font-medium text-muted-foreground">{weekLabel}</p>
        </div>

        {/* ── Calendar grid ── */}
        <div className="flex-1 overflow-hidden px-3 py-3">
          <WeekCalendar
            weekDates={weekDates}
            appointments={appointments}
            isLoading={isLoading}
            onCellClick={handleCellClick}
            onAppointmentClick={setSelectedApptId}
          />
        </div>
      </div>

      {/* ── Shared modals / sheets ── */}
      <BookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        defaultDate={bookingDate}
        defaultHour={bookingHour}
      />

      <AppointmentDetailSheet
        appointmentId={selectedApptId}
        onClose={() => setSelectedApptId(null)}
        onCompleted={handleApptCompleted}
      />

      {/* Modal de venta — se abre automáticamente al completar una cita */}
      <NewSaleModal
        open={saleOpen}
        onClose={() => { setSaleOpen(false); setSalePrefill(undefined); }}
        prefill={salePrefill}
      />
    </>
  );
}

import { useRef, useEffect, useMemo } from "react";
import { type Appointment } from "@/hooks/use-appointments";
import { AppointmentBlock } from "./AppointmentBlock";

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_START        = 7;    // 7 AM
const DAY_END          = 21;   // 9 PM
const HOUR_HEIGHT      = 64;   // px per hour
const TOTAL_HOURS      = DAY_END - DAY_START;
const GRID_HEIGHT      = TOTAL_HOURS * HOUR_HEIGHT;
const TIME_COL_W       = 52;   // px — left time-label column
const MAX_VISIBLE_COLS = 3;    // max side-by-side columns; extras shown as "+N más"

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateKey(date: Date): string {
  if (!date || isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function minutesFromDayStart(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes() - DAY_START * 60;
}

function durationMinutes(startIso: string, endIso: string): number {
  return (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000;
}

// ── Layout info per appointment ───────────────────────────────────────────────

interface LayoutInfo {
  colIndex:      number; // 0-based position within visible group
  colCount:      number; // total appointments in group
  visibleCount:  number; // min(colCount, MAX_VISIBLE_COLS)
  hiddenCount:   number; // colCount - visibleCount
  isLastVisible: boolean; // this is the rightmost visible slot in the group
}

interface LayoutResult {
  /** Per-appointment layout data */
  layoutMap: Map<string, LayoutInfo>;
  /** Maps the last-visible appointment ID → array of hidden appointments in that group */
  hiddenMap: Map<string, Appointment[]>;
}

/**
 * Groups overlapping appointments and computes column layout.
 * Caps visible columns at MAX_VISIBLE_COLS; extra appointments
 * get colIndex >= MAX_VISIBLE_COLS (filtered out of render but
 * accessible via the hiddenMap on the last visible block).
 */
function computeLayout(appointments: Appointment[]): LayoutResult {
  const sorted = [...appointments].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );

  const layoutMap = new Map<string, LayoutInfo>();
  const hiddenMap = new Map<string, Appointment[]>();
  const groups: Appointment[][] = [];

  for (const appt of sorted) {
    const apptStart = new Date(appt.startAt).getTime();
    const apptEnd   = new Date(appt.endAt).getTime();

    let placed = false;
    for (const group of groups) {
      const overlaps = group.some(
        (g) =>
          apptStart < new Date(g.endAt).getTime() &&
          apptEnd   > new Date(g.startAt).getTime(),
      );
      if (overlaps) {
        group.push(appt);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push([appt]);
  }

  for (const group of groups) {
    const colCount     = group.length;
    const visibleCount = Math.min(colCount, MAX_VISIBLE_COLS);
    const hiddenCount  = Math.max(0, colCount - MAX_VISIBLE_COLS);

    group.forEach((appt, idx) => {
      layoutMap.set(appt.id, {
        colIndex:      idx,
        colCount,
        visibleCount,
        hiddenCount,
        isLastVisible: idx === visibleCount - 1,
      });
    });

    // Register hidden appointments under the last-visible appt's ID
    if (hiddenCount > 0) {
      const lastVisible = group[visibleCount - 1];
      hiddenMap.set(lastVisible.id, group.slice(visibleCount));
    }
  }

  return { layoutMap, hiddenMap };
}

// ── Labels ────────────────────────────────────────────────────────────────────

const DAY_LABELS   = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_LABELS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

// ── Sub-components ────────────────────────────────────────────────────────────

function NowIndicator() {
  const now  = new Date();
  const mins = minutesFromDayStart(now.toISOString());
  if (mins < 0 || mins > TOTAL_HOURS * 60) return null;
  const topPx = (mins / 60) * HOUR_HEIGHT;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: `${topPx}px` }}
    >
      <div className="flex items-center">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0 -ml-1.5" />
        <div className="flex-1 h-px bg-red-500" />
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  weekDates:          Date[];
  appointments:       Appointment[];
  isLoading?:         boolean;
  onCellClick:        (date: string, hour: number) => void;
  onAppointmentClick: (id: string) => void;
  /** Hide the sticky day-header row (useful in mobile single-day view) */
  hideHeader?:        boolean;
  /** Extra class(es) for the outer wrapper div */
  className?:         string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WeekCalendar({
  weekDates,
  appointments,
  isLoading,
  onCellClick,
  onAppointmentClick,
  hideHeader  = false,
  className   = "",
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayStr  = toDateKey(new Date());

  // Scroll to current time on mount
  useEffect(() => {
    if (!scrollRef.current) return;
    const now  = new Date();
    const mins = now.getHours() * 60 + now.getMinutes() - DAY_START * 60;
    if (mins > 0) {
      const scrollTo = Math.max(0, (mins / 60) * HOUR_HEIGHT - 120);
      scrollRef.current.scrollTop = scrollTo;
    }
  }, []);

  // Group appointments by date
  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appt of appointments) {
      if (!appt.startAt) continue;
      const d = new Date(appt.startAt);
      if (isNaN(d.getTime())) continue;
      const key = toDateKey(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(appt);
    }
    return map;
  }, [appointments]);

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => DAY_START + i);

  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border bg-card h-full ${className}`}>

      {/* ── Sticky header row ─────────────────────────────────────────── */}
      {!hideHeader && (
        <div
          className="flex border-b bg-muted/30 sticky top-0 z-30 shrink-0"
          style={{ paddingLeft: `${TIME_COL_W}px` }}
        >
          {weekDates.map((date, i) => {
            const isToday = toDateKey(date) === todayStr;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center py-2 border-l first:border-l-0"
              >
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {DAY_LABELS[date.getDay()]}
                </span>
                <span
                  className={`text-sm font-bold mt-0.5 h-7 w-7 flex items-center justify-center rounded-full transition-colors
                    ${isToday ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
                >
                  {date.getDate()}
                </span>
                <span className="text-[9px] text-muted-foreground/50 mt-0.5">
                  {MONTH_LABELS[date.getMonth()]}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Scrollable grid body ──────────────────────────────────────── */}
      <div ref={scrollRef} className="overflow-y-auto flex-1">
        <div className="flex" style={{ height: `${GRID_HEIGHT}px` }}>

          {/* Time column */}
          <div className="shrink-0 relative" style={{ width: `${TIME_COL_W}px`, height: `${GRID_HEIGHT}px` }}>
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-2 text-[10px] text-muted-foreground/60 font-medium select-none"
                style={{ top: `${(h - DAY_START) * HOUR_HEIGHT - 7}px` }}
              >
                {h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((date, dayIdx) => {
            const dateStr  = toDateKey(date);
            const isToday  = dateStr === todayStr;
            const dayAppts = byDate.get(dateStr) ?? [];
            const { layoutMap, hiddenMap } = computeLayout(dayAppts);

            // Only render visible appointments (colIndex < MAX_VISIBLE_COLS)
            const visibleAppts = dayAppts.filter(
              (a) => (layoutMap.get(a.id)?.colIndex ?? 0) < MAX_VISIBLE_COLS,
            );

            return (
              <div
                key={dayIdx}
                className={`flex-1 relative border-l ${isToday ? "bg-primary/[0.02]" : ""}`}
                style={{ height: `${GRID_HEIGHT}px` }}
              >
                {/* Hour grid lines + click zones */}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-border/40 hover:bg-primary/[0.03]
                               transition-colors cursor-pointer group"
                    style={{ top: `${(h - DAY_START) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                    onClick={() => onCellClick(dateStr, h)}
                  >
                    {/* Half-hour dashed line */}
                    <div
                      className="absolute left-0 right-0 border-t border-border/20 border-dashed"
                      style={{ top: `${HOUR_HEIGHT / 2}px` }}
                    />
                    {/* "+" hint on hover */}
                    <div className="absolute right-1 top-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[10px] text-muted-foreground/50 font-medium">+</span>
                    </div>
                  </div>
                ))}

                {/* Today indicator */}
                {isToday && <NowIndicator />}

                {/* Appointment blocks */}
                {!isLoading && visibleAppts.map((appt) => {
                  const layout          = layoutMap.get(appt.id)!;
                  const mins            = minutesFromDayStart(appt.startAt);
                  const dur             = durationMinutes(appt.startAt, appt.endAt);
                  const top             = (mins / 60) * HOUR_HEIGHT;
                  const height          = Math.max((dur / 60) * HOUR_HEIGHT, 22);
                  const hiddenAppts     = layout.isLastVisible ? (hiddenMap.get(appt.id) ?? []) : [];

                  return (
                    <AppointmentBlock
                      key={appt.id}
                      appointment={appt}
                      colIndex={layout.colIndex}
                      colCount={layout.visibleCount}
                      hiddenAppointments={hiddenAppts}
                      top={top}
                      height={height}
                      onClick={onAppointmentClick}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

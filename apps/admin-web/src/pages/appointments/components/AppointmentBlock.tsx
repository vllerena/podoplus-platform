import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { type Appointment } from "@/hooks/use-appointments";
import { type AppointmentStatus, STATUS_LABEL, TERMINAL_STATUSES } from "@/lib/appointment-status";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  appointment:        Appointment;
  /** 0-based column index within the visible group */
  colIndex:           number;
  /** Total visible columns (already capped at MAX_VISIBLE_COLS) */
  colCount:           number;
  /** Hidden appointments in this group (only set on the last visible block) */
  hiddenAppointments: Appointment[];
  /** Top offset in pixels */
  top:                number;
  /** Height in pixels */
  height:             number;
  onClick:            (id: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getColor(appt: Appointment): string {
  return appt.service?.color ?? appt.color ?? "#6B7280";
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-PE", {
    hour: "numeric", minute: "2-digit", hour12: true,
    timeZone: "UTC",
  });
}

function initials(appt: Appointment): string {
  if (!appt.customer) return "?";
  const first = appt.customer.firstName?.[0] ?? "";
  const last  = appt.customer.lastName?.[0]  ?? "";
  return (first + last).toUpperCase() || "?";
}

function customerName(appt: Appointment): string {
  if (!appt.customer) return "Cliente";
  return `${appt.customer.firstName} ${appt.customer.lastName}`.trim();
}

// ── HiddenPopover ─────────────────────────────────────────────────────────────
// Renders into document.body via portal so it escapes overflow:hidden containers.

interface HiddenPopoverProps {
  appointments: Appointment[];
  anchorRect:   DOMRect;
  onSelect:     (id: string) => void;
  onClose:      () => void;
}

function HiddenPopover({ appointments, anchorRect, onSelect, onClose }: HiddenPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click-outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Slight delay so the badge's own click doesn't immediately close it
    const tid = setTimeout(() => document.addEventListener("mousedown", handler), 10);
    return () => {
      clearTimeout(tid);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Position: prefer below the anchor; flip up if near bottom of viewport
  const POPOVER_W = 220;
  const POPOVER_ESTIMATED_H = appointments.length * 56 + 40;
  const viewportH = window.innerHeight;

  const left = Math.min(anchorRect.left, window.innerWidth - POPOVER_W - 8);
  const spaceBelow = viewportH - anchorRect.bottom;
  const top = spaceBelow >= POPOVER_ESTIMATED_H
    ? anchorRect.bottom + 6
    : anchorRect.top - POPOVER_ESTIMATED_H - 6;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        top:      `${top}px`,
        left:     `${left}px`,
        width:    `${POPOVER_W}px`,
        zIndex:   9999,
      }}
      className="bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100"
      // Prevent clicks inside from propagating to the calendar grid
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b bg-muted/40">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {appointments.length} cita{appointments.length > 1 ? "s" : ""} más
        </p>
      </div>

      {/* Appointment rows */}
      <div className="divide-y divide-border/50">
        {appointments.map((appt) => {
          const color = getColor(appt);
          const rgb   = hexToRgb(color);
          const bg    = rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},0.10)` : `${color}1a`;

          return (
            <button
              key={appt.id}
              onClick={() => { onSelect(appt.id); onClose(); }}
              className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-muted/60 transition-colors"
            >
              {/* Color accent */}
              <span
                className="mt-0.5 h-3 w-1 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate leading-tight" style={{ color }}>
                  {customerName(appt)}
                </p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {fmtTime(appt.startAt)} – {fmtTime(appt.endAt)}
                  {appt.service?.name ? ` · ${appt.service.name}` : ""}
                </p>
              </div>
              {/* Mini color chip */}
              <span
                className="shrink-0 h-5 w-5 rounded-full text-[8px] font-bold flex items-center justify-center mt-0.5"
                style={{ backgroundColor: bg, color }}
              >
                {initials(appt)}
              </span>
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

// ── AppointmentBlock ──────────────────────────────────────────────────────────

export function AppointmentBlock({
  appointment, colIndex, colCount, hiddenAppointments, top, height, onClick,
}: Props) {
  const [popoverOpen, setPopoverOpen]     = useState(false);
  const [anchorRect,  setAnchorRect]      = useState<DOMRect | null>(null);
  const badgeRef                          = useRef<HTMLButtonElement>(null);

  const color      = getColor(appointment);
  const rgb        = hexToRgb(color);
  const isTerminal = TERMINAL_STATUSES.includes(appointment.status as AppointmentStatus);

  const bgColor     = rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},0.13)` : `${color}22`;
  const borderColor = color;

  const widthPct = 100 / colCount;
  const leftPct  = colIndex * widthPct;

  const name        = customerName(appointment);
  const serviceName = appointment.service?.name ?? "";
  const timeStart   = fmtTime(appointment.startAt);
  const timeEnd     = fmtTime(appointment.endAt);

  // Layout modes based on available width and height
  const isVeryNarrow = colCount >= 4;  // each slot < 25% column width
  const isNarrow     = colCount >= 2;  // each slot < 50% column width
  const isTiny       = height < 30;

  const hiddenCount = hiddenAppointments.length;

  const handleBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (popoverOpen) {
      setPopoverOpen(false);
      return;
    }
    const rect = badgeRef.current?.getBoundingClientRect();
    if (rect) {
      setAnchorRect(rect);
      setPopoverOpen(true);
    }
  };

  // Badge element (reused across layout modes)
  const badge = hiddenCount > 0 ? (
    <button
      ref={badgeRef}
      onClick={handleBadgeClick}
      className="absolute bottom-1 right-0.5 flex items-center gap-0.5 text-[8px] font-bold
                 bg-foreground/80 text-background rounded px-1 py-px leading-tight
                 hover:bg-foreground transition-colors cursor-pointer z-10"
      title={`Ver ${hiddenCount} cita${hiddenCount > 1 ? "s" : ""} más`}
    >
      +{hiddenCount}
    </button>
  ) : null;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onClick(appointment.id)}
        onKeyDown={(e) => e.key === "Enter" && onClick(appointment.id)}
        style={{
          position:        "absolute",
          top:             `${top}px`,
          height:          `${Math.max(height, 22)}px`,
          left:            `calc(${leftPct}% + 1px)`,
          width:           `calc(${widthPct}% - 2px)`,
          backgroundColor: bgColor,
          borderLeft:      `3px solid ${borderColor}`,
          opacity:         isTerminal ? 0.55 : 1,
          zIndex:          10 + colIndex,
        }}
        className="rounded-r-md overflow-hidden cursor-pointer select-none transition-all hover:brightness-95 hover:shadow-md hover:z-50"
      >
        {/* ── Tiny mode: just a colored strip with time ── */}
        {isTiny ? (
          <div className="px-1 h-full flex items-center overflow-hidden">
            <span className="text-[9px] font-semibold truncate" style={{ color: borderColor }}>
              {timeStart}
            </span>
            {badge}
          </div>

        /* ── Very narrow mode (4+ columns): initials + time ── */
        ) : isVeryNarrow ? (
          <div className="px-1 py-0.5 h-full flex flex-col justify-start overflow-hidden">
            <div className="flex items-center gap-0.5">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-[9px] font-bold truncate" style={{ color: borderColor }}>
                {initials(appointment)}
              </span>
            </div>
            <span className="text-[8px] text-muted-foreground/80 truncate mt-0.5">{timeStart}</span>
            {badge}
          </div>

        /* ── Narrow mode (2-3 columns): name + time ── */
        ) : isNarrow ? (
          <div className="px-1.5 py-0.5 h-full flex flex-col justify-start overflow-hidden">
            <div className="flex items-center gap-1 min-w-0">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-[10px] font-semibold truncate leading-tight" style={{ color: borderColor }}>
                {name}
              </span>
            </div>
            {height >= 38 && (
              <span className="text-[9px] text-muted-foreground truncate mt-0.5">{timeStart}</span>
            )}
            {height >= 52 && serviceName && (
              <span className="text-[9px] text-muted-foreground/70 truncate">{serviceName}</span>
            )}
            {badge}
          </div>

        /* ── Full mode (1 column): all info ── */
        ) : (
          <div className="px-2 py-1 h-full flex flex-col gap-0.5 overflow-hidden">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs font-semibold truncate leading-tight" style={{ color: borderColor }}>
                {name}
              </span>
            </div>
            {serviceName && (
              <span className="text-[10px] text-muted-foreground truncate leading-tight">
                {serviceName}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground/70 truncate">
              {timeStart} – {timeEnd}
            </span>
            {height >= 64 && (
              <span
                className="mt-auto text-[9px] font-semibold uppercase tracking-wide truncate opacity-60"
                style={{ color }}
              >
                {STATUS_LABEL[appointment.status as AppointmentStatus] ?? appointment.status}
              </span>
            )}
            {badge}
          </div>
        )}
      </div>

      {/* ── Overflow popover (rendered in document.body via portal) ── */}
      {popoverOpen && anchorRect && (
        <HiddenPopover
          appointments={hiddenAppointments}
          anchorRect={anchorRect}
          onSelect={onClick}
          onClose={() => setPopoverOpen(false)}
        />
      )}
    </>
  );
}

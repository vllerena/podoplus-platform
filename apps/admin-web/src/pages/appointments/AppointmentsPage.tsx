import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, Plus, CalendarDays,
  Search, SlidersHorizontal, MoreHorizontal,
  Ban, Clock, UserX, CheckCircle2,
} from "lucide-react";
import { Button, Skeleton } from "@podoplus/ui";
import { useAppointments, useServices, type Appointment } from "@/hooks/use-appointments";
import { useBranchStore }    from "@/stores/branch.store";
import { useBranches }       from "@/hooks/use-appointments";
import { AppointmentRow }    from "./components/AppointmentRow";
import { CancelModal }       from "./components/CancelModal";
import { RescheduleModal }   from "./components/RescheduleModal";
import { NewAppointmentDrawer } from "./components/NewAppointmentDrawer";
import { AppointmentDetailSheet } from "./components/AppointmentDetailSheet";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// DEMO MODE — cambiar a `false` cuando el backend tenga citas reales
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_MODE = true;

// ── Fake data ─────────────────────────────────────────────────────────────────

const D   = new Date();
const PAD = (n: number) => String(n).padStart(2, "0");
const DT  = (h: number, m = 0, endH?: number, endM = 0) => ({
  startAt: `${D.getFullYear()}-${PAD(D.getMonth()+1)}-${PAD(D.getDate())}T${PAD(h)}:${PAD(m)}:00`,
  endAt:   `${D.getFullYear()}-${PAD(D.getMonth()+1)}-${PAD(D.getDate())}T${PAD(endH ?? h+0)}:${PAD(endM)}:00`,
});

const FAKE_APPOINTMENTS: Appointment[] = [
  { id:"d1",  ...DT(8,30,9,0),   status:"COMPLETED",  source:"RECEPTION", branchId:"b1", customerId:"c1",  serviceId:"s1", createdAt:"", updatedAt:"", customer:{ id:"c1",  firstName:"María",     lastName:"García López"     }, service:{ id:"s1", name:"Podología Clínica",     durationMinutes:30, color:"#6366f1" } },
  { id:"d2",  ...DT(9,0,9,30),   status:"COMPLETED",  source:"RECEPTION", branchId:"b1", customerId:"c2",  serviceId:"s2", createdAt:"", updatedAt:"", customer:{ id:"c2",  firstName:"Carlos",    lastName:"Rodríguez Díaz"   }, service:{ id:"s2", name:"Tratamiento de Uñas",   durationMinutes:30, color:"#f59e0b" } },
  { id:"d3",  ...DT(9,30,10,0),  status:"COMPLETED",  source:"RECEPTION", branchId:"b1", customerId:"c3",  serviceId:"s3", createdAt:"", updatedAt:"", customer:{ id:"c3",  firstName:"Ana",       lastName:"Martínez Torres"  }, service:{ id:"s3", name:"Podología Deportiva",   durationMinutes:30, color:"#10b981" } },
  { id:"d4",  ...DT(10,0,10,30), status:"COMPLETED",  source:"RECEPTION", branchId:"b1", customerId:"c4",  serviceId:"s4", createdAt:"", updatedAt:"", customer:{ id:"c4",  firstName:"Luis",      lastName:"Sánchez Flores"   }, service:{ id:"s4", name:"Pie Diabético",         durationMinutes:30, color:"#ef4444" } },
  { id:"d5",  ...DT(10,30,11,0), status:"COMPLETED",  source:"RECEPTION", branchId:"b1", customerId:"c5",  serviceId:"s1", createdAt:"", updatedAt:"", customer:{ id:"c5",  firstName:"Rosa",      lastName:"Vargas Mendoza"   }, service:{ id:"s1", name:"Podología Clínica",     durationMinutes:30, color:"#6366f1" } },
  { id:"d6",  ...DT(11,0,11,30), status:"IN_SERVICE", source:"RECEPTION", branchId:"b1", customerId:"c6",  serviceId:"s5", createdAt:"", updatedAt:"", customer:{ id:"c6",  firstName:"Pedro",     lastName:"Quispe Huanca"    }, service:{ id:"s5", name:"Tratamiento de Hongos", durationMinutes:30, color:"#8b5cf6" } },
  { id:"d7",  ...DT(11,30,12,0), status:"CHECKED_IN", source:"PORTAL",    branchId:"b1", customerId:"c7",  serviceId:"s1", createdAt:"", updatedAt:"", customer:{ id:"c7",  firstName:"Elena",     lastName:"Castro Ramos"     }, service:{ id:"s1", name:"Podología Clínica",     durationMinutes:30, color:"#6366f1" } },
  { id:"d8",  ...DT(12,0,12,30), status:"CONFIRMED",  source:"RECEPTION", branchId:"b1", customerId:"c8",  serviceId:"s6", createdAt:"", updatedAt:"", customer:{ id:"c8",  firstName:"Jorge",     lastName:"Lima Palomino"    }, service:{ id:"s6", name:"Verruga Plantar",       durationMinutes:30, color:"#f97316" } },
  { id:"d9",  ...DT(14,0,14,30), status:"CONFIRMED",  source:"PORTAL",    branchId:"b1", customerId:"c9",  serviceId:"s7", createdAt:"", updatedAt:"", customer:{ id:"c9",  firstName:"Carmen",    lastName:"Chávez Ruiz"      }, service:{ id:"s7", name:"Ortesis y Plantillas",  durationMinutes:30, color:"#0ea5e9" } },
  { id:"d10", ...DT(14,30,15,0), status:"CONFIRMED",  source:"RECEPTION", branchId:"b1", customerId:"c10", serviceId:"s1", createdAt:"", updatedAt:"", customer:{ id:"c10", firstName:"Ricardo",   lastName:"Tello Aguilar"    }, service:{ id:"s1", name:"Podología Clínica",     durationMinutes:30, color:"#6366f1" } },
  { id:"d11", ...DT(15,0,15,30), status:"PENDING",    source:"PORTAL",    branchId:"b1", customerId:"c11", serviceId:"s2", createdAt:"", updatedAt:"", customer:{ id:"c11", firstName:"Sofía",     lastName:"Morales Vega"     }, service:{ id:"s2", name:"Tratamiento de Uñas",   durationMinutes:30, color:"#f59e0b" } },
  { id:"d12", ...DT(15,30,16,0), status:"PENDING",    source:"PORTAL",    branchId:"b1", customerId:"c12", serviceId:"s3", createdAt:"", updatedAt:"", customer:{ id:"c12", firstName:"Alejandro", lastName:"Pérez Torres"     }, service:{ id:"s3", name:"Podología Deportiva",   durationMinutes:30, color:"#10b981" } },
  { id:"d13", ...DT(16,0,16,30), status:"PENDING",    source:"RECEPTION", branchId:"b1", customerId:"c13", serviceId:"s1", createdAt:"", updatedAt:"", customer:{ id:"c13", firstName:"Isabel",    lastName:"Herrera Campos"   }, service:{ id:"s1", name:"Podología Clínica",     durationMinutes:30, color:"#6366f1" } },
  { id:"d14", ...DT(16,30,17,0), status:"PENDING",    source:"RECEPTION", branchId:"b1", customerId:"c14", serviceId:"s4", createdAt:"", updatedAt:"", customer:{ id:"c14", firstName:"Miguel",    lastName:"Ángel Flores"     }, service:{ id:"s4", name:"Pie Diabético",         durationMinutes:30, color:"#ef4444" } },
  { id:"d15", ...DT(17,0,17,30), status:"PENDING",    source:"PORTAL",    branchId:"b1", customerId:"c15", serviceId:"s1", createdAt:"", updatedAt:"", customer:{ id:"c15", firstName:"Lucía",     lastName:"Paredes Salinas"  }, service:{ id:"s1", name:"Podología Clínica",     durationMinutes:30, color:"#6366f1" } },
  { id:"d16", ...DT(17,30,18,0), status:"NO_SHOW",    source:"PORTAL",    branchId:"b1", customerId:"c16", serviceId:"s6", createdAt:"", updatedAt:"", customer:{ id:"c16", firstName:"David",     lastName:"Ramos Gutiérrez"  }, service:{ id:"s6", name:"Verruga Plantar",       durationMinutes:30, color:"#f97316" } },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function fmtTime(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function initials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string; pill: string }> = {
  PENDING:     { label: "Pendiente",    dot: "bg-yellow-400",  pill: "bg-yellow-50 text-yellow-700 ring-yellow-200"  },
  CONFIRMED:   { label: "Confirmada",  dot: "bg-blue-400",    pill: "bg-blue-50 text-blue-700 ring-blue-200"        },
  CHECKED_IN:  { label: "En espera",   dot: "bg-purple-400",  pill: "bg-purple-50 text-purple-700 ring-purple-200"  },
  IN_SERVICE:  { label: "En servicio", dot: "bg-indigo-400",  pill: "bg-indigo-50 text-indigo-700 ring-indigo-200"  },
  COMPLETED:   { label: "Completada",  dot: "bg-green-500",   pill: "bg-green-50 text-green-700 ring-green-200"     },
  CANCELED:    { label: "Cancelada",   dot: "bg-red-400",     pill: "bg-red-50 text-red-700 ring-red-200"           },
  NO_SHOW:     { label: "No asistió",  dot: "bg-gray-400",    pill: "bg-gray-50 text-gray-600 ring-gray-200"        },
  RESCHEDULED: { label: "Reprogramada",dot: "bg-orange-400",  pill: "bg-orange-50 text-orange-700 ring-orange-200"  },
};

// ── Filter constants ──────────────────────────────────────────────────────────

const ALL_STATUSES = [
  { value: "",            label: "Todos los estados" },
  { value: "PENDING",     label: "Pendientes"        },
  { value: "CONFIRMED",   label: "Confirmadas"       },
  { value: "CHECKED_IN",  label: "En espera"         },
  { value: "IN_SERVICE",  label: "En servicio"       },
  { value: "COMPLETED",   label: "Completadas"       },
  { value: "CANCELED",    label: "Canceladas"        },
  { value: "NO_SHOW",     label: "No asistieron"     },
];

// ── Demo row (no mutations, just display) ─────────────────────────────────────

function DemoRow({
  appt,
  onDetail,
}: {
  appt:     Appointment;
  onDetail: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const cfg    = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.PENDING;
  const color  = appt.service?.color ?? "#6B7280";
  const cName  = appt.customer
    ? `${appt.customer.firstName} ${appt.customer.lastName}`
    : "—";
  const inits  = appt.customer
    ? initials(appt.customer.firstName, appt.customer.lastName)
    : "?";

  const isActive = ["PENDING","CONFIRMED","CHECKED_IN","IN_SERVICE"].includes(appt.status);

  return (
    <tr
      className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer group"
      onClick={() => onDetail(appt.id)}
    >
      {/* Hora */}
      <td className="px-5 py-3.5 whitespace-nowrap">
        <span className="text-sm font-semibold text-foreground">{fmtTime(appt.startAt)}</span>
        <span className="text-xs text-muted-foreground ml-1">– {fmtTime(appt.endAt)}</span>
      </td>

      {/* Cliente */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span
            className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 ring-2 ring-white"
            style={{ backgroundColor: color }}
          >
            {inits}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{cName}</p>
            {appt.customer?.phone && (
              <p className="text-xs text-muted-foreground">{appt.customer.phone}</p>
            )}
          </div>
        </div>
      </td>

      {/* Servicio */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-sm text-foreground/80 truncate max-w-[180px]">
            {appt.service?.name ?? "—"}
          </span>
        </div>
      </td>

      {/* Estado */}
      <td className="px-5 py-3.5">
        <span className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1",
          cfg.pill,
        )}>
          <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
          {cfg.label}
        </span>
      </td>

      {/* Acciones */}
      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {isActive && (
            <Button size="sm" variant="outline" className="h-7 px-3 text-xs"
              onClick={() => onDetail(appt.id)}>
              <CheckCircle2 size={12} className="mr-1" />
              Gestionar
            </Button>
          )}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <MoreHorizontal size={15} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-44 bg-card border border-border rounded-xl shadow-xl py-1 text-sm">
                  {isActive ? (
                    <>
                      {["PENDING","CONFIRMED"].includes(appt.status) && (
                        <button className="flex items-center gap-2 w-full px-3 py-2 hover:bg-muted/60 text-foreground rounded-lg mx-0.5 transition-colors"
                          onClick={() => setMenuOpen(false)}>
                          <Clock size={13} className="text-orange-500" />Reprogramar
                        </button>
                      )}
                      {appt.status === "CONFIRMED" && (
                        <button className="flex items-center gap-2 w-full px-3 py-2 hover:bg-muted/60 text-foreground rounded-lg transition-colors"
                          onClick={() => setMenuOpen(false)}>
                          <UserX size={13} className="text-muted-foreground" />No asistió
                        </button>
                      )}
                      <button className="flex items-center gap-2 w-full px-3 py-2 hover:bg-destructive/5 text-destructive rounded-lg transition-colors"
                        onClick={() => setMenuOpen(false)}>
                        <Ban size={13} />Cancelar cita
                      </button>
                    </>
                  ) : (
                    <p className="px-3 py-2 text-xs text-muted-foreground">Sin acciones disponibles</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Summary chips ─────────────────────────────────────────────────────────────

function SummaryChips({ appointments }: { appointments: Appointment[] }) {
  const counts = {
    completed:  appointments.filter((a) => a.status === "COMPLETED").length,
    inProgress: appointments.filter((a) => ["IN_SERVICE","CHECKED_IN"].includes(a.status)).length,
    pending:    appointments.filter((a) => ["PENDING","CONFIRMED"].includes(a.status)).length,
    noShow:     appointments.filter((a) => a.status === "NO_SHOW").length,
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {[
        { label: "Completadas", count: counts.completed,  dot: "bg-green-500"  },
        { label: "En curso",    count: counts.inProgress, dot: "bg-indigo-500" },
        { label: "Pendientes",  count: counts.pending,    dot: "bg-yellow-400" },
        { label: "No asistieron", count: counts.noShow,   dot: "bg-gray-400"   },
      ].map(({ label, count, dot }) => (
        <span key={label} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 border border-border/60 px-2.5 py-1 rounded-full">
          <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
          {count} {label}
        </span>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AppointmentsPage() {
  const { activeBranchId, setActiveBranch } = useBranchStore();

  const [date,      setDate]      = useState(todayISO());
  const [status,    setStatus]    = useState("");
  const [serviceId, setServiceId] = useState("");
  const [search,    setSearch]    = useState("");
  const [detailId,  setDetailId]  = useState<string | null>(null);

  const [cancelTarget,     setCancelTarget]     = useState<Appointment | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [drawerOpen,       setDrawerOpen]       = useState(false);

  // Branches — auto-select first on mount
  const { data: allBranches } = useBranches();
  const activeBranches = useMemo(
    () => (allBranches ?? []).filter((b) => b.isActive),
    [allBranches],
  );
  useEffect(() => {
    if (!activeBranchId && activeBranches.length > 0) {
      setActiveBranch(activeBranches[0].id, activeBranches[0].name);
    }
  }, [activeBranches, activeBranchId, setActiveBranch]);

  // Real data query (disabled in DEMO_MODE)
  const { data: realAppts = [], isLoading, error } = useAppointments({
    date,
    branchId:  activeBranchId  ?? undefined,
    status:    status          || undefined,
    serviceId: serviceId       || undefined,
  });

  const { data: services = [] } = useServices();

  const isToday = date === todayISO();

  // In DEMO_MODE, only show fake appointments when viewing today
  const rawAppointments: Appointment[] = DEMO_MODE
    ? (isToday ? FAKE_APPOINTMENTS : [])
    : realAppts;

  // Apply local filters
  const filtered = useMemo(() => {
    let list = rawAppointments;
    if (status)    list = list.filter((a) => a.status === status);
    if (serviceId) list = list.filter((a) => a.serviceId === serviceId || a.service?.id === serviceId);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => {
        const name = `${a.customer?.firstName ?? ""} ${a.customer?.lastName ?? ""}`.toLowerCase();
        return name.includes(q) || (a.customer?.documentNumber ?? "").includes(search);
      });
    }
    return list;
  }, [rawAppointments, status, serviceId, search]);

  // Unique services from fake data (for filter dropdown in demo)
  const demoServices = useMemo(() => {
    if (!DEMO_MODE) return services;
    const seen = new Map<string, { id: string; name: string }>();
    FAKE_APPOINTMENTS.forEach((a) => {
      if (a.service) seen.set(a.service.id, { id: a.service.id, name: a.service.name });
    });
    return [...seen.values()];
  }, [services]);

  const loading = DEMO_MODE ? false : isLoading;

  return (
    <div className="flex flex-col h-full bg-muted/20">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 bg-card border-b border-border shrink-0">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Citas</h1>
            <p className="text-sm text-muted-foreground mt-0.5 capitalize">
              {formatDateHeader(date)}
            </p>
          </div>
          <Button onClick={() => setDrawerOpen(true)} className="gap-1.5 shrink-0">
            <Plus size={15} />
            Nueva cita
          </Button>
        </div>

        {/* ── Filter bar ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">

          {/* Date navigation */}
          <div className="flex items-center rounded-lg border border-border bg-card overflow-hidden">
            <button
              onClick={() => setDate(addDays(date, -1))}
              className="px-2.5 py-2 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => setDate(todayISO())}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors border-x border-border",
                isToday
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              Hoy
            </button>
            <button
              onClick={() => setDate(addDays(date, 1))}
              className="px-2.5 py-2 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Date picker */}
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />

          {/* Branch selector */}
          {activeBranches.length > 1 && (
            <select
              value={activeBranchId ?? ""}
              onChange={(e) => {
                const b = activeBranches.find((x) => x.id === e.target.value);
                setActiveBranch(e.target.value || null, b?.name ?? null);
              }}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            >
              <option value="">Todas las sedes</option>
              {activeBranches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-border bg-card pl-8 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors w-44"
            />
          </div>

          {/* Status filter */}
          <div className="relative">
            <SlidersHorizontal size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-border bg-card pl-8 pr-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors appearance-none"
            >
              {ALL_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Service filter */}
          {demoServices.length > 0 && (
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            >
              <option value="">Todos los servicios</option>
              {demoServices.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          {/* Count */}
          <span className="ml-auto text-sm text-muted-foreground font-medium">
            {filtered.length} cita{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Summary chips — only when there are appointments */}
        {filtered.length > 0 && !loading && (
          <div className="mt-3">
            <SummaryChips appointments={filtered} />
          </div>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">

          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>

          ) : error && !DEMO_MODE ? (
            <div className="flex flex-col items-center justify-center py-20 text-destructive">
              <CalendarDays size={36} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">Error al cargar las citas</p>
              <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
            </div>

          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <CalendarDays size={28} className="text-muted-foreground/50" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {search || status || serviceId
                  ? "Sin resultados para los filtros aplicados"
                  : "No hay citas para este día"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                {search || status || serviceId
                  ? "Prueba ajustando los filtros"
                  : "Usa el botón \"Nueva cita\" para agendar"}
              </p>
              {!search && !status && !serviceId && (
                <Button size="sm" onClick={() => setDrawerOpen(true)}>
                  <Plus size={14} className="mr-1.5" />Nueva cita
                </Button>
              )}
            </div>

          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-32">Hora</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Servicio</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-36">Estado</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-44">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((appt) =>
                    DEMO_MODE ? (
                      <DemoRow
                        key={appt.id}
                        appt={appt}
                        onDetail={setDetailId}
                      />
                    ) : (
                      <AppointmentRow
                        key={appt.id}
                        appointment={appt}
                        onCancel={setCancelTarget}
                        onReschedule={setRescheduleTarget}
                      />
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {DEMO_MODE && filtered.length > 0 && (
          <p className="text-center text-xs text-muted-foreground/40 mt-3 pb-1">
            ⚠️ Modo demo — datos simulados para visualización
          </p>
        )}
      </div>

      {/* ── Modals / sheets ─────────────────────────────────────────────── */}
      {!DEMO_MODE && (
        <>
          <CancelModal appointment={cancelTarget} onClose={() => setCancelTarget(null)} />
          <RescheduleModal appointment={rescheduleTarget} onClose={() => setRescheduleTarget(null)} />
        </>
      )}

      <AppointmentDetailSheet
        appointmentId={detailId}
        onClose={() => setDetailId(null)}
      />

      <NewAppointmentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        defaultDate={date}
        defaultBranchId={activeBranchId ?? undefined}
      />
    </div>
  );
}

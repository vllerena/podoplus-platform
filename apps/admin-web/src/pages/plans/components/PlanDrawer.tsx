import { useState, useEffect } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
  Button, Input, Label, Textarea, Separator, Select,
  SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@podoplus/ui";
import {
  useCreatePlan, useUpdatePlan,
  type Plan, type CreatePlanInput, type PlanType,
} from "@/hooks/use-plans";
import { cn } from "@/lib/utils";
import { Tag, Package, CalendarDays, Layers, Info } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

interface PlanTypeOption {
  value:       PlanType;
  label:       string;
  icon:        React.ReactNode;
  description: string;
  hint:        string;
}

const PLAN_TYPE_OPTIONS: PlanTypeOption[] = [
  {
    value: "HYBRID",
    label: "Sesiones + fecha",
    icon: <Layers size={14} />,
    description: "Vence cuando se agotan las sesiones O cuando expira la fecha (lo que ocurra primero).",
    hint:        "Recomendado — ideal para planes anuales, semestrales y paquetes de Podoplus.",
  },
  {
    value: "SESSION",
    label: "Solo por sesiones",
    icon: <Tag size={14} />,
    description: "El plan se agota únicamente cuando se consumen todas las sesiones incluidas. No expira por fecha.",
    hint:        "Útil para paquetes sin fecha de vencimiento.",
  },
  {
    value: "DATE",
    label: "Solo por fecha",
    icon: <CalendarDays size={14} />,
    description: "El plan vence al cumplirse la duración en días, sin importar el número de sesiones usadas.",
    hint:        "Útil para suscripciones con sesiones ilimitadas en un período.",
  },
];

// Duración rápida: presets en días
const DURATION_PRESETS: { label: string; days: number }[] = [
  { label: "30 d",    days: 30 },
  { label: "6 meses", days: 180 },
  { label: "1 año",   days: 365 },
];

const PRESET_COLORS = [
  { hex: "#3b82f6", name: "Azul" },
  { hex: "#0ea5e9", name: "Cielo" },
  { hex: "#06b6d4", name: "Cyan" },
  { hex: "#14b8a6", name: "Teal" },
  { hex: "#22c55e", name: "Verde" },
  { hex: "#8b5cf6", name: "Violeta" },
  { hex: "#6366f1", name: "Índigo" },
  { hex: "#ec4899", name: "Rosa" },
  { hex: "#f97316", name: "Naranja" },
  { hex: "#eab308", name: "Amarillo" },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open:    boolean;
  onClose: () => void;
  plan:    Plan | null; // null = crear
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlanDrawer({ open, onClose, plan }: Props) {
  const isEdit = !!plan;

  const [name,             setName]            = useState("");
  const [description,      setDescription]     = useState("");
  const [planType,         setPlanType]        = useState<PlanType>("HYBRID");
  const [price,            setPrice]           = useState("");
  const [durationDays,     setDurationDays]    = useState("");
  const [includedSessions, setIncludedSessions]= useState("");
  const [color,            setColor]           = useState<string>(PRESET_COLORS[0].hex);
  const [isActive,         setIsActive]        = useState(true);

  const createMut = useCreatePlan();
  const updateMut = useUpdatePlan(plan?.id ?? "");

  // Populate on open
  useEffect(() => {
    if (open) {
      if (plan) {
        setName(plan.name);
        setDescription(plan.description ?? "");
        setPlanType(plan.planType);
        setPrice(String(parseFloat(plan.price) || ""));
        setDurationDays(String(plan.durationDays || ""));
        setIncludedSessions(
          plan.includedSessions === "unlimited" || plan.planType === "DATE"
            ? ""
            : String(plan.includedSessions || ""),
        );
        setColor(plan.color ?? PRESET_COLORS[0].hex);
        setIsActive(plan.isActive);
      } else {
        setName(""); setDescription(""); setPlanType("HYBRID");
        setPrice(""); setDurationDays(""); setIncludedSessions("");
        setColor(PRESET_COLORS[0].hex); setIsActive(true);
      }
    }
  }, [open, plan]);

  const isPending    = createMut.isPending || updateMut.isPending;
  const showSessions = planType === "SESSION" || planType === "HYBRID";
  const priceNum     = parseFloat(price);
  const sessionsNum  = parseInt(includedSessions);
  const daysNum      = parseInt(durationDays);
  const pricePerSes  = showSessions && sessionsNum > 0 && priceNum > 0
    ? `S/ ${(priceNum / sessionsNum).toFixed(0)} por sesión`
    : null;

  const canSave =
    name.trim().length > 0 &&
    priceNum > 0 &&
    daysNum > 0 &&
    (planType === "DATE" || sessionsNum > 0);

  const selectedTypeOption = PLAN_TYPE_OPTIONS.find((o) => o.value === planType)!;

  const handleSave = async () => {
    if (!canSave) return;

    const body: CreatePlanInput = {
      name:               name.trim(),
      description:        description.trim() || undefined,
      plan_type:          planType,
      price:              priceNum,
      duration_days:      daysNum,
      included_sessions:  showSessions ? sessionsNum : undefined,
      is_active:          isActive,
      color:              color || undefined,
    };

    try {
      if (isEdit) {
        const { plan_type: _pt, ...updateBody } = body;
        await updateMut.mutateAsync(updateBody);
      } else {
        await createMut.mutateAsync(body);
      }
      onClose();
    } catch { /* toasted in hook */ }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto flex flex-col gap-0 p-0">

        <SheetHeader className="px-5 pt-5 pb-4 border-b shrink-0">
          <SheetTitle className="text-base">
            {isEdit ? "Editar plan" : "Nuevo plan"}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {isEdit
              ? "Modifica los datos del plan de suscripción."
              : "Define un nuevo plan o paquete para asignar a clientes."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* ── Tipo de plan ─────────────────────────────────────────── */}
          <section className="space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Tipo de plan
            </Label>

            <div className="grid grid-cols-1 gap-2">
              {PLAN_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isEdit}
                  onClick={() => !isEdit && setPlanType(opt.value)}
                  className={cn(
                    "relative text-left rounded-lg border p-3 transition-all",
                    planType === opt.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border hover:border-muted-foreground/40 hover:bg-muted/30",
                    isEdit && "cursor-not-allowed opacity-60",
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "flex items-center gap-1 text-xs font-semibold",
                      planType === opt.value ? "text-primary" : "text-foreground",
                    )}>
                      {opt.icon}
                      {opt.label}
                    </span>
                    {opt.value === "HYBRID" && (
                      <span className="ml-auto text-[10px] bg-primary/10 text-primary rounded-full px-1.5 py-0.5 font-semibold">
                        Recomendado
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {opt.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Hint */}
            <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              <Info size={12} className="shrink-0 mt-0.5 text-primary/60" />
              <span>{selectedTypeOption.hint}</span>
            </div>

            {isEdit && (
              <p className="text-[11px] text-muted-foreground italic">
                El tipo no puede modificarse una vez creado.
              </p>
            )}
          </section>

          <Separator />

          {/* ── Información básica ───────────────────────────────────── */}
          <section className="space-y-4">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Información básica
            </Label>

            <div className="space-y-1.5">
              <Label className="text-sm">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="ej. PLAN ANUAL X 3"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
              <p className="text-[11px] text-muted-foreground">
                Usa MAYÚSCULAS para planes y paquetes de producción.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">
                Descripción{" "}
                <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Textarea
                placeholder="Describe brevemente los beneficios del plan…"
                rows={2}
                className="resize-none text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
              />
            </div>
          </section>

          <Separator />

          {/* ── Precio y duración ────────────────────────────────────── */}
          <section className="space-y-4">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Precio y duración
            </Label>

            <div className="grid grid-cols-2 gap-3">
              {/* Precio */}
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Precio <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
                    S/
                  </span>
                  <Input
                    type="number" min="0" step="1" placeholder="0"
                    className="pl-8"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
                {pricePerSes && (
                  <p className="text-[11px] text-primary font-medium">{pricePerSes}</p>
                )}
              </div>

              {/* Sesiones incluidas */}
              {showSessions ? (
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    Nro. sesiones <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number" min="1" step="1" placeholder="1"
                    value={includedSessions}
                    onChange={(e) => setIncludedSessions(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {planType === "HYBRID"
                      ? "El plan vence al agotar las sesiones o al expirar la vigencia."
                      : "El plan vence al consumir todas las sesiones."}
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Sesiones</Label>
                  <div className="h-9 flex items-center px-3 rounded-md border border-border/60 bg-muted/30">
                    <span className="text-xs text-muted-foreground">Ilimitadas (solo fecha)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Vigencia */}
            <div className="space-y-2">
              <Label className="text-sm">
                Vigencia <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => setDurationDays(String(preset.days))}
                    className={cn(
                      "flex-1 rounded-md border text-xs font-medium py-1.5 transition-colors",
                      String(durationDays) === String(preset.days)
                        ? "bg-primary/10 border-primary/40 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Input
                  type="number" min="1" step="1" placeholder="Días de vigencia"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  className="text-sm"
                />
                {daysNum > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                    {daysNum === 365 ? "1 año" : daysNum === 180 ? "6 meses" : daysNum === 30 ? "1 mes" : `${daysNum} días`}
                  </span>
                )}
              </div>
            </div>
          </section>

          <Separator />

          {/* ── Apariencia ───────────────────────────────────────────── */}
          <section className="space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Color de identificación
            </Label>

            <div className="flex flex-wrap gap-2.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.name}
                  onClick={() => setColor(c.hex)}
                  className={cn(
                    "h-7 w-7 rounded-full transition-all border-2",
                    color === c.hex
                      ? "border-foreground scale-110 shadow-md"
                      : "border-transparent hover:scale-110 hover:border-muted-foreground/40",
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/30 border border-border/50">
              <div
                className="h-4 w-4 rounded-full shrink-0 shadow-sm border border-white/40"
                style={{ backgroundColor: color }}
              />
              <span className="text-[11px] text-muted-foreground">
                Vista previa: la barra superior de la card usará este color
              </span>
            </div>
          </section>

          <Separator />

          {/* ── Estado ───────────────────────────────────────────────── */}
          <section className="space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Estado
            </Label>
            <Select
              value={isActive ? "true" : "false"}
              onValueChange={(v) => setIsActive(v === "true")}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Activo — visible y asignable a clientes
                  </span>
                </SelectItem>
                <SelectItem value="false">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                    Inactivo — no asignable a nuevos clientes
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </section>

        </div>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <SheetFooter className="px-5 py-4 border-t shrink-0 gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={!canSave || isPending}
            onClick={handleSave}
          >
            {isPending
              ? (isEdit ? "Guardando…" : "Creando…")
              : (isEdit ? "Guardar cambios" : "Crear plan")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

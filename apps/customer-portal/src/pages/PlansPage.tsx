import { useState } from "react";
import { DEMO_PLANS, DEMO_ACTIVE_PLAN } from "@/lib/demo-data";

// ── Helpers ────────────────────────────────────────────────────────────────────

type Plan = (typeof DEMO_PLANS)[number];

// ── Upgrade modal ──────────────────────────────────────────────────────────────

function UpgradeModal({ plan, onClose }: { plan: Plan; onClose: () => void }) {
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
          <div className="text-4xl mb-3">💳</div>
          <h2 className="text-base font-black text-slate-800">
            {plan.isCurrent ? "Tu plan actual" : `Cambiar a ${plan.name}`}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {plan.isCurrent
              ? "Ya cuentas con este plan. ¡Sigue disfrutándolo!"
              : `S/ ${plan.price} / ${plan.period} · ${plan.sessions} sesiones`}
          </p>
        </div>

        <div className="rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 text-xs text-brand-700 leading-relaxed text-center">
          Para cambiar de plan comunícate con nosotros por WhatsApp o llama a tu sede. En la próxima versión podrás gestionarlo aquí.
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
            Consultar por WhatsApp
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

// ── Plan card ──────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  onSelect,
}: {
  plan:     Plan;
  onSelect: (plan: Plan) => void;
}) {
  const isCurrent = plan.isCurrent;

  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-card transition-all"
      style={isCurrent ? {
        outline: `2.5px solid ${plan.color}`,
        outlineOffset: "2px",
      } : undefined}
    >
      {/* Popular badge */}
      {plan.isPopular && (
        <div
          className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-wide shadow-md"
          style={{ backgroundColor: plan.color }}
        >
          ⭐ Más popular
        </div>
      )}

      {/* Current plan badge */}
      {isCurrent && (
        <div
          className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-wide shadow-md"
          style={{ backgroundColor: plan.color }}
        >
          ✓ Tu plan
        </div>
      )}

      {/* Header gradient */}
      <div className={`bg-gradient-to-br ${plan.gradient} px-5 pt-10 pb-5`}>
        <p className="text-white/80 text-xs font-semibold uppercase tracking-wider mb-1">
          {plan.name}
        </p>
        <div className="flex items-end gap-1">
          <span className="text-white text-3xl font-black">S/ {plan.price}</span>
          <span className="text-white/70 text-sm mb-1">/ {plan.period}</span>
        </div>
        <p className="text-white/80 text-xs mt-1">
          {plan.sessions} sesiones · {Math.round(plan.price / plan.sessions)} soles por sesión
        </p>
      </div>

      {/* Features */}
      <div className="bg-white px-5 py-4 space-y-2.5">
        {plan.features.map((feat) => (
          <div key={feat} className="flex items-start gap-2.5 text-xs text-slate-700">
            <span
              className="h-4 w-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5"
              style={{ backgroundColor: plan.color }}
            >
              ✓
            </span>
            <span className="leading-relaxed">{feat}</span>
          </div>
        ))}

        {plan.notIncluded.map((feat) => (
          <div key={feat} className="flex items-start gap-2.5 text-xs text-slate-400">
            <span className="h-4 w-4 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 text-[10px] font-bold shrink-0 mt-0.5">
              ✕
            </span>
            <span className="leading-relaxed">{feat}</span>
          </div>
        ))}

        {/* CTA */}
        <div className="pt-2">
          <button
            onClick={() => onSelect(plan)}
            className={`w-full py-2.5 rounded-xl text-sm font-bold active:scale-[0.98] transition-all ${
              isCurrent
                ? "bg-slate-100 text-slate-500 cursor-default"
                : "text-white shadow-md"
            }`}
            style={!isCurrent ? { backgroundColor: plan.color } : undefined}
          >
            {isCurrent ? "Plan activo" : "Contratar plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function PlansPage() {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const plan = DEMO_ACTIVE_PLAN;
  const pct  = Math.round((plan.sessionsUsed / plan.sessions) * 100);

  return (
    <div className="pb-6">
      {/* ── Top bar ── */}
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-xl font-black text-slate-900">Planes y afiliaciones</h1>
        <p className="text-xs text-slate-400 mt-0.5">Elige el plan que mejor se adapta a ti</p>
      </div>

      {/* ── Active plan widget ── */}
      <div className="mx-4 mb-5">
        <div
          className="rounded-2xl p-4 text-white shadow-lg"
          style={{
            background: `linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)`,
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">
                Plan activo
              </p>
              <h2 className="text-white font-black text-lg mt-0.5">{plan.name}</h2>
            </div>
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
              💳
            </div>
          </div>

          {/* Sessions progress */}
          <div className="space-y-1.5 mb-3">
            <div className="flex justify-between text-xs">
              <span className="text-white/80">Sesiones usadas</span>
              <span className="text-white font-bold">
                {plan.sessionsUsed} / {plan.sessions}
              </span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-white/70">Vence el {plan.expiresAt}</span>
            <span className="text-white font-semibold">
              {plan.sessionsLeft} sesiones disponibles
            </span>
          </div>
        </div>
      </div>

      {/* ── Section title ── */}
      <div className="px-4 mb-3">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Planes disponibles
        </p>
      </div>

      {/* ── Plan cards ── */}
      <div className="px-4 space-y-4">
        {DEMO_PLANS.map((p) => (
          <PlanCard key={p.id} plan={p} onSelect={setSelectedPlan} />
        ))}
      </div>

      {/* ── Footer note ── */}
      <div className="mx-4 mt-5 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
        <p className="text-xs text-slate-400 leading-relaxed text-center">
          Los planes se renuevan automáticamente cada mes. Puedes cancelar en cualquier momento contactando a tu sede. Las sesiones no utilizadas no se acumulan.
        </p>
      </div>

      {/* ── Upgrade modal ── */}
      {selectedPlan && (
        <UpgradeModal
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
        />
      )}
    </div>
  );
}

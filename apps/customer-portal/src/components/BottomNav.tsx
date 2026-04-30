import { useLocation, useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  {
    path:  "/",
    label: "Inicio",
    icon:  (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"}
           stroke="currentColor" strokeWidth={active ? 0 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    path:  "/citas",
    label: "Mis citas",
    icon:  (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8"  y1="2" x2="8"  y2="6" />
        <line x1="3"  y1="10" x2="21" y2="10" />
        {active && <circle cx="12" cy="16" r="2" fill="currentColor" />}
      </svg>
    ),
  },
  {
    path:  "/agendar",
    label: "Agendar",
    icon:  (_active: boolean) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
           stroke="white" strokeWidth={2.5} strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5"  y1="12" x2="19" y2="12" />
      </svg>
    ),
    isCta: true,
  },
  {
    path:  "/planes",
    label: "Planes",
    icon:  (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
        {active && <line x1="6" y1="15" x2="10" y2="15" strokeWidth={3} />}
      </svg>
    ),
  },
  {
    path:  "/perfil",
    label: "Perfil",
    icon:  (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"}
           stroke="currentColor" strokeWidth={active ? 0 : 2} strokeLinecap="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="shrink-0 border-t border-slate-200 bg-white pb-safe">
      <div className="flex items-end h-16">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.path;

          if (item.isCta) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex-1 flex flex-col items-center pb-2"
              >
                {/* Floating action button */}
                <div className="h-12 w-12 -mt-5 rounded-full bg-brand-gradient shadow-lg
                                flex items-center justify-center
                                active:scale-95 transition-transform">
                  {item.icon(false)}
                </div>
                <span className="text-[10px] font-medium text-slate-500 mt-1">{item.label}</span>
              </button>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full
                          transition-colors ${active ? "text-brand-600" : "text-slate-400"}`}
            >
              {item.icon(active)}
              <span className={`text-[10px] font-medium ${active ? "text-brand-600" : "text-slate-400"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

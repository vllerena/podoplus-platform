import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider }        from "@tanstack/react-query";

import { AppShell }          from "@/components/AppShell";
import { LoginPage }         from "@/pages/LoginPage";
import { HomePage }          from "@/pages/HomePage";
import { ProfilePage }       from "@/pages/ProfilePage";
import { BookingPage }       from "@/pages/BookingPage";
import { AppointmentsPage }  from "@/pages/AppointmentsPage";
import { PlansPage }         from "@/pages/PlansPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 1000 * 60 },
  },
});

// ── Phone-frame wrapper (centers app on desktop like a phone) ─────────────────

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-200 sm:flex sm:items-start sm:justify-center sm:pt-6 sm:pb-6">
      <div
        className="
          relative w-full h-full
          sm:w-[390px] sm:min-h-[780px] sm:max-h-[900px]
          sm:rounded-[2.5rem] sm:overflow-hidden
          sm:shadow-2xl sm:border-4 sm:border-slate-900
          flex flex-col bg-white
        "
        style={{ minHeight: "100svh" }}
      >
        {/* Status bar (decorative, desktop only) */}
        <div className="hidden sm:flex items-center justify-between px-8 py-2 bg-white shrink-0">
          <span className="text-[11px] font-bold text-slate-900">9:41</span>
          <div className="flex items-center gap-1.5">
            <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor" className="text-slate-900">
              <rect x="0" y="7" width="3" height="5" rx="0.5"/>
              <rect x="4.5" y="4" width="3" height="8" rx="0.5"/>
              <rect x="9" y="1.5" width="3" height="10.5" rx="0.5"/>
              <rect x="13.5" y="0" width="2.5" height="12" rx="0.5" opacity="0.3"/>
            </svg>
            <svg width="16" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.5" className="text-slate-900">
              <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
              <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
              <circle cx="12" cy="20" r="1" fill="currentColor"/>
            </svg>
            <svg width="25" height="12" viewBox="0 0 25 12" fill="currentColor" className="text-slate-900">
              <rect x="0" y="1" width="22" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <rect x="1.5" y="2.5" width="16" height="7" rx="1"/>
              <path d="M23 4.5v3c.825-.413 1-1 1-1.5s-.175-1.087-1-1.5z"/>
            </svg>
          </div>
        </div>

        {/* App content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PhoneFrame>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected — needs auth */}
            <Route element={<AppShell />}>
              <Route path="/"        element={<HomePage />} />
              <Route path="/agendar" element={<BookingPage />} />
              <Route path="/citas"   element={<AppointmentsPage />} />
              <Route path="/planes"  element={<PlansPage />} />
              <Route path="/perfil"  element={<ProfilePage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PhoneFrame>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

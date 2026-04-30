import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/lib/auth-store";
import { BottomNav }   from "./BottomNav";

/**
 * Protected layout: redirects to /login if not authenticated.
 * Renders the shared bottom nav + page content.
 */
export function AppShell() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  if (!isLoggedIn) return <Navigate to="/login" replace />;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Page content — scrollable */}
      <main className="flex-1 overflow-y-auto scrollbar-hide">
        <Outlet />
      </main>

      {/* Sticky bottom navigation */}
      <BottomNav />
    </div>
  );
}

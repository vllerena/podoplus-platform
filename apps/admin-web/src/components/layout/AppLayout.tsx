import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header }  from "./Header";
import { useRealtimeInit } from "@/hooks/use-realtime";
import { useMe }            from "@/hooks/use-me";
import { useBranchStore }   from "@/stores/branch.store";

export function AppLayout() {
  const [collapsed,  setCollapsed]  = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleClose = () => setMobileOpen(false);

  // Sincroniza roles, permisos y sucursales del usuario desde el servidor.
  const meQuery = useMe();

  // Inicia la conexión WebSocket mientras el usuario esté autenticado.
  // Se desconecta automáticamente al hacer logout (accessToken = null).
  useRealtimeInit();

  // Valida la sucursal seleccionada cada vez que /me devuelve branches[].
  // Garantiza que la selección persistida siga siendo accesible.
  const validateBranch = useBranchStore((s) => s.validateBranch);
  useEffect(() => {
    if (meQuery.data) {
      const branches     = meQuery.data.branches ?? [];
      const isSuperAdmin = meQuery.data.roles?.includes("SUPER_ADMIN") ?? false;
      validateBranch(branches, isSuperAdmin);
    }
  }, [meQuery.data, validateBranch]);

  return (
    <div className="flex h-screen bg-muted/30 overflow-hidden">
      {/* Sidebar — desktop siempre visible; mobile como overlay */}
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggle={() => setCollapsed((v) => !v)}
        onClose={handleClose}
      />

      {/* Contenido principal */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header onMenuClick={() => setMobileOpen((v) => !v)} />

        <main className="flex-1 overflow-auto bg-background animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/**
 * use-branch-context.ts
 * Hook de conveniencia: fusiona auth store + branch store en una sola API.
 *
 * Úsalo en cualquier página o componente que necesite filtrar por sucursal:
 *
 *   const { activeBranchId, canSwitch } = useBranchContext();
 *   const { data } = useWhatsappLogs({ branchId: activeBranchId ?? undefined });
 */
import { useAuthStore }   from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";

export function useBranchContext() {
  const user             = useAuthStore((s) => s.user);
  const isSuperAdmin     = useAuthStore((s) => s.hasRole("SUPER_ADMIN"));
  const activeBranchId   = useBranchStore((s) => s.activeBranchId);
  const activeBranchName = useBranchStore((s) => s.activeBranchName);
  const setActiveBranch  = useBranchStore((s) => s.setActiveBranch);

  const branches = user?.branches ?? [];

  /**
   * El usuario puede cambiar de sucursal si es SUPER_ADMIN
   * o si tiene acceso a más de una.
   */
  const canSwitch = isSuperAdmin || branches.length > 1;

  /**
   * Etiqueta legible para la sucursal activa.
   * "Todas las sedes" cuando activeBranchId es null.
   */
  const activeBranchLabel =
    activeBranchId ? (activeBranchName ?? activeBranchId) : "Todas las sedes";

  return {
    /** ID de la sucursal seleccionada, o null = todas. */
    activeBranchId,
    /** Nombre de la sucursal seleccionada, o null. */
    activeBranchName,
    /** Etiqueta lista para mostrar en UI. */
    activeBranchLabel,
    /** Sucursales accesibles para el usuario actual. */
    branches,
    /** True si el usuario actual es SUPER_ADMIN. */
    isSuperAdmin,
    /** True si tiene sentido mostrar el selector de sucursal. */
    canSwitch,
    /** Cambia la sucursal activa (null = todas). */
    setActiveBranch,
  };
}

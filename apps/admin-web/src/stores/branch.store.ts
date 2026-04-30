/**
 * branch.store.ts
 * Contexto de sucursal activa — persiste en localStorage.
 *
 * Reglas de selección:
 *  - SUPER_ADMIN: puede elegir "Todas las sedes" (null) o cualquier sucursal.
 *  - Usuario con una sola sucursal: se auto-selecciona al cargar /me.
 *  - Usuario con varias sucursales: empieza en null hasta que elija.
 *  - Si la sucursal guardada ya no está en branches[], se resetea.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface BranchOption {
  id:   string;
  name: string;
}

interface BranchState {
  activeBranchId:   string | null;
  activeBranchName: string | null;

  /** Selecciona una sucursal (null = todas las sedes). */
  setActiveBranch: (id: string | null, name?: string | null) => void;

  /** Limpia la selección (usado al hacer logout). */
  clearBranch: () => void;

  /**
   * Valida la selección persistida contra la lista de sucursales accesibles.
   * Llamar justo después de que /v1/auth/me resuelva con branches[] actualizados.
   *
   * Casos cubiertos:
   *  1. Sucursal guardada ya no es accesible → resetea (SUPER_ADMIN a null, otros al primero).
   *  2. Usuario con exactamente 1 sucursal y sin selección → auto-selecciona.
   *  3. SUPER_ADMIN sin selección → mantiene null (vista global).
   */
  validateBranch: (branches: BranchOption[], isSuperAdmin: boolean) => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set, get) => ({
      activeBranchId:   null,
      activeBranchName: null,

      setActiveBranch: (id, name) =>
        set({ activeBranchId: id, activeBranchName: name ?? null }),

      clearBranch: () =>
        set({ activeBranchId: null, activeBranchName: null }),

      validateBranch: (branches, isSuperAdmin) => {
        const { activeBranchId } = get();

        if (activeBranchId) {
          const found = branches.find((b) => b.id === activeBranchId);
          if (!found) {
            // Sucursal guardada ya no es accesible
            if (isSuperAdmin) {
              set({ activeBranchId: null, activeBranchName: null });
            } else {
              const first = branches[0];
              set({
                activeBranchId:   first?.id   ?? null,
                activeBranchName: first?.name ?? null,
              });
            }
          }
          // Selección válida — no tocar
          return;
        }

        // Sin selección: auto-seleccionar si hay exactamente una sucursal
        if (!isSuperAdmin && branches.length === 1) {
          set({ activeBranchId: branches[0].id, activeBranchName: branches[0].name });
        }
        // SUPER_ADMIN o multi-sucursal sin selección → mantiene null
      },
    }),
    {
      name: "podoplus-branch",
      partialize: (state) => ({
        activeBranchId:   state.activeBranchId,
        activeBranchName: state.activeBranchName,
      }),
    },
  ),
);

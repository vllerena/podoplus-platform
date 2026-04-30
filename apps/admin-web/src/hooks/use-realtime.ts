/**
 * use-realtime.ts
 *
 * Gestiona la conexión Socket.IO al namespace /realtime del backend.
 * - Se conecta automáticamente cuando el usuario está autenticado
 * - Se desconecta al hacer logout (accessToken = null)
 * - Suscribe al room `branch:<branchId>` cuando se proporciona
 * - Invalida queries de TanStack Query al recibir eventos relevantes
 * - Actualiza el contador de notificaciones no leídas en tiempo real
 */

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { notifKeys } from "./use-notifications";

// ── Constantes ────────────────────────────────────────────────────────────────

const SOCKET_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3000");

// Eventos que invalidan queries específicas al recibirlos
const QUERY_INVALIDATIONS: Record<string, string[][]> = {
  "appointment:created":    [["appointments"]],
  "appointment:confirmed":  [["appointments"]],
  "appointment:checked_in": [["appointments"]],
  "appointment:in_service": [["appointments"]],
  "appointment:completed":  [["appointments"]],
  "appointment:canceled":   [["appointments"]],
  "appointment:rescheduled":[["appointments"]],
  "appointment:no_show":    [["appointments"]],
  "sale:created":           [["sales"], ["cash-register"]],
  "sale:voided":            [["sales"]],
  "hold:created":           [["appointments"]],
  "hold:released":          [["appointments"]],
  "hold:expired":           [["appointments"]],
  "availability:updated":   [["appointments"]],
};

// ── Singleton socket ──────────────────────────────────────────────────────────
// Mantenemos UNA sola instancia fuera del ciclo de React para evitar
// reconexiones múltiples si el hook se monta en varios componentes.

let socketInstance: Socket | null = null;
let currentToken: string | null   = null;

// ── Hook principal ────────────────────────────────────────────────────────────

interface UseRealtimeOptions {
  /** ID de sucursal a la que suscribirse. Si se omite, solo escucha eventos globales. */
  branchId?: string;
}

export function useRealtime({ branchId }: UseRealtimeOptions = {}) {
  const qc          = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const socketRef   = useRef<Socket | null>(null);

  // ── Invalidar queries al recibir un evento ────────────────────────────────

  const handleEvent = useCallback(
    (event: string) => {
      // Invalidar queries relacionadas con el evento
      const keys = QUERY_INVALIDATIONS[event] ?? [];
      keys.forEach((key) => qc.invalidateQueries({ queryKey: key }));

      // Todo evento implica que puede haber una nueva notificación en la BD
      qc.invalidateQueries({ queryKey: notifKeys.unreadCount() });
      qc.invalidateQueries({ queryKey: notifKeys.all });
    },
    [qc]
  );

  // ── Conectar / desconectar según accessToken ──────────────────────────────

  useEffect(() => {
    if (!accessToken) {
      // Usuario no autenticado — desconectar si había socket previo
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
        currentToken  = null;
      }
      return;
    }

    // Si ya existe un socket con el mismo token, reutilizarlo
    if (socketInstance && currentToken === accessToken) {
      socketRef.current = socketInstance;
      return;
    }

    // Desconectar socket previo (token cambió = refresh)
    if (socketInstance) {
      socketInstance.disconnect();
    }

    // Crear nueva conexión
    const socket = io(`${SOCKET_URL}/realtime`, {
      transports:      ["websocket", "polling"],
      auth:            { token: accessToken },
      reconnection:    true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });

    socket.on("connect", () => {
      console.debug("[Realtime] Conectado:", socket.id);
    });

    socket.on("connected", () => {
      // Confirmación del servidor — suscribir rooms si hay branchId
      if (branchId) {
        socket.emit("subscribe:branch", { branchId });
      }
    });

    socket.on("connect_error", (err) => {
      console.warn("[Realtime] Error de conexión:", err.message);
    });

    socket.on("disconnect", (reason) => {
      console.debug("[Realtime] Desconectado:", reason);
    });

    // Registrar handlers para todos los eventos relevantes
    Object.keys(QUERY_INVALIDATIONS).forEach((event) => {
      socket.on(event, () => handleEvent(event));
    });

    socketInstance = socket;
    currentToken   = accessToken;
    socketRef.current = socket;

    return () => {
      // NO desconectamos al desmontar el componente (singleton),
      // solo limpiamos la referencia local.
      socketRef.current = null;
    };
  }, [accessToken, branchId, handleEvent]);

  // ── Suscripción dinámica a branch ─────────────────────────────────────────

  useEffect(() => {
    const socket = socketRef.current ?? socketInstance;
    if (!socket?.connected || !branchId) return;

    socket.emit("subscribe:branch", { branchId });

    return () => {
      socket.emit("unsubscribe:branch", { branchId });
    };
  }, [branchId]);

  // ── API pública del hook ──────────────────────────────────────────────────

  const isConnected = useCallback(() => {
    return socketInstance?.connected ?? false;
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    socketInstance?.emit(event, data);
  }, []);

  return { isConnected, emit };
}

// ── Hook de inicialización global ─────────────────────────────────────────────
// Se monta una sola vez en App para mantener la conexión activa
// sin depender de que una página específica esté montada.

export function useRealtimeInit() {
  return useRealtime({});
}

import { Injectable, Logger } from "@nestjs/common";
import { RealtimeGateway } from "./realtime.gateway";
import { WebSocketEvent } from "../../websocket_types";
import {
  HoldCreatedPayload,
  HoldReleasedPayload,
  AppointmentCreatedPayload,
  AppointmentStatusChangedPayload,
  AvailabilityUpdatedPayload,
} from "../../websocket_types";

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger("RealtimeService");
  private gateway: RealtimeGateway;

  setGateway(gateway: RealtimeGateway) {
    this.gateway = gateway;
  }

  /**
   * Emite evento cuando se crea un hold
   */
  notifyHoldCreated(payload: HoldCreatedPayload) {
    const room = `branch:${payload.branch_id}`;
    this.gateway.emitToRoom(room, WebSocketEvent.HOLD_CREATED, payload);
    this.logger.debug(
      `Hold created notification sent to ${room}: ${payload.hold_id}`
    );
  }

  /**
   * Emite evento cuando se renueva un hold
   */
  notifyHoldRenewed(branchId: string, holdId: string, expiresAt: string) {
    const room = `branch:${branchId}`;
    this.gateway.emitToRoom(room, WebSocketEvent.HOLD_RENEWED, {
      hold_id: holdId,
      branch_id: branchId,
      expires_at: expiresAt,
      renewed_at: new Date().toISOString(),
    });
    this.logger.debug(`Hold renewed notification sent to ${room}: ${holdId}`);
  }

  /**
   * Emite evento cuando se libera un hold
   */
  notifyHoldReleased(branchId: string, holdId: string, reason?: string) {
    const room = `branch:${branchId}`;
    this.gateway.emitToRoom(room, WebSocketEvent.HOLD_RELEASED, {
      hold_id: holdId,
      branch_id: branchId,
      released_at: new Date().toISOString(),
      reason,
    });
    this.logger.debug(`Hold released notification sent to ${room}: ${holdId}`);
  }

  /**
   * Emite evento cuando se expira un hold
   */
  notifyHoldExpired(branchId: string, holdId: string) {
    const room = `branch:${branchId}`;
    this.gateway.emitToRoom(room, WebSocketEvent.HOLD_EXPIRED, {
      hold_id: holdId,
      branch_id: branchId,
      expired_at: new Date().toISOString(),
    });
    this.logger.debug(`Hold expired notification sent to ${room}: ${holdId}`);
  }

  /**
   * Emite evento cuando se crea una cita
   */
  notifyAppointmentCreated(payload: AppointmentCreatedPayload) {
    const branchRoom = `branch:${payload.branch_id}`;
    const customerRoom = `customer:${payload.customer_id}`;

    this.gateway.emitToRoom(
      branchRoom,
      WebSocketEvent.APPOINTMENT_CREATED,
      payload
    );
    this.gateway.emitToRoom(
      customerRoom,
      WebSocketEvent.APPOINTMENT_CREATED,
      payload
    );

    this.logger.debug(`Appointment created notification sent: ${payload.id}`);
  }

  /**
   * Emite evento cuando cambia el estado de una cita
   */
  notifyAppointmentStatusChanged(payload: AppointmentStatusChangedPayload) {
    const branchRoom = `branch:${payload.branch_id}`;
    const customerRoom = `customer:${payload.customer_id}`;

    let event: WebSocketEvent;
    switch (payload.new_status) {
      case "CONFIRMED":
        event = WebSocketEvent.APPOINTMENT_CONFIRMED;
        break;
      case "CHECKED_IN":
        event = WebSocketEvent.APPOINTMENT_CHECKED_IN;
        break;
      case "IN_SERVICE":
        event = WebSocketEvent.APPOINTMENT_IN_SERVICE;
        break;
      case "COMPLETED":
        event = WebSocketEvent.APPOINTMENT_COMPLETED;
        break;
      case "CANCELED":
        event = WebSocketEvent.APPOINTMENT_CANCELED;
        break;
      case "RESCHEDULED":
        event = WebSocketEvent.APPOINTMENT_RESCHEDULED;
        break;
      case "NO_SHOW":
        event = WebSocketEvent.APPOINTMENT_NO_SHOW;
        break;
      default:
        return;
    }

    this.gateway.emitToRoom(branchRoom, event, payload);
    this.gateway.emitToRoom(customerRoom, event, payload);

    this.logger.debug(
      `Appointment status changed notification sent: ${payload.id} -> ${payload.new_status}`
    );
  }

  /**
   * Emite evento cuando se actualiza disponibilidad
   */
  notifyAvailabilityUpdated(payload: AvailabilityUpdatedPayload) {
    const room = `branch:${payload.branch_id}`;
    this.gateway.emitToRoom(room, WebSocketEvent.AVAILABILITY_UPDATED, payload);
    this.logger.debug(`Availability updated notification sent to ${room}`);
  }

  /**
   * Obtiene estadísticas de conexión
   */
  getConnectionStats() {
    return {
      connectedUsers: this.gateway.getConnectedUsersCount(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Obtiene conexiones de un usuario específico
   */
  getUserConnections(userId: string): string[] {
    return this.gateway.getUserConnections(userId);
  }
}

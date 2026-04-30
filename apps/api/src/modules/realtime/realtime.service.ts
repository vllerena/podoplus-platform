import { Injectable, Logger } from "@nestjs/common";
import { RealtimeGateway } from "./realtime.gateway";
import { WebSocketEvent } from "../../websocket_types";
import {
  HoldCreatedPayload,
  HoldReleasedPayload,
  AppointmentCreatedPayload,
  AppointmentStatusChangedPayload,
  AvailabilityUpdatedPayload,
  SaleCreatedPayload,
} from "../../websocket_types";

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger("RealtimeService");
  private gateway: RealtimeGateway;

  setGateway(gateway: RealtimeGateway) {
    this.gateway = gateway;
  }

  /**
   * Guard interno: evita crash si el gateway aún no fue inicializado.
   */
  private isReady(): boolean {
    if (!this.gateway) {
      this.logger.warn("RealtimeGateway no inicializado — notificación omitida");
      return false;
    }
    return true;
  }

  notifyHoldCreated(payload: HoldCreatedPayload) {
    if (!this.isReady()) return;
    const room = `branch:${payload.branch_id}`;
    this.gateway.emitToRoom(room, WebSocketEvent.HOLD_CREATED, payload);
    this.logger.debug(`Hold created → ${room}: ${payload.hold_id}`);
  }

  notifyHoldRenewed(branchId: string, holdId: string, expiresAt: string) {
    if (!this.isReady()) return;
    const room = `branch:${branchId}`;
    this.gateway.emitToRoom(room, WebSocketEvent.HOLD_RENEWED, {
      hold_id: holdId,
      branch_id: branchId,
      expires_at: expiresAt,
      renewed_at: new Date().toISOString(),
    });
    this.logger.debug(`Hold renewed → ${room}: ${holdId}`);
  }

  notifyHoldReleased(branchId: string, holdId: string, reason?: string) {
    if (!this.isReady()) return;
    const room = `branch:${branchId}`;
    this.gateway.emitToRoom(room, WebSocketEvent.HOLD_RELEASED, {
      hold_id: holdId,
      branch_id: branchId,
      released_at: new Date().toISOString(),
      reason,
    });
    this.logger.debug(`Hold released → ${room}: ${holdId}`);
  }

  notifyHoldExpired(branchId: string, holdId: string) {
    if (!this.isReady()) return;
    const room = `branch:${branchId}`;
    this.gateway.emitToRoom(room, WebSocketEvent.HOLD_EXPIRED, {
      hold_id: holdId,
      branch_id: branchId,
      expired_at: new Date().toISOString(),
    });
    this.logger.debug(`Hold expired → ${room}: ${holdId}`);
  }

  notifyAppointmentCreated(payload: AppointmentCreatedPayload) {
    if (!this.isReady()) return;
    const branchRoom = `branch:${payload.branch_id}`;
    const customerRoom = `customer:${payload.customer_id}`;
    this.gateway.emitToRoom(branchRoom, WebSocketEvent.APPOINTMENT_CREATED, payload);
    this.gateway.emitToRoom(customerRoom, WebSocketEvent.APPOINTMENT_CREATED, payload);
    this.logger.debug(`Appointment created → ${branchRoom}: ${payload.id}`);
  }

  notifyAppointmentStatusChanged(payload: AppointmentStatusChangedPayload) {
    if (!this.isReady()) return;
    const branchRoom = `branch:${payload.branch_id}`;
    const customerRoom = `customer:${payload.customer_id}`;

    let event: WebSocketEvent;
    switch (payload.new_status) {
      case "CONFIRMED":    event = WebSocketEvent.APPOINTMENT_CONFIRMED;  break;
      case "CHECKED_IN":   event = WebSocketEvent.APPOINTMENT_CHECKED_IN; break;
      case "IN_SERVICE":   event = WebSocketEvent.APPOINTMENT_IN_SERVICE; break;
      case "COMPLETED":    event = WebSocketEvent.APPOINTMENT_COMPLETED;  break;
      case "CANCELED":     event = WebSocketEvent.APPOINTMENT_CANCELED;   break;
      case "RESCHEDULED":  event = WebSocketEvent.APPOINTMENT_RESCHEDULED; break;
      case "NO_SHOW":      event = WebSocketEvent.APPOINTMENT_NO_SHOW;    break;
      default: return;
    }

    this.gateway.emitToRoom(branchRoom, event, payload);
    this.gateway.emitToRoom(customerRoom, event, payload);
    this.logger.debug(`Appointment ${payload.new_status} → ${branchRoom}: ${payload.id}`);
  }

  notifySaleCreated(payload: SaleCreatedPayload) {
    if (!this.isReady()) return;
    const room = `branch:${payload.branch_id}`;
    this.gateway.emitToRoom(room, WebSocketEvent.SALE_CREATED, payload);
    this.logger.debug(`Sale created → ${room}: ${payload.id}`);
  }

  notifySaleVoided(payload: { id: string; branch_id: string; void_reason: string; voided_at: string }) {
    if (!this.isReady()) return;
    const room = `branch:${payload.branch_id}`;
    this.gateway.emitToRoom(room, WebSocketEvent.SALE_VOIDED, payload);
    this.logger.debug(`Sale voided → ${room}: ${payload.id}`);
  }

  notifyAvailabilityUpdated(payload: AvailabilityUpdatedPayload) {
    if (!this.isReady()) return;
    const room = `branch:${payload.branch_id}`;
    this.gateway.emitToRoom(room, WebSocketEvent.AVAILABILITY_UPDATED, payload);
    this.logger.debug(`Availability updated → ${room}`);
  }

  getConnectionStats() {
    return {
      connectedUsers: this.gateway?.getConnectedUsersCount() ?? 0,
      timestamp: new Date().toISOString(),
    };
  }

  getUserConnections(userId: string): string[] {
    return this.gateway?.getUserConnections(userId) ?? [];
  }
}

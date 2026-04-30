import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { RealtimeService } from "./realtime.service";
import { WebSocketEvent } from "../../websocket_types";

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  namespace: "/realtime",
  transports: ["websocket", "polling"],
})
@Injectable()
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger("RealtimeGateway");
  private connectedUsers = new Map<string, string[]>();

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly jwtService: JwtService,
  ) {
    this.realtimeService.setGateway(this);
  }

  afterInit(_server: Server) {
    this.logger.log("WebSocket Gateway initialized on namespace /realtime");
  }

  handleConnection(client: Socket) {
    const token =
      client.handshake.auth?.token ||
      (client.handshake.headers?.authorization?.startsWith("Bearer ")
        ? client.handshake.headers.authorization.slice(7)
        : undefined);

    if (!token) {
      this.logger.warn(`WS connection rejected — no token: ${client.id}`);
      client.emit("error", { message: "Authentication token required" });
      client.disconnect(true);
      return;
    }

    let payload: { sub?: string; userId?: string } | null = null;
    try {
      payload = this.jwtService.verify<{ sub?: string; userId?: string }>(token);
    } catch {
      this.logger.warn(`WS connection rejected — invalid token: ${client.id}`);
      client.emit("error", { message: "Invalid or expired token" });
      client.disconnect(true);
      return;
    }

    const userId = payload.userId ?? payload.sub ?? client.id;
    // Attach userId to socket data for later use
    client.data.userId = userId;

    this.logger.log(`Client connected: ${client.id} (userId: ${userId})`);

    client.emit(WebSocketEvent.CONNECTED, {
      event: WebSocketEvent.CONNECTED,
      timestamp: new Date().toISOString(),
      data: {
        clientId: client.id,
        userId,
        timestamp: new Date().toISOString(),
        message: "Connected to realtime server",
      },
    });

    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, []);
    }
    this.connectedUsers.get(userId).push(client.id);
  }

  handleDisconnect(client: Socket) {
    const userId: string | undefined = client.data?.userId;
    this.logger.log(`Client disconnected: ${client.id}`);

    if (userId && this.connectedUsers.has(userId)) {
      const sockets = this.connectedUsers.get(userId);
      const index = sockets.indexOf(client.id);
      if (index > -1) {
        sockets.splice(index, 1);
      }
      if (sockets.length === 0) {
        this.connectedUsers.delete(userId);
      }
    }
  }

  @SubscribeMessage("subscribe:branch")
  handleSubscribeBranch(client: Socket, data: { branchId: string }) {
    const room = `branch:${data.branchId}`;
    client.join(room);
    this.logger.debug(`Client ${client.id} subscribed to branch: ${data.branchId}`);
    return { success: true, room };
  }

  @SubscribeMessage("unsubscribe:branch")
  handleUnsubscribeBranch(client: Socket, data: { branchId: string }) {
    const room = `branch:${data.branchId}`;
    client.leave(room);
    this.logger.debug(`Client ${client.id} unsubscribed from branch: ${data.branchId}`);
    return { success: true, room };
  }

  @SubscribeMessage("subscribe:customer")
  handleSubscribeCustomer(client: Socket, data: { customerId: string }) {
    const room = `customer:${data.customerId}`;
    client.join(room);
    this.logger.debug(`Client ${client.id} subscribed to customer: ${data.customerId}`);
    return { success: true, room };
  }

  @SubscribeMessage("unsubscribe:customer")
  handleUnsubscribeCustomer(client: Socket, data: { customerId: string }) {
    const room = `customer:${data.customerId}`;
    client.leave(room);
    this.logger.debug(`Client ${client.id} unsubscribed from customer: ${data.customerId}`);
    return { success: true, room };
  }

  @SubscribeMessage("ping")
  handlePing(_client: Socket) {
    return { pong: true, timestamp: new Date().toISOString() };
  }

  emitToRoom(room: string, event: WebSocketEvent, data: any) {
    this.server.to(room).emit(event, {
      event,
      timestamp: new Date().toISOString(),
      data,
    });
  }

  emitToUser(userId: string, event: WebSocketEvent, data: any) {
    const sockets = this.connectedUsers.get(userId);
    if (sockets) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit(event, {
          event,
          timestamp: new Date().toISOString(),
          data,
        });
      });
    }
  }

  broadcastToAll(event: WebSocketEvent, data: any) {
    this.server.emit(event, {
      event,
      timestamp: new Date().toISOString(),
      data,
    });
  }

  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  getUserConnections(userId: string): string[] {
    return this.connectedUsers.get(userId) || [];
  }
}

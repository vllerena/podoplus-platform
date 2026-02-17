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
import { RealtimeService } from "./realtime.service";
import { WebSocketEvent } from "../../websocket_types";

@WebSocketGateway({
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false,
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

  constructor(private realtimeService: RealtimeService) {
    this.realtimeService.setGateway(this);
  }

  afterInit(server: Server) {
    this.logger.log(`✅ WebSocket Gateway initialized on namespace /realtime`);
    this.logger.log(`✅ Server listening on ws://localhost:3000/realtime`);
  }

  handleConnection(client: Socket) {
    const userId =
      client.handshake.auth?.userId ||
      client.handshake.query?.userId ||
      client.id;

    this.logger.log(`✅ Client connected: ${client.id} (userId: ${userId})`);

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
    const userId =
      client.handshake.auth?.userId || client.handshake.query?.userId;
    this.logger.log(`❌ Client disconnected: ${client.id}`);

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
    this.logger.log(
      `📡 Client ${client.id} subscribed to branch: ${data.branchId}`
    );
    return { success: true, room };
  }

  @SubscribeMessage("unsubscribe:branch")
  handleUnsubscribeBranch(client: Socket, data: { branchId: string }) {
    const room = `branch:${data.branchId}`;
    client.leave(room);
    this.logger.log(
      `📡 Client ${client.id} unsubscribed from branch: ${data.branchId}`
    );
    return { success: true, room };
  }

  @SubscribeMessage("subscribe:customer")
  handleSubscribeCustomer(client: Socket, data: { customerId: string }) {
    const room = `customer:${data.customerId}`;
    client.join(room);
    this.logger.log(
      `📡 Client ${client.id} subscribed to customer: ${data.customerId}`
    );
    return { success: true, room };
  }

  @SubscribeMessage("unsubscribe:customer")
  handleUnsubscribeCustomer(client: Socket, data: { customerId: string }) {
    const room = `customer:${data.customerId}`;
    client.leave(room);
    this.logger.log(
      `📡 Client ${client.id} unsubscribed from customer: ${data.customerId}`
    );
    return { success: true, room };
  }

  @SubscribeMessage("ping")
  handlePing(client: Socket) {
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

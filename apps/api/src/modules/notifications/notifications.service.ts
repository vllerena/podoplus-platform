import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { QueuePublisherService } from "../queue/queue-publisher.service";

export interface CreateNotificationParams {
  userId?: string;
  type: string;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger("NotificationsService");

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly queuePublisher?: QueuePublisherService
  ) {}

  // ─────────────────────────────────────────────────────────────────
  // CREAR NOTIFICACIÓN (llamado internamente por otros servicios)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Fire-and-forget: si el QueuePublisher está disponible, delega al Worker
   * para mayor resiliencia (el job sobrevive si la API cae).
   * Si no, persiste directamente en DB.
   */
  notify(params: CreateNotificationParams): void {
    if (!params.userId) {
      this.logger.debug(`Notificación omitida (sin userId) — tipo: ${params.type}`);
      return;
    }
    if (this.queuePublisher) {
      this.queuePublisher.publishNotification(params).catch((err) => {
        // Fallback: escribir directo si la cola no está disponible
        this.logger.warn(
          `Queue no disponible para notificación [${params.type}], escribiendo directo: ${err.message}`
        );
        this.persist(params).catch((e) =>
          this.logger.error(`Error creando notificación [${params.type}]: ${e.message}`)
        );
      });
    } else {
      this.persist(params).catch((err) =>
        this.logger.error(`Error creando notificación [${params.type}]: ${err.message}`)
      );
    }
  }

  private async persist(params: CreateNotificationParams): Promise<void> {
    await this.prisma.notification.create({
      data: {
        user: { connect: { id: params.userId } },
        type: params.type,
        title: params.title,
        body: params.body,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // LISTAR NOTIFICACIONES DEL USUARIO AUTENTICADO
  // ─────────────────────────────────────────────────────────────────

  async getMyNotifications(
    userId: string,
    onlyUnread = false,
    limit = 20,
    offset = 0
  ) {
    const where: any = { userId };
    if (onlyUnread) where.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      data: notifications.map(this.format),
      total,
      unread_count: unreadCount,
      limit,
      offset,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // MARCAR COMO LEÍDA
  // ─────────────────────────────────────────────────────────────────

  async markAsRead(notificationId: string, userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });

    if (count === 0) {
      return { success: false, message: "Notificación no encontrada" };
    }
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────
  // MARCAR TODAS COMO LEÍDAS
  // ─────────────────────────────────────────────────────────────────

  async markAllAsRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return { success: true, marked_read: count };
  }

  // ─────────────────────────────────────────────────────────────────
  // ELIMINAR NOTIFICACIÓN
  // ─────────────────────────────────────────────────────────────────

  async deleteNotification(notificationId: string, userId: string) {
    const { count } = await this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });

    return { success: count > 0 };
  }

  // ─────────────────────────────────────────────────────────────────
  // SOLO CONTEO (para badge del panel)
  // ─────────────────────────────────────────────────────────────────

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unread_count: count };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPER
  // ─────────────────────────────────────────────────────────────────

  private format(n: any) {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      entity_type: n.entityType ?? null,
      entity_id: n.entityId ?? null,
      is_read: n.isRead,
      read_at: n.readAt ? n.readAt.toISOString() : null,
      created_at: n.createdAt.toISOString(),
    };
  }
}

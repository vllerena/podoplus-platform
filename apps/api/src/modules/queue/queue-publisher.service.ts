import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { AuditLogParams } from "../audit/audit.service";
import { CreateNotificationParams } from "../notifications/notifications.service";

/**
 * QueuePublisherService — publica jobs a colas BullMQ compartidas con el Worker.
 *
 * El Worker consume estas colas y persiste los datos en DB, manteniendo
 * el proceso de la API libre de escrituras de baja prioridad.
 *
 * Fail-safe: si Redis no está disponible al momento de publicar, el error
 * se logea y se propaga para que el llamador (AuditService / NotificationsService)
 * pueda hacer fallback a escritura directa.
 */
@Injectable()
export class QueuePublisherService implements OnModuleDestroy {
  private readonly logger = new Logger("QueuePublisherService");

  private readonly auditQueue: Queue;
  private readonly notificationsQueue: Queue;

  constructor(private readonly configService: ConfigService) {
    const connection = {
      host: configService.get<string>("REDIS_HOST", "localhost"),
      port: configService.get<number>("REDIS_PORT", 6379),
    };

    this.auditQueue = new Queue("audit-log", {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
      },
    });

    this.notificationsQueue = new Queue("notifications", {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
      },
    });

    this.logger.log("QueuePublisherService inicializado (audit-log + notifications)");
  }

  async publishAuditLog(params: AuditLogParams): Promise<void> {
    await this.auditQueue.add("persist", params);
  }

  async publishNotification(params: CreateNotificationParams): Promise<void> {
    await this.notificationsQueue.add("send", params);
  }

  async onModuleDestroy() {
    await Promise.allSettled([
      this.auditQueue.close(),
      this.notificationsQueue.close(),
    ]);
  }
}

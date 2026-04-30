import { Global, Module } from "@nestjs/common";
import { QueuePublisherService } from "./queue-publisher.service";

/**
 * Global: AuditService y NotificationsService pueden inyectar
 * QueuePublisherService sin importar QueueModule explícitamente.
 */
@Global()
@Module({
  providers: [QueuePublisherService],
  exports: [QueuePublisherService],
})
export class QueueModule {}

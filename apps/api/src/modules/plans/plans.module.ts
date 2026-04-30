import { Module } from "@nestjs/common";
import { PlansService } from "./plans.service";
import { PlansController } from "./plans.controller";
import { SubscriptionsController } from "./subscriptions.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { RbacModule } from "../rbac/rbac.module";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [PrismaModule, RbacModule, AuditModule, NotificationsModule],
  providers: [PlansService],
  exports: [PlansService],
  controllers: [PlansController, SubscriptionsController],
})
export class PlansModule {}

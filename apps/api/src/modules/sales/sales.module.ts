import { Module } from "@nestjs/common";
import { SalesService } from "./sales.service";
import { SalesController } from "./sales.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { RbacModule } from "../rbac/rbac.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { AuditModule } from "../audit/audit.module";
import { EmailModule } from "../email/email.module";
import { PlansModule } from "../plans/plans.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    PrismaModule,
    RbacModule,
    RealtimeModule,
    AuditModule,
    EmailModule,
    PlansModule,
    NotificationsModule,
  ],
  providers: [SalesService],
  exports: [SalesService],
  controllers: [SalesController],
})
export class SalesModule {}

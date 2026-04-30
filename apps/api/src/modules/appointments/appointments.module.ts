import { Module } from "@nestjs/common";
import { AppointmentsService } from "./appointments.service";
import { AppointmentsController } from "./appointments.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { RbacModule } from "../rbac/rbac.module";
import { HoldsModule } from "../holds/holds.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { AuditModule } from "../audit/audit.module";
import { EmailModule } from "../email/email.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    PrismaModule,
    RbacModule,
    HoldsModule,
    RealtimeModule,
    AuditModule,
    EmailModule,
    NotificationsModule,
  ],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
  controllers: [AppointmentsController],
})
export class AppointmentsModule {}

import { Module } from "@nestjs/common";
import { CashRegisterService } from "./cash-register.service";
import { CashRegisterController } from "./cash-register.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { RbacModule } from "../rbac/rbac.module";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [PrismaModule, RbacModule, AuditModule, NotificationsModule],
  providers: [CashRegisterService],
  exports: [CashRegisterService],
  controllers: [CashRegisterController],
})
export class CashRegisterModule {}

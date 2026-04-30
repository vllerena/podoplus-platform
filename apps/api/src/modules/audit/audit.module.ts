import { Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { AuditController } from "./audit.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { RbacModule } from "../rbac/rbac.module";

@Module({
  imports: [PrismaModule, RbacModule],
  providers: [AuditService],
  exports: [AuditService],
  controllers: [AuditController],
})
export class AuditModule {}

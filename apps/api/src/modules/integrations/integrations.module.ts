import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { RbacModule } from "../rbac/rbac.module";
import { IntegrationsService } from "./integrations.service";
import { IntegrationsController } from "./integrations.controller";

@Module({
  imports: [PrismaModule, RbacModule],
  providers: [IntegrationsService],
  controllers: [IntegrationsController],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}

import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { RbacModule } from "../rbac/rbac.module";
import { ServicesService } from "./services.service";
import { ServicesController } from "./services.controller";

@Module({
  imports: [PrismaModule, RbacModule],
  providers: [ServicesService],
  controllers: [ServicesController],
  exports: [ServicesService],
})
export class ServicesModule {}

import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { RbacModule } from "../rbac/rbac.module";
import { BusinessUnitsService } from "./business-units.service";
import { BusinessUnitsController } from "./business-units.controller";

@Module({
  imports: [PrismaModule, RbacModule],
  providers: [BusinessUnitsService],
  controllers: [BusinessUnitsController],
  exports: [BusinessUnitsService],
})
export class BusinessUnitsModule {}

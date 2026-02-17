import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { RbacModule } from "../rbac/rbac.module";
import { AvailabilityService } from "./availability.service";
import { AvailabilityController } from "./availability.controller";
import {
  SlotGeneratorService,
  CapacityService,
  ScheduleResolverService,
} from "./services";

@Module({
  imports: [PrismaModule, RbacModule],
  providers: [
    AvailabilityService,
    SlotGeneratorService,
    CapacityService,
    ScheduleResolverService,
  ],
  controllers: [AvailabilityController],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}

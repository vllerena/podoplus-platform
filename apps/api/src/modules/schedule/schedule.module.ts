import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { RbacModule } from "../rbac/rbac.module";
import { ScheduleService } from "./schedule.service";
import { ScheduleController } from "./schedule.controller";

@Module({
  imports: [PrismaModule, RbacModule],
  providers: [ScheduleService],
  controllers: [ScheduleController],
  exports: [ScheduleService],
})
export class ScheduleModule {}

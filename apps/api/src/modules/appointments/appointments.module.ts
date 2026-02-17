import { Module } from "@nestjs/common";
import { AppointmentsService } from "./appointments.service";
import { AppointmentsController } from "./appointments.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { RbacModule } from "../rbac/rbac.module";
import { HoldsModule } from "../holds/holds.module";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [PrismaModule, AuthModule, RbacModule, HoldsModule, RealtimeModule],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
  controllers: [AppointmentsController],
})
export class AppointmentsModule {}

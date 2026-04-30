import { Module } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./reports.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { RbacModule } from "../rbac/rbac.module";

@Module({
  imports: [PrismaModule, RbacModule],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}

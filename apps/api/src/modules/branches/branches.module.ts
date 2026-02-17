import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { RbacModule } from "../rbac/rbac.module";
import { BranchesService } from "./branches.service";
import { BranchesController } from "./branches.controller";

@Module({
  imports: [PrismaModule, RbacModule],
  providers: [BranchesService],
  controllers: [BranchesController],
  exports: [BranchesService],
})
export class BranchesModule {}

import { Module } from "@nestjs/common";
import { RedisModule } from "@nestjs-modules/ioredis";
import { PrismaModule } from "../prisma/prisma.module";
import { RbacService } from "./rbac.service";
import { RbacController } from "./rbac.controller";
import { RoleGuard } from "./guards/role.guard";
import { PermissionGuard } from "./guards/permission.guard";
import { BranchScopeGuard } from "./guards/branch-scope.guard";

@Module({
  imports: [RedisModule, PrismaModule],
  providers: [RbacService, RoleGuard, PermissionGuard, BranchScopeGuard],
  controllers: [RbacController],
  exports: [RbacService, RoleGuard, PermissionGuard, BranchScopeGuard],
})
export class RbacModule {}

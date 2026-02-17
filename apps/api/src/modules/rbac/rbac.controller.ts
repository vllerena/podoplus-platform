import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RequireRole } from "./decorators/require-role.decorator";
import { RequireBranchAccess } from "./decorators/require-branch-access.decorator";
import { RoleGuard } from "./guards/role.guard";

@Controller("v1/rbac")
@UseGuards(JwtAuthGuard, RoleGuard)
export class RbacController {
  private readonly logger = new Logger("RbacController");

  constructor(private prisma: PrismaService) {}

  /**
   * GET /v1/rbac/roles
   * Lista todos los roles
   */
  @Get("roles")
  @RequireRole("SUPER_ADMIN", "GENERAL_MANAGER")
  async getRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  /**
   * GET /v1/rbac/roles/:id
   * Obtiene un rol específico
   */
  @Get("roles/:id")
  @RequireRole("SUPER_ADMIN", "GENERAL_MANAGER")
  async getRole(@Param("id") id: string) {
    return this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  /**
   * GET /v1/rbac/permissions
   * Lista todos los permisos
   */
  @Get("permissions")
  @RequireRole("SUPER_ADMIN")
  async getPermissions() {
    return this.prisma.permission.findMany();
  }

  /**
   * POST /v1/rbac/role-permissions
   * Asigna permisos a un rol
   */
  @Post("role-permissions")
  @RequireRole("SUPER_ADMIN")
  async assignPermissionToRole(
    @Body() dto: { roleId: string; permissionId: string }
  ) {
    return this.prisma.rolePermission.create({
      data: {
        roleId: dto.roleId,
        permissionId: dto.permissionId,
      },
    });
  }

  /**
   * GET /v1/rbac/branches/:branchId
   * Obtiene datos de una rama (valida acceso)
   */
  @Get("branches/:branchId")
  @RequireBranchAccess("branchId")
  async getBranchData(@Param("branchId") branchId: string) {
    return this.prisma.branch.findUnique({
      where: { id: branchId },
      include: {
        users: true,
      },
    });
  }
}

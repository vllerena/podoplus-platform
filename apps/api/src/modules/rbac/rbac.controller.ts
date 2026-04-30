import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
  HttpCode,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RequireRole } from "./decorators/require-role.decorator";
import { RequireBranchAccess } from "./decorators/require-branch-access.decorator";
import { RoleGuard } from "./guards/role.guard";
import { RbacService } from "./rbac.service";
import { AssignRolePermissionDto } from "./dto/role-permission.dto";
import { AssignUserRoleDto } from "./dto/user-role.dto";

@ApiTags("RBAC")
@ApiBearerAuth("access-token")
@Controller("v1/rbac")
@UseGuards(JwtAuthGuard, RoleGuard)
export class RbacController {
  private readonly logger = new Logger("RbacController");

  constructor(private rbacService: RbacService) {}

  // ─────────────────────────────────────────────────────────────────
  // ROLES
  // ─────────────────────────────────────────────────────────────────

  /**
   * GET /v1/rbac/roles
   * Lista todos los roles con sus permisos.
   */
  @Get("roles")
  @RequireRole("SUPER_ADMIN", "GENERAL_MANAGER")
  @ApiOperation({ summary: "Listar roles", description: "Retorna todos los roles del sistema con sus permisos asignados." })
  @ApiResponse({ status: 200, description: "Lista de roles con permisos." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  getRoles() {
    return this.rbacService.getRoles();
  }

  /**
   * GET /v1/rbac/roles/:id
   * Detalle de un rol.
   */
  @Get("roles/:id")
  @RequireRole("SUPER_ADMIN", "GENERAL_MANAGER")
  @ApiOperation({ summary: "Obtener rol por ID", description: "Retorna el detalle de un rol con sus permisos." })
  @ApiParam({ name: "id", description: "ID del rol" })
  @ApiResponse({ status: 200, description: "Detalle del rol." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  @ApiResponse({ status: 404, description: "Rol no encontrado." })
  getRoleById(@Param("id") id: string) {
    return this.rbacService.getRoleById(id);
  }

  // ─────────────────────────────────────────────────────────────────
  // PERMISOS
  // ─────────────────────────────────────────────────────────────────

  /**
   * GET /v1/rbac/permissions
   * Lista todos los permisos del sistema.
   */
  @Get("permissions")
  @RequireRole("SUPER_ADMIN")
  @ApiOperation({ summary: "Listar permisos", description: "Retorna todos los permisos disponibles en el sistema." })
  @ApiResponse({ status: 200, description: "Lista de permisos." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  getPermissions() {
    return this.rbacService.getPermissions();
  }

  // ─────────────────────────────────────────────────────────────────
  // ROLE-PERMISSIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * POST /v1/rbac/role-permissions
   * Asigna un permiso a un rol.
   */
  @Post("role-permissions")
  @RequireRole("SUPER_ADMIN")
  @ApiOperation({ summary: "Asignar permiso a rol", description: "Asigna un permiso existente a un rol." })
  @ApiResponse({ status: 201, description: "Permiso asignado al rol correctamente." })
  @ApiResponse({ status: 400, description: "Datos inválidos." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  @ApiResponse({ status: 404, description: "Rol o permiso no encontrado." })
  assignPermissionToRole(
    @Body() dto: AssignRolePermissionDto
  ) {
    return this.rbacService.assignPermissionToRole(dto.roleId, dto.permissionId);
  }

  /**
   * DELETE /v1/rbac/role-permissions
   * Revoca un permiso de un rol.
   */
  @Delete("role-permissions")
  @RequireRole("SUPER_ADMIN")
  @HttpCode(200)
  @ApiOperation({ summary: "Revocar permiso de rol", description: "Revoca un permiso previamente asignado a un rol." })
  @ApiResponse({ status: 200, description: "Permiso revocado del rol correctamente." })
  @ApiResponse({ status: 400, description: "Datos inválidos." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  @ApiResponse({ status: 404, description: "Rol o permiso no encontrado." })
  removePermissionFromRole(
    @Body() dto: AssignRolePermissionDto
  ) {
    return this.rbacService.removePermissionFromRole(dto.roleId, dto.permissionId);
  }

  // ─────────────────────────────────────────────────────────────────
  // USER-ROLES
  // ─────────────────────────────────────────────────────────────────

  /**
   * POST /v1/rbac/user-roles
   * Asigna un rol a un usuario.
   */
  @Post("user-roles")
  @RequireRole("SUPER_ADMIN", "GENERAL_MANAGER")
  @ApiOperation({ summary: "Asignar rol a usuario", description: "Asigna un rol a un usuario del sistema." })
  @ApiResponse({ status: 201, description: "Rol asignado al usuario correctamente." })
  @ApiResponse({ status: 400, description: "Datos inválidos." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  @ApiResponse({ status: 404, description: "Usuario o rol no encontrado." })
  assignRoleToUser(
    @Body() dto: AssignUserRoleDto
  ) {
    return this.rbacService.assignRoleToUser(dto.userId, dto.roleId);
  }

  /**
   * DELETE /v1/rbac/user-roles
   * Revoca un rol de un usuario.
   */
  @Delete("user-roles")
  @RequireRole("SUPER_ADMIN", "GENERAL_MANAGER")
  @HttpCode(200)
  @ApiOperation({ summary: "Revocar rol de usuario", description: "Revoca un rol previamente asignado a un usuario." })
  @ApiResponse({ status: 200, description: "Rol revocado del usuario correctamente." })
  @ApiResponse({ status: 400, description: "Datos inválidos." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  @ApiResponse({ status: 404, description: "Usuario o rol no encontrado." })
  removeRoleFromUser(
    @Body() dto: AssignUserRoleDto
  ) {
    return this.rbacService.removeRoleFromUser(dto.userId, dto.roleId);
  }

  // ─────────────────────────────────────────────────────────────────
  // BRANCH
  // ─────────────────────────────────────────────────────────────────

  /**
   * GET /v1/rbac/branches/:branchId
   * Datos de una sede (solo usuarios con acceso a ella).
   */
  @Get("branches/:branchId")
  @RequireBranchAccess("branchId")
  @ApiOperation({ summary: "Obtener datos de sede", description: "Retorna los datos de una sede junto con sus usuarios. Solo accesible para usuarios con acceso a esa sede." })
  @ApiParam({ name: "branchId", description: "ID de la sede" })
  @ApiResponse({ status: 200, description: "Datos de la sede con sus usuarios." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin acceso a esta sede." })
  @ApiResponse({ status: 404, description: "Sede no encontrada." })
  getBranchData(@Param("branchId") branchId: string) {
    return this.rbacService.getBranchWithUsers(branchId);
  }
}

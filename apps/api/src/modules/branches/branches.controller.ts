import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Logger,
} from "@nestjs/common";
import { BranchesService } from "./branches.service";
import { CreateBranchDto, UpdateBranchDto } from "./dto";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RoleGuard } from "../rbac/guards/role.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { BranchScopeGuard } from "../rbac/guards/branch-scope.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequireRole } from "../rbac/decorators/require-role.decorator";
import { RequireBranchAccess } from "../rbac/decorators/require-branch-access.decorator";

@Controller("v1/branches")
@UseGuards(JwtAuthGuard, RoleGuard, PermissionGuard, BranchScopeGuard)
export class BranchesController {
  private readonly logger = new Logger("BranchesController");

  constructor(private branchesService: BranchesService) {}

  /**
   * GET /v1/branches
   * Obtiene todas las sedes del usuario (filtradas por scope)
   */
  @Get()
  async getAllBranches(@CurrentUser() user: any) {
    this.logger.log(`Usuario ${user.userId} solicitó listado de sedes`);
    return this.branchesService.findAll(user.userId);
  }

  /**
   * GET /v1/branches/:id
   * Obtiene una sede por ID (con validación de scope)
   */
  @Get(":id")
  @RequireBranchAccess("id")
  async getBranch(@Param("id") id: string, @CurrentUser() user: any) {
    this.logger.log(`Usuario ${user.userId} solicitó sede ${id}`);
    return this.branchesService.findOne(id, user.userId);
  }

  /**
   * POST /v1/branches
   * Crea una nueva sede (solo SUPER_ADMIN)
   */
  @Post()
  @RequireRole("SUPER_ADMIN")
  async createBranch(@Body() dto: CreateBranchDto, @CurrentUser() user: any) {
    this.logger.log(`SUPER_ADMIN ${user.userId} creando sede: ${dto.name}`);
    return this.branchesService.create(dto, user.userId);
  }

  /**
   * PATCH /v1/branches/:id
   * Actualiza una sede (solo SUPER_ADMIN)
   */
  @Patch(":id")
  @RequireRole("SUPER_ADMIN")
  async updateBranch(
    @Param("id") id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() user: any
  ) {
    this.logger.log(`SUPER_ADMIN ${user.userId} actualizando sede ${id}`);
    return this.branchesService.update(id, dto, user.userId);
  }

  /**
   * DELETE /v1/branches/:id
   * Desactiva una sede (solo SUPER_ADMIN)
   */
  @Delete(":id")
  @RequireRole("SUPER_ADMIN")
  async deactivateBranch(@Param("id") id: string, @CurrentUser() user: any) {
    this.logger.log(`SUPER_ADMIN ${user.userId} desactivando sede ${id}`);
    return this.branchesService.deactivate(id, user.userId);
  }

  /**
   * POST /v1/branches/:id/users/:userId
   * Asigna un usuario a una sede (solo SUPER_ADMIN)
   */
  @Post(":branchId/users/:userId")
  @RequireRole("SUPER_ADMIN")
  async assignUserToBranch(
    @Param("branchId") branchId: string,
    @Param("userId") userId: string,
    @CurrentUser() user: any
  ) {
    this.logger.log(
      `SUPER_ADMIN ${user.userId} asignando usuario ${userId} a sede ${branchId}`
    );
    return this.branchesService.assignUserToBranch(
      branchId,
      userId,
      user.userId
    );
  }

  /**
   * DELETE /v1/branches/:id/users/:userId
   * Desasigna un usuario de una sede (solo SUPER_ADMIN)
   */
  @Delete(":branchId/users/:userId")
  @RequireRole("SUPER_ADMIN")
  async removeUserFromBranch(
    @Param("branchId") branchId: string,
    @Param("userId") userId: string,
    @CurrentUser() user: any
  ) {
    this.logger.log(
      `SUPER_ADMIN ${user.userId} desasignando usuario ${userId} de sede ${branchId}`
    );
    return this.branchesService.removeUserFromBranch(
      branchId,
      userId,
      user.userId
    );
  }

  /**
   * GET /v1/branches/:id/users
   * Obtiene usuarios asignados a una sede
   */
  @Get(":id/users")
  @RequireBranchAccess("id")
  async getBranchUsers(
    @Param("id") branchId: string,
    @CurrentUser() user: any
  ) {
    this.logger.log(
      `Usuario ${user.userId} solicitó usuarios de sede ${branchId}`
    );
    return this.branchesService.getBranchUsers(branchId, user.userId);
  }
}

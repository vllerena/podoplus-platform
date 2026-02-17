import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { ScheduleService } from "./schedule.service";
import {
  CreateBranchHoursDto,
  UpdateBranchHoursDto,
  CreateBlockDto,
  UpdateBlockDto,
  BulkLoadHoursDto,
  BulkLoadBlocksDto,
  BulkLoadScheduleExceptionsDto,
  UpdateScheduleExceptionDto,
  CreateScheduleExceptionDto,
} from "./dto";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RoleGuard } from "../rbac/guards/role.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { BranchScopeGuard } from "../rbac/guards/branch-scope.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequireBranchAccess } from "../rbac/decorators/require-branch-access.decorator";

@Controller("v1/schedule")
@UseGuards(JwtAuthGuard, RoleGuard, PermissionGuard, BranchScopeGuard)
export class ScheduleController {
  private readonly logger = new Logger("ScheduleController");

  constructor(private scheduleService: ScheduleService) {}

  // ============================================================
  // BRANCH HOURS
  // ============================================================

  /**
   * GET /v1/schedule/branches/:branchId/hours
   * Obtiene horarios de una sede
   */
  @Get("branches/:branchId/hours")
  @RequireBranchAccess("branchId")
  async getBranchHours(
    @Param("branchId") branchId: string,
    @CurrentUser() user: any
  ) {
    this.logger.log(
      `Usuario ${user.userId} solicitó horarios de sede ${branchId}`
    );
    return this.scheduleService.getBranchHours(branchId, user.userId);
  }

  /**
   * POST /v1/schedule/branches/:branchId/hours
   * Crea horario para una sede
   */
  @Post("branches/:branchId/hours")
  @RequireBranchAccess("branchId")
  async createBranchHours(
    @Param("branchId") branchId: string,
    @Body() dto: CreateBranchHoursDto,
    @CurrentUser() user: any
  ) {
    this.logger.log(
      `Usuario ${user.userId} creando horario en sede ${branchId}`
    );
    return this.scheduleService.createBranchHours(branchId, dto, user.userId);
  }

  /**
   * PATCH /v1/schedule/branches/:branchId/hours/:id
   * Actualiza horario
   */
  @Patch("branches/:branchId/hours/:id")
  @RequireBranchAccess("branchId")
  async updateBranchHours(
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: UpdateBranchHoursDto,
    @CurrentUser() user: any
  ) {
    this.logger.log(`Usuario ${user.userId} actualizando horario ${id}`);
    return this.scheduleService.updateBranchHours(
      branchId,
      id,
      dto,
      user.userId
    );
  }

  /**
   * DELETE /v1/schedule/branches/:branchId/hours/:id
   * Elimina horario
   */
  @Delete("branches/:branchId/hours/:id")
  @RequireBranchAccess("branchId")
  async deleteBranchHours(
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @CurrentUser() user: any
  ) {
    this.logger.log(`Usuario ${user.userId} eliminando horario ${id}`);
    return this.scheduleService.deleteBranchHours(branchId, id, user.userId);
  }

  // ============================================================
  // BLOCKS
  // ============================================================

  /**
   * GET /v1/schedule/branches/:branchId/blocks
   * Obtiene bloqueos de una sede
   */
  @Get("branches/:branchId/blocks")
  @RequireBranchAccess("branchId")
  async getBranchBlocks(
    @Param("branchId") branchId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @CurrentUser() user?: any
  ) {
    this.logger.log(
      `Usuario ${user.userId} solicitó bloqueos de sede ${branchId}`
    );
    return this.scheduleService.getBranchBlocks(
      branchId,
      user.userId,
      from,
      to
    );
  }

  /**
   * POST /v1/schedule/branches/:branchId/blocks
   * Crea un bloqueo
   */
  @Post("branches/:branchId/blocks")
  @RequireBranchAccess("branchId")
  async createBlock(
    @Param("branchId") branchId: string,
    @Body() dto: CreateBlockDto,
    @CurrentUser() user: any
  ) {
    this.logger.log(
      `Usuario ${user.userId} creando bloqueo en sede ${branchId}`
    );
    return this.scheduleService.createBlock(branchId, dto, user.userId);
  }

  /**
   * PATCH /v1/schedule/branches/:branchId/blocks/:id
   * Actualiza un bloqueo
   */
  @Patch("branches/:branchId/blocks/:id")
  @RequireBranchAccess("branchId")
  async updateBlock(
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: UpdateBlockDto,
    @CurrentUser() user: any
  ) {
    this.logger.log(`Usuario ${user.userId} actualizando bloqueo ${id}`);
    return this.scheduleService.updateBlock(branchId, id, dto, user.userId);
  }

  /**
   * DELETE /v1/schedule/branches/:branchId/blocks/:id
   * Elimina un bloqueo
   */
  @Delete("branches/:branchId/blocks/:id")
  @RequireBranchAccess("branchId")
  async deleteBlock(
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @CurrentUser() user: any
  ) {
    this.logger.log(`Usuario ${user.userId} eliminando bloqueo ${id}`);
    return this.scheduleService.deleteBlock(branchId, id, user.userId);
  }

  /**
   * POST /v1/schedule/bulk/hours
   * Carga horarios en masa para múltiples sedes
   */
  @Post("bulk/hours")
  async bulkLoadHours(@Body() dto: BulkLoadHoursDto, @CurrentUser() user: any) {
    this.logger.log(
      `Usuario ${user.userId} iniciando carga masiva de horarios para ${dto.branchIds?.length || "todas"} sedes`
    );
    return this.scheduleService.bulkLoadHours(dto, user.userId);
  }

  /**
   * POST /v1/schedule/bulk/blocks
   * Carga bloqueos en masa para múltiples sedes
   */
  @Post("bulk/blocks")
  async bulkLoadBlocks(
    @Body() dto: BulkLoadBlocksDto,
    @CurrentUser() user: any
  ) {
    this.logger.log(
      `Usuario ${user.userId} iniciando carga masiva de bloqueos para ${dto.branchIds?.length || "todas"} sedes`
    );
    return this.scheduleService.bulkLoadBlocks(dto, user.userId);
  }

  /**
   * GET /v1/schedule/template/default
   * Obtiene la plantilla de horarios por defecto
   */
  @Get("template/default")
  async getDefaultTemplate() {
    this.logger.log("Solicitando plantilla de horarios por defecto");
    return this.scheduleService.createDefaultScheduleTemplate();
  }

  // ============================================================
  // SCHEDULE EXCEPTIONS
  // ============================================================

  /**
   * GET /v1/schedule/branches/:branchId/exceptions
   * Obtiene excepciones de horario de una sede
   */
  @Get("branches/:branchId/exceptions")
  @RequireBranchAccess("branchId")
  async getScheduleExceptions(
    @Param("branchId") branchId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @CurrentUser() user?: any
  ) {
    this.logger.log(
      `Usuario ${user.userId} solicitó excepciones de horario de sede ${branchId}`
    );
    return this.scheduleService.getScheduleExceptions(
      branchId,
      user.userId,
      from,
      to
    );
  }

  /**
   * POST /v1/schedule/branches/:branchId/exceptions
   * Crea una excepción de horario
   */
  @Post("branches/:branchId/exceptions")
  @RequireBranchAccess("branchId")
  async createScheduleException(
    @Param("branchId") branchId: string,
    @Body() dto: CreateScheduleExceptionDto,
    @CurrentUser() user: any
  ) {
    this.logger.log(
      `Usuario ${user.userId} creando excepción de horario en sede ${branchId}`
    );
    return this.scheduleService.createScheduleException(
      branchId,
      dto,
      user.userId
    );
  }

  /**
   * PATCH /v1/schedule/branches/:branchId/exceptions/:id
   * Actualiza una excepción de horario
   */
  @Patch("branches/:branchId/exceptions/:id")
  @RequireBranchAccess("branchId")
  async updateScheduleException(
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: UpdateScheduleExceptionDto,
    @CurrentUser() user: any
  ) {
    this.logger.log(
      `Usuario ${user.userId} actualizando excepción de horario ${id}`
    );
    return this.scheduleService.updateScheduleException(
      branchId,
      id,
      dto,
      user.userId
    );
  }

  /**
   * DELETE /v1/schedule/branches/:branchId/exceptions/:id
   * Elimina una excepción de horario
   */
  @Delete("branches/:branchId/exceptions/:id")
  @RequireBranchAccess("branchId")
  async deleteScheduleException(
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @CurrentUser() user: any
  ) {
    this.logger.log(
      `Usuario ${user.userId} eliminando excepción de horario ${id}`
    );
    return this.scheduleService.deleteScheduleException(
      branchId,
      id,
      user.userId
    );
  }

  /**
   * GET /v1/schedule/branches/:branchId/effective-schedule
   * Obtiene el horario efectivo para una fecha específica
   */
  @Get("branches/:branchId/effective-schedule")
  @RequireBranchAccess("branchId")
  async getEffectiveSchedule(
    @Param("branchId") branchId: string,
    @Query("date") date: string,
    @CurrentUser() user: any
  ) {
    if (!date) {
      throw new BadRequestException("El parámetro date es requerido");
    }
    this.logger.log(
      `Usuario ${user.userId} solicitó horario efectivo de sede ${branchId} para ${date}`
    );
    return this.scheduleService.getEffectiveSchedule(
      branchId,
      date,
      user.userId
    );
  }

  /**
   * POST /v1/schedule/bulk/exceptions
   * Carga excepciones en masa para múltiples sedes
   */
  @Post("bulk/exceptions")
  async bulkLoadScheduleExceptions(
    @Body() dto: BulkLoadScheduleExceptionsDto,
    @CurrentUser() user: any
  ) {
    this.logger.log(
      `Usuario ${user.userId} iniciando carga masiva de excepciones para ${dto.branchIds?.length || "todas"} sedes`
    );
    return this.scheduleService.bulkLoadScheduleExceptions(dto, user.userId);
  }
}

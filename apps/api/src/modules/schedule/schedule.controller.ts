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
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from "@nestjs/swagger";
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
import { CurrentUser, CurrentUserData } from "../auth/decorators/current-user.decorator";
import { RequireRole } from "../rbac/decorators/require-role.decorator";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { RequireBranchAccess } from "../rbac/decorators/require-branch-access.decorator";

@ApiTags("Schedule")
@ApiBearerAuth("access-token")
@Controller("v1/schedule")
@UseGuards(JwtAuthGuard, RoleGuard, PermissionGuard, BranchScopeGuard)
export class ScheduleController {
  constructor(private scheduleService: ScheduleService) {}

  // ============================================================
  // BRANCH HOURS
  // ============================================================

  /**
   * GET /v1/schedule/branches/:branchId/hours
   * Cualquier usuario con acceso a la sede puede consultar sus horarios.
   */
  @ApiOperation({ summary: "Obtener los horarios de atención de una sede" })
  @ApiResponse({ status: 200, description: "Horarios de la sede retornados exitosamente." })
  @ApiResponse({ status: 404, description: "Sede no encontrada." })
  @Get("branches/:branchId/hours")
  @RequireBranchAccess("branchId")
  getBranchHours(@Param("branchId") branchId: string) {
    return this.scheduleService.getBranchHours(branchId);
  }

  /**
   * POST /v1/schedule/branches/:branchId/hours
   * Requiere acceso a la sede + permiso schedule.manage.
   */
  @ApiOperation({ summary: "Crear una franja horaria de atención para una sede [schedule.manage]" })
  @ApiResponse({ status: 200, description: "Franja horaria creada exitosamente." })
  @ApiResponse({ status: 400, description: "Datos de horario inválidos." })
  @Post("branches/:branchId/hours")
  @RequireBranchAccess("branchId")
  @RequirePermission("schedule.manage")
  createBranchHours(
    @Param("branchId") branchId: string,
    @Body() dto: CreateBranchHoursDto
  ) {
    return this.scheduleService.createBranchHours(branchId, dto);
  }

  /**
   * PATCH /v1/schedule/branches/:branchId/hours/:id
   * Requiere acceso a la sede + permiso schedule.manage.
   */
  @ApiOperation({ summary: "Actualizar una franja horaria de atención de una sede [schedule.manage]" })
  @ApiResponse({ status: 200, description: "Franja horaria actualizada exitosamente." })
  @ApiResponse({ status: 404, description: "Franja horaria no encontrada." })
  @Patch("branches/:branchId/hours/:id")
  @RequireBranchAccess("branchId")
  @RequirePermission("schedule.manage")
  updateBranchHours(
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: UpdateBranchHoursDto
  ) {
    return this.scheduleService.updateBranchHours(branchId, id, dto);
  }

  /**
   * DELETE /v1/schedule/branches/:branchId/hours/:id
   * Requiere acceso a la sede + permiso schedule.manage.
   */
  @ApiOperation({ summary: "Eliminar una franja horaria de atención de una sede [schedule.manage]" })
  @ApiResponse({ status: 200, description: "Franja horaria eliminada exitosamente." })
  @ApiResponse({ status: 404, description: "Franja horaria no encontrada." })
  @Delete("branches/:branchId/hours/:id")
  @RequireBranchAccess("branchId")
  @RequirePermission("schedule.manage")
  deleteBranchHours(
    @Param("branchId") branchId: string,
    @Param("id") id: string
  ) {
    return this.scheduleService.deleteBranchHours(branchId, id);
  }

  // ============================================================
  // BLOCKS
  // ============================================================

  /**
   * GET /v1/schedule/branches/:branchId/blocks
   * Cualquier usuario con acceso a la sede.
   */
  @ApiOperation({ summary: "Obtener los bloqueos de tiempo de una sede (filtrable por rango de fechas)" })
  @ApiResponse({ status: 200, description: "Bloqueos de la sede retornados exitosamente." })
  @Get("branches/:branchId/blocks")
  @RequireBranchAccess("branchId")
  getBranchBlocks(
    @Param("branchId") branchId: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.scheduleService.getBranchBlocks(branchId, from, to);
  }

  /**
   * POST /v1/schedule/branches/:branchId/blocks
   * Requiere acceso a la sede + permiso schedule.manage.
   */
  @ApiOperation({ summary: "Crear un bloqueo de tiempo en una sede [schedule.manage]" })
  @ApiResponse({ status: 200, description: "Bloqueo creado exitosamente." })
  @ApiResponse({ status: 400, description: "Datos del bloqueo inválidos." })
  @Post("branches/:branchId/blocks")
  @RequireBranchAccess("branchId")
  @RequirePermission("schedule.manage")
  createBlock(
    @Param("branchId") branchId: string,
    @Body() dto: CreateBlockDto,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.scheduleService.createBlock(branchId, dto, user.userId);
  }

  /**
   * PATCH /v1/schedule/branches/:branchId/blocks/:id
   * Requiere acceso a la sede + permiso schedule.manage.
   */
  @ApiOperation({ summary: "Actualizar un bloqueo de tiempo de una sede [schedule.manage]" })
  @ApiResponse({ status: 200, description: "Bloqueo actualizado exitosamente." })
  @ApiResponse({ status: 404, description: "Bloqueo no encontrado." })
  @Patch("branches/:branchId/blocks/:id")
  @RequireBranchAccess("branchId")
  @RequirePermission("schedule.manage")
  updateBlock(
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: UpdateBlockDto
  ) {
    return this.scheduleService.updateBlock(branchId, id, dto);
  }

  /**
   * DELETE /v1/schedule/branches/:branchId/blocks/:id
   * Requiere acceso a la sede + permiso schedule.manage.
   */
  @ApiOperation({ summary: "Eliminar un bloqueo de tiempo de una sede [schedule.manage]" })
  @ApiResponse({ status: 200, description: "Bloqueo eliminado exitosamente." })
  @ApiResponse({ status: 404, description: "Bloqueo no encontrado." })
  @Delete("branches/:branchId/blocks/:id")
  @RequireBranchAccess("branchId")
  @RequirePermission("schedule.manage")
  deleteBlock(
    @Param("branchId") branchId: string,
    @Param("id") id: string
  ) {
    return this.scheduleService.deleteBlock(branchId, id);
  }

  // ============================================================
  // SCHEDULE EXCEPTIONS
  // ============================================================

  /**
   * GET /v1/schedule/branches/:branchId/exceptions
   * Cualquier usuario con acceso a la sede.
   */
  @ApiOperation({ summary: "Obtener las excepciones de horario de una sede (filtrable por rango de fechas)" })
  @ApiResponse({ status: 200, description: "Excepciones de horario retornadas exitosamente." })
  @Get("branches/:branchId/exceptions")
  @RequireBranchAccess("branchId")
  getScheduleExceptions(
    @Param("branchId") branchId: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.scheduleService.getScheduleExceptions(branchId, from, to);
  }

  /**
   * POST /v1/schedule/branches/:branchId/exceptions
   * Requiere acceso a la sede + permiso schedule.manage.
   */
  @ApiOperation({ summary: "Crear una excepción de horario para una sede [schedule.manage]" })
  @ApiResponse({ status: 200, description: "Excepción de horario creada exitosamente." })
  @ApiResponse({ status: 400, description: "Datos de la excepción inválidos." })
  @Post("branches/:branchId/exceptions")
  @RequireBranchAccess("branchId")
  @RequirePermission("schedule.manage")
  createScheduleException(
    @Param("branchId") branchId: string,
    @Body() dto: CreateScheduleExceptionDto,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.scheduleService.createScheduleException(branchId, dto, user.userId);
  }

  /**
   * PATCH /v1/schedule/branches/:branchId/exceptions/:id
   * Requiere acceso a la sede + permiso schedule.manage.
   */
  @ApiOperation({ summary: "Actualizar una excepción de horario de una sede [schedule.manage]" })
  @ApiResponse({ status: 200, description: "Excepción de horario actualizada exitosamente." })
  @ApiResponse({ status: 404, description: "Excepción no encontrada." })
  @Patch("branches/:branchId/exceptions/:id")
  @RequireBranchAccess("branchId")
  @RequirePermission("schedule.manage")
  updateScheduleException(
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: UpdateScheduleExceptionDto
  ) {
    return this.scheduleService.updateScheduleException(branchId, id, dto);
  }

  /**
   * DELETE /v1/schedule/branches/:branchId/exceptions/:id
   * Requiere acceso a la sede + permiso schedule.manage.
   */
  @ApiOperation({ summary: "Eliminar una excepción de horario de una sede [schedule.manage]" })
  @ApiResponse({ status: 200, description: "Excepción de horario eliminada exitosamente." })
  @ApiResponse({ status: 404, description: "Excepción no encontrada." })
  @Delete("branches/:branchId/exceptions/:id")
  @RequireBranchAccess("branchId")
  @RequirePermission("schedule.manage")
  deleteScheduleException(
    @Param("branchId") branchId: string,
    @Param("id") id: string
  ) {
    return this.scheduleService.deleteScheduleException(branchId, id);
  }

  /**
   * GET /v1/schedule/branches/:branchId/effective-schedule?date=YYYY-MM-DD
   * Resuelve el horario real para una fecha. Cualquier usuario con acceso a la sede.
   */
  @ApiOperation({ summary: "Resolver el horario efectivo de una sede para una fecha específica" })
  @ApiResponse({ status: 200, description: "Horario efectivo retornado exitosamente." })
  @ApiResponse({ status: 400, description: "El parámetro date es requerido." })
  @Get("branches/:branchId/effective-schedule")
  @RequireBranchAccess("branchId")
  getEffectiveSchedule(
    @Param("branchId") branchId: string,
    @Query("date") date: string
  ) {
    if (!date) throw new BadRequestException("El parámetro date es requerido");
    return this.scheduleService.getEffectiveSchedule(branchId, date);
  }

  // ============================================================
  // BULK — solo SUPER_ADMIN u OPS_MANAGER (1 sola query de rol)
  // ============================================================

  /**
   * POST /v1/schedule/bulk/hours
   * Reemplaza horarios en masa. Solo SUPER_ADMIN u OPS_MANAGER.
   */
  @ApiOperation({ summary: "Carga masiva de horarios en una o varias sedes [SUPER_ADMIN, OPS_MANAGER]" })
  @ApiResponse({ status: 200, description: "Horarios cargados masivamente exitosamente." })
  @ApiResponse({ status: 400, description: "Datos de horarios inválidos." })
  @Post("bulk/hours")
  @RequireRole("SUPER_ADMIN", "OPS_MANAGER")
  bulkLoadHours(@Body() dto: BulkLoadHoursDto, @CurrentUser() user: CurrentUserData) {
    return this.scheduleService.bulkLoadHours(dto, user.userId);
  }

  /**
   * POST /v1/schedule/bulk/blocks
   * Agrega bloqueos en masa. Solo SUPER_ADMIN u OPS_MANAGER.
   */
  @ApiOperation({ summary: "Carga masiva de bloqueos en una o varias sedes [SUPER_ADMIN, OPS_MANAGER]" })
  @ApiResponse({ status: 200, description: "Bloqueos cargados masivamente exitosamente." })
  @ApiResponse({ status: 400, description: "Datos de bloqueos inválidos." })
  @Post("bulk/blocks")
  @RequireRole("SUPER_ADMIN", "OPS_MANAGER")
  bulkLoadBlocks(@Body() dto: BulkLoadBlocksDto, @CurrentUser() user: CurrentUserData) {
    return this.scheduleService.bulkLoadBlocks(dto, user.userId);
  }

  /**
   * POST /v1/schedule/bulk/exceptions
   * Agrega excepciones en masa. Solo SUPER_ADMIN u OPS_MANAGER.
   */
  @ApiOperation({ summary: "Carga masiva de excepciones de horario en una o varias sedes [SUPER_ADMIN, OPS_MANAGER]" })
  @ApiResponse({ status: 200, description: "Excepciones de horario cargadas masivamente exitosamente." })
  @ApiResponse({ status: 400, description: "Datos de excepciones inválidos." })
  @Post("bulk/exceptions")
  @RequireRole("SUPER_ADMIN", "OPS_MANAGER")
  bulkLoadScheduleExceptions(
    @Body() dto: BulkLoadScheduleExceptionsDto,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.scheduleService.bulkLoadScheduleExceptions(dto, user.userId);
  }

  // ============================================================
  // TEMPLATE
  // ============================================================

  /**
   * GET /v1/schedule/template/default
   * Plantilla estándar (Lun–Vie 08–18, Sáb 08–16 + refrigerio). Sin restricción especial.
   */
  @ApiOperation({ summary: "Obtener la plantilla de horario estándar (Lun–Vie 08–18, Sáb 08–16 + refrigerio)" })
  @ApiResponse({ status: 200, description: "Plantilla de horario por defecto retornada exitosamente." })
  @Get("template/default")
  getDefaultTemplate() {
    return this.scheduleService.getDefaultScheduleTemplate();
  }
}

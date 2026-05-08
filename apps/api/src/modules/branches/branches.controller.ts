import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { BranchesService } from "./branches.service";
import {
  CreateBranchDto,
  UpdateBranchDto,
  SetBranchHoursDto,
  CreateBranchBlockDto,
  CreateScheduleExceptionDto,
  SetServicePriceDto,
  CreateBranchSerieDto,
} from "./dto";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RoleGuard } from "../rbac/guards/role.guard";
import { BranchScopeGuard } from "../rbac/guards/branch-scope.guard";
import { Public } from "../auth/decorators/public.decorator";
import { CurrentUser, CurrentUserData } from "../auth/decorators/current-user.decorator";
import { RequireRole } from "../rbac/decorators/require-role.decorator";
import { RequireBranchAccess } from "../rbac/decorators/require-branch-access.decorator";

@ApiTags("Branches")
@ApiBearerAuth("access-token")
@Controller("v1/branches")
@UseGuards(JwtAuthGuard, RoleGuard, BranchScopeGuard)
export class BranchesController {
  private readonly logger = new Logger("BranchesController");

  constructor(private branchesService: BranchesService) {}

  // ─── Endpoints públicos (autoservicio) ───────────────────────────────────

  /**
   * GET /v1/branches/:id/public
   * Información pública de la sede: horarios, servicios con precios, ubicación.
   * No requiere autenticación — usado por el portal de autoservicio.
   */
  @ApiOperation({ summary: "Obtener información pública de una sede (sin autenticación)" })
  @ApiResponse({ status: 200, description: "Información pública de la sede retornada exitosamente." })
  @ApiResponse({ status: 404, description: "Sede no encontrada." })
  @Get(":id/public")
  @Public()
  getPublicInfo(@Param("id") id: string) {
    return this.branchesService.getPublicInfo(id);
  }

  /**
   * GET /v1/branches/:id/photo
   * Foto de la sede. Pública para el autoservicio.
   */
  @ApiOperation({ summary: "Obtener la foto de una sede (sin autenticación)" })
  @ApiResponse({ status: 200, description: "Foto de la sede retornada exitosamente." })
  @ApiResponse({ status: 404, description: "Sede o foto no encontrada." })
  @Get(":id/photo")
  @Public()
  async getPhoto(@Param("id") id: string, @Res() res: Response) {
    const photo = await this.branchesService.getPhoto(id);
    if (!photo) return res.status(404).json({ message: "Sin foto" });
    res.set("Content-Type", photo.mimeType);
    res.set("Cache-Control", "public, max-age=86400");
    return res.send(photo.data);
  }

  // ─── Listado y detalle ───────────────────────────────────────────────────

  /**
   * GET /v1/branches
   * SUPER_ADMIN ve todas las sedes; otros solo las propias.
   */
  @ApiOperation({ summary: "Listar todas las sedes accesibles por el usuario autenticado" })
  @ApiResponse({ status: 200, description: "Lista de sedes retornada exitosamente." })
  @Get()
  getAllBranches(@CurrentUser() user: CurrentUserData) {
    return this.branchesService.findAll(user.userId);
  }

  /**
   * GET /v1/branches/:id
   */
  @ApiOperation({ summary: "Obtener el detalle de una sede por ID" })
  @ApiResponse({ status: 200, description: "Detalle de la sede retornado exitosamente." })
  @ApiResponse({ status: 404, description: "Sede no encontrada." })
  @Get(":id")
  @RequireBranchAccess("id")
  getBranch(@Param("id") id: string) {
    return this.branchesService.findOne(id);
  }

  /**
   * GET /v1/branches/:id/stats
   * Métricas del mes: citas, cancelaciones, revenue, usuarios activos.
   */
  @ApiOperation({ summary: "Obtener métricas del mes de una sede (citas, cancelaciones, revenue)" })
  @ApiResponse({ status: 200, description: "Métricas de la sede retornadas exitosamente." })
  @ApiResponse({ status: 404, description: "Sede no encontrada." })
  @Get(":id/stats")
  @RequireBranchAccess("id")
  getStats(@Param("id") id: string) {
    return this.branchesService.getStats(id);
  }

  // ─── CRUD de sede ────────────────────────────────────────────────────────

  /** POST /v1/branches  [SUPER_ADMIN] */
  @ApiOperation({ summary: "Crear una nueva sede [SUPER_ADMIN]" })
  @ApiResponse({ status: 200, description: "Sede creada exitosamente." })
  @ApiResponse({ status: 400, description: "Datos inválidos." })
  @Post()
  @RequireRole("SUPER_ADMIN")
  createBranch(@Body() dto: CreateBranchDto, @CurrentUser() user: CurrentUserData) {
    return this.branchesService.create(dto, user.userId);
  }

  /** PATCH /v1/branches/:id  [SUPER_ADMIN] */
  @ApiOperation({ summary: "Actualizar datos de una sede [SUPER_ADMIN]" })
  @ApiResponse({ status: 200, description: "Sede actualizada exitosamente." })
  @ApiResponse({ status: 404, description: "Sede no encontrada." })
  @Patch(":id")
  @RequireRole("SUPER_ADMIN")
  updateBranch(
    @Param("id") id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.branchesService.update(id, dto, user.userId);
  }

  /**
   * POST /v1/branches/:id/deactivate  [SUPER_ADMIN]
   * Desactiva la sede si no tiene citas activas futuras.
   */
  @ApiOperation({ summary: "Desactivar una sede (requiere que no tenga citas activas futuras) [SUPER_ADMIN]" })
  @ApiResponse({ status: 200, description: "Sede desactivada exitosamente." })
  @ApiResponse({ status: 409, description: "La sede tiene citas activas futuras." })
  @Post(":id/deactivate")
  @RequireRole("SUPER_ADMIN")
  deactivateBranch(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.branchesService.deactivate(id, user.userId);
  }

  /**
   * POST /v1/branches/:id/activate  [SUPER_ADMIN]
   * Reactiva una sede previamente desactivada.
   */
  @ApiOperation({ summary: "Reactivar una sede previamente desactivada [SUPER_ADMIN]" })
  @ApiResponse({ status: 200, description: "Sede reactivada exitosamente." })
  @ApiResponse({ status: 404, description: "Sede no encontrada." })
  @Post(":id/activate")
  @RequireRole("SUPER_ADMIN")
  activateBranch(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.branchesService.activate(id, user.userId);
  }

  /**
   * DELETE /v1/branches/:id  [SUPER_ADMIN]
   * Eliminación física definitiva.
   * Solo permitido si la sede está desactivada y sin historial de citas.
   */
  @ApiOperation({ summary: "Eliminar permanentemente una sede desactivada y sin historial [SUPER_ADMIN]" })
  @ApiResponse({ status: 200, description: "Sede eliminada exitosamente." })
  @ApiResponse({ status: 409, description: "La sede no puede eliminarse (activa o con historial)." })
  @Delete(":id")
  @RequireRole("SUPER_ADMIN")
  deleteBranch(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.branchesService.deletePermanently(id, user.userId);
  }

  // ─── Foto de sede ────────────────────────────────────────────────────────

  /** POST /v1/branches/:id/photo  [SUPER_ADMIN] — max 5 MB, JPEG/PNG/WEBP */
  @ApiOperation({ summary: "Subir foto de la sede (máx. 5 MB, JPEG/PNG/WEBP) [SUPER_ADMIN]" })
  @ApiResponse({ status: 200, description: "Foto subida exitosamente." })
  @ApiResponse({ status: 400, description: "Archivo no proporcionado o formato inválido." })
  @Post(":id/photo")
  @RequireRole("SUPER_ADMIN")
  @UseInterceptors(FileInterceptor("file"))
  uploadPhoto(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserData,
  ) {
    if (!file) throw new BadRequestException("Se requiere un archivo con la clave 'file'");
    return this.branchesService.uploadPhoto(id, file.buffer, file.mimetype, user.userId);
  }

  /** DELETE /v1/branches/:id/photo  [SUPER_ADMIN] */
  @ApiOperation({ summary: "Eliminar la foto de la sede [SUPER_ADMIN]" })
  @ApiResponse({ status: 200, description: "Foto eliminada exitosamente." })
  @ApiResponse({ status: 404, description: "Sede o foto no encontrada." })
  @Delete(":id/photo")
  @RequireRole("SUPER_ADMIN")
  deletePhoto(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.branchesService.deletePhoto(id, user.userId);
  }

  // ─── Horarios (BranchHour) ───────────────────────────────────────────────

  /** GET /v1/branches/:id/hours */
  @ApiOperation({ summary: "Obtener los horarios de atención de una sede" })
  @ApiResponse({ status: 200, description: "Horarios de la sede retornados exitosamente." })
  @Get(":id/hours")
  @RequireBranchAccess("id")
  getHours(@Param("id") id: string) {
    return this.branchesService.getHours(id);
  }

  /**
   * POST /v1/branches/:id/hours  [SUPER_ADMIN]
   * Reemplaza TODOS los horarios de la sede de una vez.
   */
  @ApiOperation({ summary: "Reemplazar todos los horarios de atención de una sede [SUPER_ADMIN]" })
  @ApiResponse({ status: 200, description: "Horarios reemplazados exitosamente." })
  @ApiResponse({ status: 400, description: "Datos de horarios inválidos." })
  @Post(":id/hours")
  @RequireRole("SUPER_ADMIN")
  setHours(
    @Param("id") id: string,
    @Body() dto: SetBranchHoursDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.branchesService.setHours(id, dto, user.userId);
  }

  // ─── Bloques de tiempo (BranchBlock) ────────────────────────────────────

  /** GET /v1/branches/:id/blocks?from=ISO&to=ISO */
  @ApiOperation({ summary: "Obtener los bloqueos de tiempo de una sede (filtrable por rango de fechas)" })
  @ApiResponse({ status: 200, description: "Bloqueos de la sede retornados exitosamente." })
  @Get(":id/blocks")
  @RequireBranchAccess("id")
  getBlocks(
    @Param("id")   id: string,
    @Query("from") from?: string,
    @Query("to")   to?: string,
  ) {
    return this.branchesService.getBlocks(id, from, to);
  }

  /** POST /v1/branches/:id/blocks  [SUPER_ADMIN] */
  @ApiOperation({ summary: "Crear un bloqueo de tiempo en una sede [SUPER_ADMIN]" })
  @ApiResponse({ status: 200, description: "Bloqueo creado exitosamente." })
  @ApiResponse({ status: 400, description: "Datos del bloqueo inválidos." })
  @Post(":id/blocks")
  @RequireRole("SUPER_ADMIN")
  createBlock(
    @Param("id") id: string,
    @Body() dto: CreateBranchBlockDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.branchesService.createBlock(id, dto, user.userId);
  }

  /** DELETE /v1/branches/:id/blocks/:blockId  [SUPER_ADMIN] */
  @ApiOperation({ summary: "Eliminar un bloqueo de tiempo de una sede [SUPER_ADMIN]" })
  @ApiResponse({ status: 200, description: "Bloqueo eliminado exitosamente." })
  @ApiResponse({ status: 404, description: "Bloqueo no encontrado." })
  @Delete(":id/blocks/:blockId")
  @RequireRole("SUPER_ADMIN")
  deleteBlock(
    @Param("id")      id: string,
    @Param("blockId") blockId: string,
    @CurrentUser()    user: CurrentUserData,
  ) {
    return this.branchesService.deleteBlock(id, blockId, user.userId);
  }

  // ─── Excepciones de horario ──────────────────────────────────────────────

  /** GET /v1/branches/:id/schedule-exceptions */
  @ApiOperation({ summary: "Obtener las excepciones de horario de una sede" })
  @ApiResponse({ status: 200, description: "Excepciones de horario retornadas exitosamente." })
  @Get(":id/schedule-exceptions")
  @RequireBranchAccess("id")
  getScheduleExceptions(@Param("id") id: string) {
    return this.branchesService.getScheduleExceptions(id);
  }

  /** POST /v1/branches/:id/schedule-exceptions  [SUPER_ADMIN] */
  @ApiOperation({ summary: "Crear una excepción de horario para una sede [SUPER_ADMIN]" })
  @ApiResponse({ status: 200, description: "Excepción de horario creada exitosamente." })
  @ApiResponse({ status: 400, description: "Datos de la excepción inválidos." })
  @Post(":id/schedule-exceptions")
  @RequireRole("SUPER_ADMIN")
  createScheduleException(
    @Param("id") id: string,
    @Body() dto: CreateScheduleExceptionDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.branchesService.createScheduleException(id, dto, user.userId);
  }

  /** DELETE /v1/branches/:id/schedule-exceptions/:exceptionId  [SUPER_ADMIN] */
  @ApiOperation({ summary: "Eliminar una excepción de horario de una sede [SUPER_ADMIN]" })
  @ApiResponse({ status: 200, description: "Excepción de horario eliminada exitosamente." })
  @ApiResponse({ status: 404, description: "Excepción no encontrada." })
  @Delete(":id/schedule-exceptions/:exceptionId")
  @RequireRole("SUPER_ADMIN")
  deleteScheduleException(
    @Param("id")          id: string,
    @Param("exceptionId") exceptionId: string,
    @CurrentUser()        user: CurrentUserData,
  ) {
    return this.branchesService.deleteScheduleException(id, exceptionId, user.userId);
  }

  // ─── Precios por servicio en sede ────────────────────────────────────────

  /** GET /v1/branches/:id/service-prices */
  @ApiOperation({ summary: "Obtener los precios de servicios configurados para una sede" })
  @ApiResponse({ status: 200, description: "Precios de servicios retornados exitosamente." })
  @Get(":id/service-prices")
  @RequireBranchAccess("id")
  getServicePrices(@Param("id") id: string) {
    return this.branchesService.getServicePrices(id);
  }

  /**
   * POST /v1/branches/:id/service-prices  [SUPER_ADMIN]
   * Crea o actualiza el precio de un servicio en esta sede (upsert).
   */
  @ApiOperation({ summary: "Crear o actualizar el precio de un servicio en una sede (upsert) [SUPER_ADMIN]" })
  @ApiResponse({ status: 200, description: "Precio del servicio actualizado exitosamente." })
  @ApiResponse({ status: 400, description: "Datos de precio inválidos." })
  @Post(":id/service-prices")
  @RequireRole("SUPER_ADMIN")
  setServicePrice(
    @Param("id") id: string,
    @Body() dto: SetServicePriceDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.branchesService.setServicePrice(id, dto, user.userId);
  }

  /**
   * DELETE /v1/branches/:id/service-prices/:serviceId  [SUPER_ADMIN]
   * Elimina el precio personalizado — se usará el precio base del servicio.
   */
  @ApiOperation({ summary: "Eliminar el precio personalizado de un servicio en una sede [SUPER_ADMIN]" })
  @ApiResponse({ status: 200, description: "Precio personalizado eliminado; se usará el precio base del servicio." })
  @ApiResponse({ status: 404, description: "Precio personalizado no encontrado." })
  @Delete(":id/service-prices/:serviceId")
  @RequireRole("SUPER_ADMIN")
  deleteServicePrice(
    @Param("id")        id: string,
    @Param("serviceId") serviceId: string,
    @CurrentUser()      user: CurrentUserData,
  ) {
    return this.branchesService.deleteServicePrice(id, serviceId, user.userId);
  }

  // ─── Gestión de usuarios por sede ───────────────────────────────────────

  /** GET /v1/branches/:id/users */
  @ApiOperation({ summary: "Obtener los usuarios asignados a una sede" })
  @ApiResponse({ status: 200, description: "Usuarios de la sede retornados exitosamente." })
  @Get(":id/users")
  @RequireBranchAccess("id")
  getBranchUsers(@Param("id") id: string) {
    return this.branchesService.getBranchUsers(id);
  }

  /** POST /v1/branches/:branchId/users/:userId  [SUPER_ADMIN] */
  @ApiOperation({ summary: "Asignar un usuario a una sede [SUPER_ADMIN]" })
  @ApiResponse({ status: 200, description: "Usuario asignado a la sede exitosamente." })
  @ApiResponse({ status: 404, description: "Sede o usuario no encontrado." })
  @Post(":branchId/users/:userId")
  @RequireRole("SUPER_ADMIN")
  assignUserToBranch(
    @Param("branchId") branchId: string,
    @Param("userId")   userId: string,
    @CurrentUser()     user: CurrentUserData,
  ) {
    return this.branchesService.assignUserToBranch(branchId, userId, user.userId);
  }

  /** DELETE /v1/branches/:branchId/users/:userId  [SUPER_ADMIN] */
  @ApiOperation({ summary: "Remover un usuario de una sede [SUPER_ADMIN]" })
  @ApiResponse({ status: 200, description: "Usuario removido de la sede exitosamente." })
  @ApiResponse({ status: 404, description: "Sede o usuario no encontrado." })
  @Delete(":branchId/users/:userId")
  @RequireRole("SUPER_ADMIN")
  removeUserFromBranch(
    @Param("branchId") branchId: string,
    @Param("userId")   userId: string,
    @CurrentUser()     user: CurrentUserData,
  ) {
    return this.branchesService.removeUserFromBranch(branchId, userId, user.userId);
  }

  // ─── Series de documentos ────────────────────────────────────────────────

  /** GET /v1/branches/:id/series */
  @ApiOperation({ summary: "Obtener las series de documentos configuradas para una sede" })
  @ApiResponse({ status: 200, description: "Series retornadas exitosamente." })
  @Get(":id/series")
  @RequireBranchAccess("id")
  getSeries(@Param("id") id: string) {
    return this.branchesService.getSeries(id);
  }

  /** POST /v1/branches/:id/series  [SUPER_ADMIN] */
  @ApiOperation({ summary: "Agregar una serie de documento a una sede [SUPER_ADMIN]" })
  @ApiResponse({ status: 200, description: "Serie creada exitosamente." })
  @ApiResponse({ status: 400, description: "Datos inválidos o serie duplicada." })
  @Post(":id/series")
  @RequireRole("SUPER_ADMIN")
  createSerie(
    @Param("id")   id: string,
    @Body()        dto: CreateBranchSerieDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.branchesService.createSerie(id, dto, user.userId);
  }

  /** DELETE /v1/branches/:id/series/:serieId  [SUPER_ADMIN] */
  @ApiOperation({ summary: "Eliminar una serie de documento de una sede [SUPER_ADMIN]" })
  @ApiResponse({ status: 200, description: "Serie eliminada exitosamente." })
  @ApiResponse({ status: 404, description: "Serie no encontrada." })
  @Delete(":id/series/:serieId")
  @RequireRole("SUPER_ADMIN")
  deleteSerie(
    @Param("id")      id: string,
    @Param("serieId") serieId: string,
    @CurrentUser()    user: CurrentUserData,
  ) {
    return this.branchesService.deleteSerie(id, serieId, user.userId);
  }

  // ─── Dashboard de sede ───────────────────────────────────────────────────

  /**
   * GET /v1/branches/:id/dashboard?date=YYYY-MM-DD
   *
   * Devuelve en una sola llamada los KPIs del día para el Dashboard Sede:
   * citas (por estado), ocupación, ventas del día y estado de la caja.
   * Si `date` no se envía, usa la fecha actual en hora Lima (America/Lima).
   */
  @ApiOperation({ summary: "Obtener KPIs del día para el Dashboard Sede" })
  @ApiResponse({ status: 200, description: "KPIs del día retornados exitosamente." })
  @ApiResponse({ status: 404, description: "Sede no encontrada." })
  @Get(":id/dashboard")
  @RequireBranchAccess("id")
  getDashboard(
    @Param("id")       id: string,
    @Query("date")     date?: string,
  ) {
    return this.branchesService.getDashboard(id, date);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from "@nestjs/swagger";
import { ServicesService } from "./services.service";
import {
  CreateServiceDto,
  UpdateServiceDto,
  SetBranchPriceDto,
  CreateServiceCategoryDto,
  UpdateServiceCategoryDto,
} from "./dto";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { CurrentUser, CurrentUserData } from "../auth/decorators/current-user.decorator";

@ApiTags("Services")
@Controller("v1/services")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ServicesController {
  private readonly logger = new Logger("ServicesController");

  constructor(private readonly servicesService: ServicesService) {}

  // ── Endpoints públicos — rutas estáticas primero ──────────────────────────────

  /**
   * GET /v1/services
   * Lista servicios activos. Público (portal + booking).
   * Con ?all=true y permisos muestra también los inactivos (admin).
   */
  @ApiOperation({ summary: "Listar servicios (activos o todos)" })
  @ApiResponse({ status: 200, description: "Lista de servicios devuelta correctamente" })
  @Get()
  @Public()
  getAllServices(@Query("all") all?: string) {
    // Para ver todos (incluso inactivos) el frontend admin debe pasar ?all=true
    // En un endpoint público no forzamos auth; si quieren ver inactivos los verán
    // igual (están desactivados, el portal los ignora). El filtrado real es por isActive.
    const onlyActive = all !== "true";
    return this.servicesService.findAll(onlyActive);
  }

  /**
   * GET /v1/services/self-service
   * Solo servicios con allowSelfService=true. Público (portal autoservicio).
   */
  @ApiOperation({ summary: "Listar servicios disponibles para autoservicio" })
  @ApiResponse({ status: 200, description: "Lista de servicios con allowSelfService=true" })
  @Get("self-service")
  @Public()
  getServicesForSelfService() {
    return this.servicesService.findAvailableForSelfService();
  }

  // ── Categorías — rutas estáticas antes de :id ─────────────────────────────────

  /**
   * GET /v1/services/categories
   * Lista todas las categorías de servicios. Público.
   */
  @ApiOperation({ summary: "Listar categorías de servicios" })
  @ApiResponse({ status: 200, description: "Lista de categorías devuelta correctamente" })
  @Get("categories")
  @Public()
  listCategories() {
    return this.servicesService.listCategories();
  }

  /**
   * POST /v1/services/categories
   * Crea una nueva categoría.
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Crear una nueva categoría de servicios" })
  @ApiResponse({ status: 201, description: "Categoría creada correctamente" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Post("categories")
  @RequirePermission("settings.update")
  createCategory(
    @Body() dto: CreateServiceCategoryDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user.userId} creando categoría "${dto.name}"`);
    return this.servicesService.createCategory(dto, user.userId);
  }

  /**
   * PATCH /v1/services/categories/:categoryId
   * Actualiza nombre, color u orden de una categoría.
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Actualizar una categoría de servicios" })
  @ApiParam({ name: "categoryId", description: "ID de la categoría" })
  @ApiResponse({ status: 200, description: "Categoría actualizada correctamente" })
  @ApiResponse({ status: 404, description: "Categoría no encontrada" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Patch("categories/:categoryId")
  @RequirePermission("settings.update")
  updateCategory(
    @Param("categoryId") categoryId: string,
    @Body() dto: UpdateServiceCategoryDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user.userId} actualizando categoría ${categoryId}`);
    return this.servicesService.updateCategory(categoryId, dto, user.userId);
  }

  /**
   * DELETE /v1/services/categories/:categoryId
   * Elimina una categoría (solo si no tiene servicios asignados).
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Eliminar una categoría de servicios (solo si no tiene servicios asignados)" })
  @ApiParam({ name: "categoryId", description: "ID de la categoría" })
  @ApiResponse({ status: 200, description: "Categoría eliminada correctamente" })
  @ApiResponse({ status: 400, description: "La categoría tiene servicios asignados" })
  @ApiResponse({ status: 404, description: "Categoría no encontrada" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Delete("categories/:categoryId")
  @RequirePermission("settings.update")
  deleteCategory(
    @Param("categoryId") categoryId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user.userId} eliminando categoría ${categoryId}`);
    return this.servicesService.deleteCategory(categoryId, user.userId);
  }

  // ── Rutas con :id ──────────────────────────────────────────────────────────────

  /**
   * GET /v1/services/:id
   * Detalle de servicio. Público.
   * Devuelve el servicio aunque esté inactivo (para reactivación desde admin).
   */
  @ApiOperation({ summary: "Obtener detalle de un servicio por ID" })
  @ApiParam({ name: "id", description: "ID del servicio" })
  @ApiResponse({ status: 200, description: "Servicio devuelto correctamente" })
  @ApiResponse({ status: 404, description: "Servicio no encontrado" })
  @Get(":id")
  @Public()
  getService(@Param("id") id: string) {
    return this.servicesService.findOne(id);
  }

  /**
   * POST /v1/services
   * Crea un nuevo servicio.
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Crear un nuevo servicio" })
  @ApiResponse({ status: 201, description: "Servicio creado correctamente" })
  @ApiResponse({ status: 400, description: "Datos de entrada inválidos" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Post()
  @RequirePermission("settings.update")
  createService(@Body() dto: CreateServiceDto, @CurrentUser() user: CurrentUserData) {
    this.logger.log(`Usuario ${user.userId} creando servicio "${dto.name}"`);
    return this.servicesService.create(dto, user.userId);
  }

  /**
   * PATCH /v1/services/:id
   * Actualiza un servicio (campos opcionales).
   * Para activar/desactivar usa los endpoints dedicados.
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Actualizar un servicio existente" })
  @ApiParam({ name: "id", description: "ID del servicio" })
  @ApiResponse({ status: 200, description: "Servicio actualizado correctamente" })
  @ApiResponse({ status: 400, description: "Datos de entrada inválidos" })
  @ApiResponse({ status: 404, description: "Servicio no encontrado" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Patch(":id")
  @RequirePermission("settings.update")
  updateService(
    @Param("id") id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user.userId} actualizando servicio ${id}`);
    return this.servicesService.update(id, dto, user.userId);
  }

  /**
   * POST /v1/services/:id/deactivate
   * Desactiva el servicio. Bloquea si tiene citas activas futuras.
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Desactivar un servicio (bloquea si tiene citas futuras activas)" })
  @ApiParam({ name: "id", description: "ID del servicio" })
  @ApiResponse({ status: 200, description: "Servicio desactivado correctamente" })
  @ApiResponse({ status: 400, description: "El servicio tiene citas activas futuras" })
  @ApiResponse({ status: 404, description: "Servicio no encontrado" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Post(":id/deactivate")
  @RequirePermission("settings.update")
  deactivateService(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    this.logger.log(`Usuario ${user.userId} desactivando servicio ${id}`);
    return this.servicesService.deactivate(id, user.userId);
  }

  /**
   * POST /v1/services/:id/activate
   * Reactiva un servicio previamente desactivado.
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Reactivar un servicio previamente desactivado" })
  @ApiParam({ name: "id", description: "ID del servicio" })
  @ApiResponse({ status: 200, description: "Servicio reactivado correctamente" })
  @ApiResponse({ status: 404, description: "Servicio no encontrado" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Post(":id/activate")
  @RequirePermission("settings.update")
  activateService(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    this.logger.log(`Usuario ${user.userId} activando servicio ${id}`);
    return this.servicesService.activate(id, user.userId);
  }

  /**
   * DELETE /v1/services/:id
   * Mantiene compatibilidad: desactiva el servicio (no elimina físicamente
   * ya que los servicios tienen historial de citas y ventas).
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Desactivar un servicio vía DELETE (compatibilidad — soft disable)" })
  @ApiParam({ name: "id", description: "ID del servicio" })
  @ApiResponse({ status: 200, description: "Servicio desactivado correctamente" })
  @ApiResponse({ status: 400, description: "El servicio tiene citas activas futuras" })
  @ApiResponse({ status: 404, description: "Servicio no encontrado" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Delete(":id")
  @RequirePermission("settings.update")
  deleteService(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    this.logger.log(`Usuario ${user.userId} desactivando servicio ${id} (via DELETE)`);
    return this.servicesService.deactivate(id, user.userId);
  }

  // ── Imagen ────────────────────────────────────────────────────────────────────

  /**
   * GET /v1/services/:id/image
   * Devuelve la imagen del servicio en binario. Público (portal de autoservicio).
   */
  @ApiOperation({ summary: "Obtener la imagen de un servicio" })
  @ApiParam({ name: "id", description: "ID del servicio" })
  @ApiResponse({ status: 200, description: "Imagen devuelta en binario" })
  @ApiResponse({ status: 404, description: "Servicio sin imagen o no encontrado" })
  @Get(":id/image")
  @Public()
  async getImage(@Param("id") id: string, @Res() res: Response) {
    const image = await this.servicesService.getImage(id);
    if (!image) return res.status(404).json({ message: "Sin imagen" });
    res.set("Content-Type", image.mimeType);
    res.set("Cache-Control", "public, max-age=86400");
    return res.send(image.data);
  }

  /**
   * POST /v1/services/:id/image
   * Sube imagen del servicio. Máx 5 MB, JPEG/PNG/WEBP.
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Subir o reemplazar la imagen de un servicio (máx 5 MB, JPEG/PNG/WEBP)" })
  @ApiParam({ name: "id", description: "ID del servicio" })
  @ApiResponse({ status: 201, description: "Imagen subida correctamente" })
  @ApiResponse({ status: 400, description: "Archivo no proporcionado o formato inválido" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Post(":id/image")
  @RequirePermission("settings.update")
  @UseInterceptors(FileInterceptor("file"))
  uploadImage(
    @Param("id")    id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser()  user: CurrentUserData,
  ) {
    if (!file) throw new BadRequestException("Se requiere un archivo con la clave 'file'");
    return this.servicesService.uploadImage(id, file.buffer, file.mimetype, user.userId);
  }

  /** DELETE /v1/services/:id/image */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Eliminar la imagen de un servicio" })
  @ApiParam({ name: "id", description: "ID del servicio" })
  @ApiResponse({ status: 200, description: "Imagen eliminada correctamente" })
  @ApiResponse({ status: 404, description: "Servicio o imagen no encontrada" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Delete(":id/image")
  @RequirePermission("settings.update")
  deleteImage(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.servicesService.deleteImage(id, user.userId);
  }

  // ── Estadísticas e historial ──────────────────────────────────────────────────

  /**
   * GET /v1/services/:id/stats
   * Citas totales, tasa de completación/cancelación, ingresos, sedes con precio custom.
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Obtener estadísticas de un servicio (citas, ingresos, tasas)" })
  @ApiParam({ name: "id", description: "ID del servicio" })
  @ApiResponse({ status: 200, description: "Estadísticas devueltas correctamente" })
  @ApiResponse({ status: 404, description: "Servicio no encontrado" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Get(":id/stats")
  @RequirePermission("settings.update")
  getStats(@Param("id") id: string) {
    return this.servicesService.getStats(id);
  }

  /**
   * GET /v1/services/:id/history
   * Audit log del servicio (cambios de precio, activaciones, etc.).
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Obtener el historial de auditoría de un servicio" })
  @ApiParam({ name: "id", description: "ID del servicio" })
  @ApiResponse({ status: 200, description: "Historial devuelto correctamente" })
  @ApiResponse({ status: 404, description: "Servicio no encontrado" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Get(":id/history")
  @RequirePermission("settings.update")
  getHistory(@Param("id") id: string) {
    return this.servicesService.getHistory(id);
  }

  // ── Precios por sede ──────────────────────────────────────────────────────────

  /**
   * GET /v1/services/:id/prices
   * Lista precios por sede del servicio. Público.
   */
  @ApiOperation({ summary: "Listar precios por sede de un servicio" })
  @ApiParam({ name: "id", description: "ID del servicio" })
  @ApiResponse({ status: 200, description: "Precios por sede devueltos correctamente" })
  @ApiResponse({ status: 404, description: "Servicio no encontrado" })
  @Get(":id/prices")
  @Public()
  getBranchPrices(@Param("id") id: string) {
    return this.servicesService.getBranchPrices(id);
  }

  /**
   * PUT /v1/services/:id/prices/:branchId
   * Crea o actualiza precio del servicio en una sede específica (upsert).
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Crear o actualizar el precio de un servicio en una sede específica" })
  @ApiParam({ name: "id", description: "ID del servicio" })
  @ApiParam({ name: "branchId", description: "ID de la sede" })
  @ApiResponse({ status: 200, description: "Precio por sede guardado correctamente" })
  @ApiResponse({ status: 400, description: "Datos de entrada inválidos" })
  @ApiResponse({ status: 404, description: "Servicio o sede no encontrada" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Put(":id/prices/:branchId")
  @RequirePermission("settings.update")
  setBranchPrice(
    @Param("id")       id: string,
    @Param("branchId") branchId: string,
    @Body()            dto: SetBranchPriceDto,
    @CurrentUser()     user: CurrentUserData,
  ) {
    return this.servicesService.setBranchPrice(id, branchId, dto, user.userId);
  }

  /**
   * DELETE /v1/services/:id/prices/:branchId
   * Elimina precio personalizado por sede. Vuelve al basePrice.
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Eliminar el precio personalizado de un servicio en una sede (vuelve al precio base)" })
  @ApiParam({ name: "id", description: "ID del servicio" })
  @ApiParam({ name: "branchId", description: "ID de la sede" })
  @ApiResponse({ status: 200, description: "Precio personalizado eliminado correctamente" })
  @ApiResponse({ status: 404, description: "Servicio, sede o precio no encontrado" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Delete(":id/prices/:branchId")
  @RequirePermission("settings.update")
  removeBranchPrice(
    @Param("id")       id: string,
    @Param("branchId") branchId: string,
    @CurrentUser()     user: CurrentUserData,
  ) {
    return this.servicesService.removeBranchPrice(id, branchId, user.userId);
  }
}

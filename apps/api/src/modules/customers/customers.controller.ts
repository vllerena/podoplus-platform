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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { CustomersService } from "./customers.service";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { Public } from "../auth/decorators/public.decorator";
import {
  CurrentUser,
  CurrentUserData,
} from "../auth/decorators/current-user.decorator";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { CreateCustomerNoteDto } from "./dto/create-customer-note.dto";
import { UpdateCustomerNoteDto } from "./dto/update-customer-note.dto";
import { CreateCustomerTagDto } from "./dto/customer-tag.dto";
import { SelfRegisterCustomerDto } from "./dto/self-register-customer.dto";
import { CreateCompanyDto, CreateMarketingChannelDto } from "./dto/company.dto";

@ApiTags("Customers")
@Controller("v1/customers")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CustomersController {
  private readonly logger = new Logger("CustomersController");

  constructor(private customersService: CustomersService) {}

  // ─── Endpoints públicos ───────────────────────────────────────────────────────

  /**
   * POST /v1/customers/self-register
   * Auto-registro desde el portal de autoservicio. No requiere autenticación.
   * Detecta duplicados por teléfono y retorna advertencia antes de crear.
   */
  @ApiOperation({
    summary: "Auto-registro de cliente desde portal de autoservicio",
  })
  @ApiResponse({ status: 201, description: "Cliente registrado exitosamente" })
  @ApiResponse({ status: 409, description: "Posible duplicado detectado" })
  @Post("self-register")
  @Public()
  selfRegister(@Body() dto: SelfRegisterCustomerDto) {
    return this.customersService.selfRegister(dto);
  }

  // ─── Tags (globales) ─────────────────────────────────────────────────────────

  /** GET /v1/customers/tags — Lista todos los tags disponibles */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Lista todos los tags de clientes disponibles" })
  @ApiResponse({ status: 200, description: "Lista de tags" })
  @Get("tags")
  @RequirePermission("customer.read")
  listTags() {
    return this.customersService.listTags();
  }

  /** POST /v1/customers/tags — Crea un nuevo tag */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Crea un nuevo tag de cliente" })
  @ApiResponse({ status: 201, description: "Tag creado" })
  @Post("tags")
  @RequirePermission("customer.create")
  createTag(
    @Body() dto: CreateCustomerTagDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.customersService.createTag(dto, user.userId);
  }

  /** DELETE /v1/customers/tags/:tagId — Elimina un tag (desasigna de todos los clientes) */
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Elimina un tag y lo desasigna de todos los clientes",
  })
  @ApiResponse({ status: 200, description: "Tag eliminado" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @Delete("tags/:tagId")
  @RequirePermission("customer.delete")
  deleteTag(
    @Param("tagId") tagId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.customersService.deleteTag(tagId, user.userId);
  }

  // ─── Detección de duplicados ─────────────────────────────────────────────────

  /**
   * GET /v1/customers/dedup?q=texto
   * Busca clientes potencialmente duplicados por nombre o teléfono.
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Busca clientes potencialmente duplicados por nombre o teléfono",
  })
  @ApiResponse({ status: 200, description: "Lista de clientes" })
  @ApiQuery({
    name: "q",
    required: false,
    description: "Texto de búsqueda (nombre o teléfono)",
  })
  @Get("dedup")
  @RequirePermission("customer.read")
  findDuplicates(@Query("q") q: string) {
    return this.customersService.findDuplicates(q ?? "");
  }

  // ─── Cumpleaños ──────────────────────────────────────────────────────────────

  /**
   * GET /v1/customers/birthdays?month=3
   * Clientes con cumpleaños en el mes indicado (default: mes actual).
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Lista clientes con cumpleaños en el mes indicado" })
  @ApiResponse({ status: 200, description: "Lista de clientes" })
  @ApiQuery({
    name: "month",
    required: false,
    description: "Número de mes (1-12). Por defecto: mes actual",
  })
  @Get("birthdays")
  @RequirePermission("customer.read")
  getCustomerBirthdays(@Query("month") month?: string) {
    const m = month ? parseInt(month, 10) : undefined;
    return this.customersService.getCustomerBirthdays(m);
  }

  // ─── Export CSV ──────────────────────────────────────────────────────────────

  /**
   * GET /v1/customers/export?format=csv
   * Exporta el listado de clientes con los mismos filtros que search. Máx 5000 registros.
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary:
      "Exporta el listado de clientes en formato CSV (máx 5000 registros)",
  })
  @ApiResponse({ status: 200, description: "Archivo CSV de clientes" })
  @ApiQuery({ name: "q", required: false, description: "Búsqueda por nombre" })
  @ApiQuery({
    name: "documentNumber",
    required: false,
    description: "Filtrar por número de documento",
  })
  @ApiQuery({
    name: "phone",
    required: false,
    description: "Filtrar por teléfono",
  })
  @ApiQuery({
    name: "email",
    required: false,
    description: "Filtrar por email",
  })
  @ApiQuery({
    name: "tagIds",
    required: false,
    description: "Filtrar por tags (IDs separados por coma)",
  })
  @ApiQuery({
    name: "deleted",
    required: false,
    description: "Incluir clientes eliminados (true/false)",
  })
  @Get("export")
  @RequirePermission("customer.read")
  async exportCustomers(
    @Query("q") query?: string,
    @Query("documentNumber") documentNumber?: string,
    @Query("phone") phone?: string,
    @Query("email") email?: string,
    @Query("tagIds") tagIds?: string,
    @Query("deleted") deleted?: string,
    @Res({ passthrough: true }) res?: Response,
    @CurrentUser() user?: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user?.userId} exportando listado de clientes`);
    const csv = await this.customersService.exportCustomersCSV({
      query,
      documentNumber,
      phone,
      email,
      tagIds: tagIds ? tagIds.split(",").filter(Boolean) : undefined,
      deleted: deleted === "true",
    });

    res!.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientes_${new Date().toISOString().split("T")[0]}.csv"`,
    });
    return csv;
  }

  // ─── Búsqueda principal ──────────────────────────────────────────────────────

  /**
   * GET /v1/customers
   * Lista clientes con filtros y cursor-based pagination.
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Lista clientes con filtros y cursor-based pagination",
  })
  @ApiResponse({ status: 200, description: "Lista de clientes" })
  @ApiQuery({ name: "q", required: false, description: "Búsqueda por nombre" })
  @ApiQuery({
    name: "documentNumber",
    required: false,
    description: "Filtrar por número de documento",
  })
  @ApiQuery({
    name: "phone",
    required: false,
    description: "Filtrar por teléfono",
  })
  @ApiQuery({
    name: "email",
    required: false,
    description: "Filtrar por email",
  })
  @ApiQuery({
    name: "familyHeadId",
    required: false,
    description: "Filtrar por titular de familia",
  })
  @ApiQuery({
    name: "tagIds",
    required: false,
    description: "Filtrar por tags (IDs separados por coma)",
  })
  @ApiQuery({
    name: "deleted",
    required: false,
    description: "Incluir clientes eliminados (true/false)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Cantidad de resultados (máx 100, default 20)",
  })
  @ApiQuery({
    name: "cursor",
    required: false,
    description: "Cursor para paginación",
  })
  @Get()
  @RequirePermission("customer.read")
  listCustomers(
    @Query("q") query?: string,
    @Query("documentNumber") documentNumber?: string,
    @Query("phone") phone?: string,
    @Query("email") email?: string,
    @Query("familyHeadId") familyHeadId?: string,
    @Query("tagIds") tagIds?: string,
    @Query("deleted") deleted?: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
    @CurrentUser() user?: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user?.userId} listando clientes`);

    return this.customersService.searchCustomers({
      query,
      documentNumber,
      phone,
      email,
      familyHeadId,
      tagIds: tagIds ? tagIds.split(",").filter(Boolean) : undefined,
      deleted: deleted === "true",
      limit: Math.min(parseInt(limit || "20"), 100),
      cursor,
    });
  }

  /**
   * GET /v1/customers/search
   * Búsqueda con cursor-based pagination para 60k+ registros.
   * Params: q, documentNumber, phone, email, familyHeadId, tagIds, deleted, limit, cursor
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Busca clientes con cursor-based pagination" })
  @ApiResponse({ status: 200, description: "Lista de clientes" })
  @ApiQuery({ name: "q", required: false, description: "Búsqueda por nombre" })
  @ApiQuery({
    name: "documentNumber",
    required: false,
    description: "Filtrar por número de documento",
  })
  @ApiQuery({
    name: "phone",
    required: false,
    description: "Filtrar por teléfono",
  })
  @ApiQuery({
    name: "email",
    required: false,
    description: "Filtrar por email",
  })
  @ApiQuery({
    name: "familyHeadId",
    required: false,
    description: "Filtrar por titular de familia",
  })
  @ApiQuery({
    name: "tagIds",
    required: false,
    description: "Filtrar por tags (IDs separados por coma)",
  })
  @ApiQuery({
    name: "deleted",
    required: false,
    description: "Incluir clientes eliminados (true/false)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Cantidad de resultados (máx 100, default 20)",
  })
  @ApiQuery({
    name: "cursor",
    required: false,
    description: "Cursor para paginación",
  })
  @Get("search")
  @RequirePermission("customer.read")
  searchCustomers(
    @Query("q") query?: string,
    @Query("documentNumber") documentNumber?: string,
    @Query("phone") phone?: string,
    @Query("email") email?: string,
    @Query("familyHeadId") familyHeadId?: string,
    @Query("tagIds") tagIds?: string,
    @Query("deleted") deleted?: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
    @CurrentUser() user?: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user?.userId} buscando clientes`);

    return this.customersService.searchCustomers({
      query,
      documentNumber,
      phone,
      email,
      familyHeadId,
      tagIds: tagIds ? tagIds.split(",").filter(Boolean) : undefined,
      deleted: deleted === "true",
      limit: Math.min(parseInt(limit || "20"), 100),
      cursor,
    });
  }

  // ─── Empresas (CRUD global) ───────────────────────────────────────────────────

  /** GET /v1/customers/companies */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Lista todas las empresas registradas" })
  @ApiQuery({ name: "q", required: false })
  @Get("companies")
  @RequirePermission("customer.read")
  listCompanies(@Query("q") q?: string) {
    return this.customersService.listCompanies(q);
  }

  /** POST /v1/customers/companies */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Crea una nueva empresa" })
  @Post("companies")
  @RequirePermission("customer.create")
  createCompany(@Body() dto: CreateCompanyDto, @CurrentUser() user: CurrentUserData) {
    return this.customersService.createCompany(dto, user.userId);
  }

  /** DELETE /v1/customers/companies/:companyId */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Elimina una empresa" })
  @ApiParam({ name: "companyId", description: "ID de la empresa" })
  @Delete("companies/:companyId")
  @RequirePermission("customer.delete")
  deleteCompany(
    @Param("companyId") companyId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.customersService.deleteCompany(companyId, user.userId);
  }

  // ─── Canales de marketing ─────────────────────────────────────────────────────

  /** GET /v1/customers/marketing-channels */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Lista los canales de marketing activos" })
  @Get("marketing-channels")
  @RequirePermission("customer.read")
  listMarketingChannels() {
    return this.customersService.listMarketingChannels();
  }

  /** POST /v1/customers/marketing-channels */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Crea un nuevo canal de marketing" })
  @Post("marketing-channels")
  @RequirePermission("customer.create")
  createMarketingChannel(
    @Body() dto: CreateMarketingChannelDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.customersService.createMarketingChannel(dto, user.userId);
  }

  /** DELETE /v1/customers/marketing-channels/:channelId */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Elimina un canal de marketing" })
  @ApiParam({ name: "channelId", description: "ID del canal" })
  @Delete("marketing-channels/:channelId")
  @RequirePermission("customer.delete")
  deleteMarketingChannel(
    @Param("channelId") channelId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.customersService.deleteMarketingChannel(channelId, user.userId);
  }

  // ─── Rutas con :id — deben ir DESPUÉS de las rutas estáticas ─────────────────

  /** POST /v1/customers */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Crea un nuevo cliente" })
  @ApiResponse({ status: 201, description: "Cliente creado" })
  @Post()
  @RequirePermission("customer.create")
  createCustomer(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(
      `Usuario ${user.userId} creando cliente: ${dto.firstName} ${dto.lastName}`,
    );
    return this.customersService.createCustomer(dto, user.userId);
  }

  /** GET /v1/customers/:id */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Obtiene un cliente por ID" })
  @ApiResponse({ status: 200, description: "Lista de clientes" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @Get(":id")
  @RequirePermission("customer.read")
  getCustomerById(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user.userId} consultando cliente ${id}`);
    return this.customersService.getCustomerById(id);
  }

  /** PATCH /v1/customers/:id */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Actualiza los datos de un cliente" })
  @ApiResponse({ status: 200, description: "Cliente actualizado" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @Patch(":id")
  @RequirePermission("customer.update")
  updateCustomer(
    @Param("id") id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user.userId} actualizando cliente ${id}`);
    return this.customersService.updateCustomer(id, dto, user.userId);
  }

  /** DELETE /v1/customers/:id — Soft delete */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Elimina un cliente (soft delete)" })
  @ApiResponse({ status: 200, description: "Cliente eliminado" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @Delete(":id")
  @RequirePermission("customer.delete")
  deleteCustomer(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user.userId} eliminando cliente ${id}`);
    return this.customersService.deleteCustomer(id, user.userId);
  }

  /**
   * POST /v1/customers/:id/restore
   * Restaura un cliente previamente eliminado (soft delete).
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Restaura un cliente previamente eliminado" })
  @ApiResponse({ status: 201, description: "Cliente restaurado" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @Post(":id/restore")
  @RequirePermission("customer.delete")
  restoreCustomer(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user.userId} restaurando cliente ${id}`);
    return this.customersService.restoreCustomer(id, user.userId);
  }

  /**
   * POST /v1/customers/:id/merge/:duplicateId
   * Fusiona el duplicado en el superviviente. Todos los registros se reasignan.
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Fusiona un cliente duplicado en el cliente superviviente",
  })
  @ApiResponse({ status: 201, description: "Clientes fusionados exitosamente" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del cliente superviviente" })
  @ApiParam({
    name: "duplicateId",
    description: "ID del cliente duplicado a eliminar",
  })
  @Post(":id/merge/:duplicateId")
  @RequirePermission("customer.delete")
  mergeCustomers(
    @Param("id") survivorId: string,
    @Param("duplicateId") duplicateId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(
      `Usuario ${user.userId} fusionando cliente ${duplicateId} en ${survivorId}`,
    );
    return this.customersService.mergeCustomers(
      survivorId,
      duplicateId,
      user.userId,
    );
  }

  // ─── Avatar ───────────────────────────────────────────────────────────────────

  /**
   * GET /v1/customers/:id/avatar
   * Devuelve la imagen binaria con el Content-Type correcto.
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Obtiene el avatar de un cliente" })
  @ApiResponse({ status: 200, description: "Imagen del avatar" })
  @ApiResponse({ status: 404, description: "Sin avatar" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @Get(":id/avatar")
  @RequirePermission("customer.read")
  async getAvatar(@Param("id") id: string, @Res() res: Response) {
    const avatar = await this.customersService.getAvatar(id);
    if (!avatar) return res.status(404).json({ message: "Sin avatar" });
    res.set("Content-Type", avatar.mimeType);
    res.set("Cache-Control", "private, max-age=86400");
    return res.send(avatar.data);
  }

  /**
   * POST /v1/customers/:id/avatar  — máx 3 MB, JPEG/PNG/WEBP
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary:
      "Sube o reemplaza el avatar de un cliente (máx 3 MB, JPEG/PNG/WEBP)",
  })
  @ApiResponse({ status: 201, description: "Avatar subido exitosamente" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @Post(":id/avatar")
  @RequirePermission("customer.update")
  @UseInterceptors(FileInterceptor("file"))
  uploadAvatar(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserData,
  ) {
    if (!file)
      throw new BadRequestException(
        "Se requiere un archivo con la clave 'file'",
      );
    return this.customersService.uploadAvatar(
      id,
      file.buffer,
      file.mimetype,
      user.userId,
    );
  }

  /** DELETE /v1/customers/:id/avatar */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Elimina el avatar de un cliente" })
  @ApiResponse({ status: 200, description: "Avatar eliminado" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @Delete(":id/avatar")
  @RequirePermission("customer.update")
  deleteAvatar(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.customersService.deleteAvatar(id, user.userId);
  }

  // ─── Historial de auditoría ───────────────────────────────────────────────────

  /**
   * GET /v1/customers/:id/history
   * Devuelve todos los registros de AuditLog relacionados con el cliente.
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Obtiene el historial de auditoría de un cliente" })
  @ApiResponse({ status: 200, description: "Lista de clientes" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @Get(":id/history")
  @RequirePermission("customer.read")
  getHistory(@Param("id") id: string) {
    return this.customersService.getHistory(id);
  }

  /**
   * GET /v1/customers/:id/timeline?limit=30&cursor=ISO_DATE
   * Feed cronológico unificado de citas, ventas y suscripciones del cliente.
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary:
      "Feed cronológico unificado de citas, ventas y suscripciones del cliente",
  })
  @ApiResponse({ status: 200, description: "Lista de clientes" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Cantidad de resultados (máx 100, default 30)",
  })
  @ApiQuery({
    name: "cursor",
    required: false,
    description: "Cursor ISO date para paginación",
  })
  @Get(":id/timeline")
  @RequirePermission("customer.read")
  getCustomerTimeline(
    @Param("id") id: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ) {
    return this.customersService.getCustomerTimeline(
      id,
      limit ? Math.min(parseInt(limit, 10), 100) : 30,
      cursor,
    );
  }

  // ─── Notas clínicas ───────────────────────────────────────────────────────────

  /** GET /v1/customers/:id/notes */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Lista las notas clínicas de un cliente" })
  @ApiResponse({ status: 200, description: "Lista de clientes" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @Get(":id/notes")
  @RequirePermission("customer.read")
  getNotes(@Param("id") id: string) {
    return this.customersService.getNotes(id);
  }

  /** POST /v1/customers/:id/notes */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Crea una nota clínica para un cliente" })
  @ApiResponse({ status: 201, description: "Cliente creado" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @Post(":id/notes")
  @RequirePermission("customer.update")
  createNote(
    @Param("id") id: string,
    @Body() dto: CreateCustomerNoteDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.customersService.createNote(id, dto, user.userId);
  }

  /** PATCH /v1/customers/:id/notes/:noteId */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Actualiza una nota clínica de un cliente" })
  @ApiResponse({ status: 200, description: "Nota actualizada" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @ApiParam({ name: "noteId", description: "ID de la nota" })
  @Patch(":id/notes/:noteId")
  @RequirePermission("customer.update")
  updateNote(
    @Param("id") id: string,
    @Param("noteId") noteId: string,
    @Body() dto: UpdateCustomerNoteDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.customersService.updateNote(id, noteId, dto, user.userId);
  }

  /** DELETE /v1/customers/:id/notes/:noteId */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Elimina una nota clínica de un cliente" })
  @ApiResponse({ status: 200, description: "Nota eliminada" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @ApiParam({ name: "noteId", description: "ID de la nota" })
  @Delete(":id/notes/:noteId")
  @RequirePermission("customer.update")
  deleteNote(
    @Param("id") id: string,
    @Param("noteId") noteId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.customersService.deleteNote(id, noteId, user.userId);
  }

  // ─── Tags por cliente ─────────────────────────────────────────────────────────

  /** POST /v1/customers/:id/tags/:tagId — Asigna un tag a un cliente */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Asigna un tag a un cliente" })
  @ApiResponse({ status: 201, description: "Tag asignado" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @ApiParam({ name: "tagId", description: "ID del tag" })
  @Post(":id/tags/:tagId")
  @RequirePermission("customer.update")
  assignTag(
    @Param("id") id: string,
    @Param("tagId") tagId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.customersService.assignTag(id, tagId, user.userId);
  }

  /** DELETE /v1/customers/:id/tags/:tagId — Remueve un tag de un cliente */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Remueve un tag de un cliente" })
  @ApiResponse({ status: 200, description: "Tag removido" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @ApiParam({ name: "tagId", description: "ID del tag" })
  @Delete(":id/tags/:tagId")
  @RequirePermission("customer.update")
  removeTag(
    @Param("id") id: string,
    @Param("tagId") tagId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.customersService.removeTag(id, tagId, user.userId);
  }

  // ─── Familia ──────────────────────────────────────────────────────────────────

  /** GET /v1/customers/:id/family */
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Lista los miembros de familia vinculados al cliente",
  })
  @ApiResponse({ status: 200, description: "Lista de clientes" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del titular de familia" })
  @Get(":id/family")
  @RequirePermission("customer.read")
  getFamilyMembers(@Param("id") id: string) {
    return this.customersService.getFamilyMembers(id);
  }

  /** POST /v1/customers/:id/link-family/:familyHeadId */
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Vincula un cliente como miembro de familia de otro cliente",
  })
  @ApiResponse({ status: 201, description: "Cliente creado" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del miembro a vincular" })
  @ApiParam({ name: "familyHeadId", description: "ID del titular de familia" })
  @Post(":id/link-family/:familyHeadId")
  @RequirePermission("customer.update")
  linkFamilyMember(
    @Param("id") memberId: string,
    @Param("familyHeadId") familyHeadId: string,
    @Body() body: { relation?: string },
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(
      `Usuario ${user.userId} vinculando ${memberId} a familia ${familyHeadId} (${body?.relation ?? "sin relación"})`,
    );
    return this.customersService.linkFamilyMember(
      memberId,
      familyHeadId,
      user.userId,
      body?.relation,
    );
  }

  /** POST /v1/customers/:id/unlink-family */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Desvincula un cliente de su grupo familiar" })
  @ApiResponse({ status: 201, description: "Cliente creado" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del miembro a desvincular" })
  @Post(":id/unlink-family")
  @RequirePermission("customer.update")
  unlinkFamilyMember(
    @Param("id") memberId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user.userId} desvinculando ${memberId}`);
    return this.customersService.unlinkFamilyMember(memberId, user.userId);
  }

  // ─── WhatsApp ─────────────────────────────────────────────────────────────────

  /** POST /v1/customers/:id/whatsapp-optin */
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Activa el consentimiento WhatsApp para un cliente",
  })
  @ApiResponse({ status: 201, description: "Cliente creado" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @Post(":id/whatsapp-optin")
  @RequirePermission("customer.update")
  enableWhatsAppOptIn(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.customersService.setWhatsAppOptIn(id, true, user.userId);
  }

  /** POST /v1/customers/:id/whatsapp-optout */
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Desactiva el consentimiento WhatsApp para un cliente",
  })
  @ApiResponse({ status: 201, description: "Cliente creado" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @Post(":id/whatsapp-optout")
  @RequirePermission("customer.update")
  disableWhatsAppOptIn(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.customersService.setWhatsAppOptIn(id, false, user.userId);
  }

  /**
   * GET /v1/customers/:id/messages?limit=20&cursor=
   * Historial de mensajes WhatsApp con cursor-based pagination.
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary:
      "Historial de mensajes WhatsApp del cliente con cursor-based pagination",
  })
  @ApiResponse({ status: 200, description: "Lista de clientes" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Cantidad de mensajes (default 20)",
  })
  @ApiQuery({
    name: "cursor",
    required: false,
    description: "Cursor para paginación",
  })
  @Get(":id/messages")
  @RequirePermission("customer.read")
  getMessages(
    @Param("id") id: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ) {
    return this.customersService.getMessages(id, {
      limit: parseInt(limit || "20"),
      cursor,
    });
  }

  // ─── Suscripciones, citas, ventas y estadísticas ──────────────────────────────

  /** GET /v1/customers/:id/subscriptions */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Lista las suscripciones de un cliente" })
  @ApiResponse({ status: 200, description: "Lista de clientes" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @ApiQuery({
    name: "status",
    required: false,
    description: "Filtrar por estado de suscripción",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Cantidad de resultados (máx 100, default 20)",
  })
  @ApiQuery({
    name: "offset",
    required: false,
    description: "Offset para paginación (default 0)",
  })
  @Get(":id/subscriptions")
  @RequirePermission("customer.read")
  getCustomerSubscriptions(
    @Param("id") id: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.customersService.getCustomerSubscriptions(
      id,
      status,
      Math.min(parseInt(limit || "20"), 100),
      parseInt(offset || "0"),
    );
  }

  /** GET /v1/customers/:id/appointments */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Lista las citas de un cliente" })
  @ApiResponse({ status: 200, description: "Lista de clientes" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @ApiQuery({
    name: "status",
    required: false,
    description: "Filtrar por estado de cita",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Cantidad de resultados (máx 100, default 20)",
  })
  @ApiQuery({
    name: "offset",
    required: false,
    description: "Offset para paginación (default 0)",
  })
  @Get(":id/appointments")
  @RequirePermission("customer.read")
  getCustomerAppointments(
    @Param("id") id: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.customersService.getCustomerAppointments(
      id,
      status,
      Math.min(parseInt(limit || "20"), 100),
      parseInt(offset || "0"),
    );
  }

  /** GET /v1/customers/:id/sales */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Lista las ventas de un cliente" })
  @ApiResponse({ status: 200, description: "Lista de clientes" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @ApiQuery({
    name: "status",
    required: false,
    description: "Filtrar por estado de venta",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Cantidad de resultados (máx 100, default 20)",
  })
  @ApiQuery({
    name: "offset",
    required: false,
    description: "Offset para paginación (default 0)",
  })
  @Get(":id/sales")
  @RequirePermission("customer.read")
  getCustomerSales(
    @Param("id") id: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.customersService.getCustomerSales(
      id,
      status,
      Math.min(parseInt(limit || "20"), 100),
      parseInt(offset || "0"),
    );
  }

  /** GET /v1/customers/:id/stats */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Obtiene las estadísticas de un cliente" })
  @ApiResponse({ status: 200, description: "Estadísticas del cliente" })
  @ApiResponse({ status: 404, description: "No encontrado" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @Get(":id/stats")
  @RequirePermission("customer.read")
  getCustomerStats(@Param("id") id: string) {
    return this.customersService.getCustomerStats(id);
  }

  // ─── Empresas / datos fiscales por cliente ────────────────────────────────────

  /** GET /v1/customers/:id/companies */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Lista las empresas vinculadas a un cliente" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @Get(":id/companies")
  @RequirePermission("customer.read")
  getCustomerCompanies(@Param("id") id: string) {
    return this.customersService.getCustomerCompanies(id);
  }

  /** POST /v1/customers/:id/companies/:companyId */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Vincula una empresa a un cliente" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @ApiParam({ name: "companyId", description: "ID de la empresa" })
  @Post(":id/companies/:companyId")
  @RequirePermission("customer.update")
  assignCompany(
    @Param("id") id: string,
    @Param("companyId") companyId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.customersService.assignCompanyToCustomer(id, companyId, user.userId);
  }

  /** DELETE /v1/customers/:id/companies/:companyId */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Desvincula una empresa de un cliente" })
  @ApiParam({ name: "id", description: "ID del cliente" })
  @ApiParam({ name: "companyId", description: "ID de la empresa" })
  @Delete(":id/companies/:companyId")
  @RequirePermission("customer.update")
  removeCompany(
    @Param("id") id: string,
    @Param("companyId") companyId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.customersService.removeCompanyFromCustomer(id, companyId, user.userId);
  }
}

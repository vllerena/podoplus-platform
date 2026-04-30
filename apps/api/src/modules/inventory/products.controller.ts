import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from "@nestjs/swagger";
import { InventoryService } from "./inventory.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { CurrentUser, CurrentUserData } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";

@ApiTags("Inventory")
@ApiBearerAuth("access-token")
@Controller("v1/products")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProductsController {
  private readonly logger = new Logger("ProductsController");

  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * POST /v1/products
   * Crear producto
   */
  @ApiOperation({ summary: "Crear un nuevo producto" })
  @ApiResponse({ status: 201, description: "Producto creado correctamente" })
  @ApiResponse({ status: 400, description: "Datos de entrada inválidos" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Post()
  @RequirePermission("product.manage")
  createProduct(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: CurrentUserData
  ) {
    this.logger.log(`Usuario ${user.userId} creando producto SKU ${dto.sku}`);
    return this.inventoryService.createProduct(dto, user.userId);
  }

  /**
   * GET /v1/products
   * Listar productos con cursor-based pagination.
   * Query: q (nombre/SKU), active=true|false, cursor, limit
   */
  @ApiOperation({ summary: "Listar productos con paginación por cursor" })
  @ApiQuery({ name: "q", required: false, description: "Filtro por nombre o SKU" })
  @ApiQuery({ name: "active", required: false, description: "Filtrar por estado activo: true | false" })
  @ApiQuery({ name: "cursor", required: false, description: "Cursor para paginación" })
  @ApiQuery({ name: "limit", required: false, description: "Número máximo de resultados (máx 200, default 50)" })
  @ApiResponse({ status: 200, description: "Lista de productos devuelta correctamente" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Get()
  @RequirePermission("product.read")
  getProducts(
    @Query("q")      q?: string,
    @Query("active") active?: string,
    @Query("cursor") cursor?: string,
    @Query("limit")  limit?: string,
    @CurrentUser()   user?: CurrentUserData
  ) {
    this.logger.log(`Usuario ${user?.userId} listando productos`);
    const onlyActive = active === undefined ? undefined : active === "true";
    return this.inventoryService.getProducts({
      q,
      active: onlyActive,
      cursor,
      limit:  limit ? Math.min(parseInt(limit, 10), 200) : 50,
    });
  }

  /**
   * GET /v1/products/:id
   * Obtener producto por ID
   */
  @ApiOperation({ summary: "Obtener un producto por ID" })
  @ApiParam({ name: "id", description: "ID del producto" })
  @ApiResponse({ status: 200, description: "Producto devuelto correctamente" })
  @ApiResponse({ status: 404, description: "Producto no encontrado" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Get(":id")
  @RequirePermission("product.read")
  getProductById(
    @Param("id") id: string,
    @CurrentUser() user?: CurrentUserData
  ) {
    this.logger.log(`Usuario ${user?.userId} consultando producto ${id}`);
    return this.inventoryService.getProductById(id);
  }

  /**
   * PATCH /v1/products/:id
   * Actualizar producto
   */
  @ApiOperation({ summary: "Actualizar un producto existente" })
  @ApiParam({ name: "id", description: "ID del producto" })
  @ApiResponse({ status: 200, description: "Producto actualizado correctamente" })
  @ApiResponse({ status: 400, description: "Datos de entrada inválidos" })
  @ApiResponse({ status: 404, description: "Producto no encontrado" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Patch(":id")
  @RequirePermission("product.manage")
  updateProduct(
    @Param("id") id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: CurrentUserData
  ) {
    this.logger.log(`Usuario ${user.userId} actualizando producto ${id}`);
    return this.inventoryService.updateProduct(id, dto, user.userId);
  }

  /**
   * POST /v1/products/:id/enable
   * Reactivar un producto desactivado
   */
  @ApiOperation({ summary: "Reactivar un producto desactivado" })
  @ApiParam({ name: "id", description: "ID del producto" })
  @ApiResponse({ status: 200, description: "Producto reactivado correctamente" })
  @ApiResponse({ status: 404, description: "Producto no encontrado" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Post(":id/enable")
  @RequirePermission("product.manage")
  enableProduct(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData
  ) {
    this.logger.log(`Usuario ${user.userId} activando producto ${id}`);
    return this.inventoryService.enableProduct(id, user.userId);
  }

  /**
   * DELETE /v1/products/:id
   * Desactivar producto (soft disable)
   */
  @ApiOperation({ summary: "Desactivar un producto (soft disable)" })
  @ApiParam({ name: "id", description: "ID del producto" })
  @ApiResponse({ status: 200, description: "Producto desactivado correctamente" })
  @ApiResponse({ status: 404, description: "Producto no encontrado" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Delete(":id")
  @RequirePermission("product.manage")
  disableProduct(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData
  ) {
    this.logger.log(`Usuario ${user.userId} desactivando producto ${id}`);
    return this.inventoryService.disableProduct(id, user.userId);
  }

  // ── Image endpoints ──────────────────────────────────────────────────────────

  /**
   * GET /v1/products/:id/image
   * Obtener imagen del producto (público para que <img src> funcione sin token)
   */
  @ApiOperation({ summary: "Obtener imagen del producto" })
  @ApiParam({ name: "id", description: "ID del producto" })
  @Public()
  @Get(":id/image")
  async getProductImage(@Param("id") id: string, @Res() res: Response) {
    const image = await this.inventoryService.getProductImage(id);
    if (!image) return res.status(404).json({ message: "Sin imagen" });
    res.set("Content-Type", image.mimeType);
    // no-store: el browser siempre pide al servidor (cache-busting via ?v= en la URL)
    res.set("Cache-Control", "no-store");
    return res.send(image.data);
  }

  /**
   * POST /v1/products/:id/image
   * Subir/reemplazar imagen del producto
   */
  @ApiOperation({ summary: "Subir imagen del producto" })
  @ApiParam({ name: "id", description: "ID del producto" })
  @ApiResponse({ status: 200, description: "Imagen cargada correctamente" })
  @Post(":id/image")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission("product.manage")
  @UseInterceptors(FileInterceptor("file"))
  uploadProductImage(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserData
  ) {
    if (!file) throw new BadRequestException("Se requiere un archivo con la clave 'file'");
    this.logger.log(`Usuario ${user.userId} subiendo imagen para producto ${id}`);
    return this.inventoryService.uploadProductImage(id, file.buffer, file.mimetype, user.userId);
  }

  /**
   * DELETE /v1/products/:id/image
   * Eliminar imagen del producto
   */
  @ApiOperation({ summary: "Eliminar imagen del producto" })
  @ApiParam({ name: "id", description: "ID del producto" })
  @ApiResponse({ status: 200, description: "Imagen eliminada correctamente" })
  @Delete(":id/image")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission("product.manage")
  deleteProductImage(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData
  ) {
    this.logger.log(`Usuario ${user.userId} eliminando imagen del producto ${id}`);
    return this.inventoryService.deleteProductImage(id, user.userId);
  }
}

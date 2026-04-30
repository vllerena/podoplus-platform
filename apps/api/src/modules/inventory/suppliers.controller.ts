import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from "@nestjs/swagger";
import { PurchasesService }   from "./purchases.service";
import { CreateSupplierDto }  from "./dto/create-supplier.dto";
import { JwtAuthGuard }       from "../auth/guards/jwt.guard";
import { PermissionGuard }    from "../rbac/guards/permission.guard";
import { RequirePermission }  from "../rbac/decorators/require-permission.decorator";
import { CurrentUser, CurrentUserData } from "../auth/decorators/current-user.decorator";

@ApiTags("Suppliers")
@ApiBearerAuth("access-token")
@Controller("v1/suppliers")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SuppliersController {
  private readonly logger = new Logger("SuppliersController");

  constructor(private readonly purchasesService: PurchasesService) {}

  /**
   * POST /v1/suppliers
   * Crear un nuevo proveedor.
   */
  @ApiOperation({ summary: "Crear un nuevo proveedor" })
  @ApiResponse({ status: 201, description: "Proveedor creado correctamente" })
  @ApiResponse({ status: 409, description: "Ya existe un proveedor con ese documento" })
  @Post()
  @RequirePermission("inventory.manage")
  create(
    @Body() dto: CreateSupplierDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user.userId} creando proveedor: ${dto.name}`);
    return this.purchasesService.createSupplier(dto);
  }

  /**
   * GET /v1/suppliers
   * Listar proveedores (con búsqueda opcional por nombre o documento).
   */
  @ApiOperation({ summary: "Listar proveedores" })
  @ApiQuery({ name: "q",          required: false, description: "Buscar por nombre o documento" })
  @ApiQuery({ name: "onlyActive", required: false, description: "Solo activos (default: true)" })
  @ApiResponse({ status: 200, description: "Lista de proveedores" })
  @Get()
  @RequirePermission("inventory.read")
  list(
    @Query("q")          q?: string,
    @Query("onlyActive") onlyActive?: string,
    @CurrentUser()       user?: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user?.userId} listando proveedores`);
    return this.purchasesService.listSuppliers(q, onlyActive !== "false");
  }

  /**
   * GET /v1/suppliers/:id
   * Obtener un proveedor por ID.
   */
  @ApiOperation({ summary: "Obtener proveedor por ID" })
  @ApiParam({ name: "id", description: "ID del proveedor" })
  @ApiResponse({ status: 200, description: "Proveedor encontrado" })
  @ApiResponse({ status: 404, description: "Proveedor no encontrado" })
  @Get(":id")
  @RequirePermission("inventory.read")
  findOne(
    @Param("id") id: string,
    @CurrentUser() user?: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user?.userId} consultando proveedor ${id}`);
    return this.purchasesService.getSupplier(id);
  }

  /**
   * PATCH /v1/suppliers/:id
   * Actualizar datos de un proveedor.
   */
  @ApiOperation({ summary: "Actualizar proveedor" })
  @ApiParam({ name: "id", description: "ID del proveedor" })
  @ApiResponse({ status: 200, description: "Proveedor actualizado" })
  @ApiResponse({ status: 404, description: "Proveedor no encontrado" })
  @Patch(":id")
  @RequirePermission("inventory.manage")
  update(
    @Param("id") id: string,
    @Body() dto: Partial<CreateSupplierDto>,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user.userId} actualizando proveedor ${id}`);
    return this.purchasesService.updateSupplier(id, dto);
  }

  /**
   * DELETE /v1/suppliers/:id
   * Deshabilitar un proveedor (soft delete — isActive = false).
   */
  @ApiOperation({ summary: "Deshabilitar proveedor (soft delete)" })
  @ApiParam({ name: "id", description: "ID del proveedor" })
  @ApiResponse({ status: 200, description: "Proveedor deshabilitado" })
  @ApiResponse({ status: 404, description: "Proveedor no encontrado" })
  @Delete(":id")
  @RequirePermission("inventory.manage")
  disable(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user.userId} deshabilitando proveedor ${id}`);
    return this.purchasesService.disableSupplier(id);
  }
}

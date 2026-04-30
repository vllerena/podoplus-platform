import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Headers,
  UseGuards,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { InventoryService }   from "./inventory.service";
import { CreateMovementDto }  from "./dto/create-movement.dto";
import { BulkStockInitDto }   from "./dto/bulk-stock-init.dto";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { CurrentUser, CurrentUserData } from "../auth/decorators/current-user.decorator";

@ApiTags("Inventory")
@ApiBearerAuth("access-token")
@Controller("v1/inventory")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class InventoryController {
  private readonly logger = new Logger("InventoryController");

  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * GET /v1/inventory/stocks
   * Stock actual por sede.
   * Query: branchId (req), includeAll=true (muestra todos los productos activos, incluso qty=0)
   */
  @ApiOperation({ summary: "Obtener stock actual de una sede" })
  @ApiQuery({ name: "branchId", required: true, description: "ID de la sede" })
  @ApiQuery({ name: "includeAll", required: false, description: "Si es true, incluye productos con cantidad 0" })
  @ApiResponse({ status: 200, description: "Stock devuelto correctamente" })
  @ApiResponse({ status: 400, description: "branchId es requerido" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Get("stocks")
  @RequirePermission("inventory.read")
  getStocks(
    @Query("branchId")    branchId: string,
    @Query("includeAll")  includeAll?: string,
    @CurrentUser()        user?: CurrentUserData
  ) {
    if (!branchId) throw new BadRequestException("branchId es requerido");
    this.logger.log(`Usuario ${user?.userId} consultando stock de sede ${branchId}`);
    return this.inventoryService.getStocks(branchId, includeAll === "true");
  }

  /**
   * GET /v1/inventory/stocks/low
   * Productos con stock igual o inferior al umbral.
   * Query: branchId (req), threshold (default 5)
   */
  @ApiOperation({ summary: "Obtener alertas de stock bajo de una sede" })
  @ApiQuery({ name: "branchId", required: true, description: "ID de la sede" })
  @ApiQuery({ name: "threshold", required: false, description: "Umbral de stock bajo (default 5)" })
  @ApiResponse({ status: 200, description: "Alertas de stock bajo devueltas correctamente" })
  @ApiResponse({ status: 400, description: "branchId es requerido o threshold inválido" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Get("stocks/low")
  @RequirePermission("inventory.read")
  getLowStockAlerts(
    @Query("branchId")   branchId: string,
    @Query("threshold")  threshold?: string,
    @CurrentUser()       user?: CurrentUserData
  ) {
    if (!branchId) throw new BadRequestException("branchId es requerido");
    const thresh = threshold ? parseInt(threshold, 10) : 5;
    if (isNaN(thresh) || thresh < 0) {
      throw new BadRequestException("threshold debe ser un entero no negativo");
    }
    this.logger.log(`Usuario ${user?.userId} consultando alertas de stock bajo — sede ${branchId}`);
    return this.inventoryService.getLowStockAlerts(branchId, thresh);
  }

  /**
   * GET /v1/inventory/valuation
   * Valoración del inventario de una sede (qty × costPrice / salePrice).
   * Query: branchId (req)
   */
  @ApiOperation({ summary: "Obtener la valoración del inventario de una sede" })
  @ApiQuery({ name: "branchId", required: true, description: "ID de la sede" })
  @ApiResponse({ status: 200, description: "Valoración del inventario devuelta correctamente" })
  @ApiResponse({ status: 400, description: "branchId es requerido" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Get("valuation")
  @RequirePermission("inventory.read")
  getInventoryValuation(
    @Query("branchId") branchId: string,
    @CurrentUser()     user?: CurrentUserData
  ) {
    if (!branchId) throw new BadRequestException("branchId es requerido");
    this.logger.log(`Usuario ${user?.userId} consultando valoración — sede ${branchId}`);
    return this.inventoryService.getInventoryValuation(branchId);
  }

  /**
   * POST /v1/inventory/stocks/bulk-init
   * Inicialización masiva de stock para un producto en múltiples sedes.
   */
  @ApiOperation({ summary: "Inicialización masiva de stock por producto y sede" })
  @ApiResponse({ status: 201, description: "Stock inicializado correctamente" })
  @ApiResponse({ status: 400, description: "Datos de entrada inválidos" })
  @ApiResponse({ status: 404, description: "Producto o sede no encontrada" })
  @Post("stocks/bulk-init")
  @RequirePermission("inventory.manage")
  bulkInitStock(
    @Body() dto: BulkStockInitDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(
      `Usuario ${user.userId} inicializando stock masivo — producto ${dto.product_id}, ${dto.entries.length} sedes`
    );
    return this.inventoryService.bulkInitStock(dto, user.userId);
  }

  /**
   * POST /v1/inventory/movements
   * Registrar movimiento manual (PURCHASE_IN, ADJUSTMENT, TRANSFER_OUT, TRANSFER_IN)
   */
  @ApiOperation({ summary: "Registrar un movimiento de inventario manual" })
  @ApiResponse({ status: 201, description: "Movimiento registrado correctamente" })
  @ApiResponse({ status: 400, description: "Datos de entrada inválidos" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Post("movements")
  @RequirePermission("inventory.manage")
  registerMovement(
    @Body() dto: CreateMovementDto,
    @CurrentUser() user: CurrentUserData,
    @Headers("x-idempotency-key") idempotencyKey?: string
  ) {
    this.logger.log(
      `Usuario ${user.userId} registrando movimiento ${dto.type} en sede ${dto.branch_id}`
    );
    return this.inventoryService.registerMovement(dto, user.userId, idempotencyKey);
  }

  /**
   * GET /v1/inventory/movements
   * Historial de movimientos con cursor-based pagination.
   * Query: branchId (req), productId?, type?, from?, to?, cursor?, limit?
   */
  @ApiOperation({ summary: "Listar historial de movimientos de inventario con paginación por cursor" })
  @ApiQuery({ name: "branchId", required: true, description: "ID de la sede" })
  @ApiQuery({ name: "productId", required: false, description: "Filtrar por ID de producto" })
  @ApiQuery({ name: "type", required: false, description: "Filtrar por tipo: PURCHASE_IN, ADJUSTMENT, TRANSFER_OUT, TRANSFER_IN, SALE_OUT, RETURN_IN" })
  @ApiQuery({ name: "from", required: false, description: "Fecha inicio en formato YYYY-MM-DD" })
  @ApiQuery({ name: "to", required: false, description: "Fecha fin en formato YYYY-MM-DD" })
  @ApiQuery({ name: "cursor", required: false, description: "Cursor para paginación" })
  @ApiQuery({ name: "limit", required: false, description: "Número máximo de resultados (máx 200, default 50)" })
  @ApiResponse({ status: 200, description: "Historial de movimientos devuelto correctamente" })
  @ApiResponse({ status: 400, description: "branchId es requerido o fechas inválidas" })
  @ApiResponse({ status: 403, description: "Permisos insuficientes" })
  @Get("movements")
  @RequirePermission("inventory.read")
  getMovements(
    @Query("branchId")  branchId: string,
    @Query("productId") productId?: string,
    @Query("type")      type?: string,
    @Query("from")      from?: string,
    @Query("to")        to?: string,
    @Query("cursor")    cursor?: string,
    @Query("limit")     limit?: string,
    @CurrentUser()      user?: CurrentUserData
  ) {
    if (!branchId) throw new BadRequestException("branchId es requerido");

    const fromDate = from ? this.parseLocalDate(from, false) : undefined;
    const toDate   = to   ? this.parseLocalDate(to,   true)  : undefined;

    if (fromDate && isNaN(fromDate.getTime())) {
      throw new BadRequestException("from debe ser una fecha válida (YYYY-MM-DD)");
    }
    if (toDate && isNaN(toDate.getTime())) {
      throw new BadRequestException("to debe ser una fecha válida (YYYY-MM-DD)");
    }
    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException("from debe ser anterior a to");
    }

    this.logger.log(
      `Usuario ${user?.userId} consultando movimientos de sede ${branchId}`
    );

    return this.inventoryService.getMovements({
      branchId,
      productId,
      type,
      from: fromDate,
      to:   toDate,
      cursor,
      limit: limit ? Math.min(parseInt(limit, 10), 200) : 50,
    });
  }

  // ─────────────────────────────────────────────────────────────────

  /**
   * Parsea "YYYY-MM-DD" como fecha local (sin desfase UTC).
   */
  private parseLocalDate(dateStr: string, endOfDay: boolean): Date {
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return new Date(NaN);
    const [year, month, day] = parts;
    if (endOfDay) return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }
}

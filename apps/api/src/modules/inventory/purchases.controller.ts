import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from "@nestjs/swagger";
import { PurchasesService }  from "./purchases.service";
import { CreatePurchaseDto } from "./dto/create-purchase.dto";
import { UpdatePurchaseDto } from "./dto/update-purchase.dto";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { JwtAuthGuard }      from "../auth/guards/jwt.guard";
import { PermissionGuard }   from "../rbac/guards/permission.guard";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { CurrentUser, CurrentUserData } from "../auth/decorators/current-user.decorator";

class CancelPurchaseDto {
  @ApiProperty({ example: "Compra ingresada por error", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

@ApiTags("Purchases")
@ApiBearerAuth("access-token")
@Controller("v1/purchases")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PurchasesController {
  private readonly logger = new Logger("PurchasesController");

  constructor(private readonly purchasesService: PurchasesService) {}

  /**
   * POST /v1/purchases
   * Crear una nueva compra en estado DRAFT.
   */
  @ApiOperation({ summary: "Crear una compra (DRAFT)" })
  @ApiResponse({ status: 201, description: "Compra creada en estado DRAFT" })
  @ApiResponse({ status: 400, description: "Datos de entrada inválidos" })
  @ApiResponse({ status: 404, description: "Proveedor, producto o sede no encontrada" })
  @ApiResponse({ status: 409, description: "Comprobante duplicado para este proveedor" })
  @Post()
  @RequirePermission("inventory.manage")
  create(
    @Body() dto: CreatePurchaseDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(
      `Usuario ${user.userId} creando compra: ${dto.voucher_type} ${dto.serie}-${dto.number}`
    );
    return this.purchasesService.createPurchase(dto, user.userId);
  }

  /**
   * GET /v1/purchases
   * Listar compras con filtros y paginación por cursor.
   */
  @ApiOperation({ summary: "Listar compras" })
  @ApiQuery({ name: "supplierId",     required: false, description: "Filtrar por proveedor" })
  @ApiQuery({ name: "businessUnitId", required: false, description: "Filtrar por razón social" })
  @ApiQuery({ name: "status",         required: false, description: "DRAFT | RECEIVED | CANCELLED" })
  @ApiQuery({ name: "from",           required: false, description: "Fecha inicio (YYYY-MM-DD)" })
  @ApiQuery({ name: "to",             required: false, description: "Fecha fin (YYYY-MM-DD)" })
  @ApiQuery({ name: "cursor",         required: false, description: "Cursor para paginación" })
  @ApiQuery({ name: "limit",          required: false, description: "Máx resultados (default 50)" })
  @ApiResponse({ status: 200, description: "Lista de compras" })
  @Get()
  @RequirePermission("inventory.read")
  list(
    @Query("supplierId")     supplierId?: string,
    @Query("businessUnitId") businessUnitId?: string,
    @Query("status")         status?: string,
    @Query("from")           from?: string,
    @Query("to")             to?: string,
    @Query("cursor")         cursor?: string,
    @Query("limit")          limit?: string,
    @CurrentUser()           user?: CurrentUserData,
  ) {
    const fromDate = from ? this.parseLocalDate(from, false) : undefined;
    const toDate   = to   ? this.parseLocalDate(to,   true)  : undefined;

    if (fromDate && isNaN(fromDate.getTime())) {
      throw new BadRequestException("from debe ser una fecha válida (YYYY-MM-DD)");
    }
    if (toDate && isNaN(toDate.getTime())) {
      throw new BadRequestException("to debe ser una fecha válida (YYYY-MM-DD)");
    }

    this.logger.log(`Usuario ${user?.userId} listando compras`);
    return this.purchasesService.listPurchases({
      supplierId,
      businessUnitId,
      status,
      from:  fromDate,
      to:    toDate,
      cursor,
      limit: limit ? Math.min(parseInt(limit, 10), 200) : 50,
    });
  }

  /**
   * GET /v1/purchases/:id
   * Obtener detalle de una compra (con ítems).
   */
  @ApiOperation({ summary: "Obtener detalle de una compra" })
  @ApiParam({ name: "id", description: "ID de la compra" })
  @ApiResponse({ status: 200, description: "Detalle de la compra" })
  @ApiResponse({ status: 404, description: "Compra no encontrada" })
  @Get(":id")
  @RequirePermission("inventory.read")
  findOne(
    @Param("id") id: string,
    @CurrentUser() user?: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user?.userId} consultando compra ${id}`);
    return this.purchasesService.getPurchase(id);
  }

  /**
   * PATCH /v1/purchases/:id
   * Actualizar una compra en estado DRAFT (ítems se reemplazan en bloque si se envían).
   */
  @ApiOperation({ summary: "Actualizar compra (solo en DRAFT)" })
  @ApiParam({ name: "id", description: "ID de la compra" })
  @ApiResponse({ status: 200, description: "Compra actualizada" })
  @ApiResponse({ status: 400, description: "La compra no está en estado DRAFT" })
  @ApiResponse({ status: 404, description: "Compra no encontrada" })
  @Patch(":id")
  @RequirePermission("inventory.manage")
  update(
    @Param("id") id: string,
    @Body() dto: UpdatePurchaseDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user.userId} actualizando compra ${id}`);
    return this.purchasesService.updatePurchase(id, dto, user.userId);
  }

  /**
   * POST /v1/purchases/:id/receive
   * Confirmar recepción: DRAFT → RECEIVED.
   * Actualiza InventoryStock y crea movimientos PURCHASE_IN por cada ítem.
   */
  @ApiOperation({ summary: "Recibir compra: DRAFT → RECEIVED (actualiza stock)" })
  @ApiParam({ name: "id", description: "ID de la compra" })
  @ApiResponse({ status: 200, description: "Compra recibida y stock actualizado" })
  @ApiResponse({ status: 400, description: "La compra no está en estado DRAFT o no tiene ítems" })
  @ApiResponse({ status: 404, description: "Compra no encontrada" })
  @Post(":id/receive")
  @RequirePermission("inventory.manage")
  receive(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user.userId} recibiendo compra ${id}`);
    return this.purchasesService.receivePurchase(id, user.userId);
  }

  /**
   * POST /v1/purchases/:id/cancel
   * Cancelar una compra — solo si está en DRAFT.
   */
  @ApiOperation({ summary: "Cancelar compra (solo en DRAFT)" })
  @ApiParam({ name: "id", description: "ID de la compra" })
  @ApiBody({ type: CancelPurchaseDto, required: false })
  @ApiResponse({ status: 200, description: "Compra cancelada" })
  @ApiResponse({ status: 400, description: "La compra no está en estado DRAFT" })
  @ApiResponse({ status: 404, description: "Compra no encontrada" })
  @Post(":id/cancel")
  @RequirePermission("inventory.manage")
  cancel(
    @Param("id") id: string,
    @Body() body: CancelPurchaseDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user.userId} cancelando compra ${id}`);
    return this.purchasesService.cancelPurchase(id, body.reason ?? "", user.userId);
  }

  // ─────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────

  private parseLocalDate(dateStr: string, endOfDay: boolean): Date {
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return new Date(NaN);
    const [year, month, day] = parts;
    if (endOfDay) return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }
}

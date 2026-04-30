import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { SalesService } from "./sales.service";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { VoidSaleDto } from "./dto/void-sale.dto";
import { RefundSaleDto } from "./dto/refund-sale.dto";
import { SimulateSunatSyncDto } from "./dto/simulate-sunat-sync.dto";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import {
  CurrentUser,
  CurrentUserData,
} from "../auth/decorators/current-user.decorator";
import { parseLocalDate } from "../../utils/timezone";

/** Máximo rango de fechas permitido en consultas */
const MAX_RANGE_DAYS = 365;

@ApiTags("Sales")
@ApiBearerAuth("access-token")
@Controller("v1/sales")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SalesController {
  private readonly logger = new Logger("SalesController");

  constructor(private readonly salesService: SalesService) {}

  // ─────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────

  /**
   * POST /v1/sales
   * Registrar una nueva venta.
   */
  @ApiOperation({ summary: "Registrar una nueva venta" })
  @ApiResponse({ status: 201, description: "Venta creada correctamente." })
  @ApiResponse({
    status: 400,
    description: "Datos inválidos o idempotency key duplicada.",
  })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permiso sale.create." })
  @Post()
  @RequirePermission("sale.create")
  async createSale(
    @Body() dto: CreateSaleDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(
      `Usuario ${user.userId} creando venta en sede ${dto.branch_id}`,
    );
    return this.salesService.createSale(dto, user.userId);
  }

  /**
   * POST /v1/sales/:id/sunat-sync
   * Simular envío de factura/boleta a SUNAT y recibir una confirmación.
   */
  @ApiOperation({
    summary: "Simular sincronización SUNAT de un documento de venta",
  })
  @ApiResponse({
    status: 200,
    description: "Simulación SUNAT ejecutada correctamente.",
  })
  @ApiResponse({
    status: 400,
    description: "Tipo de documento inválido o venta no candidata.",
  })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permiso sale.read." })
  @Post(":id/sunat-sync")
  @RequirePermission("sale.read")
  async simulateSunatSync(
    @Param("id") id: string,
    @Body() dto: SimulateSunatSyncDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user.userId} simulando SUNAT para venta ${id}`);
    return this.salesService.simulateSunatDocumentSync(id, dto.docType);
  }

  // ─────────────────────────────────────────────────────────────────
  // LIST / QUERY
  // ─────────────────────────────────────────────────────────────────

  /**
   * GET /v1/sales/stats
   * Estadísticas de ventas para una sede.
   * Debe ir ANTES de :id para no ser interceptado.
   */
  @ApiOperation({ summary: "Obtener estadísticas de ventas de una sede" })
  @ApiResponse({
    status: 200,
    description: "Estadísticas de ventas retornadas correctamente.",
  })
  @ApiResponse({
    status: 400,
    description: "branchId es requerido o rango de fechas inválido.",
  })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permiso sale.read." })
  @Get("stats")
  @RequirePermission("sale.read")
  async getSaleStats(
    @Query("branchId") branchId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @CurrentUser() user?: CurrentUserData,
  ) {
    if (!branchId) {
      throw new BadRequestException("branchId es requerido");
    }

    const { fromDate, toDate } = this.parseDateRange(from, to);

    this.logger.log(
      `Usuario ${user?.userId} consultando stats de ventas de sede ${branchId}`,
    );

    return this.salesService.getSaleStats(branchId, fromDate, toDate);
  }

  /**
   * GET /v1/sales
   * Listar ventas con filtros y cursor-based pagination.
   * Query: branchId (requerido), from, to, status, customerId, cursor, limit
   */
  @ApiOperation({
    summary: "Listar ventas con filtros y paginación por cursor",
  })
  @ApiResponse({
    status: 200,
    description: "Lista de ventas retornada correctamente.",
  })
  @ApiResponse({
    status: 400,
    description:
      "branchId es requerido, limit inválido o rango de fechas incorrecto.",
  })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permiso sale.read." })
  @Get()
  @RequirePermission("sale.read")
  async getSales(
    @Query("branchId") branchId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("status") status?: string,
    @Query("customerId") customerId?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limitStr?: string,
    @CurrentUser() user?: CurrentUserData,
  ) {
    if (!branchId) {
      throw new BadRequestException("branchId es requerido");
    }

    const { fromDate, toDate } = this.parseDateRange(from, to);

    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException("limit debe ser un número entre 1 y 100");
    }

    this.logger.log(
      `Usuario ${user?.userId} consultando ventas de sede ${branchId}`,
    );

    return this.salesService.getSales(
      branchId,
      fromDate,
      toDate,
      status,
      customerId,
      cursor,
      limit,
    );
  }

  /**
   * GET /v1/sales/:id
   * Obtener venta por ID.
   */
  @ApiOperation({ summary: "Obtener una venta por ID" })
  @ApiResponse({ status: 200, description: "Venta retornada correctamente." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permiso sale.read." })
  @ApiResponse({ status: 404, description: "Venta no encontrada." })
  @Get(":id")
  @RequirePermission("sale.read")
  async getSaleById(
    @Param("id") id: string,
    @CurrentUser() user?: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user?.userId} consultando venta ${id}`);
    return this.salesService.getSaleById(id);
  }

  /**
   * GET /v1/sales/:id/history
   * Historial de auditoría de una venta.
   */
  @ApiOperation({ summary: "Obtener el historial de auditoría de una venta" })
  @ApiResponse({
    status: 200,
    description: "Historial de auditoría retornado correctamente.",
  })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permiso sale.read." })
  @ApiResponse({ status: 404, description: "Venta no encontrada." })
  @Get(":id/history")
  @RequirePermission("sale.read")
  async getSaleHistory(
    @Param("id") id: string,
    @CurrentUser() user?: CurrentUserData,
  ) {
    this.logger.log(
      `Usuario ${user?.userId} consultando historial de venta ${id}`,
    );
    return this.salesService.getSaleHistory(id);
  }

  // ─────────────────────────────────────────────────────────────────
  // MUTATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * POST /v1/sales/:id/void
   * Anular venta (PAID → VOIDED). Restaura inventario y caja.
   */
  @ApiOperation({
    summary: "Anular una venta (PAID → VOIDED). Restaura inventario y caja.",
  })
  @ApiResponse({ status: 200, description: "Venta anulada correctamente." })
  @ApiResponse({
    status: 400,
    description: "La venta no puede ser anulada en su estado actual.",
  })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permiso sale.void." })
  @ApiResponse({ status: 404, description: "Venta no encontrada." })
  @Post(":id/void")
  @RequirePermission("sale.void")
  async voidSale(
    @Param("id") id: string,
    @Body() dto: VoidSaleDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user.userId} anulando venta ${id}`);
    return this.salesService.voidSale(id, dto, user.userId);
  }

  /**
   * POST /v1/sales/:id/refund
   * Reembolsar venta (PAID → REFUNDED). Persiste monto y motivo del reembolso.
   */
  @ApiOperation({ summary: "Reembolsar una venta (PAID → REFUNDED)" })
  @ApiResponse({ status: 200, description: "Venta reembolsada correctamente." })
  @ApiResponse({
    status: 400,
    description:
      "La venta no puede ser reembolsada en su estado actual o monto inválido.",
  })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permiso sale.refund." })
  @ApiResponse({ status: 404, description: "Venta no encontrada." })
  @Post(":id/refund")
  @RequirePermission("sale.refund")
  async refundSale(
    @Param("id") id: string,
    @Body() dto: RefundSaleDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    this.logger.log(`Usuario ${user.userId} reembolsando venta ${id}`);
    return this.salesService.refundSale(id, dto, user.userId);
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPER
  // ─────────────────────────────────────────────────────────────────

  private parseDateRange(
    from?: string,
    to?: string,
  ): { fromDate?: Date; toDate?: Date } {
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (from) {
      fromDate = parseLocalDate(from);
      if (isNaN(fromDate.getTime())) {
        throw new BadRequestException(
          "from debe ser una fecha válida (YYYY-MM-DD)",
        );
      }
    }
    if (to) {
      toDate = parseLocalDate(to);
      if (isNaN(toDate.getTime())) {
        throw new BadRequestException(
          "to debe ser una fecha válida (YYYY-MM-DD)",
        );
      }
      toDate.setUTCHours(23, 59, 59, 999);
    }

    if (fromDate && toDate) {
      if (fromDate > toDate) {
        throw new BadRequestException("from debe ser menor o igual que to");
      }
      const diffDays =
        (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > MAX_RANGE_DAYS) {
        throw new BadRequestException(
          `El rango máximo permitido es ${MAX_RANGE_DAYS} días`,
        );
      }
    }

    return { fromDate, toDate };
  }
}

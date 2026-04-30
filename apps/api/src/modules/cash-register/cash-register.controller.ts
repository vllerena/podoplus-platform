import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Headers,
  UseGuards,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from "@nestjs/swagger";
import { CashRegisterService } from "./cash-register.service";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { CurrentUser, CurrentUserData } from "../auth/decorators/current-user.decorator";
import { OpenRegisterDto } from "./dto/open-register.dto";
import { CloseRegisterDto } from "./dto/close-register.dto";
import { ManualMovementDto } from "./dto/manual-movement.dto";

@ApiTags("Cash Register")
@ApiBearerAuth("access-token")
@Controller("v1/cash-registers")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CashRegisterController {
  private readonly logger = new Logger("CashRegisterController");

  constructor(private cashRegisterService: CashRegisterService) {}

  /**
   * POST /v1/cash-registers
   * Abre una nueva caja en una sede. Solo puede haber 1 caja OPEN por sede.
   */
  @ApiOperation({ summary: "Abrir una nueva caja en una sede" })
  @ApiResponse({ status: 201, description: "Caja abierta correctamente." })
  @ApiResponse({ status: 400, description: "Ya existe una caja abierta en la sede o datos inválidos." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permiso cash_register.manage." })
  @Post()
  @RequirePermission("cash_register.manage")
  openRegister(
    @Body() dto: OpenRegisterDto,
    @CurrentUser() user: CurrentUserData,
    @Headers("x-idempotency-key") idempotencyKey?: string,
  ) {
    this.logger.log(`Usuario ${user.userId} abriendo caja en sede ${dto.branch_id}`);
    return this.cashRegisterService.openRegister(dto, user.userId, idempotencyKey);
  }

  /**
   * GET /v1/cash-registers/open
   * Caja actualmente abierta en una sede.
   * Debe ir ANTES de `:id` para no ser capturada como ID.
   */
  @ApiOperation({ summary: "Obtener la caja actualmente abierta en una sede" })
  @ApiResponse({ status: 200, description: "Caja abierta retornada correctamente." })
  @ApiResponse({ status: 400, description: "branch_id es requerido." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permiso cash_register.read." })
  @ApiResponse({ status: 404, description: "No hay caja abierta en la sede." })
  @Get("open")
  @RequirePermission("cash_register.read")
  getOpenRegister(
    @Query("branch_id") branchId: string,
    @CurrentUser() user?: CurrentUserData
  ) {
    if (!branchId) throw new BadRequestException("branch_id es requerido");
    this.logger.log(`Usuario ${user?.userId} consultando caja abierta en sede ${branchId}`);
    return this.cashRegisterService.getOpenRegister(branchId);
  }

  /**
   * GET /v1/cash-registers
   * Historial de cajas de una sede con cursor-based pagination.
   * Query: branch_id (req), status?, cursor?, limit?
   */
  @ApiOperation({ summary: "Listar historial de cajas de una sede con paginación por cursor" })
  @ApiResponse({ status: 200, description: "Lista de cajas retornada correctamente." })
  @ApiResponse({ status: 400, description: "branch_id es requerido." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permiso cash_register.read." })
  @Get()
  @RequirePermission("cash_register.read")
  getRegisters(
    @Query("branch_id") branchId: string,
    @Query("status")    status?: string,
    @Query("cursor")    cursor?: string,
    @Query("limit")     limit?: string,
    @CurrentUser()      user?: CurrentUserData
  ) {
    if (!branchId) throw new BadRequestException("branch_id es requerido");
    this.logger.log(`Usuario ${user?.userId} listando cajas de sede ${branchId}`);
    return this.cashRegisterService.getRegisters({
      branchId,
      status,
      cursor,
      limit: limit ? Math.min(parseInt(limit, 10), 100) : 20,
    });
  }

  /**
   * GET /v1/cash-registers/:id
   * Detalle de una caja con balance calculado vía aggregate.
   */
  @ApiOperation({ summary: "Obtener detalle de una caja por ID con balance calculado" })
  @ApiResponse({ status: 200, description: "Caja retornada correctamente." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permiso cash_register.read." })
  @ApiResponse({ status: 404, description: "Caja no encontrada." })
  @Get(":id")
  @RequirePermission("cash_register.read")
  getRegisterById(
    @Param("id") registerId: string,
    @CurrentUser() user?: CurrentUserData
  ) {
    this.logger.log(`Usuario ${user?.userId} consultando caja ${registerId}`);
    return this.cashRegisterService.getRegisterById(registerId);
  }

  /**
   * POST /v1/cash-registers/:id/close
   * Cierra una caja registrando el balance físico contado.
   */
  @ApiOperation({ summary: "Cerrar una caja registrando el balance físico contado" })
  @ApiResponse({ status: 200, description: "Caja cerrada correctamente." })
  @ApiResponse({ status: 400, description: "Datos inválidos o la caja ya está cerrada." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permiso cash_register.manage." })
  @ApiResponse({ status: 404, description: "Caja no encontrada." })
  @Post(":id/close")
  @RequirePermission("cash_register.manage")
  closeRegister(
    @Param("id")   registerId: string,
    @Body()        dto: CloseRegisterDto,
    @CurrentUser() user: CurrentUserData
  ) {
    this.logger.log(`Usuario ${user.userId} cerrando caja ${registerId}`);
    return this.cashRegisterService.closeRegister(registerId, dto, user.userId);
  }

  /**
   * GET /v1/cash-registers/:id/summary
   * Resumen del cuadre de caja: desglose por tipo de referencia (SALE, MANUAL…).
   */
  @ApiOperation({ summary: "Obtener resumen del cuadre de caja desglosado por tipo de referencia" })
  @ApiResponse({ status: 200, description: "Resumen de caja retornado correctamente." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permiso cash_register.read." })
  @ApiResponse({ status: 404, description: "Caja no encontrada." })
  @Get(":id/summary")
  @RequirePermission("cash_register.read")
  getRegisterSummary(
    @Param("id") registerId: string,
    @CurrentUser() user?: CurrentUserData
  ) {
    this.logger.log(`Usuario ${user?.userId} consultando resumen de caja ${registerId}`);
    return this.cashRegisterService.getRegisterSummary(registerId);
  }

  /**
   * GET /v1/cash-registers/:id/movements
   * Movimientos de una caja con cursor-based pagination.
   * Query: type (IN|OUT)?, cursor?, limit?
   */
  @ApiOperation({ summary: "Listar movimientos de una caja con paginación por cursor" })
  @ApiResponse({ status: 200, description: "Movimientos retornados correctamente." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permiso cash_register.read." })
  @ApiResponse({ status: 404, description: "Caja no encontrada." })
  @Get(":id/movements")
  @RequirePermission("cash_register.read")
  getMovements(
    @Param("id")    registerId: string,
    @Query("type")  type?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
    @CurrentUser()  user?: CurrentUserData
  ) {
    this.logger.log(`Usuario ${user?.userId} consultando movimientos de caja ${registerId}`);
    return this.cashRegisterService.getMovements({
      registerId,
      type,
      cursor,
      limit: limit ? Math.min(parseInt(limit, 10), 200) : 50,
    });
  }

  /**
   * POST /v1/cash-registers/:id/movements
   * Registra un ingreso o egreso manual (fondos, vuelto, gastos, retiros, etc.)
   */
  @ApiOperation({ summary: "Registrar un movimiento manual de caja (ingreso o egreso)" })
  @ApiResponse({ status: 201, description: "Movimiento manual registrado correctamente." })
  @ApiResponse({ status: 400, description: "Datos inválidos o la caja no está abierta." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permiso cash_register.manage." })
  @ApiResponse({ status: 404, description: "Caja no encontrada." })
  @Post(":id/movements")
  @RequirePermission("cash_register.manage")
  addManualMovement(
    @Param("id")   registerId: string,
    @Body()        dto: ManualMovementDto,
    @CurrentUser() user: CurrentUserData,
    @Headers("x-idempotency-key") idempotencyKey?: string,
  ) {
    this.logger.log(
      `Usuario ${user.userId} registrando movimiento manual (${dto.type} S/ ${dto.amount}) en caja ${registerId}`
    );
    return this.cashRegisterService.addManualMovement(registerId, dto, user.userId);
  }
}

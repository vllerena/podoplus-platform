import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from "@nestjs/swagger";
import type { SubscriptionStatus } from "./plans.service";
import { PlansService } from "./plans.service";
import { AssignSubscriptionDto } from "./dto/assign-subscription.dto";
import { ConsumeSessionDto } from "./dto/consume-session.dto";
import { CancelSubscriptionDto } from "./dto/cancel-subscription.dto";
import { PauseSubscriptionDto } from "./dto/pause-subscription.dto";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { CurrentUser, CurrentUserData } from "../auth/decorators/current-user.decorator";

@ApiTags("Plans")
@ApiBearerAuth("access-token")
@Controller("v1/subscriptions")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SubscriptionsController {
  private readonly logger = new Logger("SubscriptionsController");

  constructor(private readonly plansService: PlansService) {}

  // ─────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────

  /**
   * POST /v1/subscriptions
   * Asignar un plan a un cliente (crear suscripción ACTIVE).
   */
  @ApiOperation({ summary: "Asignar un plan a un cliente (crear suscripción)" })
  @ApiResponse({ status: 201, description: "Suscripción creada exitosamente" })
  @ApiResponse({ status: 400, description: "Datos inválidos" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @Post()
  @RequirePermission("subscription.create")
  async assignSubscription(
    @Body() dto: AssignSubscriptionDto,
    @CurrentUser() user: CurrentUserData
  ) {
    this.logger.log(
      `Usuario ${user.userId} asignando plan ${dto.plan_id} a cliente ${dto.customer_id}`
    );
    return this.plansService.assignSubscription(dto, user.userId);
  }

  // ─────────────────────────────────────────────────────────────────
  // QUERIES
  // ─────────────────────────────────────────────────────────────────

  /**
   * GET /v1/subscriptions
   * Lista global de suscripciones con filtros y cursor-based pagination.
   * Debe ir ANTES de :id para no ser interceptado.
   */
  @ApiOperation({ summary: "Listar suscripciones globalmente con filtros y paginación por cursor" })
  @ApiQuery({ name: "branch_id", required: false, description: "Filtrar por sede" })
  @ApiQuery({ name: "status",    required: false, description: "ACTIVE | PAUSED | EXPIRED | CANCELED" })
  @ApiQuery({ name: "plan_id",   required: false, description: "Filtrar por plan" })
  @ApiQuery({ name: "cursor",    required: false, description: "Cursor de paginación" })
  @ApiQuery({ name: "limit",     required: false, description: "Ítems por página (máx 100, default 20)" })
  @ApiResponse({ status: 200, description: "Lista paginada de suscripciones." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permiso subscription.read." })
  @Get()
  @RequirePermission("subscription.read")
  async listSubscriptions(
    @Query("branch_id") branchId?: string,
    @Query("status")    status?: string,
    @Query("plan_id")   planId?: string,
    @Query("cursor")    cursor?: string,
    @Query("limit")     limit?: string,
    @CurrentUser()      user?: CurrentUserData,
  ) {
    this.logger.log(
      `Usuario ${user?.userId} listando suscripciones (branch=${branchId}, status=${status})`
    );
    return this.plansService.listSubscriptions({
      branchId,
      status:  status as SubscriptionStatus | undefined,
      planId,
      cursor,
      limit:   limit ? Math.min(parseInt(limit, 10), 100) : 20,
    });
  }

  /**
   * GET /v1/subscriptions/customer/:customerId
   * Listar todas las suscripciones de un cliente (con expiración automática).
   * Debe ir ANTES de :id para no ser interceptado.
   */
  @ApiOperation({ summary: "Listar todas las suscripciones de un cliente" })
  @ApiParam({ name: "customerId", description: "ID del cliente" })
  @ApiResponse({ status: 200, description: "Lista de suscripciones obtenida exitosamente" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @Get("customer/:customerId")
  @RequirePermission("subscription.read")
  async getCustomerSubscriptions(
    @Param("customerId") customerId: string,
    @CurrentUser() user?: CurrentUserData
  ) {
    this.logger.log(
      `Usuario ${user?.userId} consultando suscripciones de cliente ${customerId}`
    );
    return this.plansService.getCustomerSubscriptions(customerId);
  }

  /**
   * GET /v1/subscriptions/stats/:customerId
   * Estadísticas de suscripciones de un cliente.
   * Debe ir ANTES de :id para no ser interceptado.
   */
  @ApiOperation({ summary: "Estadísticas de suscripciones de un cliente" })
  @ApiParam({ name: "customerId", description: "ID del cliente" })
  @ApiResponse({ status: 200, description: "Estadísticas obtenidas exitosamente" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @Get("stats/:customerId")
  @RequirePermission("subscription.read")
  async getSubscriptionStats(
    @Param("customerId") customerId: string,
    @CurrentUser() user?: CurrentUserData
  ) {
    this.logger.log(
      `Usuario ${user?.userId} consultando stats de cliente ${customerId}`
    );
    return this.plansService.getSubscriptionStats(customerId);
  }

  /**
   * GET /v1/subscriptions/:id
   * Detalle de una suscripción (incluye historial de consumos).
   */
  @ApiOperation({ summary: "Obtener detalle de una suscripción por ID" })
  @ApiParam({ name: "id", description: "ID de la suscripción" })
  @ApiResponse({ status: 200, description: "Suscripción obtenida exitosamente" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @ApiResponse({ status: 404, description: "Suscripción no encontrada" })
  @Get(":id")
  @RequirePermission("subscription.read")
  async getSubscriptionById(
    @Param("id") id: string,
    @CurrentUser() user?: CurrentUserData
  ) {
    this.logger.log(
      `Usuario ${user?.userId} consultando suscripción ${id}`
    );
    return this.plansService.getSubscriptionById(id);
  }

  // ─────────────────────────────────────────────────────────────────
  // STATE TRANSITIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * POST /v1/subscriptions/:id/consume
   * Consumir una sesión (ACTIVE → puede → EXPIRED si se agotan).
   * Notifica si quedan ≤ 2 sesiones.
   */
  @ApiOperation({ summary: "Consumir una sesión de la suscripción" })
  @ApiParam({ name: "id", description: "ID de la suscripción" })
  @ApiResponse({ status: 201, description: "Sesión consumida exitosamente" })
  @ApiResponse({ status: 400, description: "Datos inválidos o sesiones agotadas" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @ApiResponse({ status: 404, description: "Suscripción no encontrada" })
  @Post(":id/consume")
  @RequirePermission("subscription.manage")
  async consumeSession(
    @Param("id") id: string,
    @Body() dto: ConsumeSessionDto,
    @CurrentUser() user: CurrentUserData
  ) {
    this.logger.log(`Usuario ${user.userId} consumiendo sesión de suscripción ${id}`);
    return this.plansService.consumeSession(id, dto, user.userId);
  }

  /**
   * POST /v1/subscriptions/:id/pause
   * Pausar suscripción ACTIVE → PAUSED.
   * Al resumir, se extiende endDate por los días pausados.
   */
  @ApiOperation({ summary: "Pausar una suscripción activa" })
  @ApiParam({ name: "id", description: "ID de la suscripción" })
  @ApiResponse({ status: 201, description: "Suscripción pausada exitosamente" })
  @ApiResponse({ status: 400, description: "La suscripción no está activa" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @ApiResponse({ status: 404, description: "Suscripción no encontrada" })
  @Post(":id/pause")
  @RequirePermission("subscription.manage")
  async pauseSubscription(
    @Param("id") id: string,
    @Body() dto: PauseSubscriptionDto,
    @CurrentUser() user: CurrentUserData
  ) {
    this.logger.log(`Usuario ${user.userId} pausando suscripción ${id}`);
    return this.plansService.pauseSubscription(id, dto, user.userId);
  }

  /**
   * POST /v1/subscriptions/:id/resume
   * Resumir suscripción PAUSED → ACTIVE.
   * Si venció durante la pausa → EXPIRED automáticamente.
   */
  @ApiOperation({ summary: "Resumir una suscripción pausada" })
  @ApiParam({ name: "id", description: "ID de la suscripción" })
  @ApiResponse({ status: 201, description: "Suscripción resumida exitosamente" })
  @ApiResponse({ status: 400, description: "La suscripción no está pausada" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @ApiResponse({ status: 404, description: "Suscripción no encontrada" })
  @Post(":id/resume")
  @RequirePermission("subscription.manage")
  async resumeSubscription(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData
  ) {
    this.logger.log(`Usuario ${user.userId} resumiendo suscripción ${id}`);
    return this.plansService.resumeSubscription(id, user.userId);
  }

  /**
   * POST /v1/subscriptions/:id/renew
   * Renovar suscripción: marca la actual como EXPIRED y crea una nueva ACTIVE.
   * La nueva queda vinculada via `renewed_from_id`.
   */
  @ApiOperation({ summary: "Renovar una suscripción (crea una nueva desde la actual)" })
  @ApiParam({ name: "id", description: "ID de la suscripción a renovar" })
  @ApiResponse({ status: 201, description: "Suscripción renovada exitosamente" })
  @ApiResponse({ status: 400, description: "La suscripción no puede renovarse" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @ApiResponse({ status: 404, description: "Suscripción no encontrada" })
  @Post(":id/renew")
  @RequirePermission("subscription.manage")
  async renewSubscription(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData
  ) {
    this.logger.log(`Usuario ${user.userId} renovando suscripción ${id}`);
    return this.plansService.renewSubscription(id, user.userId);
  }

  /**
   * POST /v1/subscriptions/:id/cancel
   * Cancelar suscripción (ACTIVE / PAUSED → CANCELED).
   */
  @ApiOperation({ summary: "Cancelar una suscripción activa o pausada" })
  @ApiParam({ name: "id", description: "ID de la suscripción" })
  @ApiResponse({ status: 201, description: "Suscripción cancelada exitosamente" })
  @ApiResponse({ status: 400, description: "La suscripción ya está cancelada o expirada" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @ApiResponse({ status: 404, description: "Suscripción no encontrada" })
  @Post(":id/cancel")
  @RequirePermission("subscription.manage")
  async cancelSubscription(
    @Param("id") id: string,
    @Body() dto: CancelSubscriptionDto,
    @CurrentUser() user: CurrentUserData
  ) {
    this.logger.log(`Usuario ${user.userId} cancelando suscripción ${id}`);
    return this.plansService.cancelSubscription(id, dto, user.userId);
  }
}

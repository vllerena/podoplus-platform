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
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from "@nestjs/swagger";
import { PlansService } from "./plans.service";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { CurrentUser, CurrentUserData } from "../auth/decorators/current-user.decorator";

@ApiTags("Plans")
@ApiBearerAuth("access-token")
@Controller("v1/plans")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PlansController {
  private readonly logger = new Logger("PlansController");

  constructor(private readonly plansService: PlansService) {}

  /**
   * POST /v1/plans
   * Crear un nuevo plan de suscripción.
   */
  @ApiOperation({ summary: "Crear un nuevo plan de suscripción" })
  @ApiResponse({ status: 201, description: "Plan creado exitosamente" })
  @ApiResponse({ status: 400, description: "Datos inválidos" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @Post()
  @RequirePermission("plan.manage")
  async createPlan(
    @Body() dto: CreatePlanDto,
    @CurrentUser() user: CurrentUserData
  ) {
    this.logger.log(`Usuario ${user.userId} creando plan "${dto.name}"`);
    return this.plansService.createPlan(dto, user.userId);
  }

  /**
   * GET /v1/plans
   * Listar planes. Query: active=true|false
   */
  @ApiOperation({ summary: "Listar planes de suscripción" })
  @ApiQuery({ name: "active", required: false, description: "Filtrar por estado activo (true/false)" })
  @ApiResponse({ status: 200, description: "Lista de planes obtenida exitosamente" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @Get()
  @RequirePermission("plan.read")
  async getPlans(@Query("active") active?: string) {
    const onlyActive = active === undefined ? undefined : active === "true";
    return this.plansService.getPlans(onlyActive);
  }

  /**
   * GET /v1/plans/:id
   * Obtener plan por ID.
   */
  @ApiOperation({ summary: "Obtener un plan por ID" })
  @ApiResponse({ status: 200, description: "Plan obtenido exitosamente" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @ApiResponse({ status: 404, description: "Plan no encontrado" })
  @Get(":id")
  @RequirePermission("plan.read")
  async getPlanById(@Param("id") id: string) {
    return this.plansService.getPlanById(id);
  }

  /**
   * PATCH /v1/plans/:id
   * Actualizar nombre, descripción, precio, duración o color de un plan.
   */
  @ApiOperation({ summary: "Actualizar un plan existente" })
  @ApiResponse({ status: 200, description: "Plan actualizado exitosamente" })
  @ApiResponse({ status: 400, description: "Datos inválidos" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @ApiResponse({ status: 404, description: "Plan no encontrado" })
  @Patch(":id")
  @RequirePermission("plan.manage")
  async updatePlan(
    @Param("id") id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser() user: CurrentUserData
  ) {
    this.logger.log(`Usuario ${user.userId} actualizando plan ${id}`);
    return this.plansService.updatePlan(id, dto, user.userId);
  }

  /**
   * POST /v1/plans/:id/activate
   * Activar un plan inactivo.
   */
  @ApiOperation({ summary: "Activar un plan inactivo" })
  @ApiParam({ name: "id", description: "ID del plan" })
  @ApiResponse({ status: 200, description: "Plan activado exitosamente" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @ApiResponse({ status: 404, description: "Plan no encontrado" })
  @Post(":id/activate")
  @RequirePermission("plan.manage")
  async activatePlan(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData
  ) {
    this.logger.log(`Usuario ${user.userId} activando plan ${id}`);
    return this.plansService.activatePlan(id, user.userId);
  }

  /**
   * POST /v1/plans/:id/deactivate
   * Desactivar un plan activo (no elimina suscripciones existentes).
   */
  @ApiOperation({ summary: "Desactivar un plan activo" })
  @ApiParam({ name: "id", description: "ID del plan" })
  @ApiResponse({ status: 200, description: "Plan desactivado exitosamente" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @ApiResponse({ status: 404, description: "Plan no encontrado" })
  @Post(":id/deactivate")
  @RequirePermission("plan.manage")
  async deactivatePlan(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData
  ) {
    this.logger.log(`Usuario ${user.userId} desactivando plan ${id}`);
    return this.plansService.deactivatePlan(id, user.userId);
  }
}

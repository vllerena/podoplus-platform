import {
  Controller,
  Get,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { AvailabilityService } from "./availability.service";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RoleGuard } from "../rbac/guards/role.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { BranchScopeGuard } from "../rbac/guards/branch-scope.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@Controller("v1/availability")
@UseGuards(JwtAuthGuard, RoleGuard, PermissionGuard, BranchScopeGuard)
export class AvailabilityController {
  private readonly logger = new Logger("AvailabilityController");

  constructor(private availabilityService: AvailabilityService) {}

  /**
   * GET /v1/availability
   * Obtiene disponibilidad de slots para una sede y servicio
   *
   * Query params:
   * - branchId: UUID de la sede
   * - serviceId: UUID del servicio
   * - from: Fecha inicio (YYYY-MM-DD)
   * - to: Fecha fin (YYYY-MM-DD)
   */
  @Get()
  async getAvailability(
    @Query("branchId") branchId?: string,
    @Query("serviceId") serviceId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @CurrentUser() user?: any
  ) {
    // Validar parámetros requeridos
    if (!branchId || !serviceId || !from || !to) {
      throw new BadRequestException(
        "Los parámetros branchId, serviceId, from y to son requeridos"
      );
    }

    this.logger.log(
      `Usuario ${user.userId} solicitó disponibilidad: branch=${branchId}, service=${serviceId}, rango=${from} a ${to}`
    );

    return this.availabilityService.getAvailability(
      branchId,
      serviceId,
      from,
      to,
      user.userId
    );
  }

  /**
   * GET /v1/availability/grouped
   * Alias para disponibilidad agrupada por fecha (mismo resultado que /availability)
   */
  @Get("grouped")
  async getAvailabilityGrouped(
    @Query("branchId") branchId?: string,
    @Query("serviceId") serviceId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @CurrentUser() user?: any
  ) {
    if (!branchId || !serviceId || !from || !to) {
      throw new BadRequestException(
        "Los parámetros branchId, serviceId, from y to son requeridos"
      );
    }

    this.logger.log(
      `Usuario ${user.userId} solicitó disponibilidad agrupada: branch=${branchId}, service=${serviceId}`
    );

    return this.availabilityService.getAvailabilityGroupedByDate(
      branchId,
      serviceId,
      from,
      to,
      user.userId
    );
  }
}

import {
  Controller,
  Get,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { AvailabilityService } from "./availability.service";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RoleGuard } from "../rbac/guards/role.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { BranchScopeGuard } from "../rbac/guards/branch-scope.guard";
import { CurrentUser, CurrentUserData } from "../auth/decorators/current-user.decorator";

@ApiTags("Availability")
@ApiBearerAuth("access-token")
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
  @ApiOperation({ summary: "Obtener slots de disponibilidad para una sede y servicio en un rango de fechas" })
  @ApiResponse({ status: 200, description: "Slots de disponibilidad devueltos correctamente" })
  @ApiResponse({ status: 400, description: "Parámetros requeridos faltantes" })
  @ApiQuery({ name: "branchId", required: true, description: "UUID de la sede" })
  @ApiQuery({ name: "serviceId", required: true, description: "UUID del servicio" })
  @ApiQuery({ name: "from", required: true, description: "Fecha inicio en formato YYYY-MM-DD" })
  @ApiQuery({ name: "to", required: true, description: "Fecha fin en formato YYYY-MM-DD" })
  @Get()
  async getAvailability(
    @Query("branchId")  branchId?: string,
    @Query("serviceId") serviceId?: string,
    @Query("from")      from?: string,
    @Query("to")        to?: string,
    @CurrentUser()      user?: CurrentUserData
  ) {
    if (!branchId || !serviceId || !from || !to) {
      throw new BadRequestException(
        "Los parámetros branchId, serviceId, from y to son requeridos"
      );
    }

    this.logger.log(
      `Usuario ${user!.userId} solicitó disponibilidad: branch=${branchId}, service=${serviceId}, rango=${from} a ${to}`
    );

    return this.availabilityService.getAvailability(branchId, serviceId, from, to, user!.userId);
  }
}

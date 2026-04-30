import { Controller, Get, UseGuards, Logger } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { RealtimeService } from "./realtime.service";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { CurrentUser, CurrentUserData } from "../auth/decorators/current-user.decorator";

@ApiTags("Realtime")
@ApiBearerAuth("access-token")
@Controller("v1/realtime")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RealtimeController {
  private readonly logger = new Logger("RealtimeController");

  constructor(private readonly realtimeService: RealtimeService) {}

  /**
   * GET /v1/realtime/stats
   * Retorna cantidad de usuarios conectados actualmente.
   */
  @ApiOperation({ summary: "Obtener estadísticas de usuarios conectados en tiempo real" })
  @ApiResponse({ status: 200, description: "Estadísticas de conexiones obtenidas exitosamente" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @Get("stats")
  @RequirePermission("realtime.read")
  getStats(@CurrentUser() user: CurrentUserData) {
    this.logger.debug(`Usuario ${user?.userId} consultando stats de realtime`);
    return this.realtimeService.getConnectionStats();
  }
}

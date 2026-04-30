import {
  Controller, Get, Query, UseGuards, BadRequestException, Logger,
} from "@nestjs/common";
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery,
} from "@nestjs/swagger";
import { IntegrationsService } from "./integrations.service";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { CurrentUser, CurrentUserData } from "../auth/decorators/current-user.decorator";

@ApiTags("Integrations")
@ApiBearerAuth("access-token")
@Controller("v1/integrations")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class IntegrationsController {
  private readonly logger = new Logger("IntegrationsController");

  constructor(private readonly service: IntegrationsService) {}

  /**
   * GET /v1/integrations/status
   * Estado de cada integración externa (WhatsApp, SUNAT…).
   */
  @Get("status")
  @RequirePermission("whatsapp.read")
  @ApiOperation({ summary: "Estado de las integraciones externas" })
  @ApiResponse({ status: 200, description: "Estado de cada integración" })
  getStatus() {
    return this.service.getIntegrationsStatus();
  }

  /**
   * GET /v1/integrations/whatsapp/stats
   * Estadísticas de mensajes WhatsApp (total, enviados hoy, fallidos hoy, por estado).
   */
  @Get("whatsapp/stats")
  @RequirePermission("whatsapp.read")
  @ApiOperation({ summary: "Estadísticas de mensajes WhatsApp" })
  @ApiQuery({ name: "branch_id", required: false })
  @ApiResponse({ status: 200, description: "Estadísticas" })
  async getWhatsappStats(
    @Query("branch_id") branchId?: string,
    @CurrentUser() _user?: CurrentUserData,
  ) {
    return this.service.getWhatsappStats(branchId || undefined);
  }

  /**
   * GET /v1/integrations/whatsapp/logs
   * Historial paginado de mensajes WhatsApp enviados.
   */
  @Get("whatsapp/logs")
  @RequirePermission("whatsapp.read")
  @ApiOperation({ summary: "Historial de mensajes WhatsApp" })
  @ApiQuery({ name: "branch_id", required: false })
  @ApiQuery({ name: "status",    required: false, description: "QUEUED|SENT|DELIVERED|READ|FAILED" })
  @ApiQuery({ name: "from",      required: false, description: "YYYY-MM-DD" })
  @ApiQuery({ name: "to",        required: false, description: "YYYY-MM-DD" })
  @ApiQuery({ name: "limit",     required: false })
  @ApiQuery({ name: "offset",    required: false })
  @ApiQuery({ name: "cursor",    required: false })
  @ApiResponse({ status: 200, description: "Logs paginados" })
  async getWhatsappLogs(
    @Query("branch_id") branchId?: string,
    @Query("status")    status?:   string,
    @Query("from")      from?:     string,
    @Query("to")        to?:       string,
    @Query("limit")     limit?:    string,
    @Query("offset")    offset?:   string,
    @Query("cursor")    cursor?:   string,
    @CurrentUser()      user?: CurrentUserData,
  ) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate   = to   ? new Date(to)   : undefined;
    if (fromDate && isNaN(fromDate.getTime())) throw new BadRequestException("from no es una fecha válida");
    if (toDate   && isNaN(toDate.getTime()))   throw new BadRequestException("to no es una fecha válida");
    if (toDate) toDate.setUTCHours(23, 59, 59, 999);

    this.logger.log(`Usuario ${user?.userId} consultando WhatsApp logs`);

    return this.service.getWhatsappLogs({
      branchId: branchId || undefined,
      status:   status   || undefined,
      from:     fromDate,
      to:       toDate,
      limit:    limit  ? Math.min(parseInt(limit,  10), 200) : 50,
      offset:   offset ? parseInt(offset, 10) : 0,
      cursor:   cursor || undefined,
    });
  }
}

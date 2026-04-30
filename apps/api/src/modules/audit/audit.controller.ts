import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from "@nestjs/swagger";
import { AuditService } from "./audit.service";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { CurrentUser, CurrentUserData } from "../auth/decorators/current-user.decorator";

@ApiTags("Audit")
@ApiBearerAuth("access-token")
@Controller("v1/audit")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AuditController {
  private readonly logger = new Logger("AuditController");

  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /v1/audit
   * Consultar el audit log con filtros y paginación dual:
   *
   * • Offset (default): `?limit=50&offset=0`
   * • Cursor-based:     `?limit=50&cursor=<id>` — eficiente para tablas grandes.
   *   El campo `nextCursor` de la respuesta es el cursor para la siguiente página.
   *
   * Query: branchId?, entityType?, action?, actorId?, from?, to?,
   *        limit?, offset?, cursor?
   */
  @ApiOperation({ summary: "Consultar el audit log con filtros y paginación (offset o cursor-based)" })
  @ApiQuery({ name: "branchId", required: false, description: "Filtrar por ID de sede" })
  @ApiQuery({ name: "entityType", required: false, description: "Filtrar por tipo de entidad (ej. appointment, customer)" })
  @ApiQuery({ name: "action", required: false, description: "Filtrar por acción auditada" })
  @ApiQuery({ name: "actorId", required: false, description: "Filtrar por ID del actor que realizó la acción" })
  @ApiQuery({ name: "from", required: false, description: "Fecha de inicio (YYYY-MM-DD)" })
  @ApiQuery({ name: "to", required: false, description: "Fecha de fin (YYYY-MM-DD)" })
  @ApiQuery({ name: "limit", required: false, description: "Máximo de resultados (default 50)" })
  @ApiQuery({ name: "offset", required: false, description: "Desplazamiento para paginación offset (default 0)" })
  @ApiQuery({ name: "cursor", required: false, description: "Cursor para paginación eficiente en tablas grandes" })
  @ApiResponse({ status: 200, description: "Logs de auditoría obtenidos exitosamente" })
  @ApiResponse({ status: 400, description: "Parámetros de fecha o paginación inválidos" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @Get()
  @RequirePermission("audit.read")
  async getLogs(
    @Query("branchId")    branchId?: string,
    @Query("entityType")  entityType?: string,
    @Query("action")      action?: string,
    @Query("actorId")     actorId?: string,
    @Query("from")        from?: string,
    @Query("to")          to?: string,
    @Query("limit")       limit?: string,
    @Query("offset")      offset?: string,
    @Query("cursor")      cursor?: string,
    @CurrentUser()        user?: CurrentUserData
  ) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate   = to   ? new Date(to)   : undefined;

    if (fromDate && isNaN(fromDate.getTime())) {
      throw new BadRequestException("from no es una fecha válida");
    }
    if (toDate && isNaN(toDate.getTime())) {
      throw new BadRequestException("to no es una fecha válida");
    }
    if (toDate) toDate.setUTCHours(23, 59, 59, 999);

    const parsedLimit  = parseInt(limit, 10)  || 50;
    const parsedOffset = parseInt(offset, 10) || 0;

    if (parsedLimit < 1) {
      throw new BadRequestException("limit debe ser un número positivo");
    }

    this.logger.log(
      `Usuario ${user?.userId} consultando audit log` +
      (branchId   ? ` — sede ${branchId}`     : "") +
      (entityType ? ` — entidad ${entityType}` : "") +
      (cursor     ? ` — cursor ${cursor}`      : ` — offset ${parsedOffset}`)
    );

    return this.auditService.getLogs({
      branchId,
      entityType,
      action,
      actorId,
      from: fromDate,
      to:   toDate,
      limit:  parsedLimit,
      offset: parsedOffset,
      cursor,
    });
  }

  /**
   * GET /v1/audit/:entityType/:entityId
   * Historial completo de auditoría de una entidad específica (orden cronológico).
   * Ej: GET /v1/audit/appointment/abc123
   */
  @ApiOperation({ summary: "Historial completo de auditoría de una entidad específica" })
  @ApiParam({ name: "entityType", description: "Tipo de entidad (ej. appointment, customer, plan)" })
  @ApiParam({ name: "entityId", description: "ID de la entidad" })
  @ApiResponse({ status: 200, description: "Historial de auditoría obtenido exitosamente" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 403, description: "Sin permiso para esta acción" })
  @Get(":entityType/:entityId")
  @RequirePermission("audit.read")
  async getEntityHistory(
    @Param("entityType") entityType: string,
    @Param("entityId")   entityId:   string,
    @CurrentUser()       user?: CurrentUserData
  ) {
    this.logger.log(`Usuario ${user?.userId} consultando historial de ${entityType}/${entityId}`);
    return this.auditService.getEntityHistory(entityType, entityId);
  }
}

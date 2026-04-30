import {
  Controller, Get, Post, Delete,
  Param, Query, UseGuards, Logger,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { CurrentUser, CurrentUserData } from "../auth/decorators/current-user.decorator";

@ApiTags("Notifications")
@ApiBearerAuth("access-token")
@Controller("v1/notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  private readonly logger = new Logger("NotificationsController");

  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /v1/notifications
   * Lista las notificaciones del usuario autenticado.
   * Query: unread=true (solo no leídas), limit (máx 100), offset
   */
  @ApiOperation({ summary: "Listar notificaciones del usuario autenticado" })
  @ApiQuery({ name: "unread", required: false, description: "Solo notificaciones no leídas (true/false)" })
  @ApiQuery({ name: "limit", required: false, description: "Máximo de resultados (máx 100, default 20)" })
  @ApiQuery({ name: "offset", required: false, description: "Desplazamiento para paginación (default 0)" })
  @ApiResponse({ status: 200, description: "Lista de notificaciones obtenida exitosamente" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @Get()
  async getMyNotifications(
    @Query("unread") unread?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @CurrentUser() user?: CurrentUserData
  ) {
    const parsedLimit  = parseInt(limit, 10);
    const parsedOffset = parseInt(offset, 10);
    const limitNum  = Math.min(isNaN(parsedLimit)  ? 20 : parsedLimit,  100);
    const offsetNum = isNaN(parsedOffset) ? 0 : parsedOffset;
    const onlyUnread = unread === "true";
    return this.notificationsService.getMyNotifications(
      user.userId, onlyUnread, limitNum, offsetNum
    );
  }

  /**
   * GET /v1/notifications/unread-count
   * Conteo de notificaciones no leídas (para badge del panel).
   */
  @ApiOperation({ summary: "Obtener conteo de notificaciones no leídas" })
  @ApiResponse({ status: 200, description: "Conteo de no leídas obtenido exitosamente" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @Get("unread-count")
  async getUnreadCount(@CurrentUser() user: CurrentUserData) {
    return this.notificationsService.getUnreadCount(user.userId);
  }

  /**
   * POST /v1/notifications/read-all
   * Marca todas las notificaciones del usuario como leídas.
   */
  @ApiOperation({ summary: "Marcar todas las notificaciones del usuario como leídas" })
  @ApiResponse({ status: 201, description: "Todas las notificaciones marcadas como leídas" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @Post("read-all")
  async markAllAsRead(@CurrentUser() user: CurrentUserData) {
    this.logger.log(`Usuario ${user.userId} marcando todas las notificaciones como leídas`);
    return this.notificationsService.markAllAsRead(user.userId);
  }

  /**
   * POST /v1/notifications/:id/read
   * Marca una notificación específica como leída.
   */
  @ApiOperation({ summary: "Marcar una notificación específica como leída" })
  @ApiParam({ name: "id", description: "ID de la notificación" })
  @ApiResponse({ status: 201, description: "Notificación marcada como leída" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 404, description: "Notificación no encontrada" })
  @Post(":id/read")
  async markAsRead(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.notificationsService.markAsRead(id, user.userId);
  }

  /**
   * DELETE /v1/notifications/:id
   * Elimina una notificación del usuario autenticado.
   */
  @ApiOperation({ summary: "Eliminar una notificación del usuario autenticado" })
  @ApiParam({ name: "id", description: "ID de la notificación" })
  @ApiResponse({ status: 200, description: "Notificación eliminada exitosamente" })
  @ApiResponse({ status: 401, description: "No autorizado" })
  @ApiResponse({ status: 404, description: "Notificación no encontrada" })
  @Delete(":id")
  async deleteNotification(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.notificationsService.deleteNotification(id, user.userId);
  }
}

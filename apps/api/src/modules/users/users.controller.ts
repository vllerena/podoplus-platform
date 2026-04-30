import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { PermissionGuard } from "../rbac/guards/permission.guard";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { CurrentUser, CurrentUserData } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { AssignRoleDto } from "./dto/assign-role.dto";
import { AdminResetPasswordDto } from "./dto/reset-password.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";

@ApiTags("Users")
@ApiBearerAuth("access-token")
@Controller("v1/users")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UsersController {
  private readonly logger = new Logger("UsersController");

  constructor(private usersService: UsersService) {}

  // ─── Perfil propio (sin permiso especial) ────────────────────────────────

  /**
   * GET /v1/users/me
   * Datos completos del usuario autenticado.
   */
  @Get("me")
  @ApiOperation({ summary: "Obtener perfil propio", description: "Retorna los datos completos del usuario autenticado." })
  @ApiResponse({ status: 200, description: "Perfil del usuario autenticado." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  getMyProfile(@CurrentUser() user: CurrentUserData) {
    return this.usersService.getMyProfile(user.userId);
  }

  /**
   * PATCH /v1/users/me
   * Edita el propio perfil (nombre, teléfono). No permite cambiar email aquí.
   */
  @Patch("me")
  @ApiOperation({ summary: "Actualizar perfil propio", description: "Permite editar nombre y teléfono del usuario autenticado." })
  @ApiResponse({ status: 200, description: "Perfil actualizado correctamente." })
  @ApiResponse({ status: 400, description: "Datos inválidos." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  updateMyProfile(
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.usersService.updateMyProfile(user.userId, dto);
  }

  /**
   * POST /v1/users/me/change-password
   * Cambia la propia contraseña verificando la actual.
   * Revoca todas las sesiones activas tras el cambio.
   */
  @Post("me/change-password")
  @ApiOperation({ summary: "Cambiar contraseña propia", description: "Cambia la contraseña del usuario autenticado verificando la actual. Revoca todas las sesiones activas." })
  @ApiResponse({ status: 200, description: "Contraseña cambiada correctamente." })
  @ApiResponse({ status: 400, description: "Contraseña actual incorrecta o datos inválidos." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  changeMyPassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.usersService.changeMyPassword(user.userId, dto);
  }

  /**
   * GET /v1/users/me/avatar
   * Devuelve el avatar del propio usuario como imagen binaria.
   */
  @Get("me/avatar")
  @Public()
  @ApiOperation({ summary: "Obtener avatar propio", description: "Devuelve el avatar del usuario autenticado como imagen binaria (público para uso en <img>)." })
  @ApiResponse({ status: 200, description: "Imagen del avatar." })
  @ApiResponse({ status: 404, description: "Sin avatar." })
  async getMyAvatar(
    @CurrentUser() user: CurrentUserData,
    @Res() res: Response,
  ) {
    // user puede ser undefined cuando se llama sin JWT (e.g. <img src>)
    const userId = user?.userId;
    if (!userId) return res.status(404).json({ message: "Sin avatar" });
    const avatar = await this.usersService.getAvatar(userId);
    if (!avatar) {
      return res.status(404).json({ message: "Sin avatar" });
    }
    res.set("Content-Type", avatar.mimeType);
    res.set("Cache-Control", "public, max-age=86400, immutable");
    return res.send(avatar.data);
  }

  /**
   * POST /v1/users/me/avatar
   * Sube o reemplaza el avatar del propio usuario (max 2 MB, JPEG/PNG/WEBP).
   */
  @Post("me/avatar")
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Subir avatar propio", description: "Sube o reemplaza el avatar del usuario autenticado (máx. 2 MB, JPEG/PNG/WEBP)." })
  @ApiConsumes("multipart/form-data")
  @ApiBody({ schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } })
  @ApiResponse({ status: 200, description: "Avatar subido correctamente." })
  @ApiResponse({ status: 400, description: "Archivo no proporcionado o formato inválido." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  uploadMyAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserData,
  ) {
    if (!file) throw new BadRequestException("Se requiere un archivo con la clave 'file'");
    return this.usersService.uploadAvatar(user.userId, file.buffer, file.mimetype, user.userId);
  }

  /**
   * DELETE /v1/users/me/avatar
   * Elimina el avatar del propio usuario.
   */
  @Delete("me/avatar")
  @ApiOperation({ summary: "Eliminar avatar propio", description: "Elimina el avatar del usuario autenticado." })
  @ApiResponse({ status: 200, description: "Avatar eliminado correctamente." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  deleteMyAvatar(@CurrentUser() user: CurrentUserData) {
    return this.usersService.deleteAvatar(user.userId, user.userId);
  }

  // ─── Gestión de usuarios (requiere user.manage) ──────────────────────────

  /**
   * GET /v1/users
   * Lista usuarios con filtros y paginación por cursor.
   * Query params: isActive, role, branchId, q, limit, cursor
   */
  @Get()
  @RequirePermission("user.manage")
  @ApiOperation({ summary: "Listar usuarios", description: "Lista usuarios con filtros opcionales y paginación por cursor." })
  @ApiQuery({ name: "isActive", required: false, type: Boolean, description: "Filtrar por estado activo/inactivo" })
  @ApiQuery({ name: "role",     required: false, type: String,  description: "Filtrar por código de rol" })
  @ApiQuery({ name: "branchId", required: false, type: String,  description: "Filtrar por sede" })
  @ApiQuery({ name: "q",        required: false, type: String,  description: "Búsqueda por nombre o email" })
  @ApiQuery({ name: "limit",    required: false, type: Number,  description: "Cantidad de resultados por página (default 20)" })
  @ApiQuery({ name: "cursor",   required: false, type: String,  description: "Cursor para paginación" })
  @ApiResponse({ status: 200, description: "Lista paginada de usuarios." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  getUsers(
    @Query("isActive") isActive?: string,
    @Query("role")     roleCode?: string,
    @Query("branchId") branchId?: string,
    @Query("q")        query?: string,
    @Query("limit")    limit?: string,
    @Query("cursor")   cursor?: string,
  ) {
    const parsedLimit = parseInt(limit ?? "20", 10);
    return this.usersService.getUsers({
      isActive: isActive === undefined ? undefined : isActive === "true",
      roleCode,
      branchId,
      query,
      limit:  isNaN(parsedLimit) ? 20 : parsedLimit,
      cursor,
    });
  }

  /**
   * GET /v1/users/:id
   * Detalle de un usuario con roles y permisos.
   */
  @Get(":id")
  @RequirePermission("user.manage")
  @ApiOperation({ summary: "Obtener usuario por ID", description: "Retorna el detalle de un usuario junto con sus roles y permisos." })
  @ApiParam({ name: "id", description: "ID del usuario" })
  @ApiResponse({ status: 200, description: "Detalle del usuario." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  @ApiResponse({ status: 404, description: "Usuario no encontrado." })
  getUserById(@Param("id") id: string) {
    return this.usersService.getUserById(id);
  }

  /**
   * GET /v1/users/:id/avatar
   * Devuelve el avatar de un usuario como imagen binaria.
   */
  @Get(":id/avatar")
  @Public()
  @ApiOperation({ summary: "Obtener avatar de un usuario", description: "Devuelve el avatar del usuario como imagen binaria (público para uso en <img>)." })
  @ApiParam({ name: "id", description: "ID del usuario" })
  @ApiResponse({ status: 200, description: "Imagen del avatar." })
  @ApiResponse({ status: 404, description: "Sin avatar." })
  async getAvatar(@Param("id") id: string, @Res() res: Response) {
    const avatar = await this.usersService.getAvatar(id);
    if (!avatar) {
      return res.status(404).json({ message: "Sin avatar" });
    }
    res.set("Content-Type", avatar.mimeType);
    res.set("Cache-Control", "public, max-age=86400, immutable");
    return res.send(avatar.data);
  }

  /**
   * GET /v1/users/:id/stats
   * Métricas de rendimiento: citas completadas, ventas generadas.
   * Query params: branchId (opcional)
   */
  @Get(":id/stats")
  @RequirePermission("user.manage")
  @ApiOperation({ summary: "Estadísticas de un usuario", description: "Retorna métricas de rendimiento: citas completadas y ventas generadas." })
  @ApiParam({ name: "id", description: "ID del usuario" })
  @ApiQuery({ name: "branchId", required: false, type: String, description: "Filtrar estadísticas por sede" })
  @ApiResponse({ status: 200, description: "Estadísticas del usuario." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  @ApiResponse({ status: 404, description: "Usuario no encontrado." })
  getUserStats(
    @Param("id")       id: string,
    @Query("branchId") branchId?: string,
  ) {
    return this.usersService.getUserStats(id, branchId);
  }

  /**
   * POST /v1/users
   * Crea un nuevo usuario del sistema.
   */
  @Post()
  @RequirePermission("user.manage")
  @ApiOperation({ summary: "Crear usuario", description: "Crea un nuevo usuario en el sistema." })
  @ApiResponse({ status: 201, description: "Usuario creado correctamente." })
  @ApiResponse({ status: 400, description: "Datos inválidos." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  @ApiResponse({ status: 409, description: "El email ya está en uso." })
  createUser(@Body() dto: CreateUserDto, @CurrentUser() user: CurrentUserData) {
    return this.usersService.createUser(dto, user.userId);
  }

  /**
   * PATCH /v1/users/:id
   * Actualiza datos básicos de un usuario.
   */
  @Patch(":id")
  @RequirePermission("user.manage")
  @ApiOperation({ summary: "Actualizar usuario", description: "Actualiza los datos básicos de un usuario." })
  @ApiParam({ name: "id", description: "ID del usuario" })
  @ApiResponse({ status: 200, description: "Usuario actualizado correctamente." })
  @ApiResponse({ status: 400, description: "Datos inválidos." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  @ApiResponse({ status: 404, description: "Usuario no encontrado." })
  updateUser(
    @Param("id") id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.usersService.updateUser(id, dto, user.userId);
  }

  /**
   * POST /v1/users/:id/avatar
   * El admin sube o reemplaza el avatar de cualquier usuario.
   */
  @Post(":id/avatar")
  @RequirePermission("user.manage")
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Subir avatar de un usuario", description: "El administrador sube o reemplaza el avatar de cualquier usuario (máx. 2 MB, JPEG/PNG/WEBP)." })
  @ApiParam({ name: "id", description: "ID del usuario" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({ schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } })
  @ApiResponse({ status: 200, description: "Avatar subido correctamente." })
  @ApiResponse({ status: 400, description: "Archivo no proporcionado o formato inválido." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  uploadAvatar(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserData,
  ) {
    if (!file) throw new BadRequestException("Se requiere un archivo con la clave 'file'");
    return this.usersService.uploadAvatar(id, file.buffer, file.mimetype, user.userId);
  }

  /**
   * DELETE /v1/users/:id/avatar
   * El admin elimina el avatar de un usuario.
   */
  @Delete(":id/avatar")
  @RequirePermission("user.manage")
  @ApiOperation({ summary: "Eliminar avatar de un usuario", description: "El administrador elimina el avatar de cualquier usuario." })
  @ApiParam({ name: "id", description: "ID del usuario" })
  @ApiResponse({ status: 200, description: "Avatar eliminado correctamente." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  @ApiResponse({ status: 404, description: "Usuario no encontrado." })
  deleteAvatar(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.usersService.deleteAvatar(id, user.userId);
  }

  /**
   * POST /v1/users/:id/activate
   */
  @Post(":id/activate")
  @RequirePermission("user.manage")
  @ApiOperation({ summary: "Activar usuario", description: "Activa la cuenta de un usuario." })
  @ApiParam({ name: "id", description: "ID del usuario" })
  @ApiResponse({ status: 200, description: "Usuario activado correctamente." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  @ApiResponse({ status: 404, description: "Usuario no encontrado." })
  activateUser(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.usersService.setActive(id, true, user.userId);
  }

  /**
   * POST /v1/users/:id/deactivate
   * Desactiva y revoca todas las sesiones activas del usuario.
   */
  @Post(":id/deactivate")
  @RequirePermission("user.manage")
  @ApiOperation({ summary: "Desactivar usuario", description: "Desactiva la cuenta del usuario y revoca todas sus sesiones activas." })
  @ApiParam({ name: "id", description: "ID del usuario" })
  @ApiResponse({ status: 200, description: "Usuario desactivado correctamente." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  @ApiResponse({ status: 404, description: "Usuario no encontrado." })
  deactivateUser(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.usersService.setActive(id, false, user.userId);
  }

  /**
   * POST /v1/users/:id/reset-password
   * Admin resetea la contraseña. Revoca todas las sesiones del usuario afectado.
   */
  @Post(":id/reset-password")
  @RequirePermission("user.manage")
  @ApiOperation({ summary: "Resetear contraseña de usuario", description: "El administrador establece una nueva contraseña para el usuario. Revoca todas las sesiones activas del usuario afectado." })
  @ApiParam({ name: "id", description: "ID del usuario" })
  @ApiResponse({ status: 200, description: "Contraseña reseteada correctamente." })
  @ApiResponse({ status: 400, description: "Datos inválidos." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  @ApiResponse({ status: 404, description: "Usuario no encontrado." })
  resetPassword(
    @Param("id") id: string,
    @Body() dto: AdminResetPasswordDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.usersService.resetPassword(id, dto, user.userId);
  }

  /**
   * POST /v1/users/:id/roles
   * Asigna un rol a un usuario, opcionalmente en una sede.
   */
  @Post(":id/roles")
  @RequirePermission("role.manage")
  @ApiOperation({ summary: "Asignar rol a usuario", description: "Asigna un rol a un usuario, opcionalmente vinculado a una sede." })
  @ApiParam({ name: "id", description: "ID del usuario" })
  @ApiResponse({ status: 200, description: "Rol asignado correctamente." })
  @ApiResponse({ status: 400, description: "Datos inválidos." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  @ApiResponse({ status: 404, description: "Usuario o rol no encontrado." })
  assignRole(
    @Param("id") id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.usersService.assignRole(id, dto, user.userId);
  }

  /**
   * DELETE /v1/users/:id/roles/:roleCode
   * Remueve un rol de un usuario.
   */
  @Delete(":id/roles/:roleCode")
  @RequirePermission("role.manage")
  @ApiOperation({ summary: "Remover rol de usuario", description: "Revoca un rol asignado a un usuario." })
  @ApiParam({ name: "id",       description: "ID del usuario" })
  @ApiParam({ name: "roleCode", description: "Código del rol a remover" })
  @ApiResponse({ status: 200, description: "Rol removido correctamente." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permisos suficientes." })
  @ApiResponse({ status: 404, description: "Usuario o rol no encontrado." })
  removeRole(
    @Param("id")       id: string,
    @Param("roleCode") roleCode: string,
    @CurrentUser()     user: CurrentUserData,
  ) {
    return this.usersService.removeRole(id, roleCode, user.userId);
  }

  // ─── Sedes ────────────────────────────────────────────────────────────────

  /**
   * POST /v1/users/:id/branches
   * Asigna una sede al usuario.
   */
  @Post(":id/branches")
  @RequirePermission("user.manage")
  @ApiOperation({ summary: "Asignar sede a usuario" })
  @ApiParam({ name: "id", description: "ID del usuario" })
  @ApiResponse({ status: 200, description: "Sede asignada correctamente." })
  @ApiResponse({ status: 404, description: "Usuario o sede no encontrado." })
  assignBranch(
    @Param("id")   id: string,
    @Body("branchId") branchId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.usersService.assignBranch(id, branchId, user.userId);
  }

  /**
   * DELETE /v1/users/:id/branches/:branchId
   * Remueve una sede del usuario.
   */
  @Delete(":id/branches/:branchId")
  @RequirePermission("user.manage")
  @ApiOperation({ summary: "Remover sede de usuario" })
  @ApiParam({ name: "id",       description: "ID del usuario" })
  @ApiParam({ name: "branchId", description: "ID de la sede a remover" })
  @ApiResponse({ status: 200, description: "Sede removida correctamente." })
  @ApiResponse({ status: 404, description: "Relación usuario-sede no encontrada." })
  removeBranch(
    @Param("id")       id: string,
    @Param("branchId") branchId: string,
    @CurrentUser()     user: CurrentUserData,
  ) {
    return this.usersService.removeBranch(id, branchId, user.userId);
  }
}

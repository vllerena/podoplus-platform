import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  BadRequestException,
  HttpCode,
  Logger,
  UseGuards,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from "@nestjs/swagger";
import { Request } from "express";
import {
  AuthService,
  LoginResponse,
  RefreshResponse,
  ActiveSession,
} from "./auth.service";
import {
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from "./dto/auth.dto";
import { JwtAuthGuard } from "./guards/jwt.guard";
import { Public } from "./decorators/public.decorator";
import { CurrentUser, CurrentUserData } from "./decorators/current-user.decorator";
import { RbacService } from "../rbac/rbac.service";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("Auth")
@Controller("v1/auth")
export class AuthController {
  private readonly logger = new Logger("AuthController");

  constructor(
    private authService: AuthService,
    private rbacService: RbacService,
    private prisma: PrismaService,
  ) {}

  // ─── Login ────────────────────────────────────────────────────────────────

  /**
   * POST /v1/auth/login
   * Rate limit: 5 intentos por IP cada 15 minutos.
   */
  @ApiOperation({ summary: "Iniciar sesión" })
  @ApiResponse({ status: 200, description: "Login exitoso, retorna access y refresh token" })
  @ApiResponse({ status: 401, description: "Credenciales inválidas" })
  @Post("login")
  @Public()
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<LoginResponse> {
    const ip          = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    const userAgent   = req.headers["user-agent"];
    const deviceName  = dto.deviceName;

    this.logger.log(`Login: ${dto.email} (IP: ${ip})`);

    return this.authService.login(dto.email, dto.password, ip, {
      deviceName,
      ip,
      userAgent,
    });
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────

  /**
   * POST /v1/auth/refresh
   * Rota el refresh token. Devuelve nuevo par accessToken + refreshToken.
   * El refresh token anterior queda invalidado (one-time use).
   */
  @ApiOperation({ summary: "Rotar refresh token" })
  @ApiResponse({ status: 200, description: "Nuevo par de tokens" })
  @ApiResponse({ status: 401, description: "Refresh token inválido o expirado" })
  @Post("refresh")
  @Public()
  @HttpCode(200)
  async refresh(@Body() dto: RefreshTokenDto): Promise<RefreshResponse> {
    if (!dto.refreshToken) {
      throw new BadRequestException("refreshToken es requerido");
    }
    return this.authService.refreshToken(dto.refreshToken);
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  /**
   * POST /v1/auth/logout
   * 1. Blacklistea el access token actual (hasta su expiración).
   * 2. Revoca el refresh token para que no pueda rotarse.
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Cerrar sesión" })
  @ApiResponse({ status: 200, description: "Sesión cerrada" })
  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    // Blacklistear el access token del header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const accessToken = authHeader.substring(7);
      await this.authService.blacklistAccessToken(accessToken);
    }

    // Revocar el refresh token
    if (dto.refreshToken) {
      await this.authService.revokeRefreshToken(dto.refreshToken);
    }

    return { message: "Sesión cerrada correctamente" };
  }

  // ─── Sesiones activas ─────────────────────────────────────────────────────

  /**
   * GET /v1/auth/sessions
   * Lista todas las sesiones activas del usuario autenticado.
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Listar sesiones activas" })
  @ApiResponse({ status: 200, description: "Lista de sesiones" })
  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  async getSessions(
    @CurrentUser() user: CurrentUserData,
  ): Promise<ActiveSession[]> {
    return this.authService.getActiveSessions(user.userId);
  }

  /**
   * DELETE /v1/auth/sessions/:jti
   * Revoca una sesión activa específica (logout remoto).
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Revocar sesión por JTI" })
  @ApiResponse({ status: 200, description: "Sesión revocada" })
  @Delete("sessions/:jti")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async revokeSession(
    @Param("jti") jti: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<{ message: string }> {
    await this.authService.revokeSession(user.userId, jti);
    return { message: "Sesión revocada correctamente" };
  }

  // ─── Forgot / Reset password ──────────────────────────────────────────────

  /**
   * POST /v1/auth/forgot-password
   * Genera un token de recuperación y lo envía por email.
   * Rate limit: 3 intentos por IP cada 15 minutos.
   * Siempre responde 200 para no revelar si el email existe.
   */
  @ApiOperation({ summary: "Solicitar restablecimiento de contraseña" })
  @ApiResponse({ status: 200, description: "Email enviado si el usuario existe" })
  @Post("forgot-password")
  @Public()
  @HttpCode(200)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto.email);
    return {
      message:
        "Si el email está registrado, recibirás un enlace para restablecer tu contraseña.",
    };
  }

  /**
   * POST /v1/auth/reset-password
   * Valida el token de recuperación y actualiza la contraseña.
   * Revoca todas las sesiones activas tras el cambio.
   */
  @ApiOperation({ summary: "Restablecer contraseña con token" })
  @ApiResponse({ status: 200, description: "Contraseña restablecida" })
  @ApiResponse({ status: 400, description: "Token inválido o expirado" })
  @Post("reset-password")
  @Public()
  @HttpCode(200)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: "Contraseña restablecida correctamente. Inicia sesión de nuevo." };
  }

  // ─── Me ───────────────────────────────────────────────────────────────────

  /**
   * GET /v1/auth/me
   * Perfil completo del usuario autenticado: roles, permisos y sucursales.
   * Usado por el frontend para poblar el auth store tras cada login/refresh.
   */
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Perfil completo del usuario autenticado" })
  @ApiResponse({ status: 200, description: "Perfil con roles, permisos y sucursales" })
  @Get("me")
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: CurrentUserData) {
    // Permisos frescos desde Redis (30 s de caché) — ya calculados por RbacService
    const permsData = await this.rbacService.getUserPermissions(user.userId);

    // Sucursales accesibles (nombre necesario para el branch selector del dashboard)
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      include: {
        branches: {
          include: {
            branch: { select: { id: true, name: true, isActive: true } },
          },
        },
      },
    });

    const branches = (dbUser?.branches ?? [])
      .filter((ub) => ub.branch.isActive)
      .map((ub) => ({ id: ub.branch.id, name: ub.branch.name }));

    return {
      id:          user.userId,
      email:       user.email,
      firstName:   user.firstName,
      lastName:    user.lastName,
      roles:       permsData.roles,
      permissions: permsData.permissions,
      branches,
    };
  }
}

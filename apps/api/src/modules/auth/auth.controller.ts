import {
  Controller,
  Post,
  Body,
  BadRequestException,
  HttpCode,
  Logger,
  UseGuards,
  Get,
} from "@nestjs/common";
import { AuthService, LoginResponse } from "./auth.service";
import { LoginDto, RefreshTokenDto } from "./dto/auth.dto";
import { JwtAuthGuard } from "./guards/jwt.guard";
import { Public } from "./decorators/public.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import { AuthModule } from "../auth/auth.module";

@Controller("v1/auth")
export class AuthController {
  private readonly logger = new Logger("AuthController");

  constructor(private authService: AuthService) {}

  /**
   * POST /v1/auth/login
   * Login con email y contraseña
   */
  @Post("login")
  @Public()
  @HttpCode(200)
  async login(@Body() dto: LoginDto): Promise<LoginResponse> {
    this.logger.log(`Intento de login: ${dto.email}`);

    if (!dto.email || !dto.password) {
      throw new BadRequestException("Email y contraseña son requeridos");
    }

    return this.authService.login(dto.email, dto.password);
  }

  /**
   * POST /v1/auth/refresh
   * Refresca el token de acceso
   */
  @Post("refresh")
  @Public()
  @HttpCode(200)
  async refresh(
    @Body() dto: RefreshTokenDto
  ): Promise<{ accessToken: string }> {
    if (!dto.refreshToken) {
      throw new BadRequestException("refreshToken es requerido");
    }

    this.logger.log("Refresh token solicitado");
    return this.authService.refreshToken(dto.refreshToken);
  }

  /**
   * GET /v1/auth/me
   * Obtiene los datos del usuario actual (requiere autenticación)
   */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: any) {
    return {
      id: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }
}

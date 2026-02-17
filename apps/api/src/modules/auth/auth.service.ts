import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

export interface TokenPayload {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger("AuthService");

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService
  ) {}

  /**
   * Genera tokens de acceso y refresco
   */
  async generateTokens(userId: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user) {
      this.logger.warn(`Usuario no encontrado: ${userId}`);
      throw new UnauthorizedException("Usuario no encontrado");
    }

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email || "",
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const jwtExpiration = this.configService.get<string>(
      "JWT_EXPIRATION",
      "24h"
    );
    const refreshExpiration = this.configService.get<string>(
      "JWT_REFRESH_EXPIRATION",
      "7d"
    );

    const accessTokenExpiresIn: string | number = /^\d+$/.test(jwtExpiration)
      ? parseInt(jwtExpiration, 10)
      : (jwtExpiration as any);

    const refreshTokenExpiresIn: string | number = /^\d+$/.test(
      refreshExpiration
    )
      ? parseInt(refreshExpiration, 10)
      : (refreshExpiration as any);

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessTokenExpiresIn,
    } as any);

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
      expiresIn: refreshTokenExpiresIn,
    } as any);

    this.logger.debug(`Tokens generados para usuario: ${user.email}`);

    return { accessToken, refreshToken };
  }

  /**
   * Obtiene los roles del usuario
   */
  private async getUserRoles(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          select: {
            code: true,
          },
        },
      },
    });

    return userRoles.map((ur) => ur.role.code);
  }

  /**
   * Login con email y contraseña
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    this.logger.log(`Intento de login: ${email}`);

    if (!email || !password) {
      throw new BadRequestException("Email y contraseña son requeridos");
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      this.logger.warn(`Login fallido - usuario no encontrado: ${email}`);
      throw new UnauthorizedException("Credenciales inválidas");
    }

    if (!user.isActive) {
      this.logger.warn(`Login fallido - usuario inactivo: ${email}`);
      throw new UnauthorizedException("Usuario inactivo");
    }

    if (!user.passwordHash) {
      this.logger.warn(`Login fallido - sin contraseña: ${email}`);
      throw new UnauthorizedException("Usuario sin contraseña configurada");
    }

    // Verificar contraseña
    const isPasswordValid = this.verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn(`Login fallido - contraseña inválida: ${email}`);
      throw new UnauthorizedException("Credenciales inválidas");
    }

    const { accessToken, refreshToken } = await this.generateTokens(user.id);

    // Obtener roles del usuario
    const roles = user.roles.map((ur) => ur.role.code);

    this.logger.log(`Login exitoso: ${email} con roles: ${roles.join(", ")}`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email || "",
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
      },
    };
  }

  /**
   * Refresca el token de acceso
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    if (!refreshToken) {
      throw new BadRequestException("Refresh token es requerido");
    }

    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
      }) as TokenPayload;

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          isActive: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      if (!user || !user.isActive) {
        this.logger.warn(`Refresh fallido - usuario no válido: ${payload.sub}`);
        throw new UnauthorizedException("Usuario no válido");
      }

      const newPayload: TokenPayload = {
        sub: user.id,
        email: user.email || "",
        firstName: user.firstName,
        lastName: user.lastName,
      };

      const jwtExpiration = this.configService.get<string>(
        "JWT_EXPIRATION",
        "24h"
      );

      const accessTokenExpiresIn: string | number = /^\d+$/.test(jwtExpiration)
        ? parseInt(jwtExpiration, 10)
        : (jwtExpiration as any);

      const accessToken = this.jwtService.sign(newPayload, {
        expiresIn: accessTokenExpiresIn,
      } as any);

      this.logger.debug(`Token refrescado para usuario: ${user.email}`);

      return { accessToken };
    } catch (error) {
      this.logger.error("Error validando refresh token", error);
      throw new UnauthorizedException("Token de refresco inválido o expirado");
    }
  }

  /**
   * Valida un JWT
   */
  validateJwt(token: string): TokenPayload {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      this.logger.error("Error validando JWT", error);
      throw new UnauthorizedException("Token inválido o expirado");
    }
  }

  /**
   * Hashea una contraseña usando scrypt (Node.js crypto)
   */
  hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const hashedPassword = scryptSync(password, salt, 64).toString("hex");
    return `${salt}.${hashedPassword}`;
  }

  /**
   * Verifica una contraseña (VERSIÓN ROBUSTA)
   */
  private verifyPassword(password: string, hash: string): boolean {
    try {
      const parts = hash.split(".");

      if (parts.length !== 2) {
        this.logger.error("Hash inválido: formato incorrecto");
        return false;
      }

      const [salt, key] = parts;

      // Validar que salt y key sean hex válidos
      if (!salt || !key) {
        this.logger.error("Hash inválido: salt o key vacío");
        return false;
      }

      // Generar hash con la misma salt
      const hashedPassword = scryptSync(password, salt, 64).toString("hex");

      // Comparación segura contra timing attacks
      try {
        return timingSafeEqual(
          Buffer.from(key, "hex"),
          Buffer.from(hashedPassword, "hex")
        );
      } catch (error) {
        this.logger.debug(
          "timingSafeEqual falló - hashes con longitud diferente"
        );
        return false;
      }
    } catch (error) {
      this.logger.error("Error verificando contraseña:", error);
      return false;
    }
  }
}

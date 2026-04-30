import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  Optional,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CacheService } from "../cache/cache.service";
import { EmailService } from "../email/email.service";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface TokenPayload {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  /** JWT ID único — presente en access Y refresh tokens */
  jti: string;
}

export interface SessionMeta {
  deviceName?: string;
  ip?: string;
  userAgent?: string;
}

/** Datos guardados en Redis por cada refresh token activo */
export interface SessionData extends SessionMeta {
  userId: string;
  issuedAt: string; // ISO timestamp
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id:          string;
    email:       string;
    firstName:   string;
    lastName:    string;
    roles:       string[];
    permissions: string[];
    branches:    { id: string; name: string }[];
  };
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ActiveSession {
  jti: string;
  deviceName?: string;
  ip?: string;
  issuedAt: string;
}

// ─── Constantes Redis ─────────────────────────────────────────────────────────

/** TTL del refresh token en Redis (7 días en segundos) */
const RT_TTL_S = 7 * 24 * 60 * 60;

/** TTL de la blacklist de access tokens (24h en segundos — igual al JWT) */
const ACCESS_TOKEN_TTL_S = 24 * 60 * 60;

/** TTL del reset de contraseña (15 minutos) */
const PWD_RESET_TTL_S = 15 * 60;

/** Máximo de intentos fallidos antes de bloquear */
const MAX_LOGIN_ATTEMPTS = 5;

/** Duración del bloqueo de cuenta (15 minutos en segundos) */
const LOCKOUT_TTL_S = 15 * 60;

// ─── Prefijos Redis (sin el "podo:" — lo agrega CacheService) ────────────────
const K = {
  rt: (jti: string) => `rt:${jti}`, // sesión de refresh token
  rtUser: (userId: string) => `rt-user:${userId}`, // índice de sesiones por usuario
  bl: (jti: string) => `bl:${jti}`, // blacklist de access tokens
  loginFail: (email: string) => `login-fail:${email}`, // contador de intentos fallidos
  loginLock: (email: string) => `login-lock:${email}`, // bloqueo de cuenta
  pwdReset: (token: string) => `pwd-reset:${token}`, // token de reset de contraseña
};

// ─── Servicio ─────────────────────────────────────────────────────────────────

@Injectable()
export class AuthService {
  private readonly logger = new Logger("AuthService");

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private cache: CacheService,
    @Optional() private auditService?: AuditService,
    @Optional() private emailService?: EmailService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // generateTokens — emite access + refresh token con jti y roles embebidos
  // ───────────────────────────────────────────────────────────────────────────

  async generateTokens(
    userId: string,
    meta: SessionMeta = {},
    preloadedRoles?: string[],
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      this.logger.warn(`generateTokens: usuario no encontrado: ${userId}`);
      throw new UnauthorizedException("Usuario no encontrado");
    }

    // Reutilizar roles pre-cargados (ej. desde login) para evitar query extra
    const roles = preloadedRoles ?? (await this.getUserRoles(userId));

    const jwtExpiration = this.configService.get<string>(
      "JWT_EXPIRATION",
      "24h",
    );
    const refreshExpiration = this.configService.get<string>(
      "JWT_REFRESH_EXPIRATION",
      "7d",
    );

    const toExpiresIn = (v: string): string | number =>
      /^\d+$/.test(v) ? parseInt(v, 10) : (v as any);

    // jti únicos para access y refresh (diferentes — cada uno tiene su propio ID)
    const accessJti = randomBytes(16).toString("hex");
    const refreshJti = randomBytes(32).toString("hex");

    const basePayload = {
      sub: user.id,
      email: user.email || "",
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
    };

    const accessToken = this.jwtService.sign(
      { ...basePayload, jti: accessJti },
      { expiresIn: toExpiresIn(jwtExpiration) } as any,
    );

    const refreshToken = this.jwtService.sign(
      { ...basePayload, jti: refreshJti },
      {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
        expiresIn: toExpiresIn(refreshExpiration),
      } as any,
    );

    // Guardar sesión de refresh token en Redis (datos + índice por usuario)
    const sessionData: SessionData = {
      userId: user.id,
      deviceName: meta.deviceName,
      ip: meta.ip,
      userAgent: meta.userAgent,
      issuedAt: new Date().toISOString(),
    };

    await Promise.all([
      this.cache.set(K.rt(refreshJti), sessionData, RT_TTL_S),
      this.cache.sAdd(K.rtUser(user.id), refreshJti, RT_TTL_S),
    ]);

    this.logger.debug(`Tokens generados para usuario: ${user.email}`);
    return { accessToken, refreshToken };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // login
  // ───────────────────────────────────────────────────────────────────────────

  async login(
    email: string,
    password: string,
    ip = "unknown",
    meta: SessionMeta = {},
  ): Promise<LoginResponse> {
    this.logger.log(`Intento de login: ${email}`);

    if (!email || !password) {
      throw new BadRequestException("Email y password son requeridos");
    }

    // ── 1. Verificar bloqueo de cuenta ──────────────────────────────────────
    const isLocked = await this.cache.get<string>(K.loginLock(email));
    if (isLocked) {
      this.logger.warn(`Cuenta bloqueada temporalmente: ${email}`);
      throw new UnauthorizedException(
        "Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intente en 15 minutos.",
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    // ── 2. Validaciones de usuario ───────────────────────────────────────────
    if (!user) {
      await this.recordFailedAttempt(email);
      this.auditService?.log({
        actorType: "SYSTEM",
        actorId: "anonymous",
        action: "auth.login_failed",
        entityType: "user",
        entityId: email,
        metadata: { reason: "user_not_found", ip },
      });
      // Mismo mensaje para no revelar si el email existe
      throw new UnauthorizedException("Credenciales inválidas");
    }

    if (!user.isActive) {
      this.auditService?.log({
        actorType: "USER",
        actorId: user.id,
        action: "auth.login_failed",
        entityType: "user",
        entityId: user.id,
        metadata: { reason: "user_inactive", ip },
      });
      throw new UnauthorizedException("Usuario inactivo");
    }

    if (!user.passwordHash) {
      this.auditService?.log({
        actorType: "USER",
        actorId: user.id,
        action: "auth.login_failed",
        entityType: "user",
        entityId: user.id,
        metadata: { reason: "no_password_configured", ip },
      });
      throw new UnauthorizedException("Usuario sin password configurado");
    }

    // ── 3. Verificar password ────────────────────────────────────────────────
    const isPasswordValid = this.verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.recordFailedAttempt(email);
      this.auditService?.log({
        actorType: "USER",
        actorId: user.id,
        action: "auth.login_failed",
        entityType: "user",
        entityId: user.id,
        metadata: { reason: "invalid_password", ip },
      });
      throw new UnauthorizedException("Credenciales inválidas");
    }

    // ── 4. Login exitoso ─────────────────────────────────────────────────────
    // Limpiar contador de intentos fallidos y registrar fecha de último acceso
    await Promise.all([
      this.cache.del(K.loginFail(email)),
      this.prisma.user.update({
        where: { id: user.id },
        data:  { lastLoginAt: new Date() },
      }),
    ]);

    const roles = user.roles.map((ur) => ur.role.code);

    // Pasar roles pre-cargados para evitar un query extra en generateTokens
    const { accessToken, refreshToken } = await this.generateTokens(
      user.id,
      { ...meta, ip },
      roles,
    );

    // Audit trail de sesión
    this.auditService?.log({
      actorType: "USER",
      actorId: user.id,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      metadata: { ip, deviceName: meta.deviceName, userAgent: meta.userAgent },
    });

    this.logger.log(`Login exitoso: ${email} [${roles.join(", ")}]`);

    // Cargar permisos y sucursales para incluirlos en la respuesta
    // (evita un round-trip extra del frontend a /me)
    const permissionSet = new Set<string>();
    user.roles.forEach((ur) => {
      ur.role.permissions.forEach((rp) => {
        permissionSet.add(rp.permission.code);
      });
    });

    const userWithBranches = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        branches: {
          select: { branch: { select: { id: true, name: true } } },
        },
      },
    });
    const branches = (userWithBranches?.branches ?? []).map((ub) => ({
      id:   ub.branch.id,
      name: ub.branch.name,
    }));

    return {
      accessToken,
      refreshToken,
      user: {
        id:          user.id,
        email:       user.email || "",
        firstName:   user.firstName,
        lastName:    user.lastName,
        roles,
        permissions: Array.from(permissionSet),
        branches,
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // refreshToken — rotación completa con reuse detection
  // ───────────────────────────────────────────────────────────────────────────

  async refreshToken(token: string): Promise<RefreshResponse> {
    if (!token) throw new BadRequestException("Refresh token es requerido");

    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
      }) as TokenPayload;
    } catch {
      this.logger.warn("Refresh token con firma inválida o expirado");
      throw new UnauthorizedException("Token de refresco inválido o expirado");
    }

    const { sub: userId, jti } = payload;

    // Tokens legacy (sin jti) — compatibilidad
    if (!jti) return this.legacyRefresh(userId);

    // ── Verificar que el jti exista en Redis ─────────────────────────────────
    const sessionData = await this.cache.get<SessionData>(K.rt(jti));

    if (!sessionData) {
      // Token ya consumido o robado → posible reutilización
      this.logger.warn(`⚠️  Reuse detection: userId=${userId}, jti=${jti}`);
      this.auditService?.log({
        actorType: "SYSTEM",
        actorId: userId,
        action: "auth.refresh_token_reuse",
        entityType: "user",
        entityId: userId,
        metadata: { jti },
      });
      await this.revokeAllUserTokens(userId);
      throw new UnauthorizedException(
        "Token de refresco inválido. Se han revocado todas las sesiones por seguridad.",
      );
    }

    if (sessionData.userId !== userId) {
      this.logger.warn(`jti=${jti} no pertenece a userId=${userId}`);
      await this.revokeAllUserTokens(userId);
      throw new UnauthorizedException("Token de refresco inválido");
    }

    // ── Verificar usuario activo ──────────────────────────────────────────────
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });

    if (!user?.isActive) {
      await this.consumeRefreshJti(jti, userId);
      throw new UnauthorizedException("Usuario no válido");
    }

    // ── Consumir jti viejo y emitir nuevo par ─────────────────────────────────
    await this.consumeRefreshJti(jti, userId);

    const { accessToken, refreshToken } = await this.generateTokens(userId, {
      deviceName: sessionData.deviceName,
      ip: sessionData.ip,
      userAgent: sessionData.userAgent,
    });

    this.logger.debug(`Refresh token rotado: userId=${userId}`);
    return { accessToken, refreshToken };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // blacklistAccessToken — agrega el jti del access token a la blacklist Redis
  // ───────────────────────────────────────────────────────────────────────────

  async blacklistAccessToken(token: string): Promise<void> {
    try {
      // decode sin verificar firma (el guard ya lo verificó antes de llegar aquí)
      const decoded = this.jwtService.decode(token) as TokenPayload & {
        exp?: number;
      };
      if (!decoded?.jti) return;

      const now = Math.floor(Date.now() / 1000);
      const remaining = decoded.exp ? decoded.exp - now : ACCESS_TOKEN_TTL_S;
      if (remaining <= 0) return; // ya expiró, no hace falta blacklistear

      await this.cache.set(K.bl(decoded.jti), "1", remaining);
      this.logger.debug(
        `Access token blacklisteado: jti=${decoded.jti} (TTL=${remaining}s)`,
      );
    } catch {
      this.logger.warn(
        "blacklistAccessToken: error decodificando token, ignorado",
      );
    }
  }

  /**
   * Verifica si el jti de un access token está en la blacklist.
   * Usado por JwtStrategy.validate().
   */
  async isAccessTokenBlacklisted(jti: string): Promise<boolean> {
    const val = await this.cache.get<string>(K.bl(jti));
    return val !== null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // logout — revoca refresh token + blacklistea access token
  // ───────────────────────────────────────────────────────────────────────────

  async revokeRefreshToken(token: string): Promise<void> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
      }) as TokenPayload;

      if (payload.jti) {
        await this.consumeRefreshJti(payload.jti, payload.sub);
        this.logger.debug(`Refresh token revocado: jti=${payload.jti}`);
      }
    } catch {
      this.logger.debug("revokeRefreshToken: token ya inválido, ignorado");
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Sesiones activas
  // ───────────────────────────────────────────────────────────────────────────

  async getActiveSessions(userId: string): Promise<ActiveSession[]> {
    const jtis = await this.cache.sMembers(K.rtUser(userId));
    if (jtis.length === 0) return [];

    // Batch fetch en una sola llamada MGET (evita N+1 Redis GET)
    const rtKeys = jtis.map((jti) => K.rt(jti));
    const values = await this.cache.mget<SessionData>(rtKeys);

    const sessions: ActiveSession[] = [];
    const staleJtis: string[] = [];

    jtis.forEach((jti, i) => {
      const data = values[i];
      if (!data) {
        // jti expiró en Redis pero sigue en el Set — marcar para limpiar
        staleJtis.push(jti);
        return;
      }
      sessions.push({
        jti,
        deviceName: data.deviceName,
        ip: data.ip,
        issuedAt: data.issuedAt,
      });
    });

    // Limpiar jtis expirados del Set (fire-and-forget)
    if (staleJtis.length > 0) {
      Promise.all(
        staleJtis.map((jti) => this.cache.sRem(K.rtUser(userId), jti)),
      ).catch((e) =>
        this.logger.warn(`getActiveSessions cleanup error: ${e.message}`),
      );
    }

    return sessions;
  }

  async revokeSession(userId: string, jti: string): Promise<void> {
    // Verificar que el jti pertenezca al usuario antes de revocar
    const data = await this.cache.get<SessionData>(K.rt(jti));
    if (!data || data.userId !== userId) {
      throw new BadRequestException("Sesión no encontrada");
    }
    await this.consumeRefreshJti(jti, userId);
    this.logger.log(`Sesión revocada: userId=${userId}, jti=${jti}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Forgot / Reset password
  // ───────────────────────────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    // Siempre responder 200 para no revelar si el email existe
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firstName: true, isActive: true },
    });

    if (!user || !user.isActive) {
      this.logger.debug(
        `forgotPassword: email no encontrado o inactivo (${email})`,
      );
      return;
    }

    const token = randomBytes(32).toString("hex");
    await this.cache.set(K.pwdReset(token), user.id, PWD_RESET_TTL_S);

    const resetUrl = `${this.configService.get("FRONTEND_URL", "http://localhost:3000")}/reset-password?token=${token}`;

    if (this.emailService) {
      await this.emailService.sendPasswordResetEmail(
        user.email,
        resetUrl,
        user.firstName,
      );
    } else {
      this.logger.log(`[DEV] Reset URL para ${email}: ${resetUrl}`);
    }

    this.auditService?.log({
      actorType: "SYSTEM",
      actorId: user.id,
      action: "auth.forgot_password",
      entityType: "user",
      entityId: user.id,
      metadata: { email },
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userId = await this.cache.get<string>(K.pwdReset(token));

    if (!userId) {
      throw new BadRequestException(
        "Token de recuperación inválido o expirado. Solicite uno nuevo.",
      );
    }

    // Consumir el token (one-time use)
    await this.cache.del(K.pwdReset(token));

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });

    if (!user?.isActive) {
      throw new UnauthorizedException("Usuario no válido");
    }

    const passwordHash = this.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Forzar re-login en todos los dispositivos
    await this.revokeAllUserTokens(userId);

    this.auditService?.log({
      actorType: "USER",
      actorId: userId,
      action: "auth.reset_password",
      entityType: "user",
      entityId: userId,
      metadata: {},
    });

    this.logger.log(`Contraseña restablecida: userId=${userId}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // validateJwt
  // ───────────────────────────────────────────────────────────────────────────

  validateJwt(token: string): TokenPayload {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException("Token inválido o expirado");
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Password helpers
  // ───────────────────────────────────────────────────────────────────────────

  hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 64).toString("hex");
    return `${salt}.${hash}`;
  }

  /** Expuesto para que UsersService valide la contraseña actual en changeMyPassword */
  checkPassword(password: string, hash: string): boolean {
    return this.verifyPassword(password, hash);
  }

  private verifyPassword(password: string, hash: string): boolean {
    try {
      const parts = hash.split(".");
      if (parts.length !== 2) return false;

      const [salt, key] = parts;
      if (!salt || !key) return false;

      const derived = scryptSync(password, salt, 64).toString("hex");
      return timingSafeEqual(
        Buffer.from(key, "hex"),
        Buffer.from(derived, "hex"),
      );
    } catch {
      return false;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helpers privados
  // ───────────────────────────────────────────────────────────────────────────

  private async getUserRoles(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { select: { code: true } } },
    });
    return userRoles.map((ur) => ur.role.code);
  }

  /**
   * Registra un intento fallido y bloquea la cuenta si supera el límite.
   * Usa INCR atómico de Redis para evitar race conditions bajo carga concurrente.
   */
  private async recordFailedAttempt(email: string): Promise<void> {
    try {
      // cache.incr usa Redis INCR (atómico) + EXPIRE condicional
      const attempts = await this.cache.incr(K.loginFail(email), LOCKOUT_TTL_S);

      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        await Promise.all([
          this.cache.set(K.loginLock(email), "1", LOCKOUT_TTL_S),
          this.cache.del(K.loginFail(email)), // contador ya no es necesario
        ]);
        this.logger.warn(
          `Cuenta bloqueada por ${MAX_LOGIN_ATTEMPTS} intentos fallidos: ${email}`,
        );
        this.auditService?.log({
          actorType: "SYSTEM",
          actorId: "anonymous",
          action: "auth.account_locked",
          entityType: "user",
          entityId: email,
          metadata: { email, attempts },
        });
      }
    } catch (err: any) {
      this.logger.warn(`recordFailedAttempt error: ${err.message}`);
    }
  }

  /** Elimina un jti de Redis y del índice del usuario */
  private async consumeRefreshJti(jti: string, userId: string): Promise<void> {
    await Promise.all([
      this.cache.del(K.rt(jti)),
      this.cache.sRem(K.rtUser(userId), jti),
    ]);
  }

  /**
   * API pública para que UsersService fuerce re-login tras reset de contraseña por admin.
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.revokeAllUserTokens(userId);
  }

  /**
   * Revoca TODAS las sesiones activas de un usuario.
   * Se usa ante sospecha de compromiso (reuse detection o reset de contraseña).
   */
  private async revokeAllUserTokens(userId: string): Promise<void> {
    const jtis = await this.cache.sMembers(K.rtUser(userId));

    // Elimina todos los rt:{jti} + el índice de usuario en 2 llamadas Redis
    // (delMany usa un solo DEL multi-key en lugar de N DELs individuales)
    await Promise.all([
      this.cache.delMany(jtis.map((jti) => K.rt(jti))),
      this.cache.del(K.rtUser(userId)),
    ]);

    this.logger.warn(
      `Todas las sesiones revocadas: userId=${userId} (${jtis.length} tokens)`,
    );
  }

  /**
   * Compatibilidad con tokens legacy (emitidos antes de la rotación con jti).
   * Solo regenera el par sin consumir ningún jti.
   */
  private async legacyRefresh(userId: string): Promise<RefreshResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });
    if (!user?.isActive) throw new UnauthorizedException("Usuario no válido");

    return this.generateTokens(userId);
  }
}

import { UnauthorizedException, BadRequestException } from "@nestjs/common";
import {
  AuthService,
  LoginResponse,
  RefreshResponse,
  ActiveSession,
} from "./auth.service";
import { createPrismaMock, PrismaMock } from "../../test/prisma.mock";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID = "user-uuid-1";
const USER_EMAIL = "test@example.com";
const USER_FIRST = "Ana";
const USER_LAST = "García";
const TEST_PASSWORD = "Password1!";
const TEST_JTI = "test-jti-abc123";
const REFRESH_JTI = "refresh-jti-xyz789";
const NOW_EPOCH = Math.floor(Date.now() / 1000);

// ─── Mock factories ───────────────────────────────────────────────────────────

const makeJwtService = () => ({
  sign: jest.fn().mockReturnValue("mocked-token"),
  verify: jest.fn().mockReturnValue({
    sub: USER_ID,
    jti: REFRESH_JTI,
    email: USER_EMAIL,
    firstName: USER_FIRST,
    lastName: USER_LAST,
    roles: ["PODOLOGIST"],
  }),
  decode: jest.fn().mockReturnValue({
    jti: TEST_JTI,
    exp: NOW_EPOCH + 3600,
  }),
});

const CONFIG_MAP: Record<string, string> = {
  JWT_SECRET: "secret",
  JWT_EXPIRATION: "24h",
  JWT_REFRESH_SECRET: "refresh-secret",
  JWT_REFRESH_EXPIRATION: "7d",
  FRONTEND_URL: "http://localhost:3000",
};

const makeConfigService = () => ({
  get: jest
    .fn()
    .mockImplementation((key: any, def?: any) => CONFIG_MAP[key] ?? def),
});

const makeCacheService = () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  delMany: jest.fn().mockResolvedValue(undefined),
  incr: jest.fn().mockResolvedValue(1),
  mget: jest.fn().mockResolvedValue([]),
  sAdd: jest.fn().mockResolvedValue(undefined),
  sMembers: jest.fn().mockResolvedValue([]),
  sRem: jest.fn().mockResolvedValue(undefined),
});

const makeAuditService = () => ({
  log: jest.fn().mockResolvedValue(undefined),
});

const makeEmailService = () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
});

// makeUser builds a DB user row with roles pre-attached
const makeUser = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: USER_ID,
  email: USER_EMAIL,
  firstName: USER_FIRST,
  lastName: USER_LAST,
  isActive: true,
  passwordHash: null as string | null, // filled in beforeEach after hash is known
  roles: [{ role: { code: "PODOLOGIST" } }],
  ...overrides,
});

// Extended Prisma mock type that includes userRole (not in the base mock but needed by getUserRoles)
type ExtendedPrismaMock = PrismaMock & {
  userRole: { findMany: jest.Mock };
};

const createExtendedPrismaMock = (): ExtendedPrismaMock => ({
  ...createPrismaMock(),
  userRole: { findMany: jest.fn().mockResolvedValue([]) },
});

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("AuthService", () => {
  let service: AuthService;
  let prisma: ExtendedPrismaMock;
  let jwtService: ReturnType<typeof makeJwtService>;
  let configService: ReturnType<typeof makeConfigService>;
  let cache: ReturnType<typeof makeCacheService>;
  let auditService: ReturnType<typeof makeAuditService>;
  let emailService: ReturnType<typeof makeEmailService>;

  // Real password hash computed once per beforeEach after the service is instantiated
  let validHash: string;

  beforeEach(() => {
    prisma = createExtendedPrismaMock();
    jwtService = makeJwtService();
    configService = makeConfigService();
    cache = makeCacheService();
    auditService = makeAuditService();
    emailService = makeEmailService();

    service = new AuthService(
      prisma as any,
      jwtService as any,
      configService as any,
      cache as any,
      auditService as any,
      emailService as any,
    );

    // Use the real crypto implementation so verifyPassword works end-to-end
    validHash = service.hashPassword(TEST_PASSWORD);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // login()
  // ═══════════════════════════════════════════════════════════════════════════

  describe("login()", () => {
    it("happy path — returns accessToken, refreshToken, and user object", async () => {
      const user = makeUser({ passwordHash: validHash });

      // findUnique for login + findUnique inside generateTokens
      prisma.user.findUnique
        .mockResolvedValueOnce(user) // login query (with roles)
        .mockResolvedValueOnce({
          // generateTokens query
          id: USER_ID,
          email: USER_EMAIL,
          firstName: USER_FIRST,
          lastName: USER_LAST,
        });

      cache.get.mockResolvedValue(null); // no lock

      const result: LoginResponse = await service.login(
        USER_EMAIL,
        TEST_PASSWORD,
      );

      expect(result.accessToken).toBe("mocked-token");
      expect(result.refreshToken).toBe("mocked-token");
      expect(result.user).toMatchObject({
        id: USER_ID,
        email: USER_EMAIL,
        firstName: USER_FIRST,
        lastName: USER_LAST,
        roles: ["PODOLOGIST"],
      });
      expect(jwtService.sign).toHaveBeenCalledTimes(2); // access + refresh
    });

    it("throws UnauthorizedException when account is locked", async () => {
      // cache.get always returns "1" → every call sees the lock
      cache.get.mockResolvedValue("1");

      const promise = service.login(USER_EMAIL, TEST_PASSWORD);
      await expect(promise).rejects.toThrow(UnauthorizedException);
      await expect(promise).rejects.toThrow(/Cuenta bloqueada/);
    });

    it("throws UnauthorizedException when user is not found", async () => {
      cache.get.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);

      const promise = service.login(USER_EMAIL, TEST_PASSWORD);
      await expect(promise).rejects.toThrow(UnauthorizedException);
      await expect(promise).rejects.toThrow(/Credenciales inválidas/);
    });

    it("throws UnauthorizedException when user is inactive", async () => {
      cache.get.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ isActive: false, passwordHash: validHash }),
      );

      const promise = service.login(USER_EMAIL, TEST_PASSWORD);
      await expect(promise).rejects.toThrow(UnauthorizedException);
      await expect(promise).rejects.toThrow(/Usuario inactivo/);
    });

    it("throws UnauthorizedException when password is wrong", async () => {
      cache.get.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ passwordHash: validHash }),
      );

      const promise = service.login(USER_EMAIL, "WrongPassword!");
      await expect(promise).rejects.toThrow(UnauthorizedException);
      await expect(promise).rejects.toThrow(/Credenciales inválidas/);
    });

    it("calls cache.incr() when password is wrong (not cache.get+set for attempts)", async () => {
      cache.get.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ passwordHash: validHash }),
      );

      await expect(service.login(USER_EMAIL, "WrongPassword!")).rejects.toThrow(
        UnauthorizedException,
      );

      expect(cache.incr).toHaveBeenCalledWith(
        expect.stringContaining("login-fail"),
        expect.any(Number),
      );
      // Must NOT use get+set pattern for the failure counter
      const getCalls: string[] = (cache.get as jest.Mock).mock.calls.map(
        (call: unknown[]) => String(call[0]),
      );
      expect(getCalls.every((k) => !k.includes("login-fail"))).toBe(true);
    });

    it("sets loginLock key when incr reaches MAX_LOGIN_ATTEMPTS (5)", async () => {
      cache.get.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ passwordHash: validHash }),
      );
      // Simulate the 5th failed attempt
      cache.incr.mockResolvedValue(5);

      await expect(service.login(USER_EMAIL, "WrongPassword!")).rejects.toThrow(
        UnauthorizedException,
      );

      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining("login-lock"),
        "1",
        expect.any(Number),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // recordFailedAttempt() — tested indirectly via login()
  // ═══════════════════════════════════════════════════════════════════════════

  describe("recordFailedAttempt() (via login)", () => {
    it("uses cache.incr() (atomic) — not cache.get() for tracking attempts", async () => {
      cache.get.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null); // user not found path

      await expect(service.login(USER_EMAIL, TEST_PASSWORD)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(cache.incr).toHaveBeenCalledWith(
        expect.stringContaining("login-fail"),
        expect.any(Number),
      );
    });

    it("sets lockout key when incr returns a value >= 5", async () => {
      cache.get.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      cache.incr.mockResolvedValue(5);

      await expect(service.login(USER_EMAIL, TEST_PASSWORD)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining("login-lock"),
        "1",
        expect.any(Number),
      );
      // Counter should be cleared after lockout
      expect(cache.del).toHaveBeenCalledWith(
        expect.stringContaining("login-fail"),
      );
    });
  });

  describe("forgotPassword()", () => {
    it("envía el email de restauración cuando el usuario existe y está activo", async () => {
      const user = makeUser({ firstName: "Ana", isActive: true });
      prisma.user.findUnique.mockResolvedValue(user);

      await service.forgotPassword(USER_EMAIL);

      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining("pwd-reset"),
        USER_ID,
        expect.any(Number),
      );
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        USER_EMAIL,
        expect.stringContaining("/reset-password?token="),
        "Ana",
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "auth.forgot_password",
          entityType: "user",
          entityId: USER_ID,
        }),
      );
    });

    it("no lanza error si el email no existe", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.forgotPassword("missing@example.com"),
      ).resolves.toBeUndefined();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // refreshToken()
  // ═══════════════════════════════════════════════════════════════════════════

  describe("refreshToken()", () => {
    const sessionData = {
      userId: USER_ID,
      deviceName: "Chrome",
      ip: "127.0.0.1",
      userAgent: "Mozilla/5.0",
      issuedAt: new Date().toISOString(),
    };

    it("happy path — rotates token and returns new pair", async () => {
      jwtService.verify.mockReturnValue({
        sub: USER_ID,
        jti: REFRESH_JTI,
        email: USER_EMAIL,
        firstName: USER_FIRST,
        lastName: USER_LAST,
        roles: ["PODOLOGIST"],
      });

      cache.get.mockResolvedValueOnce(sessionData); // rt:{jti} found

      prisma.user.findUnique
        .mockResolvedValueOnce({ id: USER_ID, isActive: true }) // active check
        .mockResolvedValueOnce({
          // generateTokens
          id: USER_ID,
          email: USER_EMAIL,
          firstName: USER_FIRST,
          lastName: USER_LAST,
        });

      const result: RefreshResponse = await service.refreshToken(
        "valid-refresh-token",
      );

      expect(result.accessToken).toBe("mocked-token");
      expect(result.refreshToken).toBe("mocked-token");
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });

    it("throws BadRequestException when token is empty string", async () => {
      await expect(service.refreshToken("")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws UnauthorizedException when JWT signature is invalid", async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error("invalid signature");
      });

      const promise = service.refreshToken("bad-token");
      await expect(promise).rejects.toThrow(UnauthorizedException);
      await expect(promise).rejects.toThrow(/Token de refresco inválido/);
    });

    it("throws UnauthorizedException and revokes all tokens when jti not found in Redis (reuse detection)", async () => {
      jwtService.verify.mockReturnValue({
        sub: USER_ID,
        jti: REFRESH_JTI,
        email: USER_EMAIL,
        firstName: USER_FIRST,
        lastName: USER_LAST,
        roles: [],
      });

      cache.get.mockResolvedValueOnce(null); // rt:{jti} missing → reuse!
      cache.sMembers.mockResolvedValue([REFRESH_JTI, "other-jti"]);

      await expect(service.refreshToken("reused-token")).rejects.toThrow(
        UnauthorizedException,
      );

      // revokeAllUserTokens must be called → delMany + del on index
      expect(cache.delMany).toHaveBeenCalled();
    });

    it("throws UnauthorizedException when user is inactive", async () => {
      jwtService.verify.mockReturnValue({
        sub: USER_ID,
        jti: REFRESH_JTI,
        email: USER_EMAIL,
        firstName: USER_FIRST,
        lastName: USER_LAST,
        roles: [],
      });

      cache.get.mockResolvedValueOnce(sessionData); // session found
      prisma.user.findUnique.mockResolvedValueOnce({
        id: USER_ID,
        isActive: false,
      });

      await expect(service.refreshToken("valid-token")).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // blacklistAccessToken() / logout
  // ═══════════════════════════════════════════════════════════════════════════

  describe("blacklistAccessToken()", () => {
    it("blacklists the jti in Redis with the remaining TTL", async () => {
      const futureExp = NOW_EPOCH + 3600;
      jwtService.decode.mockReturnValue({ jti: TEST_JTI, exp: futureExp });

      await service.blacklistAccessToken("valid-access-token");

      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining(`bl:${TEST_JTI}`),
        "1",
        expect.any(Number),
      );
      // The TTL stored should be the remaining seconds (approximately)
      const ttlArg = (cache.set as jest.Mock).mock.calls[0][2] as number;
      expect(ttlArg).toBeGreaterThan(0);
      expect(ttlArg).toBeLessThanOrEqual(3600);
    });

    it("skips blacklisting when the token is already expired (remaining <= 0)", async () => {
      jwtService.decode.mockReturnValue({ jti: TEST_JTI, exp: NOW_EPOCH - 10 });

      await service.blacklistAccessToken("expired-token");

      expect(cache.set).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getActiveSessions()
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getActiveSessions()", () => {
    const JTI_1 = "jti-1";
    const JTI_2 = "jti-2";
    const session1 = {
      userId: USER_ID,
      deviceName: "Chrome",
      ip: "1.2.3.4",
      issuedAt: new Date().toISOString(),
    };
    const session2 = {
      userId: USER_ID,
      deviceName: "Firefox",
      ip: "5.6.7.8",
      issuedAt: new Date().toISOString(),
    };

    it("returns list using cache.mget (not individual cache.get calls)", async () => {
      cache.sMembers.mockResolvedValue([JTI_1, JTI_2]);
      cache.mget.mockResolvedValue([session1, session2]);

      const sessions: ActiveSession[] =
        await service.getActiveSessions(USER_ID);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].jti).toBe(JTI_1);
      expect(sessions[1].jti).toBe(JTI_2);

      // Must use mget, not individual get calls
      expect(cache.mget).toHaveBeenCalledTimes(1);
      expect(cache.mget).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining(JTI_1),
          expect.stringContaining(JTI_2),
        ]),
      );
    });

    it("filters out stale jtis (mget returns null) and calls cache.sRem for cleanup", async () => {
      cache.sMembers.mockResolvedValue([JTI_1, JTI_2]);
      // JTI_2 expired → mget returns null for that slot
      cache.mget.mockResolvedValue([session1, null]);

      const sessions: ActiveSession[] =
        await service.getActiveSessions(USER_ID);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].jti).toBe(JTI_1);

      // Let the fire-and-forget cleanup settle
      await Promise.resolve();

      expect(cache.sRem).toHaveBeenCalledWith(
        expect.stringContaining("rt-user"),
        JTI_2,
      );
    });

    it("returns empty array when user has no sessions", async () => {
      cache.sMembers.mockResolvedValue([]);

      const sessions = await service.getActiveSessions(USER_ID);

      expect(sessions).toEqual([]);
      expect(cache.mget).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // revokeAllUserTokens() — tested via refreshToken reuse detection
  // ═══════════════════════════════════════════════════════════════════════════

  describe("revokeAllUserTokens() (via refreshToken reuse)", () => {
    it("uses cache.delMany() with an array, not individual cache.del() calls per jti", async () => {
      jwtService.verify.mockReturnValue({
        sub: USER_ID,
        jti: REFRESH_JTI,
        email: USER_EMAIL,
        firstName: USER_FIRST,
        lastName: USER_LAST,
        roles: [],
      });

      // Simulate reuse: jti not in Redis
      cache.get.mockResolvedValueOnce(null);
      const existingJtis = ["jti-a", "jti-b", "jti-c"];
      cache.sMembers.mockResolvedValue(existingJtis);

      await expect(service.refreshToken("reused-token")).rejects.toThrow(
        UnauthorizedException,
      );

      expect(cache.delMany).toHaveBeenCalledWith(
        expect.arrayContaining(
          existingJtis.map((jti) => expect.stringContaining(jti)),
        ),
      );
      // delMany should be called with an array (batch) — not one call per jti
      expect(cache.delMany).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // forgotPassword()
  // ═══════════════════════════════════════════════════════════════════════════

  describe("forgotPassword()", () => {
    it("returns void even when email is not found (no exception)", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.forgotPassword("unknown@example.com"),
      ).resolves.toBeUndefined();
      expect(cache.set).not.toHaveBeenCalled();
    });

    it("returns void even when user is inactive (no exception)", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: USER_ID,
        firstName: USER_FIRST,
        isActive: false,
      });

      await expect(service.forgotPassword(USER_EMAIL)).resolves.toBeUndefined();
      expect(cache.set).not.toHaveBeenCalled();
    });

    it("stores reset token in Redis with 15-minute TTL when user exists", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: USER_ID,
        firstName: USER_FIRST,
        isActive: true,
      });

      await service.forgotPassword(USER_EMAIL);

      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining("pwd-reset"),
        USER_ID,
        15 * 60,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // resetPassword()
  // ═══════════════════════════════════════════════════════════════════════════

  describe("resetPassword()", () => {
    const RESET_TOKEN = "valid-reset-token-hex";
    const NEW_PASSWORD = "NewPassword2@";

    it("happy path — updates passwordHash and revokes all user tokens", async () => {
      cache.get.mockResolvedValueOnce(USER_ID); // token → userId found
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID, isActive: true });
      prisma.user.update.mockResolvedValue({} as any);
      cache.sMembers.mockResolvedValue([]); // no existing sessions

      await expect(
        service.resetPassword(RESET_TOKEN, NEW_PASSWORD),
      ).resolves.toBeUndefined();

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: USER_ID },
          data: expect.objectContaining({ passwordHash: expect.any(String) }),
        }),
      );
      // revokeAllUserTokens is called
      expect(cache.delMany).toHaveBeenCalled();
    });

    it("throws BadRequestException when reset token is invalid or expired", async () => {
      cache.get.mockResolvedValue(null); // token never found in Redis

      const promise = service.resetPassword("bad-token", NEW_PASSWORD);
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(/Token de recuperación inválido/);
    });

    it("throws UnauthorizedException when user is inactive", async () => {
      cache.get.mockResolvedValueOnce(USER_ID);
      // Token consumed (del)
      prisma.user.findUnique.mockResolvedValue({
        id: USER_ID,
        isActive: false,
      });

      await expect(
        service.resetPassword(RESET_TOKEN, NEW_PASSWORD),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // hashPassword() / checkPassword()
  // ═══════════════════════════════════════════════════════════════════════════

  describe("hashPassword()", () => {
    it('produces a "salt.hash" format string', () => {
      const hash = service.hashPassword(TEST_PASSWORD);
      const parts = hash.split(".");

      expect(parts).toHaveLength(2);
      const [salt, key] = parts;
      expect(salt.length).toBeGreaterThan(0);
      expect(key.length).toBeGreaterThan(0);
    });

    it("produces a different hash each call (random salt)", () => {
      const hash1 = service.hashPassword(TEST_PASSWORD);
      const hash2 = service.hashPassword(TEST_PASSWORD);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("checkPassword()", () => {
    it("returns true for the correct password", () => {
      const hash = service.hashPassword(TEST_PASSWORD);
      expect(service.checkPassword(TEST_PASSWORD, hash)).toBe(true);
    });

    it("returns false for a wrong password", () => {
      const hash = service.hashPassword(TEST_PASSWORD);
      expect(service.checkPassword("WrongPassword!", hash)).toBe(false);
    });

    it("returns false for a malformed hash (missing separator)", () => {
      expect(service.checkPassword(TEST_PASSWORD, "noseparatorhere")).toBe(
        false,
      );
    });

    it("returns false for an empty hash string", () => {
      expect(service.checkPassword(TEST_PASSWORD, "")).toBe(false);
    });

    it("returns false for a hash with wrong key length", () => {
      // Valid salt format but the hex key is wrong length for scrypt 64-byte output
      expect(service.checkPassword(TEST_PASSWORD, "aabbccdd.deadbeef")).toBe(
        false,
      );
    });
  });
});

import {
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { createPrismaMock, PrismaMock } from "../../test/prisma.mock";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID   = "user-uuid-1";
const ACTOR_ID  = "actor-uuid-1";
const ROLE_ID   = "role-uuid-1";
const BRANCH_ID = "branch-uuid-1";

const makeUser = (overrides: Partial<any> = {}) => ({
  id:           USER_ID,
  firstName:    "Jane",
  lastName:     "Doe",
  email:        "jane@example.com",
  phone:        null,
  passwordHash: "hashed_password",
  isActive:     true,
  avatarData:   null,
  avatarMimeType: null,
  createdAt:    new Date("2024-01-01"),
  updatedAt:    new Date("2024-01-01"),
  roles:        [],
  branches:     [],
  ...overrides,
});

const makeRole = (overrides: Partial<any> = {}) => ({
  id:          ROLE_ID,
  code:        "RECEPTIONIST",
  name:        "Receptionist",
  permissions: [],
  ...overrides,
});

const makeBranch = (overrides: Partial<any> = {}) => ({
  id:   BRANCH_ID,
  name: "Sede Principal",
  code: "SP",
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("UsersService", () => {
  let service: UsersService;
  let prisma: PrismaMock;
  let authService: {
    hashPassword: jest.Mock;
    checkPassword: jest.Mock;
    revokeAllUserSessions: jest.Mock;
  };
  let auditService: { log: jest.Mock };
  let cacheService: { delPattern: jest.Mock };
  let rbacService: { clearUserPermissionsCache: jest.Mock };

  beforeEach(() => {
    prisma = createPrismaMock();

    // Add missing models to the prisma mock
    (prisma as any).role = {
      findUnique: jest.fn(),
      findMany:   jest.fn(),
    };
    (prisma as any).userRole = {
      findUnique: jest.fn(),
      create:     jest.fn(),
      delete:     jest.fn(),
      upsert:     jest.fn(),
    };
    (prisma as any).userBranch = {
      findUnique: jest.fn(),
      upsert:     jest.fn(),
    };
    (prisma as any).sale = {
      count:     jest.fn(),
      aggregate: jest.fn(),
    };
    (prisma as any).appointment = {
      count: jest.fn(),
    };

    authService = {
      hashPassword:           jest.fn().mockReturnValue("hashed_new_password"),
      checkPassword:          jest.fn().mockReturnValue(true),
      revokeAllUserSessions:  jest.fn().mockResolvedValue(undefined),
    };

    auditService = { log: jest.fn() };

    cacheService = { delPattern: jest.fn().mockResolvedValue(undefined) };

    rbacService = {
      clearUserPermissionsCache: jest.fn().mockResolvedValue(undefined),
    };

    service = new UsersService(
      prisma as any,
      authService as any,
      rbacService as any,
      auditService as any,
    );
  });

  // ─── createUser ───────────────────────────────────────────────────────────

  describe("createUser", () => {
    const dto = {
      firstName: "Jane",
      lastName:  "Doe",
      email:     "jane@example.com",
      password:  "SecurePass123!",
    } as any;

    it("creates user with hashed password", async () => {
      prisma.user.findUnique.mockResolvedValue(null); // no existing email/phone
      prisma.user.create.mockResolvedValue(makeUser());
      // getUserById is called at the end; mock a full user
      const fullUser = makeUser({
        roles: [{ role: makeRole() }],
        branches: [],
      });
      prisma.user.findUnique
        .mockResolvedValueOnce(null)  // email check
        .mockResolvedValue(fullUser); // getUserById

      await service.createUser(dto, ACTOR_ID);

      expect(authService.hashPassword).toHaveBeenCalledWith(dto.password);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordHash: "hashed_new_password",
            email:        dto.email,
          }),
        })
      );
    });

    it("throws ConflictException when email already exists", async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser()); // email conflict

      await expect(service.createUser(dto, ACTOR_ID)).rejects.toThrow(
        ConflictException
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  // ─── getUserById ──────────────────────────────────────────────────────────

  describe("getUserById", () => {
    it("returns user with roles", async () => {
      const user = makeUser({
        roles: [
          {
            role: {
              ...makeRole(),
              permissions: [{ permission: { code: "appointment.read" } }],
            },
          },
        ],
        branches: [{ branch: makeBranch() }],
      });
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getUserById(USER_ID);

      expect(result.id).toBe(USER_ID);
      expect(result.roles).toContain("RECEPTIONIST");
    });

    it("throws NotFoundException when user is not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserById(USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateUser ───────────────────────────────────────────────────────────

  describe("updateUser", () => {
    it("updates firstName and lastName", async () => {
      const existing = makeUser();
      const updated  = makeUser({ firstName: "Janet", lastName: "Smith", roles: [], branches: [] });

      prisma.user.findUnique.mockResolvedValue(existing);
      prisma.user.update.mockResolvedValue(updated);

      const result = await service.updateUser(
        USER_ID,
        { firstName: "Janet", lastName: "Smith" },
        ACTOR_ID
      );

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ firstName: "Janet", lastName: "Smith" }),
        })
      );
      expect(result.firstName).toBe("Janet");
    });

    it("throws NotFoundException when user is not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateUser(USER_ID, { firstName: "X" }, ACTOR_ID)
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── setActive ────────────────────────────────────────────────────────────

  describe("setActive — deactivate", () => {
    it("sets isActive=false and calls revokeAllUserSessions", async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      prisma.user.update.mockResolvedValue(makeUser({ isActive: false }));

      const result = await service.setActive(USER_ID, false, ACTOR_ID);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } })
      );
      expect(authService.revokeAllUserSessions).toHaveBeenCalledWith(USER_ID);
      expect(rbacService.clearUserPermissionsCache).toHaveBeenCalledWith(USER_ID);
      expect(result.isActive).toBe(false);
    });

    it("throws NotFoundException when user is not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.setActive(USER_ID, false, ACTOR_ID)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // ─── changeMyPassword ─────────────────────────────────────────────────────

  describe("changeMyPassword", () => {
    const dto = {
      currentPassword: "OldPass123!",
      newPassword:     "NewPass456!",
    };

    it("verifies current password, updates hash, revokes sessions", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id:           USER_ID,
        passwordHash: "hashed_old_password",
      });
      authService.checkPassword.mockReturnValue(true);
      prisma.user.update.mockResolvedValue({});

      const result = await service.changeMyPassword(USER_ID, dto);

      expect(authService.checkPassword).toHaveBeenCalledWith(
        dto.currentPassword,
        "hashed_old_password"
      );
      expect(authService.hashPassword).toHaveBeenCalledWith(dto.newPassword);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { passwordHash: "hashed_new_password" },
        })
      );
      expect(authService.revokeAllUserSessions).toHaveBeenCalledWith(USER_ID);
      expect(result.success).toBe(true);
    });

    it("throws UnauthorizedException when current password is wrong", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id:           USER_ID,
        passwordHash: "hashed_old_password",
      });
      authService.checkPassword.mockReturnValue(false);

      await expect(service.changeMyPassword(USER_ID, dto)).rejects.toThrow(
        UnauthorizedException
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.changeMyPassword(USER_ID, dto)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // ─── resetPassword ────────────────────────────────────────────────────────

  describe("resetPassword — admin reset", () => {
    const dto = { new_password: "NewAdminPass1!" };

    it("sets new passwordHash and revokes all sessions of target user", async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      prisma.user.update.mockResolvedValue({});

      const result = await service.resetPassword(USER_ID, dto, ACTOR_ID);

      expect(authService.hashPassword).toHaveBeenCalledWith(dto.new_password);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: USER_ID },
          data:  { passwordHash: "hashed_new_password" },
        })
      );
      expect(authService.revokeAllUserSessions).toHaveBeenCalledWith(USER_ID);
      expect(result.success).toBe(true);
    });

    it("throws NotFoundException when user is not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword(USER_ID, dto, ACTOR_ID)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // ─── assignRole ───────────────────────────────────────────────────────────

  describe("assignRole", () => {
    const dto = { role_code: "RECEPTIONIST" };

    it("assigns role to user — prisma.userRole.upsert called", async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      (prisma as any).role.findUnique.mockResolvedValue(makeRole());
      (prisma as any).userRole.upsert.mockResolvedValue({});

      // getUserById at the end
      const fullUser = makeUser({
        roles: [{ role: { ...makeRole(), permissions: [] } }],
        branches: [],
      });
      prisma.user.findUnique
        .mockResolvedValueOnce(makeUser()) // first call (existence check)
        .mockResolvedValue(fullUser);      // getUserById at the end

      await service.assignRole(USER_ID, dto, ACTOR_ID);

      expect((prisma as any).userRole.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ userId: USER_ID, roleId: ROLE_ID }),
        })
      );
      expect(rbacService.clearUserPermissionsCache).toHaveBeenCalledWith(USER_ID);
    });

    it("throws NotFoundException when role is not found", async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      (prisma as any).role.findUnique.mockResolvedValue(null);

      await expect(service.assignRole(USER_ID, dto, ACTOR_ID)).rejects.toThrow(
        NotFoundException
      );
    });
  });
});

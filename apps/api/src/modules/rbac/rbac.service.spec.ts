import {
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { RbacService, UserPermissions } from "./rbac.service";
import { createPrismaMock, PrismaMock } from "../../test/prisma.mock";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID      = "user-uuid-1";
const ROLE_ID      = "role-uuid-1";
const PERMISSION_ID = "perm-uuid-1";
const BRANCH_ID    = "branch-uuid-1";

const makeDbUser = (overrides: Partial<any> = {}) => ({
  id:       USER_ID,
  isActive: true,
  roles: [
    {
      role: {
        code: "RECEPTIONIST",
        permissions: [
          { permission: { code: "appointment.read" } },
          { permission: { code: "customer.read" } },
        ],
      },
    },
  ],
  branches: [{ branchId: BRANCH_ID }],
  ...overrides,
});

const makeRole = (overrides: Partial<any> = {}) => ({
  id:          ROLE_ID,
  code:        "RECEPTIONIST",
  name:        "Receptionist",
  permissions: [],
  ...overrides,
});

const makePermission = (overrides: Partial<any> = {}) => ({
  id:          PERMISSION_ID,
  code:        "appointment.read",
  description: "appointment.read",
  ...overrides,
});

const cachedPerms: UserPermissions = {
  userId:      USER_ID,
  roles:       ["RECEPTIONIST"],
  permissions: ["appointment.read", "customer.read"],
  branchIds:   [BRANCH_ID],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("RbacService", () => {
  let service: RbacService;
  let prisma: PrismaMock;
  let redisMock: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(() => {
    prisma = createPrismaMock();

    // Add models not in the base mock
    (prisma as any).role = {
      findUnique: jest.fn(),
      findMany:   jest.fn(),
      upsert:     jest.fn(),
    };
    (prisma as any).permission = {
      findUnique: jest.fn(),
      findMany:   jest.fn(),
      upsert:     jest.fn(),
    };
    (prisma as any).rolePermission = {
      findUnique: jest.fn(),
      create:     jest.fn(),
      delete:     jest.fn(),
    };
    (prisma as any).userRole = {
      findUnique: jest.fn(),
      create:     jest.fn(),
      delete:     jest.fn(),
      findMany:   jest.fn(),
    };
    (prisma as any).userBranch = {
      findMany: jest.fn().mockResolvedValue([]),
    };

    redisMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue("OK"),
      del: jest.fn().mockResolvedValue(1),
    };

    service = new RbacService(prisma as any, redisMock as any);
  });

  // ─── getUserPermissions ───────────────────────────────────────────────────

  describe("getUserPermissions", () => {
    it("on cache miss: queries DB, builds UserPermissions, stores in Redis", async () => {
      redisMock.get.mockResolvedValue(null); // cache miss
      prisma.user.findUnique.mockResolvedValue(makeDbUser());

      const result = await service.getUserPermissions(USER_ID);

      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(result.userId).toBe(USER_ID);
      expect(result.roles).toContain("RECEPTIONIST");
      expect(result.permissions).toContain("appointment.read");
      expect(result.branchIds).toContain(BRANCH_ID);
      expect(redisMock.set).toHaveBeenCalledWith(
        `rbac:perms:${USER_ID}`,
        JSON.stringify(result),
        "EX",
        30
      );
    });

    it("on cache hit: returns cached value without DB query", async () => {
      redisMock.get.mockResolvedValue(JSON.stringify(cachedPerms));

      const result = await service.getUserPermissions(USER_ID);

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(result.roles).toEqual(cachedPerms.roles);
      expect(result.permissions).toEqual(cachedPerms.permissions);
    });
  });

  // ─── hasPermission ────────────────────────────────────────────────────────

  describe("hasPermission", () => {
    beforeEach(() => {
      redisMock.get.mockResolvedValue(JSON.stringify(cachedPerms));
    });

    it("returns true when permission is in list", async () => {
      const result = await service.hasPermission(USER_ID, "appointment.read");
      expect(result).toBe(true);
    });

    it("returns false when permission is not in list", async () => {
      const result = await service.hasPermission(USER_ID, "user.manage");
      expect(result).toBe(false);
    });
  });

  // ─── hasAccessToBranch ────────────────────────────────────────────────────

  describe("hasAccessToBranch", () => {
    it("SUPER_ADMIN always has access even to branches not in their list", async () => {
      const superAdminPerms: UserPermissions = {
        userId:      USER_ID,
        roles:       ["SUPER_ADMIN"],
        permissions: [],
        branchIds:   [],
      };
      redisMock.get.mockResolvedValue(JSON.stringify(superAdminPerms));

      const result = await service.hasAccessToBranch(USER_ID, "any-branch-id");
      expect(result).toBe(true);
    });

    it("regular user: returns true if branchId is in list", async () => {
      redisMock.get.mockResolvedValue(JSON.stringify(cachedPerms));

      const result = await service.hasAccessToBranch(USER_ID, BRANCH_ID);
      expect(result).toBe(true);
    });

    it("regular user: returns false if branchId is not in list", async () => {
      redisMock.get.mockResolvedValue(JSON.stringify(cachedPerms));

      const result = await service.hasAccessToBranch(USER_ID, "other-branch-id");
      expect(result).toBe(false);
    });
  });

  // ─── assignPermissionToRole ───────────────────────────────────────────────

  describe("assignPermissionToRole", () => {
    it("creates rolePermission when both role and permission exist", async () => {
      (prisma as any).role.findUnique.mockResolvedValue(makeRole());
      (prisma as any).permission.findUnique.mockResolvedValue(makePermission());
      (prisma as any).rolePermission.findUnique.mockResolvedValue(null); // not yet assigned
      (prisma as any).rolePermission.create.mockResolvedValue({
        roleId:       ROLE_ID,
        permissionId: PERMISSION_ID,
        role:         makeRole(),
        permission:   makePermission(),
      });

      const result = await service.assignPermissionToRole(ROLE_ID, PERMISSION_ID);

      expect((prisma as any).rolePermission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { roleId: ROLE_ID, permissionId: PERMISSION_ID },
        })
      );
      expect(result.roleId).toBe(ROLE_ID);
    });

    it("throws NotFoundException when role is not found", async () => {
      (prisma as any).role.findUnique.mockResolvedValue(null);
      (prisma as any).permission.findUnique.mockResolvedValue(makePermission());

      await expect(
        service.assignPermissionToRole(ROLE_ID, PERMISSION_ID)
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException when permission is not found", async () => {
      (prisma as any).role.findUnique.mockResolvedValue(makeRole());
      (prisma as any).permission.findUnique.mockResolvedValue(null);

      await expect(
        service.assignPermissionToRole(ROLE_ID, PERMISSION_ID)
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException when permission already assigned to role", async () => {
      (prisma as any).role.findUnique.mockResolvedValue(makeRole());
      (prisma as any).permission.findUnique.mockResolvedValue(makePermission());
      (prisma as any).rolePermission.findUnique.mockResolvedValue({
        roleId:       ROLE_ID,
        permissionId: PERMISSION_ID,
      });

      await expect(
        service.assignPermissionToRole(ROLE_ID, PERMISSION_ID)
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── seedRolesAndPermissions ──────────────────────────────────────────────

  describe("seedRolesAndPermissions", () => {
    const EXPECTED_ROLE_COUNT       = 10;
    const EXPECTED_PERMISSION_COUNT = 49;

    beforeEach(() => {
      (prisma as any).role.upsert.mockResolvedValue({});
      (prisma as any).permission.upsert.mockResolvedValue({});
    });

    it("calls upsert for each role and each permission", async () => {
      await service.seedRolesAndPermissions();

      expect((prisma as any).role.upsert).toHaveBeenCalledTimes(EXPECTED_ROLE_COUNT);
      expect((prisma as any).permission.upsert).toHaveBeenCalledTimes(EXPECTED_PERMISSION_COUNT);
    });

    it("returns { roles: N, permissions: M } with correct counts", async () => {
      const result = await service.seedRolesAndPermissions();

      expect(result.roles).toBe(EXPECTED_ROLE_COUNT);
      expect(result.permissions).toBe(EXPECTED_PERMISSION_COUNT);
    });

    it("seeds required permission codes (spot check)", async () => {
      await service.seedRolesAndPermissions();

      const permCodes: string[] = (prisma as any).permission.upsert.mock.calls.map(
        (call: any[]) => call[0].where.code
      );

      expect(permCodes).toContain("realtime.read");
      expect(permCodes).toContain("audit.read");
      expect(permCodes).toContain("cash_register.manage");
      expect(permCodes).toContain("product.manage");
      expect(permCodes).toContain("inventory.manage");
    });
  });
});

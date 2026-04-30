import {
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { BranchesService } from "./branches.service";
import { createPrismaMock, PrismaMock } from "../../test/prisma.mock";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BRANCH_ID = "branch-uuid-1";
const ACTOR_ID  = "user-uuid-1";
const USER_ID   = "user-uuid-2";

const makeBranch = (overrides: Partial<any> = {}) => ({
  id:              BRANCH_ID,
  code:            "LIM-01",
  name:            "Sede Lima",
  address:         "Av. Javier Prado 1234",
  district:        "Miraflores",
  city:            "Lima",
  phone:           "999888777",
  email:           "lima@podoplus.pe",
  latitude:        null,
  longitude:       null,
  googleMapsUrl:   null,
  isActive:        true,
  defaultCapacity: 4,
  timezone:        "America/Lima",
  photoData:       null,
  photoMimeType:   null,
  createdAt:       new Date(),
  updatedAt:       new Date(),
  ...overrides,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a minimal mock RbacService */
const makeRbacService = (roles: string[] = ["SUPER_ADMIN"]) => ({
  getUserPermissions:        jest.fn().mockResolvedValue({ roles, branchIds: [] }),
  clearUserPermissionsCache: jest.fn().mockResolvedValue(undefined),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BranchesService", () => {
  let service:      BranchesService;
  let prisma:       PrismaMock;
  let rbacService:  ReturnType<typeof makeRbacService>;
  let auditService: { log: jest.Mock };

  beforeEach(() => {
    prisma       = createPrismaMock();
    rbacService  = makeRbacService();
    auditService = { log: jest.fn() };

    service = new BranchesService(
      prisma as any,
      rbacService as any,
      auditService as any,
    );
  });

  // ─── create() ──────────────────────────────────────────────────────────────

  describe("create()", () => {
    const dto = {
      name:    "Sede Lima",
      address: "Av. Javier Prado 1234",
      city:    "Lima",
      code:    "LIM-01",
    };

    it("creates a branch with correct data", async () => {
      prisma.branch.findUnique.mockResolvedValue(null); // no duplicate code
      prisma.branch.create.mockResolvedValue(makeBranch());

      const result = await service.create(dto as any, ACTOR_ID);

      expect(prisma.branch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name:     dto.name,
            address:  dto.address,
            city:     dto.city,
            code:     dto.code,
            isActive: true,
          }),
        }),
      );
      expect(result.id).toBe(BRANCH_ID);
    });

    it("throws BadRequestException when a branch with the same code already exists", async () => {
      prisma.branch.findUnique.mockResolvedValue(makeBranch()); // duplicate

      await expect(service.create(dto as any, ACTOR_ID)).rejects.toThrow(BadRequestException);
      expect(prisma.branch.create).not.toHaveBeenCalled();
    });
  });

  // ─── update() ──────────────────────────────────────────────────────────────

  describe("update()", () => {
    it("updates branch fields", async () => {
      const updateDto = { name: "Sede Lima Norte", city: "Lima" };
      prisma.branch.findUnique.mockResolvedValue(makeBranch());
      prisma.branch.update.mockResolvedValue(makeBranch({ name: "Sede Lima Norte" }));

      const result = await service.update(BRANCH_ID, updateDto as any, ACTOR_ID);

      expect(prisma.branch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BRANCH_ID },
          data:  expect.objectContaining({ name: "Sede Lima Norte" }),
        }),
      );
      expect(result.name).toBe("Sede Lima Norte");
    });

    it("throws NotFoundException when branch does not exist", async () => {
      prisma.branch.findUnique.mockResolvedValue(null);

      await expect(service.update(BRANCH_ID, {} as any, ACTOR_ID)).rejects.toThrow(NotFoundException);
      expect(prisma.branch.update).not.toHaveBeenCalled();
    });
  });

  // ─── getStats() — Lima UTC fix ─────────────────────────────────────────────

  describe("getStats()", () => {
    it("returns stats with UTC-based date boundaries and correct aggregated values", async () => {
      // assertBranchExists
      prisma.branch.findUnique.mockResolvedValue(makeBranch());

      // All appointment.count calls return 5
      prisma.appointment.count.mockResolvedValue(5);

      // userBranch.count for activeUsers — add missing mock method
      (prisma as any).userBranch = { count: jest.fn().mockResolvedValue(3) };

      // sale.aggregate is not in the base mock — add it locally
      (prisma.sale as any).aggregate = jest.fn().mockResolvedValue({ _sum: { totalAmount: 1000 } });

      const result = await service.getStats(BRANCH_ID);

      // period.from must be a valid "YYYY-MM-DD" string
      expect(result.period.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.period.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // appointments.total comes from the mocked count (5)
      expect(result.appointments.total).toBe(5);

      // revenue comes from sale.aggregate
      expect(result.revenue).toBe(1000);

      // branchId is echoed back
      expect(result.branchId).toBe(BRANCH_ID);
    });
  });

  // ─── deactivate() ─────────────────────────────────────────────────────────

  describe("deactivate()", () => {
    it("sets isActive=false when there are no future active appointments", async () => {
      prisma.branch.findUnique.mockResolvedValue(makeBranch({ isActive: true }));
      prisma.appointment.count.mockResolvedValue(0);
      prisma.branch.update.mockResolvedValue(makeBranch({ isActive: false }));

      const result = await service.deactivate(BRANCH_ID, ACTOR_ID);

      expect(prisma.branch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BRANCH_ID },
          data:  { isActive: false },
        }),
      );
      expect(result.isActive).toBe(false);
    });

    it("throws BadRequestException when branch has future active appointments", async () => {
      prisma.branch.findUnique.mockResolvedValue(makeBranch({ isActive: true }));
      prisma.appointment.count.mockResolvedValue(3);

      await expect(service.deactivate(BRANCH_ID, ACTOR_ID)).rejects.toThrow(BadRequestException);
      expect(prisma.branch.update).not.toHaveBeenCalled();
    });
  });

  // ─── findAll() ─────────────────────────────────────────────────────────────

  describe("findAll()", () => {
    it("returns all branches for SUPER_ADMIN (no branch filter)", async () => {
      rbacService.getUserPermissions.mockResolvedValue({ roles: ["SUPER_ADMIN"], branchIds: [] });
      prisma.branch.findMany.mockResolvedValue([makeBranch(), makeBranch({ id: "branch-uuid-2", code: "LIM-02" })]);

      const result = await service.findAll(USER_ID);

      expect(result).toHaveLength(2);
      // SUPER_ADMIN gets an empty where clause → no users filter
      expect(prisma.branch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it("filters by user branches for non-admin users", async () => {
      rbacService.getUserPermissions.mockResolvedValue({ roles: ["PODOLOGIST"], branchIds: [BRANCH_ID] });
      prisma.branch.findMany.mockResolvedValue([makeBranch()]);

      const result = await service.findAll(USER_ID);

      expect(result).toHaveLength(1);
      // Non-admin: where includes users filter
      expect(prisma.branch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { users: { some: { userId: USER_ID } } },
        }),
      );
    });
  });
});

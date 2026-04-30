import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { ServicesService } from "./services.service";
import { createPrismaMock, PrismaMock } from "../../test/prisma.mock";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SERVICE_ID  = "svc-uuid-1";
const CATEGORY_ID = "cat-uuid-1";
const ACTOR_ID    = "user-uuid-1";
const BRANCH_ID   = "branch-uuid-1";

const makeService = (overrides: Partial<any> = {}) => ({
  id: SERVICE_ID,
  name: "Podología General",
  description: "Tratamiento básico",
  durationMinutes: 30,
  bufferMinutes: 5,
  basePrice: 80,
  isActive: true,
  allowSelfService: false,
  color: "#6B7280",
  imageData: null,
  imageMimeType: null,
  categoryId: CATEGORY_ID,
  internalCode: null,
  sunatProductCode: null,
  unitTypeCode: "ZZ",
  igvAffectationCode: "10",
  hasIgv: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  category: { id: CATEGORY_ID, name: "Podología", color: "#FF5733" },
  ...overrides,
});

const makeCategory = (overrides: Partial<any> = {}) => ({
  id: CATEGORY_ID,
  name: "Podología",
  color: "#FF5733",
  order: 1,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  _count: { services: 0 },
  ...overrides,
});

// ─── Mock cache ───────────────────────────────────────────────────────────────

const makeCacheMock = () => ({
  wrap: jest.fn().mockImplementation((_key: string, _ttl: number, fn: () => any) => fn()),
  delPattern: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ServicesService", () => {
  let svc: ServicesService;
  let prisma: PrismaMock;
  let cache: ReturnType<typeof makeCacheMock>;
  let auditService: { log: jest.Mock; getEntityHistory: jest.Mock };

  beforeEach(() => {
    prisma = createPrismaMock();

    // Add missing models not in base mock
    (prisma as any).serviceCategory = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    (prisma as any).branchServicePrice = {
      findMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    };
    (prisma as any).servicePriceHistory = {
      create: jest.fn(),
    };
    (prisma as any).serviceBranchPrice = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    };
    (prisma as any).saleItem = {
      ...(prisma as any).saleItem,
      aggregate: jest.fn().mockResolvedValue({ _sum: { subtotal: null }, _count: { id: 0 } }),
    };

    cache = makeCacheMock();
    auditService = { log: jest.fn(), getEntityHistory: jest.fn().mockResolvedValue([]) };

    svc = new ServicesService(prisma as any, cache as any, auditService as any);
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe("create()", () => {
    it("creates service with correct fields", async () => {
      (prisma as any).serviceCategory.findUnique.mockResolvedValue(makeCategory());
      prisma.service.create.mockResolvedValue(makeService());

      const dto = {
        name: "Podología General",
        durationMinutes: 30,
        basePrice: 80,
        categoryId: CATEGORY_ID,
      };

      const result = await svc.create(dto as any, ACTOR_ID);

      expect(prisma.service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Podología General",
            durationMinutes: 30,
            basePrice: 80,
            isActive: true,
          }),
        })
      );
      expect(result).toHaveProperty("id", SERVICE_ID);
      expect(result).toHaveProperty("name", "Podología General");
    });

    it("throws NotFoundException when categoryId does not exist", async () => {
      (prisma as any).serviceCategory.findUnique.mockResolvedValue(null);

      const dto = {
        name: "Podología General",
        durationMinutes: 30,
        basePrice: 80,
        categoryId: "nonexistent-cat",
      };

      await expect(svc.create(dto as any, ACTOR_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe("findAll()", () => {
    it("returns only active services when onlyActive=true", async () => {
      const activeService = makeService({ isActive: true });
      prisma.service.findMany.mockResolvedValue([activeService]);

      await svc.findAll(true);

      expect(prisma.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        })
      );
    });

    it("returns all services when onlyActive=false", async () => {
      prisma.service.findMany.mockResolvedValue([makeService(), makeService({ id: "svc-uuid-2", isActive: false })]);

      await svc.findAll(false);

      expect(prisma.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe("findOne()", () => {
    it("returns service with category and formatted fields", async () => {
      prisma.service.findUnique.mockResolvedValue(makeService());

      const result = await svc.findOne(SERVICE_ID);

      expect(result).toMatchObject({
        id: SERVICE_ID,
        name: "Podología General",
        category: { id: CATEGORY_ID, name: "Podología" },
      });
    });

    it("throws NotFoundException when service does not exist", async () => {
      prisma.service.findUnique.mockResolvedValue(null);

      await expect(svc.findOne("nonexistent")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe("update()", () => {
    it("updates service fields", async () => {
      const existing = makeService();
      const updated  = makeService({ name: "Podología Avanzada" });
      prisma.service.findUnique.mockResolvedValue(existing);
      prisma.service.update.mockResolvedValue(updated);

      const result = await svc.update(SERVICE_ID, { name: "Podología Avanzada" } as any, ACTOR_ID);

      expect(prisma.service.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SERVICE_ID },
          data: expect.objectContaining({ name: "Podología Avanzada" }),
        })
      );
      expect(result.name).toBe("Podología Avanzada");
    });

    it("throws NotFoundException when service not found", async () => {
      prisma.service.findUnique.mockResolvedValue(null);

      await expect(svc.update(SERVICE_ID, { name: "X" } as any, ACTOR_ID)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // ─── deactivate ───────────────────────────────────────────────────────────

  describe("deactivate()", () => {
    it("sets isActive=false when service has no future active appointments", async () => {
      prisma.service.findUnique.mockResolvedValue(makeService({ isActive: true }));
      prisma.appointment.count.mockResolvedValue(0);
      prisma.service.update.mockResolvedValue(makeService({ isActive: false }));

      const result = await svc.deactivate(SERVICE_ID, ACTOR_ID);

      expect(prisma.service.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SERVICE_ID },
          data: { isActive: false },
        })
      );
      expect(result.isActive).toBe(false);
    });

    it("throws BadRequestException when service has future active appointments", async () => {
      prisma.service.findUnique.mockResolvedValue(makeService({ isActive: true }));
      prisma.appointment.count.mockResolvedValue(3); // 3 active future appointments

      await expect(svc.deactivate(SERVICE_ID, ACTOR_ID)).rejects.toThrow(BadRequestException);
      await expect(svc.deactivate(SERVICE_ID, ACTOR_ID)).rejects.toThrow(
        /No se puede desactivar/
      );
    });

    it("throws NotFoundException when service does not exist", async () => {
      prisma.service.findUnique.mockResolvedValue(null);

      await expect(svc.deactivate(SERVICE_ID, ACTOR_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── activate ─────────────────────────────────────────────────────────────

  describe("activate()", () => {
    it("sets isActive=true", async () => {
      prisma.service.findUnique.mockResolvedValue(makeService({ isActive: false }));
      prisma.service.update.mockResolvedValue(makeService({ isActive: true }));

      const result = await svc.activate(SERVICE_ID, ACTOR_ID);

      expect(prisma.service.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SERVICE_ID },
          data: { isActive: true },
        })
      );
      expect(result.isActive).toBe(true);
    });

    it("throws NotFoundException when service does not exist", async () => {
      prisma.service.findUnique.mockResolvedValue(null);

      await expect(svc.activate(SERVICE_ID, ACTOR_ID)).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException when service is already active", async () => {
      prisma.service.findUnique.mockResolvedValue(makeService({ isActive: true }));

      await expect(svc.activate(SERVICE_ID, ACTOR_ID)).rejects.toThrow(BadRequestException);
    });
  });
});

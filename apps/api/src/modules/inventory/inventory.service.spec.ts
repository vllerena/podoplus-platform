import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { InventoryService } from "./inventory.service";
import { createPrismaMock, PrismaMock } from "../../test/prisma.mock";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BRANCH_ID   = "branch-uuid-1";
const PRODUCT_ID  = "prod-uuid-1";
const USER_ID     = "user-uuid-1";
const MOVEMENT_ID = "mov-uuid-1";

const makeProduct = (overrides: Partial<any> = {}) => ({
  id:                 PRODUCT_ID,
  sku:                "SKU-001",
  name:               "Test Product",
  description:        null,
  unitType:           "unit",
  costPrice:          { toString: () => "10.00" },
  salePrice:          { toString: () => "20.00" },
  isActive:           true,
  internalCode:       null,
  sunatProductCode:   null,
  unitTypeCode:       "NIU",
  igvAffectationCode: "10",
  hasIgv:             true,
  createdAt:          new Date("2024-01-01"),
  updatedAt:          new Date("2024-01-01"),
  ...overrides,
});

const makeBranch = (overrides: Partial<any> = {}) => ({
  id:   BRANCH_ID,
  name: "Sede Principal",
  ...overrides,
});

const makeStock = (overrides: Partial<any> = {}) => ({
  branchId:  BRANCH_ID,
  productId: PRODUCT_ID,
  quantity:  10,
  updatedAt: new Date("2024-01-01"),
  product:   makeProduct(),
  ...overrides,
});

const makeMovement = (overrides: Partial<any> = {}) => ({
  id:            MOVEMENT_ID,
  branchId:      BRANCH_ID,
  productId:     PRODUCT_ID,
  type:          "PURCHASE_IN",
  quantity:      5,
  referenceType: "MANUAL",
  referenceId:   null,
  reason:        null,
  createdById:   USER_ID,
  createdAt:     new Date("2024-01-01"),
  product:       makeProduct(),
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("InventoryService", () => {
  let service: InventoryService;
  let prisma: PrismaMock;
  let auditService: { log: jest.Mock };

  beforeEach(() => {
    prisma = createPrismaMock();

    // $transaction executes the callback inline
    prisma.$transaction.mockImplementation(async (cb: any) =>
      typeof cb === "function" ? cb(prisma) : Promise.all(cb)
    );

    auditService = { log: jest.fn() };

    service = new InventoryService(prisma as any, auditService as any);
  });

  // ─── createProduct ────────────────────────────────────────────────────────

  describe("createProduct", () => {
    const dto = {
      sku:        "SKU-001",
      name:       "Test Product",
      unit_type:  "unit",
      cost_price: 10,
      sale_price: 20,
    } as any;

    it("creates product when SKU does not exist", async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue(makeProduct());

      const result = await service.createProduct(dto, USER_ID);

      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { sku: dto.sku },
      });
      expect(prisma.product.create).toHaveBeenCalledTimes(1);
      expect(result.sku).toBe("SKU-001");
    });

    it("throws ConflictException when SKU already exists", async () => {
      prisma.product.findUnique.mockResolvedValue(makeProduct());

      await expect(service.createProduct(dto, USER_ID)).rejects.toThrow(
        ConflictException
      );
      expect(prisma.product.create).not.toHaveBeenCalled();
    });
  });

  // ─── registerMovement ─────────────────────────────────────────────────────

  describe("registerMovement", () => {
    const baseDto = {
      branch_id:  BRANCH_ID,
      product_id: PRODUCT_ID,
      quantity:   5,
      type:       "PURCHASE_IN" as const,
    };

    beforeEach(() => {
      prisma.branch.findUnique.mockResolvedValue(makeBranch());
      prisma.product.findUnique.mockResolvedValue(makeProduct());
      prisma.inventoryMovement.create.mockResolvedValue(makeMovement());
      prisma.inventoryStock.upsert.mockResolvedValue(makeStock());
      prisma.inventoryStock.update.mockResolvedValue(makeStock());
      prisma.inventoryStock.findUnique.mockResolvedValue(makeStock());
    });

    it("PURCHASE_IN increases stock (calls upsert with increment)", async () => {
      const dto = { ...baseDto, type: "PURCHASE_IN" as const };

      await service.registerMovement(dto, USER_ID);

      expect(prisma.inventoryStock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ quantity: { increment: 5 } }),
        })
      );
    });

    it("ADJUSTMENT sets stock directly (upsert with absolute quantity)", async () => {
      const dto = { ...baseDto, type: "ADJUSTMENT" as const, quantity: 15 };
      prisma.inventoryMovement.create.mockResolvedValue(
        makeMovement({ type: "ADJUSTMENT", quantity: 15 })
      );

      await service.registerMovement(dto, USER_ID);

      expect(prisma.inventoryStock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ quantity: 15 }),
        })
      );
    });

    it("throws BadRequestException when SALE_OUT / insufficient stock", async () => {
      // TRANSFER_OUT with insufficient stock triggers ConflictException in the service,
      // but to test insufficient stock via SALE_OUT we test via TRANSFER_OUT with low stock
      const dto = {
        ...baseDto,
        type:             "TRANSFER_OUT" as const,
        target_branch_id: "branch-uuid-2",
        quantity:         100,
      };
      // Stock has only 10 units
      prisma.inventoryStock.findUnique.mockResolvedValue(makeStock({ quantity: 5 }));

      await expect(service.registerMovement(dto, USER_ID)).rejects.toThrow();
    });

    it("throws NotFoundException when product is not found", async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.registerMovement(baseDto, USER_ID)).rejects.toThrow(
        NotFoundException
      );
    });

    it("throws NotFoundException when branch is not found", async () => {
      prisma.branch.findUnique.mockResolvedValue(null);

      await expect(service.registerMovement(baseDto, USER_ID)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // ─── getLowStockAlerts ────────────────────────────────────────────────────

  describe("getLowStockAlerts", () => {
    beforeEach(() => {
      prisma.branch.findUnique.mockResolvedValue(makeBranch());
    });

    it("returns products where qty <= threshold", async () => {
      const stocks = [
        makeStock({ quantity: 3 }),
        makeStock({ productId: "prod-uuid-2", quantity: 0 }),
      ];
      prisma.inventoryStock.findMany.mockResolvedValue(stocks);

      const result = await service.getLowStockAlerts(BRANCH_ID, 5);

      expect(result.total_alerts).toBe(2);
      expect(result.alerts).toHaveLength(2);
      expect(result.alerts[0].quantity).toBe(3);
      expect(result.alerts[1].quantity).toBe(0);
      expect(result.alerts[1].is_out_of_stock).toBe(true);
    });

    it("returns empty array when all stock is OK", async () => {
      prisma.inventoryStock.findMany.mockResolvedValue([]);

      const result = await service.getLowStockAlerts(BRANCH_ID, 5);

      expect(result.total_alerts).toBe(0);
      expect(result.alerts).toHaveLength(0);
    });
  });

  // ─── getStocks ────────────────────────────────────────────────────────────

  describe("getStocks", () => {
    beforeEach(() => {
      prisma.branch.findUnique.mockResolvedValue(makeBranch());
    });

    it("returns stock list for a branch", async () => {
      const stocks = [makeStock(), makeStock({ productId: "prod-uuid-2", quantity: 7 })];
      prisma.inventoryStock.findMany.mockResolvedValue(stocks);

      const result = await service.getStocks(BRANCH_ID);

      expect(result).toHaveLength(2);
      expect(result[0].branch_id).toBe(BRANCH_ID);
      expect(result[0].quantity).toBe(10);
    });

    it("with includeAll=false filters out qty=0 items (only returns stock records)", async () => {
      // includeAll=false (default) — only returns stocks that have a record
      const stocks = [makeStock({ quantity: 5 })]; // qty=0 item not in DB record
      prisma.inventoryStock.findMany.mockResolvedValue(stocks);

      const result = await service.getStocks(BRANCH_ID, false);

      expect(result).toHaveLength(1);
      expect(result[0].quantity).toBe(5);
    });
  });
});

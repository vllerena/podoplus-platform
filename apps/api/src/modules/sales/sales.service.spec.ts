import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { writeSunatSyncLog } from "./sunat-log";
import { SalesService } from "./sales.service";
import { createPrismaMock, PrismaMock } from "../../test/prisma.mock";
import { CreateSaleDto } from "./dto/create-sale.dto";

jest.mock("./sunat-log", () => ({
  writeSunatSyncLog: jest.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BRANCH_ID = "branch-uuid-1";
const CUSTOMER_ID = "cust-uuid-1";
const SALE_ID = "sale-uuid-1";
const USER_ID = "user-uuid-1";
const PRODUCT_ID_1 = "prod-uuid-1";
const PRODUCT_ID_2 = "prod-uuid-2";
const PRODUCT_ID_3 = "prod-uuid-3";
const SERVICE_ID = "svc-uuid-1";
const PLAN_ID = "plan-uuid-1";

const makeSale = (overrides: Partial<any> = {}) => ({
  id: SALE_ID,
  branchId: BRANCH_ID,
  customerId: CUSTOMER_ID,
  appointmentId: null,
  cashRegisterId: null,
  totalAmount: 100,
  discountAmount: 0,
  paymentMethod: "CASH",
  status: "PAID",
  voidReason: null,
  createdById: USER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [],
  ...overrides,
});

const makeSaleItem = (overrides: Partial<any> = {}) => ({
  id: "item-uuid-1",
  saleId: SALE_ID,
  itemType: "PRODUCT",
  productId: PRODUCT_ID_1,
  serviceId: null,
  planId: null,
  quantity: 2,
  unitPrice: 50,
  subtotal: 100,
  ...overrides,
});

const makeProductItems = (
  ids: string[],
  qty = 1,
  price = 50,
): CreateSaleDto["items"] =>
  ids.map((id) => ({
    item_type: "PRODUCT" as const,
    product_id: id,
    quantity: qty,
    unit_price: price,
  }));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SalesService", () => {
  let service: SalesService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();

    // $transaction executes the callback inline
    prisma.$transaction.mockImplementation(async (cb: any) =>
      typeof cb === "function" ? cb(prisma) : Promise.all(cb),
    );

    service = new SalesService(prisma as any);
  });

  // ─── createSale — branch / customer / appointment validations ─────────────

  describe("createSale — pre-validation", () => {
    it("throws NotFoundException when the branch does not exist", async () => {
      prisma.branch.findUnique.mockResolvedValue(null);

      const dto = {
        branch_id: BRANCH_ID,
        items: [],
        payment_method: "CASH",
      } as any;

      await expect(service.createSale(dto, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws NotFoundException when the customer does not exist", async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID });
      prisma.customer.findUnique.mockResolvedValue(null);

      const dto = {
        branch_id: BRANCH_ID,
        customer_id: CUSTOMER_ID,
        items: [],
        payment_method: "CASH",
      } as any;

      await expect(service.createSale(dto, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ConflictException when the appointment already has a sale", async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID });
      prisma.appointment.findUnique.mockResolvedValue({
        id: "apt-uuid-1",
        sale: { id: "existing-sale" }, // already linked
      });

      const dto = {
        branch_id: BRANCH_ID,
        appointment_id: "apt-uuid-1",
        items: [],
        payment_method: "CASH",
      } as any;

      await expect(service.createSale(dto, USER_ID)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─── createSale — validateItems ───────────────────────────────────────────

  describe("createSale — item validation", () => {
    it("throws BadRequestException when a PRODUCT item has no product_id", async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID });

      const dto = {
        branch_id: BRANCH_ID,
        items: [{ item_type: "PRODUCT", quantity: 1, unit_price: 10 }],
        payment_method: "CASH",
      } as any;

      await expect(service.createSale(dto, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws NotFoundException when a product is not found in the DB", async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID });
      // findMany returns only one of the two requested products
      prisma.product.findMany.mockResolvedValue([
        { id: PRODUCT_ID_1, isActive: true },
        // PRODUCT_ID_2 is missing
      ]);

      const dto = {
        branch_id: BRANCH_ID,
        items: makeProductItems([PRODUCT_ID_1, PRODUCT_ID_2]),
        payment_method: "CASH",
      } as any;

      await expect(service.createSale(dto, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws NotFoundException when a product exists but is inactive", async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID });
      prisma.product.findMany.mockResolvedValue([
        { id: PRODUCT_ID_1, isActive: false },
      ]);

      const dto = {
        branch_id: BRANCH_ID,
        items: makeProductItems([PRODUCT_ID_1]),
        payment_method: "CASH",
      } as any;

      await expect(service.createSale(dto, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    /**
     * Critical N+1 regression test.
     * With 3 products in the cart, validateItems must issue exactly ONE
     * product.findMany (with `id: { in: [...] }`) — not 3 individual findUnique calls.
     */
    it("validates all PRODUCT items with a single batch query (N+1 fix)", async () => {
      const ids = [PRODUCT_ID_1, PRODUCT_ID_2, PRODUCT_ID_3];

      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID });
      prisma.customer.findUnique.mockResolvedValue({ id: CUSTOMER_ID });
      prisma.cashRegister.findFirst.mockResolvedValue(null);

      // Return all 3 products as active
      prisma.product.findMany.mockResolvedValue(
        ids.map((id) => ({ id, isActive: true })),
      );

      const sale = makeSale({
        items: ids.map((id) =>
          makeSaleItem({
            id: `item-${id}`,
            productId: id,
            quantity: 1,
            unitPrice: 50,
            subtotal: 50,
          }),
        ),
      });
      prisma.sale.create.mockResolvedValue(sale);
      // Inventory checks inside $transaction
      prisma.inventoryStock.findUnique.mockResolvedValue({ quantity: 10 });
      prisma.inventoryStock.update.mockResolvedValue({});
      prisma.inventoryMovement.create.mockResolvedValue({});

      const dto: CreateSaleDto = {
        branch_id: BRANCH_ID,
        customer_id: CUSTOMER_ID,
        items: makeProductItems(ids, 1, 50),
        payment_method: "CARD",
      };

      await service.createSale(dto, USER_ID);

      // product.findMany should be called exactly ONCE for the entire cart
      expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { id: { in: ids } },
      });
    });
  });

  // ─── createSale — total calculation ──────────────────────────────────────

  describe("createSale — total amount calculation", () => {
    const setupPassingValidation = (ids: string[]) => {
      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID });
      prisma.customer.findUnique.mockResolvedValue({ id: CUSTOMER_ID });
      prisma.cashRegister.findFirst.mockResolvedValue(null);
      prisma.product.findMany.mockResolvedValue(
        ids.map((id) => ({ id, isActive: true })),
      );
      prisma.inventoryStock.findUnique.mockResolvedValue({ quantity: 10 });
      prisma.inventoryStock.update.mockResolvedValue({});
      prisma.inventoryMovement.create.mockResolvedValue({});
    };

    it("computes totalAmount = sum(unit_price * qty) - discount", async () => {
      // 2 × 50 + 1 × 30 = 130 - 10 discount = 120
      const ids = [PRODUCT_ID_1, PRODUCT_ID_2];
      setupPassingValidation(ids);

      const sale = makeSale({ totalAmount: 120, discountAmount: 10 });
      prisma.sale.create.mockResolvedValue(sale);

      const dto: CreateSaleDto = {
        branch_id: BRANCH_ID,
        customer_id: CUSTOMER_ID,
        discount_amount: 10,
        items: [
          {
            item_type: "PRODUCT",
            product_id: PRODUCT_ID_1,
            quantity: 2,
            unit_price: 50,
          },
          {
            item_type: "PRODUCT",
            product_id: PRODUCT_ID_2,
            quantity: 1,
            unit_price: 30,
          },
        ],
        payment_method: "CARD",
      };

      await service.createSale(dto, USER_ID);

      const createCall = prisma.sale.create.mock.calls[0][0] as any;
      expect(createCall.data.totalAmount).toBe(120); // (2*50 + 1*30) - 10
      expect(createCall.data.discountAmount).toBe(10);
    });

    it("clamps totalAmount to 0 when discount exceeds the subtotal", async () => {
      setupPassingValidation([PRODUCT_ID_1]);
      prisma.sale.create.mockResolvedValue(
        makeSale({ totalAmount: 0, discountAmount: 200 }),
      );

      const dto: CreateSaleDto = {
        branch_id: BRANCH_ID,
        customer_id: CUSTOMER_ID,
        discount_amount: 200, // larger than 50 total
        items: [
          {
            item_type: "PRODUCT",
            product_id: PRODUCT_ID_1,
            quantity: 1,
            unit_price: 50,
          },
        ],
        payment_method: "CARD",
      };

      await service.createSale(dto, USER_ID);

      const createCall = prisma.sale.create.mock.calls[0][0] as any;
      expect(createCall.data.totalAmount).toBe(0); // Math.max(0, ...)
    });
  });

  // ─── createSale — inventory movements ────────────────────────────────────

  describe("createSale — inventory movements", () => {
    it("creates an inventory movement for each PRODUCT item sold", async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID });
      prisma.customer.findUnique.mockResolvedValue({ id: CUSTOMER_ID });
      prisma.cashRegister.findFirst.mockResolvedValue(null);
      prisma.product.findMany.mockResolvedValue([
        { id: PRODUCT_ID_1, isActive: true },
        { id: PRODUCT_ID_2, isActive: true },
      ]);
      prisma.inventoryStock.findUnique.mockResolvedValue({ quantity: 10 });
      prisma.inventoryStock.update.mockResolvedValue({});
      prisma.inventoryMovement.create.mockResolvedValue({});

      const saleItems = [
        makeSaleItem({ id: "i1", productId: PRODUCT_ID_1 }),
        makeSaleItem({ id: "i2", productId: PRODUCT_ID_2 }),
      ];
      prisma.sale.create.mockResolvedValue(makeSale({ items: saleItems }));

      const dto: CreateSaleDto = {
        branch_id: BRANCH_ID,
        customer_id: CUSTOMER_ID,
        items: makeProductItems([PRODUCT_ID_1, PRODUCT_ID_2]),
        payment_method: "CARD",
      };

      await service.createSale(dto, USER_ID);

      // One inventory movement per product item
      expect(prisma.inventoryMovement.create).toHaveBeenCalledTimes(2);
      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: "SALE_OUT" }),
        }),
      );
    });

    it("throws ConflictException when stock is insufficient for a product", async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_ID });
      prisma.customer.findUnique.mockResolvedValue({ id: CUSTOMER_ID });
      prisma.cashRegister.findFirst.mockResolvedValue(null);
      prisma.product.findMany.mockResolvedValue([
        { id: PRODUCT_ID_1, isActive: true },
      ]);
      prisma.sale.create.mockResolvedValue(
        makeSale({ items: [makeSaleItem()] }),
      );
      // Only 1 unit in stock, but requesting 5
      prisma.inventoryStock.findUnique.mockResolvedValue({ quantity: 1 });

      const dto: CreateSaleDto = {
        branch_id: BRANCH_ID,
        customer_id: CUSTOMER_ID,
        items: [
          {
            item_type: "PRODUCT",
            product_id: PRODUCT_ID_1,
            quantity: 5,
            unit_price: 50,
          },
        ],
        payment_method: "CARD",
      };

      await expect(service.createSale(dto, USER_ID)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─── voidSale ─────────────────────────────────────────────────────────────

  describe("voidSale", () => {
    it("throws NotFoundException when the sale does not exist", async () => {
      prisma.sale.findUnique.mockResolvedValue(null);

      await expect(
        service.voidSale(SALE_ID, { reason: "Error" }, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException when the sale is not in PAID status", async () => {
      prisma.sale.findUnique.mockResolvedValue(
        makeSale({ status: "VOIDED", items: [] }),
      );

      await expect(
        service.voidSale(SALE_ID, { reason: "Error" }, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it("voids the sale and restores inventory for each PRODUCT item", async () => {
      const items = [
        makeSaleItem({ id: "i1", productId: PRODUCT_ID_1, quantity: 2 }),
        makeSaleItem({ id: "i2", productId: PRODUCT_ID_2, quantity: 1 }),
      ];
      const sale = makeSale({ paymentMethod: "CARD", items });
      const voided = { ...sale, status: "VOIDED", voidReason: "Error" };

      prisma.sale.findUnique.mockResolvedValue(sale);
      prisma.cashRegister.findFirst.mockResolvedValue(null); // no open register
      prisma.sale.update.mockResolvedValue(voided);
      prisma.inventoryStock.update.mockResolvedValue({});
      prisma.inventoryMovement.create.mockResolvedValue({});

      const result = await service.voidSale(
        SALE_ID,
        { reason: "Error" },
        USER_ID,
      );

      expect(result.status).toBe("VOIDED");
      // One RETURN_IN inventory movement per product item
      expect(prisma.inventoryMovement.create).toHaveBeenCalledTimes(2);
      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: "RETURN_IN" }),
        }),
      );
    });
  });

  // ─── refundSale ───────────────────────────────────────────────────────────

  describe("refundSale", () => {
    it("throws NotFoundException when the sale does not exist", async () => {
      prisma.sale.findUnique.mockResolvedValue(null);

      await expect(
        service.refundSale(
          SALE_ID,
          { amount: 50, reason: "Devolución" },
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException when refund amount exceeds the sale total", async () => {
      prisma.sale.findUnique.mockResolvedValue(
        makeSale({ totalAmount: 100, items: [] }),
      );

      await expect(
        service.refundSale(
          SALE_ID,
          { amount: 150, reason: "Devolución" },
          USER_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("refunds a PAID sale successfully", async () => {
      const sale = makeSale({ totalAmount: 100, items: [] });
      const refunded = { ...sale, status: "REFUNDED" };

      prisma.sale.findUnique.mockResolvedValue(sale);
      prisma.cashRegister.findFirst.mockResolvedValue(null);
      prisma.sale.update.mockResolvedValue(refunded);

      const result = await service.refundSale(
        SALE_ID,
        { amount: 50, reason: "Devolución parcial" },
        USER_ID,
      );

      expect(result.status).toBe("REFUNDED");
    });
  });

  describe("simulateSunatDocumentSync", () => {
    it("writes a SUNAT sync log and returns a confirmed response for a PAID sale", async () => {
      const sale = makeSale({
        status: "PAID",
        items: [makeSaleItem()],
        customer: {
          id: CUSTOMER_ID,
          firstName: "Juan",
          lastName: "Perez",
          documentType: "1",
          documentNumber: "12345678",
        },
      });

      prisma.sale.findUnique.mockResolvedValue(sale as any);

      const result = await service.simulateSunatDocumentSync(SALE_ID, "03");

      expect(writeSunatSyncLog).toHaveBeenCalledTimes(1);
      expect(result.response.status).toBe("CONFIRMED");
      expect(result.response.sunatDocumentNumber).toMatch(/^B001-/);
      expect(result.payload.tipoDocumento).toBe("03");
    });

    it("throws NotFoundException when the sale does not exist", async () => {
      prisma.sale.findUnique.mockResolvedValue(null);

      await expect(
        service.simulateSunatDocumentSync(SALE_ID, "01"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException when the sale is not PAID", async () => {
      const sale = makeSale({ status: "VOIDED", items: [] });
      prisma.sale.findUnique.mockResolvedValue(sale as any);

      await expect(
        service.simulateSunatDocumentSync(SALE_ID, "01"),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

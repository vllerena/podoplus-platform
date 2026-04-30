import { NotFoundException } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { createPrismaMock, PrismaMock } from "../../test/prisma.mock";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BRANCH_ID = "branch-uuid-1";

const makeBranch = (overrides: Partial<any> = {}) => ({
  id: BRANCH_ID,
  name: "Sede Principal",
  defaultCapacity: 2,
  ...overrides,
});

const makeAppointment = (overrides: Partial<any> = {}) => ({
  id: "appt-uuid-1",
  branchId: BRANCH_ID,
  serviceId: "svc-uuid-1",
  customerId: "cust-uuid-1",
  status: "COMPLETED",
  source: "RECEPTION",
  startAt: new Date(Date.UTC(2026, 0, 2, 10, 0, 0)),
  endAt: new Date(Date.UTC(2026, 0, 2, 11, 0, 0)),
  cancelReason: null,
  service: { id: "svc-uuid-1", name: "Podología" },
  customer: { id: "cust-uuid-1", firstName: "Ana", lastName: "López", createdAt: new Date(Date.UTC(2026, 0, 2)), phone: "999000111" },
  ...overrides,
});

const makeSale = (overrides: Partial<any> = {}) => ({
  id: "sale-uuid-1",
  branchId: BRANCH_ID,
  status: "PAID",
  totalAmount: 100,
  discountAmount: 0,
  refundAmount: null,
  paymentMethod: "CASH",
  createdAt: new Date(Date.UTC(2026, 0, 2, 10, 0, 0)),
  items: [],
  customer: null,
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ReportsService", () => {
  let service: ReportsService;
  let prisma: PrismaMock;

  const FROM = new Date(Date.UTC(2026, 0, 1));
  const TO = new Date(Date.UTC(2026, 0, 3));

  beforeEach(() => {
    prisma = createPrismaMock();

    // Add missing models not in base mock
    (prisma as any).sale.aggregate = jest.fn();
    (prisma as any).saleItem.aggregate = jest.fn();

    service = new ReportsService(prisma as any);
  });

  // ─── getDashboardReport ────────────────────────────────────────────────────

  describe("getDashboardReport", () => {
    beforeEach(() => {
      prisma.branch.findUnique.mockResolvedValue(makeBranch());
      prisma.appointment.findMany.mockResolvedValue([
        makeAppointment({ status: "COMPLETED" }),
        makeAppointment({ status: "NO_SHOW" }),
        makeAppointment({ status: "CANCELED" }),
      ]);
      prisma.sale.findMany.mockResolvedValue([
        makeSale({ status: "PAID", totalAmount: 150 }),
      ]);
      prisma.customerSubscription.count.mockResolvedValue(5);
      (prisma.inventoryStock as any).count = jest.fn().mockResolvedValue(2);
    });

    it("returns dashboard object with correct structure (appointments, revenue, subscriptions, lowStock)", async () => {
      const result = await service.getDashboardReport(BRANCH_ID, FROM, TO);

      expect(result).toHaveProperty("branch_id", BRANCH_ID);
      expect(result).toHaveProperty("branch_name", "Sede Principal");
      expect(result).toHaveProperty("appointments");
      expect(result).toHaveProperty("sales");
      expect(result).toHaveProperty("subscriptions");
      expect(result).toHaveProperty("inventory");

      expect(result.appointments).toMatchObject({
        total: 3,
        completed: 1,
        no_show: 1,
        canceled: 1,
      });
      expect(result.sales).toHaveProperty("total_revenue");
      expect(result.subscriptions).toHaveProperty("active_count", 5);
      expect(result.inventory).toHaveProperty("low_stock_count", 2);
    });

    it("queries prisma with correct from/to date params", async () => {
      await service.getDashboardReport(BRANCH_ID, FROM, TO);

      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branchId: BRANCH_ID,
            startAt: { gte: FROM, lte: TO },
          }),
        })
      );
      expect(prisma.sale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branchId: BRANCH_ID,
            createdAt: { gte: FROM, lte: TO },
          }),
        })
      );
    });

    it("returns correct count of days in period via daily_occupancy (dateRange UTC fix)", async () => {
      // getDashboardReport does not return daily_occupancy; use getOperationsReport
      // to indirectly test dateRange. FROM=Jan 1, TO=Jan 3 → 3 days.
      prisma.appointment.findMany.mockResolvedValue([]);
      const ops = await service.getOperationsReport(BRANCH_ID, FROM, TO);
      // daily_occupancy should have exactly 3 entries
      expect(ops.daily_occupancy).toHaveLength(3);
      expect(ops.daily_occupancy[0].date).toBe("2026-01-01");
      expect(ops.daily_occupancy[1].date).toBe("2026-01-02");
      expect(ops.daily_occupancy[2].date).toBe("2026-01-03");
    });
  });

  // ─── getOperationsReport ───────────────────────────────────────────────────

  describe("getOperationsReport", () => {
    it("returns operations data with correct structure", async () => {
      prisma.branch.findUnique.mockResolvedValue(makeBranch());
      prisma.appointment.findMany.mockResolvedValue([
        makeAppointment({ status: "COMPLETED", source: "RECEPTION" }),
        makeAppointment({ id: "appt-uuid-2", status: "NO_SHOW", source: "PORTAL" }),
      ]);

      const result = await service.getOperationsReport(BRANCH_ID, FROM, TO);

      expect(result).toHaveProperty("branch_id", BRANCH_ID);
      expect(result).toHaveProperty("branch_name");
      expect(result).toHaveProperty("period");
      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("rates");
      expect(result).toHaveProperty("by_source");
      expect(result).toHaveProperty("top_services");
      expect(result).toHaveProperty("daily_occupancy");

      expect(result.summary).toMatchObject({
        total_appointments: 2,
        completed: 1,
        no_show: 1,
      });

      expect(result.rates).toHaveProperty("completion_rate_pct");
      expect(result.rates).toHaveProperty("no_show_rate_pct");
    });

    it("throws NotFoundException when branch does not exist", async () => {
      prisma.branch.findUnique.mockResolvedValue(null);

      await expect(service.getOperationsReport(BRANCH_ID, FROM, TO)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // ─── getSalesReport ────────────────────────────────────────────────────────

  describe("getSalesReport", () => {
    it("returns sales data with revenue breakdown", async () => {
      prisma.branch.findUnique.mockResolvedValue(makeBranch());
      prisma.sale.findMany.mockResolvedValue([
        makeSale({
          status: "PAID",
          totalAmount: 200,
          paymentMethod: "CASH",
          items: [
            {
              id: "item-1",
              itemType: "PRODUCT",
              productId: "prod-1",
              serviceId: null,
              quantity: 2,
              subtotal: 200,
              product: { id: "prod-1", name: "Crema podológica" },
              service: null,
              plan: null,
            },
          ],
        }),
        makeSale({
          id: "sale-uuid-2",
          status: "REFUNDED",
          totalAmount: 50,
          refundAmount: 50,
          paymentMethod: "CARD",
          items: [],
        }),
      ]);

      const result = await service.getSalesReport(BRANCH_ID, FROM, TO);

      expect(result).toHaveProperty("branch_id", BRANCH_ID);
      expect(result).toHaveProperty("period");
      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("payment_breakdown");
      expect(result).toHaveProperty("top_products");
      expect(result).toHaveProperty("top_services");
      expect(result).toHaveProperty("daily_revenue");

      expect(result.summary).toMatchObject({
        total_transactions: 1,
        refunded_count: 1,
        total_revenue: "200.00",
        total_refunded: "50.00",
        net_revenue: "150.00",
      });

      // payment_breakdown must include CASH entry
      const cashEntry = result.payment_breakdown.find((p: any) => p.method === "CASH");
      expect(cashEntry).toBeDefined();
      expect(cashEntry?.count).toBe(1);
    });

    it("throws NotFoundException when branch does not exist", async () => {
      prisma.branch.findUnique.mockResolvedValue(null);

      await expect(service.getSalesReport(BRANCH_ID, FROM, TO)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // ─── formatDate UTC fix — tested indirectly ───────────────────────────────

  describe("formatDate (UTC, via getDashboardReport period field)", () => {
    it("formats Date created with Date.UTC as YYYY-MM-DD with no timezone drift", async () => {
      prisma.branch.findUnique.mockResolvedValue(makeBranch());
      prisma.appointment.findMany.mockResolvedValue([]);
      prisma.sale.findMany.mockResolvedValue([]);
      prisma.customerSubscription.count.mockResolvedValue(0);
      (prisma.inventoryStock as any).count = jest.fn().mockResolvedValue(0);

      // Use UTC midnight dates — these should never drift to a different day
      const fromUtc = new Date(Date.UTC(2026, 0, 1));  // 2026-01-01T00:00:00Z
      const toUtc   = new Date(Date.UTC(2026, 0, 3));  // 2026-01-03T00:00:00Z

      const result = await service.getDashboardReport(BRANCH_ID, fromUtc, toUtc);

      expect(result.period.from).toBe("2026-01-01");
      expect(result.period.to).toBe("2026-01-03");
    });
  });
});

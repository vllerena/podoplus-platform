import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PlansService } from "./plans.service";
import { createPrismaMock, PrismaMock } from "../../test/prisma.mock";
import { CacheService } from "../cache/cache.service";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CUSTOMER_ID = "cust-uuid-1";
const PLAN_ID = "plan-uuid-1";
const BRANCH_ID = "branch-uuid-1";
const SUB_ID = "sub-uuid-1";
const USER_ID = "user-uuid-1";

const makePlan = (overrides: Partial<any> = {}) => ({
  id: PLAN_ID,
  name: "Plan Mensual",
  description: null,
  planType: "SESSION",
  price: 150,
  durationDays: 30,
  includedSessions: 8,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeCustomer = () => ({
  id: CUSTOMER_ID,
  firstName: "María",
  lastName: "García",
});

const makeBranch = () => ({ id: BRANCH_ID, name: "Sede Central" });

const makeSubscription = (overrides: Partial<any> = {}) => {
  const startDate = new Date("2025-06-01");
  const endDate = new Date("2025-07-01");
  return {
    id: SUB_ID,
    customerId: CUSTOMER_ID,
    planId: PLAN_ID,
    branchId: BRANCH_ID,
    status: "ACTIVE",
    startDate,
    endDate,
    remainingSessions: 8,
    cancelReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    plan: makePlan(),
    customer: makeCustomer(),
    consumptions: [],
    ...overrides,
  };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PlansService", () => {
  let service: PlansService;
  let prisma: PrismaMock;
  let cache: jest.Mocked<Pick<CacheService, "wrap" | "delPattern" | "get" | "set" | "del">>;

  beforeEach(() => {
    prisma = createPrismaMock();

    prisma.$transaction.mockImplementation(async (cb: any) =>
      typeof cb === "function" ? cb(prisma) : Promise.all(cb)
    );

    // CacheService mock: wrap() ejecuta el callback directamente (sin caché real)
    cache = {
      wrap: jest.fn().mockImplementation((_key: string, _ttl: number, fn: () => Promise<any>) => fn()),
      delPattern: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    service = new PlansService(prisma as any, cache as any);
  });

  // ─── assignSubscription ───────────────────────────────────────────────────

  describe("assignSubscription", () => {
    const dto = {
      customer_id: CUSTOMER_ID,
      plan_id: PLAN_ID,
      branch_id: BRANCH_ID,
    };

    it("throws NotFoundException when the customer does not exist", async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      prisma.plan.findUnique.mockResolvedValue(makePlan());
      prisma.branch.findUnique.mockResolvedValue(makeBranch());

      await expect(service.assignSubscription(dto, USER_ID)).rejects.toThrow(
        NotFoundException
      );
    });

    it("throws NotFoundException when the plan is not found", async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer());
      prisma.plan.findUnique.mockResolvedValue(null);
      prisma.branch.findUnique.mockResolvedValue(makeBranch());

      await expect(service.assignSubscription(dto, USER_ID)).rejects.toThrow(
        NotFoundException
      );
    });

    it("throws NotFoundException when the plan is inactive", async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer());
      prisma.plan.findUnique.mockResolvedValue(makePlan({ isActive: false }));
      prisma.branch.findUnique.mockResolvedValue(makeBranch());

      await expect(service.assignSubscription(dto, USER_ID)).rejects.toThrow(
        NotFoundException
      );
    });

    it("throws NotFoundException when the branch does not exist", async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer());
      prisma.plan.findUnique.mockResolvedValue(makePlan());
      prisma.branch.findUnique.mockResolvedValue(null);

      await expect(service.assignSubscription(dto, USER_ID)).rejects.toThrow(
        NotFoundException
      );
    });

    it("throws ConflictException when customer already has an ACTIVE subscription to this plan", async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer());
      prisma.plan.findUnique.mockResolvedValue(makePlan());
      prisma.branch.findUnique.mockResolvedValue(makeBranch());
      prisma.customerSubscription.findFirst.mockResolvedValue(makeSubscription());

      await expect(service.assignSubscription(dto, USER_ID)).rejects.toThrow(
        ConflictException
      );
    });

    it("creates subscription with correct endDate (startDate + plan.durationDays)", async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer());
      prisma.plan.findUnique.mockResolvedValue(makePlan({ durationDays: 30 }));
      prisma.branch.findUnique.mockResolvedValue(makeBranch());
      prisma.customerSubscription.findFirst.mockResolvedValue(null);
      prisma.customerSubscription.create.mockResolvedValue(makeSubscription());

      // Provide an explicit start date
      const startDate = "2025-08-01";
      await service.assignSubscription({ ...dto, start_date: startDate }, USER_ID);

      const createCall = prisma.customerSubscription.create.mock.calls[0][0] as any;
      const expectedStart = new Date(startDate);
      expectedStart.setUTCHours(0, 0, 0, 0);
      const expectedEnd = new Date(expectedStart);
      expectedEnd.setUTCDate(expectedEnd.getUTCDate() + 30);

      expect(createCall.data.startDate).toEqual(expectedStart);
      expect(createCall.data.endDate).toEqual(expectedEnd);
    });

    it("performs customer/plan/branch lookups in parallel (Promise.all)", async () => {
      // All three findUnique calls should resolve concurrently.
      // We verify this by checking all three mocks were called exactly once.
      prisma.customer.findUnique.mockResolvedValue(makeCustomer());
      prisma.plan.findUnique.mockResolvedValue(makePlan());
      prisma.branch.findUnique.mockResolvedValue(makeBranch());
      prisma.customerSubscription.findFirst.mockResolvedValue(null);
      prisma.customerSubscription.create.mockResolvedValue(makeSubscription());

      await service.assignSubscription(dto, USER_ID);

      expect(prisma.customer.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.plan.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.branch.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  // ─── consumeSession ───────────────────────────────────────────────────────

  describe("consumeSession", () => {
    const dto = { appointment_id: undefined };

    it("throws NotFoundException when the subscription does not exist", async () => {
      prisma.customerSubscription.findUnique.mockResolvedValue(null);

      await expect(service.consumeSession(SUB_ID, dto, USER_ID)).rejects.toThrow(
        NotFoundException
      );
    });

    it("throws BadRequestException when the subscription is not ACTIVE", async () => {
      prisma.customerSubscription.findUnique.mockResolvedValue(
        makeSubscription({ status: "CANCELED" })
      );

      await expect(service.consumeSession(SUB_ID, dto, USER_ID)).rejects.toThrow(
        BadRequestException
      );
    });

    it("throws BadRequestException when a DATE plan subscription has expired", async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday
      prisma.customerSubscription.findUnique.mockResolvedValue(
        makeSubscription({
          plan: makePlan({ planType: "DATE", includedSessions: 9999 }),
          endDate: expiredDate,
        })
      );
      prisma.customerSubscription.update.mockResolvedValue({});

      await expect(service.consumeSession(SUB_ID, dto, USER_ID)).rejects.toThrow(
        BadRequestException
      );
    });

    it("throws BadRequestException when a SESSION plan has 0 remaining sessions", async () => {
      prisma.customerSubscription.findUnique.mockResolvedValue(
        makeSubscription({ remainingSessions: 0 })
      );

      await expect(service.consumeSession(SUB_ID, dto, USER_ID)).rejects.toThrow(
        BadRequestException
      );
    });

    it("decrements remainingSessions by 1 for a SESSION plan", async () => {
      const sub = makeSubscription({ remainingSessions: 5 });
      const updated = { ...sub, remainingSessions: 4 };

      prisma.customerSubscription.findUnique.mockResolvedValue(sub);
      prisma.subscriptionConsumption.create.mockResolvedValue({});
      prisma.customerSubscription.update.mockResolvedValue({ ...updated, plan: makePlan() });

      await service.consumeSession(SUB_ID, dto, USER_ID);

      expect(prisma.customerSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SUB_ID },
          data: expect.objectContaining({
            remainingSessions: 4, // 5 - 1
            status: "ACTIVE",
          }),
        })
      );
    });

    it("sets status to EXPIRED when the last SESSION is consumed", async () => {
      const sub = makeSubscription({ remainingSessions: 1 }); // last session
      const expired = { ...sub, remainingSessions: 0, status: "EXPIRED" };

      prisma.customerSubscription.findUnique.mockResolvedValue(sub);
      prisma.subscriptionConsumption.create.mockResolvedValue({});
      prisma.customerSubscription.update.mockResolvedValue({ ...expired, plan: makePlan() });

      await service.consumeSession(SUB_ID, dto, USER_ID);

      expect(prisma.customerSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            remainingSessions: 0,
            status: "EXPIRED",
          }),
        })
      );
    });

    it("does NOT decrement sessions for a DATE plan (unlimited)", async () => {
      const futureDateEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
      const sub = makeSubscription({
        plan: makePlan({ planType: "DATE", includedSessions: 9999 }),
        endDate: futureDateEnd,
        remainingSessions: 9999,
      });

      prisma.customerSubscription.findUnique.mockResolvedValue(sub);
      prisma.subscriptionConsumption.create.mockResolvedValue({});
      prisma.customerSubscription.update.mockResolvedValue({ ...sub, plan: sub.plan });

      await service.consumeSession(SUB_ID, dto, USER_ID);

      const updateCall = prisma.customerSubscription.update.mock.calls[0][0] as any;
      // For DATE plans, remainingSessions stays at 9999 (sentinel)
      expect(updateCall.data.remainingSessions).toBe(9999);
      expect(updateCall.data.status).toBe("ACTIVE");
    });
  });

  // ─── getCustomerSubscriptions ─────────────────────────────────────────────

  describe("getCustomerSubscriptions", () => {
    it("throws NotFoundException when the customer does not exist", async () => {
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.getCustomerSubscriptions(CUSTOMER_ID)).rejects.toThrow(
        NotFoundException
      );
    });

    /**
     * Critical N+1 regression test.
     * The service must expire overdue subscriptions with a SINGLE updateMany call,
     * NOT with individual update calls per subscription.
     */
    it("expires overdue subscriptions with one updateMany call (N+1 fix)", async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer());
      prisma.customerSubscription.updateMany.mockResolvedValue({ count: 3 });
      prisma.customerSubscription.findMany.mockResolvedValue([]);

      await service.getCustomerSubscriptions(CUSTOMER_ID);

      // updateMany called exactly once for all expired subscriptions
      expect(prisma.customerSubscription.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.customerSubscription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId: CUSTOMER_ID,
            status: "ACTIVE",
            endDate: { lt: expect.any(Date) },
          }),
          data: { status: "EXPIRED" },
        })
      );
    });

    it("returns all subscriptions for the customer after expiry sync", async () => {
      const subs = [makeSubscription(), makeSubscription({ id: "sub-uuid-2", status: "EXPIRED" })];

      prisma.customer.findUnique.mockResolvedValue(makeCustomer());
      prisma.customerSubscription.updateMany.mockResolvedValue({ count: 0 });
      prisma.customerSubscription.findMany.mockResolvedValue(subs);

      const result = await service.getCustomerSubscriptions(CUSTOMER_ID);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(SUB_ID);
    });
  });

  // ─── createPlan ───────────────────────────────────────────────────────────

  describe("createPlan", () => {
    it("sets includedSessions to 9999 (sentinel) for DATE plans", async () => {
      const plan = makePlan({ planType: "DATE", includedSessions: 9999 });
      prisma.plan.create.mockResolvedValue(plan);

      await service.createPlan(
        {
          name: "Plan Anual",
          plan_type: "DATE",
          price: 500,
          duration_days: 365,
        },
        USER_ID
      );

      const createCall = prisma.plan.create.mock.calls[0][0] as any;
      expect(createCall.data.includedSessions).toBe(9999);
    });

    it("uses dto.included_sessions for SESSION plans", async () => {
      const plan = makePlan({ planType: "SESSION", includedSessions: 10 });
      prisma.plan.create.mockResolvedValue(plan);

      await service.createPlan(
        {
          name: "Plan 10 Sesiones",
          plan_type: "SESSION",
          price: 200,
          duration_days: 90,
          included_sessions: 10,
        },
        USER_ID
      );

      const createCall = prisma.plan.create.mock.calls[0][0] as any;
      expect(createCall.data.includedSessions).toBe(10);
    });
  });

  // ─── cancelSubscription ───────────────────────────────────────────────────

  describe("cancelSubscription", () => {
    it("throws NotFoundException when the subscription does not exist", async () => {
      prisma.customerSubscription.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelSubscription(SUB_ID, { reason: "Ya no necesito" }, USER_ID)
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException when the subscription is already CANCELED", async () => {
      prisma.customerSubscription.findUnique.mockResolvedValue(
        makeSubscription({ status: "CANCELED" })
      );

      await expect(
        service.cancelSubscription(SUB_ID, { reason: "Ya no necesito" }, USER_ID)
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when the subscription is already EXPIRED", async () => {
      prisma.customerSubscription.findUnique.mockResolvedValue(
        makeSubscription({ status: "EXPIRED" })
      );

      await expect(
        service.cancelSubscription(SUB_ID, { reason: "Ya no necesito" }, USER_ID)
      ).rejects.toThrow(BadRequestException);
    });

    it("cancels an ACTIVE subscription and records the reason", async () => {
      const sub = makeSubscription();
      const canceled = { ...sub, status: "CANCELED", cancelReason: "Ya no necesito" };

      prisma.customerSubscription.findUnique.mockResolvedValue(sub);
      prisma.customerSubscription.update.mockResolvedValue({ ...canceled, plan: makePlan() });

      const result = await service.cancelSubscription(
        SUB_ID,
        { reason: "Ya no necesito" },
        USER_ID
      );

      expect(result.status).toBe("CANCELED");
      expect(result.cancel_reason).toBe("Ya no necesito");
    });
  });
});

import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { CustomersService } from "./customers.service";
import { createPrismaMock, PrismaMock } from "../../test/prisma.mock";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CUSTOMER_ID   = "cust-uuid-1";
const DUPLICATE_ID  = "cust-uuid-2";
const ACTOR_ID      = "user-uuid-1";

const makeCustomer = (overrides: Partial<any> = {}) => ({
  id:             CUSTOMER_ID,
  firstName:      "Ana",
  lastName:       "García",
  documentType:   null,
  documentNumber: null,
  phone:          null,
  email:          null,
  birthDate:      null,
  gender:         null,
  notes:          null,
  whatsappOptIn:  false,
  selfRegistered: false,
  avatarData:     null,
  avatarMimeType: null,
  familyHeadId:   null,
  familyHead:     null,
  deletedAt:      null,
  tagAssignments: [],
  createdAt:      new Date("2024-01-01T00:00:00.000Z"),
  updatedAt:      new Date("2024-01-01T00:00:00.000Z"),
  ...overrides,
});

// Extend prisma mock with models not defined in createPrismaMock
const extendPrismaWithCustomerModels = (prisma: PrismaMock) => {
  const extended = prisma as any;

  if (!extended.customerNote) {
    extended.customerNote = {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
  }

  if (!extended.customerTag) {
    extended.customerTag = {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
  }

  if (!extended.customerTagAssignment) {
    extended.customerTagAssignment = {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    };
  }

  if (!extended.whatsappMessageLog) {
    extended.whatsappMessageLog = {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    };
  }

  // $queryRaw for getCustomerBirthdays
  extended.$queryRaw = jest.fn().mockResolvedValue([]);

  return extended;
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CustomersService", () => {
  let service:      CustomersService;
  let prisma:       PrismaMock & any;
  let auditService: { log: jest.Mock };

  beforeEach(() => {
    prisma = createPrismaMock();
    extendPrismaWithCustomerModels(prisma);
    auditService = { log: jest.fn() };

    // $transaction executes the callback inline
    prisma.$transaction.mockImplementation(async (cb: any) =>
      typeof cb === "function" ? cb(prisma) : Promise.all(cb),
    );

    service = new CustomersService(prisma as any, auditService as any);
  });

  // ─── createCustomer() ──────────────────────────────────────────────────────

  describe("createCustomer()", () => {
    const dto = {
      firstName: "Ana",
      lastName:  "García",
    };

    it("creates a customer — prisma.customer.create is called", async () => {
      prisma.customer.create.mockResolvedValue(makeCustomer());

      await service.createCustomer(dto as any, ACTOR_ID);

      expect(prisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            firstName: dto.firstName,
            lastName:  dto.lastName,
          }),
        }),
      );
    });

    it("throws ConflictException when document number already exists in an active customer", async () => {
      const dtoWithDoc = { ...dto, documentNumber: "12345678" };
      prisma.customer.findUnique.mockResolvedValue(makeCustomer({ documentNumber: "12345678", deletedAt: null }));

      await expect(service.createCustomer(dtoWithDoc as any, ACTOR_ID)).rejects.toThrow(ConflictException);
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });
  });

  // ─── parseDateOnly() — UTC fix (tested indirectly via createCustomer) ──────

  describe("parseDateOnly() — UTC midnight, no timezone drift", () => {
    it("stores birthDate as UTC midnight when a date string YYYY-MM-DD is provided", async () => {
      const dto = {
        firstName: "Ana",
        lastName:  "García",
        birthDate: "1990-05-15",
      };

      prisma.customer.create.mockResolvedValue(makeCustomer({ birthDate: new Date("1990-05-15T00:00:00.000Z") }));

      await service.createCustomer(dto as any, ACTOR_ID);

      const createCall = prisma.customer.create.mock.calls[0][0] as any;
      const storedDate: Date = createCall.data.birthDate;

      expect(storedDate).toBeInstanceOf(Date);
      expect(storedDate.getUTCFullYear()).toBe(1990);
      expect(storedDate.getUTCMonth()).toBe(4);   // May = 4 (0-indexed)
      expect(storedDate.getUTCDate()).toBe(15);
      expect(storedDate.getUTCHours()).toBe(0);    // no local timezone offset
    });
  });

  // ─── calculateAge() — UTC fix (tested indirectly) ─────────────────────────

  describe("calculateAge() — via formatCustomer", () => {
    it("returns a reasonable non-negative age based on UTC methods", async () => {
      const birthDate = new Date("1990-01-01T00:00:00.000Z");
      const customerWithBirth = makeCustomer({ birthDate });

      // getCustomerById uses customer.findFirst
      prisma.customer.findFirst.mockResolvedValue({
        ...customerWithBirth,
        familyMembers:  [],
        appointments:   [],
        subscriptions:  [],
        tagAssignments: [],
      });

      const result = await service.getCustomerById(CUSTOMER_ID);

      // Age must be a non-negative number consistent with birth year 1990
      expect(typeof result.age).toBe("number");
      expect(result.age).toBeGreaterThanOrEqual(0);
      // In 2024+ the age must be at least 34
      expect(result.age).toBeGreaterThanOrEqual(34);
    });
  });

  // ─── mergeCustomers() ──────────────────────────────────────────────────────

  describe("mergeCustomers()", () => {
    const survivorCustomer  = makeCustomer({ id: CUSTOMER_ID,  firstName: "Ana",  lastName: "García" });
    const duplicateCustomer = makeCustomer({ id: DUPLICATE_ID, firstName: "Ana",  lastName: "Garcia" });

    it("reassigns appointments, sales, subscriptions from duplicate to survivor", async () => {
      prisma.customer.findFirst
        .mockResolvedValueOnce(survivorCustomer)   // survivor lookup
        .mockResolvedValueOnce(duplicateCustomer); // duplicate lookup

      // Inside $transaction — add updateMany to appointment/sale if not present in base mock
      prisma.customer.updateMany.mockResolvedValue({ count: 0 });
      (prisma.appointment as any).updateMany = jest.fn().mockResolvedValue({ count: 2 });
      (prisma.sale as any).updateMany = jest.fn().mockResolvedValue({ count: 1 });
      prisma.customerSubscription.updateMany.mockResolvedValue({ count: 0 });
      prisma.whatsappMessageLog.updateMany.mockResolvedValue({ count: 0 });
      (prisma as any).customerNote = (prisma as any).customerNote ?? {};
      (prisma as any).customerNote.updateMany = jest.fn().mockResolvedValue({ count: 0 });
      prisma.customerTagAssignment.findMany.mockResolvedValue([]);
      prisma.customerTagAssignment.deleteMany.mockResolvedValue({ count: 0 });
      prisma.customer.update.mockResolvedValue({ ...duplicateCustomer, deletedAt: new Date() });

      // After merge, getCustomerById is called for the survivor
      prisma.customer.findFirst.mockResolvedValueOnce({
        ...survivorCustomer,
        familyMembers:  [],
        appointments:   [],
        subscriptions:  [],
        tagAssignments: [],
      });

      await service.mergeCustomers(CUSTOMER_ID, DUPLICATE_ID, ACTOR_ID);

      expect(prisma.appointment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customerId: DUPLICATE_ID },
          data:  { customerId: CUSTOMER_ID },
        }),
      );
      expect(prisma.sale.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customerId: DUPLICATE_ID },
          data:  { customerId: CUSTOMER_ID },
        }),
      );
      expect(prisma.customerSubscription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customerId: DUPLICATE_ID },
          data:  { customerId: CUSTOMER_ID },
        }),
      );
    });

    it("throws NotFoundException when survivor does not exist", async () => {
      prisma.customer.findFirst
        .mockResolvedValueOnce(null)               // survivor not found
        .mockResolvedValueOnce(duplicateCustomer);

      await expect(
        service.mergeCustomers(CUSTOMER_ID, DUPLICATE_ID, ACTOR_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException when duplicate does not exist", async () => {
      prisma.customer.findFirst
        .mockResolvedValueOnce(survivorCustomer)
        .mockResolvedValueOnce(null);              // duplicate not found

      await expect(
        service.mergeCustomers(CUSTOMER_ID, DUPLICATE_ID, ACTOR_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException when trying to merge a customer with itself", async () => {
      await expect(
        service.mergeCustomers(CUSTOMER_ID, CUSTOMER_ID, ACTOR_ID),
      ).rejects.toThrow(BadRequestException);

      // No DB calls should be made before the self-merge guard
      expect(prisma.customer.findFirst).not.toHaveBeenCalled();
    });
  });

  // ─── deleteCustomer() — soft delete ───────────────────────────────────────

  describe("deleteCustomer()", () => {
    it("sets deletedAt to a non-null Date (soft delete)", async () => {
      prisma.customer.findFirst.mockResolvedValue(makeCustomer());
      const deletedCustomer = makeCustomer({ deletedAt: new Date() });
      prisma.customer.update.mockResolvedValue(deletedCustomer);

      await service.deleteCustomer(CUSTOMER_ID, ACTOR_ID);

      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CUSTOMER_ID },
          data:  expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });

    it("throws NotFoundException when customer does not exist", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.deleteCustomer(CUSTOMER_ID, ACTOR_ID)).rejects.toThrow(NotFoundException);
      expect(prisma.customer.update).not.toHaveBeenCalled();
    });
  });

  // ─── restoreCustomer() ─────────────────────────────────────────────────────

  describe("restoreCustomer()", () => {
    it("clears deletedAt (sets it to null) on restore", async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer({ deletedAt: new Date() }));
      prisma.customer.update.mockResolvedValue(makeCustomer({ deletedAt: null }));

      await service.restoreCustomer(CUSTOMER_ID, ACTOR_ID);

      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CUSTOMER_ID },
          data:  { deletedAt: null },
        }),
      );
    });

    it("throws NotFoundException when customer does not exist", async () => {
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.restoreCustomer(CUSTOMER_ID, ACTOR_ID)).rejects.toThrow(NotFoundException);
      expect(prisma.customer.update).not.toHaveBeenCalled();
    });
  });

  // ─── getCustomerBirthdays() — Lima UTC fix ─────────────────────────────────

  describe("getCustomerBirthdays()", () => {
    it("uses Lima wall-clock (UTC-5) for default month and calls prisma.$queryRaw", async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      // No month param — service computes month from Lima time
      const result = await service.getCustomerBirthdays();

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result).toHaveProperty("month");
      expect(result.month).toBeGreaterThanOrEqual(1);
      expect(result.month).toBeLessThanOrEqual(12);
      expect(result).toHaveProperty("data");
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("does not throw and calls prisma.$queryRaw when an explicit month is provided", async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getCustomerBirthdays(3);

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result.month).toBe(3);
    });

    it("throws BadRequestException when month is out of range", async () => {
      await expect(service.getCustomerBirthdays(13)).rejects.toThrow(BadRequestException);
      await expect(service.getCustomerBirthdays(0)).rejects.toThrow(BadRequestException);
    });
  });
});

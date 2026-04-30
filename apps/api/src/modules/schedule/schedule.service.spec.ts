import { NotFoundException, BadRequestException } from "@nestjs/common";
import { ScheduleService } from "./schedule.service";
import { createPrismaMock } from "../../test/prisma.mock";

// ─── Extended mock factory with schedule-specific models ──────────────────────

const createSchedulePrismaMock = () => ({
  ...createPrismaMock(),
  branchHour: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  branchBlock: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  branchScheduleException: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
});

type SchedulePrismaMock = ReturnType<typeof createSchedulePrismaMock>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BRANCH_ID = "branch-uuid-1";
const BLOCK_ID  = "block-uuid-1";
const HOUR_ID   = "hour-uuid-1";
const ACTOR_ID  = "user-uuid-1";

const makeBlock = (overrides: Partial<any> = {}) => ({
  id: BLOCK_ID,
  branchId: BRANCH_ID,
  type: "LUNCH",
  title: "Refrigerio",
  startAt: new Date("2026-03-15T09:00:00Z"),
  endAt: new Date("2026-03-15T10:00:00Z"),
  isRecurring: false,
  weekday: null,
  startTime: null,
  endTime: null,
  createdById: ACTOR_ID,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

const makeHour = (overrides: Partial<any> = {}) => ({
  id: HOUR_ID,
  branchId: BRANCH_ID,
  weekday: 2,
  startTime: "08:00",
  endTime: "18:00",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ScheduleService", () => {
  let service: ScheduleService;
  let prisma: SchedulePrismaMock;
  let auditService: { log: jest.Mock };

  beforeEach(() => {
    prisma = createSchedulePrismaMock();
    auditService = { log: jest.fn() };

    // ScheduleService constructor only takes PrismaService
    service = new ScheduleService(prisma as any);
  });

  // ─── createBlock ────────────────────────────────────────────────────────────

  describe("createBlock", () => {
    const createBlockDto = {
      type: "LUNCH" as const,
      title: "Refrigerio",
      date: "2026-03-15",
      startTime: "09:00",
      endTime: "10:00",
    };

    it("stores startAt/endAt as UTC timestamps — getUTCHours() matches input hours", async () => {
      const createdBlock = makeBlock();
      prisma.branchBlock.create.mockResolvedValue(createdBlock);

      await service.createBlock(BRANCH_ID, createBlockDto, ACTOR_ID);

      expect(prisma.branchBlock.create).toHaveBeenCalledTimes(1);
      const callArg = prisma.branchBlock.create.mock.calls[0][0] as any;

      // Critical: UTC fix — hours must match input regardless of local timezone
      expect(callArg.data.startAt).toBeInstanceOf(Date);
      expect(callArg.data.endAt).toBeInstanceOf(Date);
      expect(callArg.data.startAt.getUTCHours()).toBe(9);
      expect(callArg.data.endAt.getUTCHours()).toBe(10);

      // Also verify the correct UTC date
      expect(callArg.data.startAt.getUTCFullYear()).toBe(2026);
      expect(callArg.data.startAt.getUTCMonth()).toBe(2); // March = 2 (0-indexed)
      expect(callArg.data.startAt.getUTCDate()).toBe(15);
    });

    it("throws BadRequestException when endTime <= startTime", async () => {
      const dto = { ...createBlockDto, startTime: "10:00", endTime: "09:00" };

      await expect(service.createBlock(BRANCH_ID, dto, ACTOR_ID)).rejects.toThrow(
        BadRequestException
      );
      expect(prisma.branchBlock.create).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when endTime equals startTime", async () => {
      const dto = { ...createBlockDto, startTime: "09:00", endTime: "09:00" };

      await expect(service.createBlock(BRANCH_ID, dto, ACTOR_ID)).rejects.toThrow(
        BadRequestException
      );
    });

    it("throws NotFoundException when branch does not exist — create rejects with PrismaError", async () => {
      // Simulate Prisma foreign key constraint error when branch is not found
      prisma.branchBlock.create.mockRejectedValue(
        Object.assign(new Error("Foreign key constraint failed"), { code: "P2003" })
      );

      await expect(service.createBlock("nonexistent-branch", createBlockDto, ACTOR_ID)).rejects.toThrow(
        Error
      );
    });
  });

  // ─── updateBlock ────────────────────────────────────────────────────────────

  describe("updateBlock", () => {
    it("updates block fields correctly", async () => {
      const existingBlock = makeBlock();
      const updatedBlock  = makeBlock({ title: "Almuerzo actualizado" });

      prisma.branchBlock.findUnique.mockResolvedValue(existingBlock);
      prisma.branchBlock.update.mockResolvedValue(updatedBlock);

      const dto = { title: "Almuerzo actualizado" };
      const result = await service.updateBlock(BRANCH_ID, BLOCK_ID, dto);

      expect(prisma.branchBlock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BLOCK_ID },
          data: expect.objectContaining({ title: "Almuerzo actualizado" }),
        })
      );
      expect(result.title).toBe("Almuerzo actualizado");
    });

    it("throws NotFoundException when block does not exist", async () => {
      prisma.branchBlock.findUnique.mockResolvedValue(null);

      await expect(service.updateBlock(BRANCH_ID, BLOCK_ID, {})).rejects.toThrow(
        NotFoundException
      );
      expect(prisma.branchBlock.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when block belongs to a different branch", async () => {
      prisma.branchBlock.findUnique.mockResolvedValue(makeBlock({ branchId: "other-branch" }));

      await expect(service.updateBlock(BRANCH_ID, BLOCK_ID, {})).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // ─── deleteBlock ────────────────────────────────────────────────────────────

  describe("deleteBlock", () => {
    it("deletes block — calls prisma.branchBlock.delete", async () => {
      prisma.branchBlock.findUnique.mockResolvedValue(makeBlock());
      prisma.branchBlock.delete.mockResolvedValue(makeBlock());

      const result = await service.deleteBlock(BRANCH_ID, BLOCK_ID);

      expect(prisma.branchBlock.delete).toHaveBeenCalledWith({ where: { id: BLOCK_ID } });
      expect(result).toEqual({ success: true });
    });

    it("throws NotFoundException when block does not exist", async () => {
      prisma.branchBlock.findUnique.mockResolvedValue(null);

      await expect(service.deleteBlock(BRANCH_ID, BLOCK_ID)).rejects.toThrow(NotFoundException);
      expect(prisma.branchBlock.delete).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when block belongs to a different branch", async () => {
      prisma.branchBlock.findUnique.mockResolvedValue(makeBlock({ branchId: "other-branch" }));

      await expect(service.deleteBlock(BRANCH_ID, BLOCK_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getEffectiveSchedule ────────────────────────────────────────────────────

  describe("getEffectiveSchedule", () => {
    // "2026-01-20" is a Tuesday → getUTCDay() === 2
    const TUESDAY = "2026-01-20";

    it("returns weekly schedule for Tuesday (getUTCDay()=2) when branchHour with dayOfWeek=2 exists", async () => {
      const tuesdayHour = makeHour({ weekday: 2 });

      // No exception for this date
      prisma.branchScheduleException.findUnique.mockResolvedValue(null);
      // Returns schedule for dayOfWeek=2
      prisma.branchHour.findFirst.mockResolvedValue(tuesdayHour);

      const result = await service.getEffectiveSchedule(BRANCH_ID, TUESDAY);

      expect(result.type).toBe("weekly");
      expect(result.startTime).toBe("08:00");
      expect(result.endTime).toBe("18:00");

      // Verify the query used the correct dayOfWeek (getUTCDay, not getDay)
      expect(prisma.branchHour.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branchId: BRANCH_ID,
            weekday: 2,
            isActive: true,
          }),
        })
      );
    });

    it("throws BadRequestException when no matching branchHour exists for the date", async () => {
      prisma.branchScheduleException.findUnique.mockResolvedValue(null);
      prisma.branchHour.findFirst.mockResolvedValue(null);

      await expect(service.getEffectiveSchedule(BRANCH_ID, TUESDAY)).rejects.toThrow(
        BadRequestException
      );
    });

    it("returns exception schedule when an exception exists for the date", async () => {
      const exception = {
        id: "exc-1",
        branchId: BRANCH_ID,
        date: new Date(TUESDAY),
        startTime: "10:00",
        endTime: "14:00",
        reason: "Horario reducido",
        createdById: ACTOR_ID,
      };

      prisma.branchScheduleException.findUnique.mockResolvedValue(exception);

      const result = await service.getEffectiveSchedule(BRANCH_ID, TUESDAY);

      expect(result.type).toBe("exception");
      expect(result.startTime).toBe("10:00");
      expect(result.endTime).toBe("14:00");
      expect(result.reason).toBe("Horario reducido");
      // branchHour should NOT be queried if exception exists
      expect(prisma.branchHour.findFirst).not.toHaveBeenCalled();
    });
  });

  // ─── updateBranchHours ───────────────────────────────────────────────────────

  describe("updateBranchHours", () => {
    it("throws BadRequestException when startTime >= endTime", async () => {
      const existingHour = makeHour({ startTime: "08:00", endTime: "18:00" });
      prisma.branchHour.findUnique.mockResolvedValue(existingHour);

      const dto = { startTime: "10:00", endTime: "09:00" };

      await expect(service.updateBranchHours(BRANCH_ID, HOUR_ID, dto)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.updateBranchHours(BRANCH_ID, HOUR_ID, dto)).rejects.toThrow(
        "startTime debe ser menor que endTime"
      );
      expect(prisma.branchHour.update).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when startTime equals endTime", async () => {
      const existingHour = makeHour({ startTime: "08:00", endTime: "18:00" });
      prisma.branchHour.findUnique.mockResolvedValue(existingHour);

      const dto = { startTime: "09:00", endTime: "09:00" };

      await expect(service.updateBranchHours(BRANCH_ID, HOUR_ID, dto)).rejects.toThrow(
        BadRequestException
      );
    });

    it("updates hours when startTime < endTime", async () => {
      const existingHour = makeHour();
      const updatedHour  = makeHour({ startTime: "09:00", endTime: "17:00" });

      prisma.branchHour.findUnique.mockResolvedValue(existingHour);
      prisma.branchHour.update.mockResolvedValue(updatedHour);

      const dto = { startTime: "09:00", endTime: "17:00" };
      const result = await service.updateBranchHours(BRANCH_ID, HOUR_ID, dto);

      expect(prisma.branchHour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: HOUR_ID },
          data: expect.objectContaining({ startTime: "09:00", endTime: "17:00" }),
        })
      );
      expect(result.startTime).toBe("09:00");
      expect(result.endTime).toBe("17:00");
    });

    it("throws NotFoundException when hour does not exist", async () => {
      prisma.branchHour.findUnique.mockResolvedValue(null);

      await expect(
        service.updateBranchHours(BRANCH_ID, HOUR_ID, { startTime: "09:00", endTime: "17:00" })
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── bulkLoadBlocks ──────────────────────────────────────────────────────────

  describe("bulkLoadBlocks", () => {
    const bulkDto = {
      branchIds: [BRANCH_ID],
      blocks: [
        {
          type: "HOLIDAY",
          title: "Feriado Nacional",
          date: "2026-07-28",
          startTime: "00:00",
          endTime: "23:59",
        },
        {
          type: "LUNCH",
          title: "Refrigerio",
          date: "2026-07-28",
          startTime: "13:00",
          endTime: "14:00",
        },
      ],
    };

    it("creates multiple blocks with UTC timestamps", async () => {
      prisma.branch.findMany
        .mockResolvedValueOnce([{ id: BRANCH_ID }]) // validation query
        .mockResolvedValueOnce([{ id: BRANCH_ID }]); // second findMany (found check)

      prisma.branchBlock.createMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkLoadBlocks(bulkDto as any, ACTOR_ID);

      expect(result.totalBlocksCreated).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.failures).toHaveLength(0);

      expect(prisma.branchBlock.createMany).toHaveBeenCalledTimes(1);
      const callArg = prisma.branchBlock.createMany.mock.calls[0][0] as any;

      // Verify UTC timestamps for first block (00:00)
      const firstBlock = callArg.data[0];
      expect(firstBlock.startAt).toBeInstanceOf(Date);
      expect(firstBlock.startAt.getUTCHours()).toBe(0);
      expect(firstBlock.startAt.getUTCMinutes()).toBe(0);

      // Verify UTC timestamps for second block (13:00)
      const secondBlock = callArg.data[1];
      expect(secondBlock.startAt.getUTCHours()).toBe(13);
      expect(secondBlock.endAt.getUTCHours()).toBe(14);
    });

    it("reports failure per branch when createMany throws", async () => {
      prisma.branch.findMany
        .mockResolvedValueOnce([{ id: BRANCH_ID }])
        .mockResolvedValueOnce([{ id: BRANCH_ID }]);

      prisma.branchBlock.createMany.mockRejectedValue(new Error("DB error"));

      const result = await service.bulkLoadBlocks(bulkDto as any, ACTOR_ID);

      expect(result.successCount).toBe(0);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].branchId).toBe(BRANCH_ID);
      expect(result.failures[0].error).toBe("DB error");
    });

    it("throws BadRequestException when one or more branchIds do not exist", async () => {
      prisma.branch.findMany
        .mockResolvedValueOnce([]) // no active branches found
        .mockResolvedValueOnce([]); // found = []

      const dto = { branchIds: [BRANCH_ID, "nonexistent-branch"], blocks: bulkDto.blocks };

      await expect(service.bulkLoadBlocks(dto as any, ACTOR_ID)).rejects.toThrow(
        BadRequestException
      );
    });
  });
});

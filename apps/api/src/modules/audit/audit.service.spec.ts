import { AuditService } from "./audit.service";
import { createPrismaMock, PrismaMock } from "../../test/prisma.mock";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BRANCH_ID = "branch-uuid-1";
const ACTOR_ID  = "user-uuid-1";
const LOG_ID_1  = "log-uuid-1";
const LOG_ID_2  = "log-uuid-2";

const makeAuditLogParams = (overrides: Partial<any> = {}) => ({
  actorType: "USER" as const,
  actorId: ACTOR_ID,
  branchId: BRANCH_ID,
  action: "appointment.created",
  entityType: "appointment",
  entityId: "apt-uuid-1",
  reason: undefined,
  metadata: undefined,
  ...overrides,
});

const makeDbLog = (overrides: Partial<any> = {}) => ({
  id: LOG_ID_1,
  actorType: "USER",
  actorId: ACTOR_ID,
  actor: { firstName: "Juan", lastName: "Pérez", email: "j@test.com" },
  branchId: BRANCH_ID,
  action: "appointment.created",
  entityType: "appointment",
  entityId: "apt-uuid-1",
  reason: null,
  metadataJson: null,
  createdAt: new Date("2026-01-01T10:00:00Z"),
  ...overrides,
});

// ─── Helper: flush all microtasks (fire-and-forget promises) ──────────────────
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AuditService", () => {
  let service: AuditService;
  let prisma: PrismaMock;
  let queuePublisher: { publishAuditLog: jest.Mock };

  beforeEach(() => {
    prisma = createPrismaMock();
  });

  // ─── log() — fire and forget ─────────────────────────────────────────────

  describe("log()", () => {
    it("calls queuePublisher.publishAuditLog when QueuePublisher is available", async () => {
      queuePublisher = { publishAuditLog: jest.fn().mockResolvedValue(undefined) };
      service = new AuditService(prisma as any, queuePublisher as any);

      const params = makeAuditLogParams();
      service.log(params);

      await flushPromises();

      expect(queuePublisher.publishAuditLog).toHaveBeenCalledTimes(1);
      expect(queuePublisher.publishAuditLog).toHaveBeenCalledWith(params);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it("calls prisma.auditLog.create directly when QueuePublisher is unavailable (undefined)", async () => {
      service = new AuditService(prisma as any, undefined);
      prisma.auditLog.create.mockResolvedValue({});

      const params = makeAuditLogParams();
      service.log(params);

      await flushPromises();

      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    });

    it("falls back to prisma.auditLog.create when queue.publishAuditLog rejects", async () => {
      queuePublisher = {
        publishAuditLog: jest.fn().mockRejectedValue(new Error("Queue unavailable")),
      };
      service = new AuditService(prisma as any, queuePublisher as any);
      prisma.auditLog.create.mockResolvedValue({});

      const params = makeAuditLogParams();
      service.log(params);

      await flushPromises();

      expect(queuePublisher.publishAuditLog).toHaveBeenCalledTimes(1);
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    });
  });

  // ─── persist() — testable via log() when no queue ────────────────────────

  describe("persist() — via log() with no queue", () => {
    beforeEach(() => {
      service = new AuditService(prisma as any, undefined);
      prisma.auditLog.create.mockResolvedValue({});
    });

    it("calls prisma.auditLog.create with correctly mapped fields", async () => {
      const params = makeAuditLogParams({
        actorType: "USER",
        actorId: ACTOR_ID,
        branchId: BRANCH_ID,
        action: "sale.created",
        entityType: "sale",
        entityId: "sale-uuid-1",
        reason: "Venta manual",
        metadata: { total: 150 },
      });

      service.log(params);
      await flushPromises();

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorType: "USER",
          actorId: ACTOR_ID,
          branchId: BRANCH_ID,
          action: "sale.created",
          entityType: "sale",
          entityId: "sale-uuid-1",
          reason: "Venta manual",
          metadataJson: { total: 150 },
        },
      });
    });

    it("maps undefined actorId to null", async () => {
      const params = makeAuditLogParams({ actorType: "SYSTEM", actorId: undefined });

      service.log(params);
      await flushPromises();

      const callArg = prisma.auditLog.create.mock.calls[0][0] as any;
      expect(callArg.data.actorId).toBeNull();
    });

    it("maps undefined branchId to null", async () => {
      const params = makeAuditLogParams({ branchId: undefined });

      service.log(params);
      await flushPromises();

      const callArg = prisma.auditLog.create.mock.calls[0][0] as any;
      expect(callArg.data.branchId).toBeNull();
    });

    it("maps undefined reason to null", async () => {
      const params = makeAuditLogParams({ reason: undefined });

      service.log(params);
      await flushPromises();

      const callArg = prisma.auditLog.create.mock.calls[0][0] as any;
      expect(callArg.data.reason).toBeNull();
    });
  });

  // ─── getLogs() — offset pagination ───────────────────────────────────────

  describe("getLogs() — offset pagination", () => {
    beforeEach(() => {
      service = new AuditService(prisma as any, undefined);
    });

    it("returns { total, limit, offset, nextCursor, data } in offset mode", async () => {
      const dbLog = makeDbLog();
      prisma.auditLog.findMany.mockResolvedValue([dbLog]);
      prisma.auditLog.count.mockResolvedValue(1);

      const result = await service.getLogs({ limit: 50 });

      expect(result).toMatchObject({
        total: 1,
        limit: 50,
        offset: 0,
        data: expect.arrayContaining([
          expect.objectContaining({ id: LOG_ID_1 }),
        ]),
      });
    });

    it("nextCursor is the last item id when results fill the limit", async () => {
      const logs = Array.from({ length: 50 }, (_, i) =>
        makeDbLog({ id: `log-${i}` })
      );
      prisma.auditLog.findMany.mockResolvedValue(logs);
      prisma.auditLog.count.mockResolvedValue(100);

      const result = await service.getLogs({ limit: 50 });

      expect(result.nextCursor).toBe("log-49");
    });

    it("nextCursor is null when results are fewer than limit", async () => {
      const logs = [makeDbLog({ id: LOG_ID_1 }), makeDbLog({ id: LOG_ID_2 })];
      prisma.auditLog.findMany.mockResolvedValue(logs);
      prisma.auditLog.count.mockResolvedValue(2);

      const result = await service.getLogs({ limit: 50 });

      expect(result.nextCursor).toBeNull();
    });

    it("passes offset and limit to prisma.findMany", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.getLogs({ limit: 20, offset: 40 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 40,
        })
      );
    });

    it("caps limit at 200 even if a larger value is requested", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.getLogs({ limit: 500 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 })
      );
    });

    it("formats each log entry with correct field mapping", async () => {
      const dbLog = makeDbLog({
        id: LOG_ID_1,
        actorType: "USER",
        actorId: ACTOR_ID,
        actor: { firstName: "Juan", lastName: "Pérez", email: "j@test.com" },
        branchId: null,
        action: "appointment.created",
        entityType: "appointment",
        entityId: "apt-1",
        reason: null,
        metadataJson: null,
        createdAt: new Date("2026-01-01T10:00:00Z"),
      });

      prisma.auditLog.findMany.mockResolvedValue([dbLog]);
      prisma.auditLog.count.mockResolvedValue(1);

      const result = await service.getLogs({});

      expect(result.data[0]).toMatchObject({
        id: LOG_ID_1,
        actor_type: "USER",
        actor_id: ACTOR_ID,
        actor_name: "Juan Pérez",
        action: "appointment.created",
        entity_type: "appointment",
        entity_id: "apt-1",
        created_at: "2026-01-01T10:00:00.000Z",
      });
      // branch_id should be undefined (not null) when branchId is null
      expect(result.data[0].branch_id).toBeUndefined();
    });
  });

  // ─── getLogs() — cursor pagination ───────────────────────────────────────

  describe("getLogs() — cursor pagination", () => {
    beforeEach(() => {
      service = new AuditService(prisma as any, undefined);
    });

    it("passes cursor + skip:1 to prisma.findMany when cursor is provided", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.getLogs({ cursor: LOG_ID_1, limit: 20 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: LOG_ID_1 },
          skip: 1,
          take: 21, // limit + 1 to check hasMore
        })
      );
      // count should NOT be called in cursor mode
      expect(prisma.auditLog.count).not.toHaveBeenCalled();
    });

    it("returns { total: null, offset: null } in cursor mode", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getLogs({ cursor: LOG_ID_1 });

      expect(result.total).toBeNull();
      expect(result.offset).toBeNull();
    });

    it("slices to limit and sets nextCursor when logs.length === limit+1 (hasMore)", async () => {
      const LIMIT = 3;
      // Return limit+1 items to simulate hasMore=true
      const logs = Array.from({ length: LIMIT + 1 }, (_, i) =>
        makeDbLog({ id: `log-${i}` })
      );
      prisma.auditLog.findMany.mockResolvedValue(logs);

      const result = await service.getLogs({ cursor: "some-cursor", limit: LIMIT });

      // Should slice to exactly `limit` items
      expect(result.data).toHaveLength(LIMIT);
      // nextCursor should be the id of the LAST item in the sliced page (index limit-1)
      expect(result.nextCursor).toBe(`log-${LIMIT - 1}`);
    });

    it("returns nextCursor null and full data when logs.length <= limit", async () => {
      const logs = [makeDbLog({ id: LOG_ID_1 }), makeDbLog({ id: LOG_ID_2 })];
      prisma.auditLog.findMany.mockResolvedValue(logs);

      const result = await service.getLogs({ cursor: "some-cursor", limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.nextCursor).toBeNull();
    });
  });

  // ─── getEntityHistory() ───────────────────────────────────────────────────

  describe("getEntityHistory()", () => {
    beforeEach(() => {
      service = new AuditService(prisma as any, undefined);
    });

    it("returns ordered audit entries for entityType+entityId", async () => {
      const log1 = makeDbLog({
        id: LOG_ID_1,
        entityType: "appointment",
        entityId: "apt-uuid-1",
        action: "appointment.created",
        createdAt: new Date("2026-01-01T08:00:00Z"),
      });
      const log2 = makeDbLog({
        id: LOG_ID_2,
        entityType: "appointment",
        entityId: "apt-uuid-1",
        action: "appointment.confirmed",
        createdAt: new Date("2026-01-01T09:00:00Z"),
      });

      prisma.auditLog.findMany.mockResolvedValue([log1, log2]);

      const result = await service.getEntityHistory("appointment", "apt-uuid-1");

      expect(result).toHaveLength(2);
      expect(result[0].action).toBe("appointment.created");
      expect(result[1].action).toBe("appointment.confirmed");

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entityType: "appointment", entityId: "apt-uuid-1" },
          orderBy: { createdAt: "asc" },
        })
      );
    });

    it("formats each entry correctly — created_at as ISO string, actor_name combined", async () => {
      const dbLog = makeDbLog({
        id: LOG_ID_1,
        actor: { firstName: "María", lastName: "García", email: "m@test.com" },
        actorId: "user-2",
        createdAt: new Date("2026-03-15T14:30:00Z"),
      });

      prisma.auditLog.findMany.mockResolvedValue([dbLog]);

      const result = await service.getEntityHistory("appointment", "apt-uuid-1");

      expect(result[0]).toMatchObject({
        id: LOG_ID_1,
        actor_id: "user-2",
        actor_name: "María García",
        created_at: "2026-03-15T14:30:00.000Z",
      });
    });

    it("sets actor_name to undefined when actor is null", async () => {
      const dbLog = makeDbLog({ actor: null, actorType: "SYSTEM", actorId: null });

      prisma.auditLog.findMany.mockResolvedValue([dbLog]);

      const result = await service.getEntityHistory("appointment", "apt-uuid-1");

      expect(result[0].actor_name).toBeUndefined();
      expect(result[0].actor_id).toBeUndefined();
    });

    it("returns empty array when no logs exist for the entity", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getEntityHistory("appointment", "nonexistent-id");

      expect(result).toEqual([]);
    });
  });
});

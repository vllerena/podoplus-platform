import { BadRequestException } from "@nestjs/common";
import { HoldsService } from "./holds.service";
import { createPrismaMock, PrismaMock } from "../../test/prisma.mock";

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const BRANCH_ID = "branch-uuid-1";
const SERVICE_ID = "service-uuid-1";
const HOLDER_ID = "user-uuid-1";
const CREATED_BY = "user-uuid-1";

const START_AT = new Date("2025-06-15T09:00:00Z");
const END_AT = new Date("2025-06-15T09:30:00Z");

// A pre-built hold payload as it would be stored in Redis
const makeHoldPayload = (overrides: Partial<any> = {}) => ({
  hold_id: "hold-uuid-1",
  branch_id: BRANCH_ID,
  service_id: SERVICE_ID,
  start_at: START_AT.toISOString(),
  end_at: END_AT.toISOString(),
  holder_type: "USER",
  holder_id: HOLDER_ID,
  created_by: CREATED_BY,
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 90_000).toISOString(),
  ...overrides,
});

// ─── Redis mock ───────────────────────────────────────────────────────────────

const makeRedisMock = () => ({
  setex: jest.fn().mockResolvedValue("OK"),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue([]),
  mget: jest.fn().mockResolvedValue([]),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("HoldsService", () => {
  let service: HoldsService;
  let redis: ReturnType<typeof makeRedisMock>;
  let prisma: PrismaMock;

  beforeEach(() => {
    redis = makeRedisMock();
    prisma = createPrismaMock();
    service = new HoldsService(redis as any, prisma as any);
  });

  // ─── createHold() ─────────────────────────────────────────────────────────

  describe("createHold()", () => {
    it("creates a hold in Redis using setex with a 90-second TTL", async () => {
      const result = await service.createHold(
        BRANCH_ID,
        SERVICE_ID,
        START_AT,
        END_AT,
        "USER",
        HOLDER_ID,
        CREATED_BY
      );

      expect(redis.setex).toHaveBeenCalledTimes(1);

      const [key, ttl, payload] = redis.setex.mock.calls[0] as [string, number, string];
      expect(key).toMatch(/^hold:/);
      expect(ttl).toBe(90);

      const stored = JSON.parse(payload);
      expect(stored.branch_id).toBe(BRANCH_ID);
      expect(stored.service_id).toBe(SERVICE_ID);
      expect(stored.start_at).toBe(START_AT.toISOString());
      expect(stored.end_at).toBe(END_AT.toISOString());
      expect(stored.holder_type).toBe("USER");
      expect(stored.holder_id).toBe(HOLDER_ID);
    });

    it("generates a UUID-format holdId (not Math.random output)", async () => {
      const result = await service.createHold(
        BRANCH_ID,
        SERVICE_ID,
        START_AT,
        END_AT,
        "USER",
        HOLDER_ID,
        CREATED_BY
      );

      // UUID v4 pattern: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(result.hold_id).toMatch(uuidPattern);
    });

    it("returns the correct hold fields", async () => {
      const result = await service.createHold(
        BRANCH_ID,
        SERVICE_ID,
        START_AT,
        END_AT,
        "USER",
        HOLDER_ID,
        CREATED_BY
      );

      expect(result).toMatchObject({
        hold_id: expect.any(String),
        branch_id: BRANCH_ID,
        service_id: SERVICE_ID,
        start_at: START_AT.toISOString(),
        end_at: END_AT.toISOString(),
        expires_at: expect.any(String),
      });
    });

    it("sets expires_at roughly 90 seconds from now", async () => {
      const before = Date.now();
      const result = await service.createHold(
        BRANCH_ID,
        SERVICE_ID,
        START_AT,
        END_AT,
        "USER",
        HOLDER_ID,
        CREATED_BY
      );
      const after = Date.now();

      const expiresAt = new Date(result.expires_at).getTime();
      expect(expiresAt).toBeGreaterThanOrEqual(before + 90_000);
      expect(expiresAt).toBeLessThanOrEqual(after + 90_000);
    });

    it("throws BadRequestException when startAt >= endAt", async () => {
      const sameTime = new Date("2025-06-15T09:00:00Z");

      await expect(
        service.createHold(BRANCH_ID, SERVICE_ID, sameTime, sameTime, "USER", HOLDER_ID, CREATED_BY)
      ).rejects.toThrow(BadRequestException);

      const pastStart = new Date("2025-06-15T10:00:00Z");
      const earlyEnd = new Date("2025-06-15T09:00:00Z");

      await expect(
        service.createHold(BRANCH_ID, SERVICE_ID, pastStart, earlyEnd, "USER", HOLDER_ID, CREATED_BY)
      ).rejects.toThrow(BadRequestException);
    });

    it("stores the Redis key as hold:{holdId}", async () => {
      const result = await service.createHold(
        BRANCH_ID,
        SERVICE_ID,
        START_AT,
        END_AT,
        "USER",
        HOLDER_ID,
        CREATED_BY
      );

      const [key] = redis.setex.mock.calls[0] as [string, number, string];
      expect(key).toBe(`hold:${result.hold_id}`);
    });
  });

  // ─── getHold() ────────────────────────────────────────────────────────────

  describe("getHold()", () => {
    it("returns parsed hold from Redis when the key exists", async () => {
      const payload = makeHoldPayload();
      redis.get.mockResolvedValue(JSON.stringify(payload));

      const result = await service.getHold("hold-uuid-1");

      expect(redis.get).toHaveBeenCalledWith("hold:hold-uuid-1");
      expect(result).toEqual(payload);
    });

    it("returns null when the key is not found in Redis", async () => {
      redis.get.mockResolvedValue(null);

      const result = await service.getHold("nonexistent-id");

      expect(result).toBeNull();
    });
  });

  // ─── releaseHold() ────────────────────────────────────────────────────────

  describe("releaseHold()", () => {
    it("calls redis.del with the correct key", async () => {
      await service.releaseHold("hold-uuid-1");

      expect(redis.del).toHaveBeenCalledWith("hold:hold-uuid-1");
    });

    it("resolves without error when hold exists (del returns 1)", async () => {
      redis.del.mockResolvedValue(1);

      await expect(service.releaseHold("hold-uuid-1")).resolves.toBeUndefined();
    });

    it("resolves without error when hold does not exist (del returns 0)", async () => {
      redis.del.mockResolvedValue(0);

      await expect(service.releaseHold("nonexistent-id")).resolves.toBeUndefined();
    });
  });

  // ─── getHoldsForRange() ───────────────────────────────────────────────────

  describe("getHoldsForRange()", () => {
    it("returns empty array when there are no keys in Redis", async () => {
      redis.keys.mockResolvedValue([]);

      const result = await service.getHoldsForRange(
        BRANCH_ID,
        new Date("2025-06-15T00:00:00Z"),
        new Date("2025-06-15T23:59:59Z")
      );

      expect(result).toEqual([]);
      expect(redis.mget).not.toHaveBeenCalled();
    });

    it("uses redis.mget (single batch call) instead of individual gets", async () => {
      redis.keys.mockResolvedValue(["hold:a", "hold:b", "hold:c"]);
      redis.mget.mockResolvedValue([null, null, null]);

      await service.getHoldsForRange(
        BRANCH_ID,
        new Date("2025-06-15T00:00:00Z"),
        new Date("2025-06-15T23:59:59Z")
      );

      expect(redis.mget).toHaveBeenCalledTimes(1);
      // mget must be called with all keys spread as individual args
      expect(redis.mget).toHaveBeenCalledWith("hold:a", "hold:b", "hold:c");
    });

    it("filters holds by branchId", async () => {
      const holdSameBranch = makeHoldPayload({
        hold_id: "h1",
        branch_id: BRANCH_ID,
        start_at: new Date("2025-06-15T09:00:00Z").toISOString(),
        end_at: new Date("2025-06-15T09:30:00Z").toISOString(),
      });
      const holdOtherBranch = makeHoldPayload({
        hold_id: "h2",
        branch_id: "other-branch",
        start_at: new Date("2025-06-15T09:00:00Z").toISOString(),
        end_at: new Date("2025-06-15T09:30:00Z").toISOString(),
      });

      redis.keys.mockResolvedValue(["hold:h1", "hold:h2"]);
      redis.mget.mockResolvedValue([
        JSON.stringify(holdSameBranch),
        JSON.stringify(holdOtherBranch),
      ]);

      const result = await service.getHoldsForRange(
        BRANCH_ID,
        new Date("2025-06-15T00:00:00Z"),
        new Date("2025-06-15T23:59:59Z")
      );

      expect(result).toHaveLength(1);
      expect(result[0].hold_id).toBe("h1");
    });

    it("filters holds by date range — excludes holds outside the range", async () => {
      const holdInRange = makeHoldPayload({
        hold_id: "h-in",
        branch_id: BRANCH_ID,
        start_at: new Date("2025-06-15T09:00:00Z").toISOString(),
        end_at: new Date("2025-06-15T09:30:00Z").toISOString(),
      });
      const holdBefore = makeHoldPayload({
        hold_id: "h-before",
        branch_id: BRANCH_ID,
        start_at: new Date("2025-06-14T08:00:00Z").toISOString(),
        end_at: new Date("2025-06-14T08:30:00Z").toISOString(),
      });
      const holdAfter = makeHoldPayload({
        hold_id: "h-after",
        branch_id: BRANCH_ID,
        start_at: new Date("2025-06-16T10:00:00Z").toISOString(),
        end_at: new Date("2025-06-16T10:30:00Z").toISOString(),
      });

      redis.keys.mockResolvedValue(["hold:h-in", "hold:h-before", "hold:h-after"]);
      redis.mget.mockResolvedValue([
        JSON.stringify(holdInRange),
        JSON.stringify(holdBefore),
        JSON.stringify(holdAfter),
      ]);

      const fromDate = new Date("2025-06-15T00:00:00Z");
      const toDate = new Date("2025-06-15T23:59:59Z");

      const result = await service.getHoldsForRange(BRANCH_ID, fromDate, toDate);

      expect(result).toHaveLength(1);
      expect(result[0].hold_id).toBe("h-in");
    });

    it("filters out null/expired values from mget result", async () => {
      const holdValid = makeHoldPayload({
        hold_id: "h-valid",
        branch_id: BRANCH_ID,
        start_at: new Date("2025-06-15T09:00:00Z").toISOString(),
        end_at: new Date("2025-06-15T09:30:00Z").toISOString(),
      });

      redis.keys.mockResolvedValue(["hold:h-expired", "hold:h-valid"]);
      redis.mget.mockResolvedValue([
        null, // expired/evicted key
        JSON.stringify(holdValid),
      ]);

      const result = await service.getHoldsForRange(
        BRANCH_ID,
        new Date("2025-06-15T00:00:00Z"),
        new Date("2025-06-15T23:59:59Z")
      );

      expect(result).toHaveLength(1);
      expect(result[0].hold_id).toBe("h-valid");
    });

    it("returns all matching holds when multiple holds share the same branch and range", async () => {
      const hold1 = makeHoldPayload({
        hold_id: "h1",
        branch_id: BRANCH_ID,
        start_at: new Date("2025-06-15T09:00:00Z").toISOString(),
        end_at: new Date("2025-06-15T09:30:00Z").toISOString(),
      });
      const hold2 = makeHoldPayload({
        hold_id: "h2",
        branch_id: BRANCH_ID,
        start_at: new Date("2025-06-15T10:00:00Z").toISOString(),
        end_at: new Date("2025-06-15T10:30:00Z").toISOString(),
      });

      redis.keys.mockResolvedValue(["hold:h1", "hold:h2"]);
      redis.mget.mockResolvedValue([JSON.stringify(hold1), JSON.stringify(hold2)]);

      const result = await service.getHoldsForRange(
        BRANCH_ID,
        new Date("2025-06-15T00:00:00Z"),
        new Date("2025-06-15T23:59:59Z")
      );

      expect(result).toHaveLength(2);
    });
  });

  // ─── validateHold() ───────────────────────────────────────────────────────

  describe("validateHold()", () => {
    it("returns true when hold data matches exactly", async () => {
      const payload = makeHoldPayload({
        hold_id: "h1",
        branch_id: BRANCH_ID,
        service_id: SERVICE_ID,
        start_at: START_AT.toISOString(),
        end_at: END_AT.toISOString(),
      });
      redis.get.mockResolvedValue(JSON.stringify(payload));

      const valid = await service.validateHold("h1", BRANCH_ID, SERVICE_ID, START_AT, END_AT);

      expect(valid).toBe(true);
    });

    it("throws BadRequestException when hold is not found (expired or never existed)", async () => {
      redis.get.mockResolvedValue(null);

      await expect(
        service.validateHold("ghost-id", BRANCH_ID, SERVICE_ID, START_AT, END_AT)
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when branchId does not match", async () => {
      const payload = makeHoldPayload({
        branch_id: "wrong-branch",
        service_id: SERVICE_ID,
        start_at: START_AT.toISOString(),
        end_at: END_AT.toISOString(),
      });
      redis.get.mockResolvedValue(JSON.stringify(payload));

      await expect(
        service.validateHold("h1", BRANCH_ID, SERVICE_ID, START_AT, END_AT)
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when serviceId does not match", async () => {
      const payload = makeHoldPayload({
        branch_id: BRANCH_ID,
        service_id: "wrong-service",
        start_at: START_AT.toISOString(),
        end_at: END_AT.toISOString(),
      });
      redis.get.mockResolvedValue(JSON.stringify(payload));

      await expect(
        service.validateHold("h1", BRANCH_ID, SERVICE_ID, START_AT, END_AT)
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── renewHold() ──────────────────────────────────────────────────────────

  describe("renewHold()", () => {
    it("extends TTL in Redis and returns updated expires_at", async () => {
      const recentCreatedAt = new Date(Date.now() - 10_000).toISOString(); // 10 seconds ago
      const payload = makeHoldPayload({ hold_id: "h1", created_at: recentCreatedAt });
      redis.get.mockResolvedValue(JSON.stringify(payload));
      redis.setex.mockResolvedValue("OK");

      const result = await service.renewHold("h1");

      expect(redis.setex).toHaveBeenCalledWith(
        "hold:h1",
        90,
        expect.any(String)
      );
      expect(result).toMatchObject({
        hold_id: "h1",
        expires_at: expect.any(String),
      });
    });

    it("throws BadRequestException when hold is not found", async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.renewHold("ghost-id")).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when hold has exceeded the 3-minute maximum", async () => {
      // Created more than 90 seconds ago (beyond the renew threshold of 180 - 90 = 90 s)
      const oldCreatedAt = new Date(Date.now() - 100_000).toISOString(); // 100 seconds ago
      const payload = makeHoldPayload({ hold_id: "h1", created_at: oldCreatedAt });
      redis.get.mockResolvedValue(JSON.stringify(payload));

      await expect(service.renewHold("h1")).rejects.toThrow(BadRequestException);
    });
  });
});

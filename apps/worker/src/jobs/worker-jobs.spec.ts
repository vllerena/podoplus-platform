import { promises as fs } from "node:fs";
import { basename } from "node:path";
import { expireSubscriptions } from "./expire-subscriptions";
import { markNoShows } from "./mark-no-shows";
import { sendNotification } from "./send-notification";
import * as notificationLog from "../lib/notification-log";

// ─── Inline Prisma mock ───────────────────────────────────────────────────────

const makePrismaMock = () => ({
  customerSubscription: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  appointment: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  appointmentStatusHistory: {
    create: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
});

// ─── expireSubscriptions ─────────────────────────────────────────────────────

describe("expireSubscriptions", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = makePrismaMock();
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("calls updateMany with { id: { in: expiredIds } } — NOT individual updates (N+1 fix)", async () => {
    const expired = [
      {
        id: "sub-1",
        customer: { id: "cust-1", firstName: "Ana", lastName: "López" },
        plan: { id: "plan-1", name: "Mensual", planType: "DATE" },
        endDate: new Date("2026-01-01T00:00:00Z"),
      },
      {
        id: "sub-2",
        customer: { id: "cust-2", firstName: "Juan", lastName: "Pérez" },
        plan: { id: "plan-1", name: "Mensual", planType: "HYBRID" },
        endDate: new Date("2026-01-01T00:00:00Z"),
      },
    ];
    prisma.customerSubscription.findMany.mockResolvedValue(expired);
    prisma.customerSubscription.updateMany.mockResolvedValue({ count: 2 });

    await expireSubscriptions(prisma as any);

    // Must call updateMany with ALL ids in one query — not two separate updates
    expect(prisma.customerSubscription.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.customerSubscription.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["sub-1", "sub-2"] } },
      data: { status: "EXPIRED" },
    });
  });

  it("logs completion message after expiring subscriptions", async () => {
    const expired = [
      {
        id: "sub-1",
        customer: { id: "cust-1", firstName: "Ana", lastName: "López" },
        plan: { id: "plan-1", name: "Mensual", planType: "DATE" },
        endDate: new Date("2026-01-01T00:00:00Z"),
      },
    ];
    prisma.customerSubscription.findMany.mockResolvedValue(expired);
    prisma.customerSubscription.updateMany.mockResolvedValue({ count: 1 });

    await expireSubscriptions(prisma as any);

    // At least one console.log call with "Completado" in it
    const allLogCalls = consoleSpy.mock.calls.flat().join(" ");
    expect(allLogCalls).toMatch(/Completado/);
  });

  it("returns early with no DB calls when findMany returns []", async () => {
    prisma.customerSubscription.findMany.mockResolvedValue([]);

    await expireSubscriptions(prisma as any);

    expect(prisma.customerSubscription.updateMany).not.toHaveBeenCalled();
  });

  it("logs the count from updateMany result", async () => {
    const expired = [
      {
        id: "sub-1",
        customer: { id: "cust-1", firstName: "Ana", lastName: "López" },
        plan: { id: "plan-1", name: "Mensual", planType: "DATE" },
        endDate: new Date("2026-01-01T00:00:00Z"),
      },
    ];
    prisma.customerSubscription.findMany.mockResolvedValue(expired);
    prisma.customerSubscription.updateMany.mockResolvedValue({ count: 1 });

    await expireSubscriptions(prisma as any);

    const allLogCalls = consoleSpy.mock.calls.flat().join(" ");
    // Should mention "1" somewhere (the count)
    expect(allLogCalls).toMatch(/1/);
  });
});

// ─── markNoShows ─────────────────────────────────────────────────────────────

describe("markNoShows", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = makePrismaMock();
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const makeStaleAppointment = (overrides: Partial<any> = {}) => ({
    id: "appt-uuid-1",
    status: "SCHEDULED",
    endAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    customer: { firstName: "Ana", lastName: "López" },
    service: { name: "Podología" },
    branch: { name: "Sede Central" },
    ...overrides,
  });

  it("marks stale SCHEDULED appointments as NO_SHOW — update called for each", async () => {
    const stale = [
      makeStaleAppointment({ id: "appt-1" }),
      makeStaleAppointment({ id: "appt-2" }),
    ];
    prisma.appointment.findMany.mockResolvedValue(stale);
    prisma.appointment.update.mockResolvedValue({});
    prisma.appointmentStatusHistory.create.mockResolvedValue({});

    await markNoShows(prisma as any);

    expect(prisma.appointment.update).toHaveBeenCalledTimes(2);
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "appt-1" },
        data: { status: "NO_SHOW" },
      }),
    );
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "appt-2" },
        data: { status: "NO_SHOW" },
      }),
    );
  });

  it("creates AppointmentStatusHistory record for each NO_SHOW", async () => {
    const stale = [
      makeStaleAppointment({ id: "appt-1" }),
      makeStaleAppointment({ id: "appt-2" }),
    ];
    prisma.appointment.findMany.mockResolvedValue(stale);
    prisma.appointment.update.mockResolvedValue({});
    prisma.appointmentStatusHistory.create.mockResolvedValue({});

    await markNoShows(prisma as any);

    expect(prisma.appointmentStatusHistory.create).toHaveBeenCalledTimes(2);
    expect(prisma.appointmentStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: "SCHEDULED",
          toStatus: "NO_SHOW",
          changedByType: "SYSTEM",
        }),
      }),
    );
  });

  it("returns early when no stale appointments found", async () => {
    prisma.appointment.findMany.mockResolvedValue([]);

    await markNoShows(prisma as any);

    expect(prisma.appointment.update).not.toHaveBeenCalled();
    expect(prisma.appointmentStatusHistory.create).not.toHaveBeenCalled();
  });

  it("grace period: cutoff is approximately 30 minutes before now", async () => {
    prisma.appointment.findMany.mockResolvedValue([]);

    const before = Date.now();
    await markNoShows(prisma as any);
    const after = Date.now();

    const callArgs = prisma.appointment.findMany.mock.calls[0][0];
    const cutoff: Date = callArgs.where.endAt.lt;

    const expectedCutoffMin = before - 30 * 60 * 1000;
    const expectedCutoffMax = after - 30 * 60 * 1000;

    expect(cutoff.getTime()).toBeGreaterThanOrEqual(expectedCutoffMin - 100); // 100ms tolerance
    expect(cutoff.getTime()).toBeLessThanOrEqual(expectedCutoffMax + 100);
  });
});

// ─── sendNotification ─────────────────────────────────────────────────────────

describe("sendNotification", () => {
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(notificationLog, "logNotification").mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const baseData = {
    userId: "user-uuid-1",
    type: "APPOINTMENT_REMINDER",
    title: "Recordatorio",
    body: "Tienes una cita mañana",
    entityType: "appointment",
    entityId: "appt-uuid-1",
  };

  it("creates notification in prisma when userId is present", async () => {
    prisma.notification.create.mockResolvedValue({ id: "notif-1" });

    await sendNotification(prisma as any, baseData);

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "APPOINTMENT_REMINDER",
          title: "Recordatorio",
          body: "Tienes una cita mañana",
          entityType: "appointment",
          entityId: "appt-uuid-1",
        }),
      }),
    );
    expect(notificationLog.logNotification).toHaveBeenCalledWith(baseData);
  });

  it("returns early WITHOUT calling prisma.notification.create when userId is empty string", async () => {
    await sendNotification(prisma as any, { ...baseData, userId: "" });

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(notificationLog.logNotification).not.toHaveBeenCalled();
  });

  it("returns early WITHOUT calling prisma.notification.create when userId is undefined/falsy", async () => {
    await sendNotification(prisma as any, {
      ...baseData,
      userId: undefined as any,
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(notificationLog.logNotification).not.toHaveBeenCalled();
  });
});

describe("logNotification", () => {
  const baseData = {
    userId: "user-uuid-1",
    type: "APPOINTMENT_REMINDER",
    title: "Recordatorio",
    body: "Tienes una cita mañana",
    entityType: "appointment",
    entityId: "appt-uuid-1",
  };

  it("creates the logs directory and appends a JSON record", async () => {
    const mkdirSpy = jest
      .spyOn(fs, "mkdir")
      .mockResolvedValue(undefined as any);
    const appendSpy = jest
      .spyOn(fs, "appendFile")
      .mockResolvedValue(undefined as any);

    await notificationLog.logNotification(baseData as any);

    expect(mkdirSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(basename(appendSpy.mock.calls[0][0] as string)).toBe(
      "notifications.jsonl",
    );
    expect(typeof appendSpy.mock.calls[0][1]).toBe("string");
    const record = JSON.parse(appendSpy.mock.calls[0][1] as string);
    expect(record).toMatchObject({
      userId: "user-uuid-1",
      type: "APPOINTMENT_REMINDER",
      title: "Recordatorio",
      body: "Tienes una cita mañana",
      entityType: "appointment",
      entityId: "appt-uuid-1",
    });
    expect(record.loggedAt).toBeDefined();
  });
});

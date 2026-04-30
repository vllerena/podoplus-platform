import { NotificationsService, CreateNotificationParams } from "./notifications.service";
import { createPrismaMock, PrismaMock } from "../../test/prisma.mock";
import { QueuePublisherService } from "../queue/queue-publisher.service";

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID = "user-uuid-1";
const NOTIF_ID = "notif-uuid-1";

const makeNotificationRow = (overrides: Partial<any> = {}) => ({
  id: NOTIF_ID,
  userId: USER_ID,
  type: "APPOINTMENT_CONFIRMED",
  title: "Cita confirmada",
  body: "Tu cita ha sido confirmada.",
  entityType: null,
  entityId: null,
  isRead: false,
  readAt: null,
  createdAt: new Date("2025-01-01T10:00:00Z"),
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("NotificationsService", () => {
  let service: NotificationsService;
  let prisma: PrismaMock;
  let queuePublisher: jest.Mocked<Pick<QueuePublisherService, "publishNotification">>;

  beforeEach(() => {
    prisma = createPrismaMock();

    queuePublisher = {
      publishNotification: jest.fn().mockResolvedValue(undefined),
    };

    service = new NotificationsService(prisma as any, queuePublisher as any);
  });

  // ─── notify() ─────────────────────────────────────────────────────────────

  describe("notify()", () => {
    it("delegates to queuePublisher when available and userId is present", async () => {
      const params: CreateNotificationParams = {
        userId: USER_ID,
        type: "APPOINTMENT_CONFIRMED",
        title: "Cita confirmada",
        body: "Tu cita ha sido confirmada.",
      };

      service.notify(params);

      // Give the microtask queue a tick to flush the async fire-and-forget call
      await Promise.resolve();

      expect(queuePublisher.publishNotification).toHaveBeenCalledWith(params);
    });

    it("falls back to prisma.notification.create when queuePublisher is unavailable", async () => {
      // Instantiate without queuePublisher so it persists directly
      const serviceNoBroker = new NotificationsService(prisma as any);

      prisma.notification.create.mockResolvedValue(makeNotificationRow());

      const params: CreateNotificationParams = {
        userId: USER_ID,
        type: "APPOINTMENT_CONFIRMED",
        title: "Cita confirmada",
        body: "Tu cita ha sido confirmada.",
      };

      serviceNoBroker.notify(params);

      // Flush the promise returned by persist()
      await new Promise(process.nextTick);

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user: { connect: { id: USER_ID } },
            type: params.type,
            title: params.title,
            body: params.body,
          }),
        })
      );
    });

    it("returns early without calling queuePublisher when userId is undefined", async () => {
      const params: CreateNotificationParams = {
        userId: undefined,
        type: "APPOINTMENT_CONFIRMED",
        title: "Cita confirmada",
        body: "Tu cita ha sido confirmada.",
      };

      service.notify(params);
      await Promise.resolve();

      expect(queuePublisher.publishNotification).not.toHaveBeenCalled();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it("returns early without calling prisma when userId is an empty string", async () => {
      const serviceNoBroker = new NotificationsService(prisma as any);

      const params: CreateNotificationParams = {
        userId: "",
        type: "APPOINTMENT_CONFIRMED",
        title: "Cita confirmada",
        body: "Tu cita ha sido confirmada.",
      };

      serviceNoBroker.notify(params);
      await new Promise(process.nextTick);

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it("passes entityType and entityId to prisma.notification.create when provided", async () => {
      const serviceNoBroker = new NotificationsService(prisma as any);

      prisma.notification.create.mockResolvedValue(
        makeNotificationRow({ entityType: "APPOINTMENT", entityId: "appt-uuid-1" })
      );

      const params: CreateNotificationParams = {
        userId: USER_ID,
        type: "APPOINTMENT_CONFIRMED",
        title: "Cita confirmada",
        body: "Tu cita ha sido confirmada.",
        entityType: "APPOINTMENT",
        entityId: "appt-uuid-1",
      };

      serviceNoBroker.notify(params);
      await new Promise(process.nextTick);

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: "APPOINTMENT",
            entityId: "appt-uuid-1",
          }),
        })
      );
    });

    it("falls back to prisma when queuePublisher.publishNotification rejects", async () => {
      queuePublisher.publishNotification.mockRejectedValue(new Error("Queue unavailable"));
      prisma.notification.create.mockResolvedValue(makeNotificationRow());

      const params: CreateNotificationParams = {
        userId: USER_ID,
        type: "APPOINTMENT_CONFIRMED",
        title: "Cita confirmada",
        body: "Tu cita ha sido confirmada.",
      };

      service.notify(params);
      // Flush rejection + fallback persist
      await new Promise(process.nextTick);
      await new Promise(process.nextTick);

      expect(prisma.notification.create).toHaveBeenCalled();
    });
  });

  // ─── getMyNotifications() ─────────────────────────────────────────────────

  describe("getMyNotifications()", () => {
    it("returns paginated data with correct shape", async () => {
      const rows = [makeNotificationRow()];
      prisma.notification.findMany.mockResolvedValue(rows);
      prisma.notification.count
        .mockResolvedValueOnce(1)   // total
        .mockResolvedValueOnce(1);  // unreadCount

      const result = await service.getMyNotifications(USER_ID);

      expect(result).toMatchObject({
        data: expect.any(Array),
        total: 1,
        unread_count: 1,
        limit: 20,
        offset: 0,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(NOTIF_ID);
    });

    it("formats notification rows correctly (snake_case fields)", async () => {
      const row = makeNotificationRow({
        entityType: "APPOINTMENT",
        entityId: "appt-1",
        isRead: true,
        readAt: new Date("2025-01-02T10:00:00Z"),
      });
      prisma.notification.findMany.mockResolvedValue([row]);
      prisma.notification.count.mockResolvedValue(1);

      const result = await service.getMyNotifications(USER_ID);
      const item = result.data[0];

      expect(item.entity_type).toBe("APPOINTMENT");
      expect(item.entity_id).toBe("appt-1");
      expect(item.is_read).toBe(true);
      expect(item.read_at).toBe("2025-01-02T10:00:00.000Z");
      expect(item.created_at).toBe("2025-01-01T10:00:00.000Z");
    });

    it("applies isRead=false filter when onlyUnread=true", async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.getMyNotifications(USER_ID, true);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: USER_ID, isRead: false }),
        })
      );
    });

    it("does NOT apply isRead filter when onlyUnread=false (default)", async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.getMyNotifications(USER_ID, false);

      const callArg = prisma.notification.findMany.mock.calls[0][0] as any;
      expect(callArg.where).not.toHaveProperty("isRead");
    });

    it("respects custom limit and offset", async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.getMyNotifications(USER_ID, false, 5, 10);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5, skip: 10 })
      );
    });

    it("returns unread_count from a separate parallel count query", async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count
        .mockResolvedValueOnce(10)  // total
        .mockResolvedValueOnce(3);  // unreadCount

      const result = await service.getMyNotifications(USER_ID);

      expect(result.total).toBe(10);
      expect(result.unread_count).toBe(3);
    });
  });

  // ─── markAsRead() ─────────────────────────────────────────────────────────

  describe("markAsRead()", () => {
    it("returns success=true when the notification is found and updated", async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.markAsRead(NOTIF_ID, USER_ID);

      expect(result).toEqual({ success: true });
      expect(prisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: NOTIF_ID, userId: USER_ID },
          data: expect.objectContaining({ isRead: true }),
        })
      );
    });

    it("returns success=false with message when notification not found (count=0)", async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.markAsRead(NOTIF_ID, USER_ID);

      expect(result).toEqual({
        success: false,
        message: "Notificación no encontrada",
      });
    });

    it("sets readAt to a Date value", async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 1 });

      await service.markAsRead(NOTIF_ID, USER_ID);

      const callArg = prisma.notification.updateMany.mock.calls[0][0] as any;
      expect(callArg.data.readAt).toBeInstanceOf(Date);
    });
  });

  // ─── markAllAsRead() ──────────────────────────────────────────────────────

  describe("markAllAsRead()", () => {
    it("calls updateMany with userId and isRead=false filter", async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead(USER_ID);

      expect(prisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID, isRead: false },
          data: expect.objectContaining({ isRead: true }),
        })
      );
      expect(result).toEqual({ success: true, marked_read: 5 });
    });

    it("returns marked_read=0 when there are no unread notifications", async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.markAllAsRead(USER_ID);

      expect(result).toEqual({ success: true, marked_read: 0 });
    });
  });

  // ─── deleteNotification() ─────────────────────────────────────────────────

  describe("deleteNotification()", () => {
    it("returns success=true when notification is deleted (count > 0)", async () => {
      prisma.notification.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.deleteNotification(NOTIF_ID, USER_ID);

      expect(result).toEqual({ success: true });
      expect(prisma.notification.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: NOTIF_ID, userId: USER_ID },
        })
      );
    });

    it("returns success=false when notification not found (count=0)", async () => {
      prisma.notification.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.deleteNotification(NOTIF_ID, USER_ID);

      expect(result).toEqual({ success: false });
    });
  });

  // ─── getUnreadCount() ─────────────────────────────────────────────────────

  describe("getUnreadCount()", () => {
    it("returns unread_count from prisma.notification.count", async () => {
      prisma.notification.count.mockResolvedValue(7);

      const result = await service.getUnreadCount(USER_ID);

      expect(result).toEqual({ unread_count: 7 });
      expect(prisma.notification.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID, isRead: false },
        })
      );
    });

    it("returns unread_count=0 when there are no unread notifications", async () => {
      prisma.notification.count.mockResolvedValue(0);

      const result = await service.getUnreadCount(USER_ID);

      expect(result).toEqual({ unread_count: 0 });
    });
  });
});

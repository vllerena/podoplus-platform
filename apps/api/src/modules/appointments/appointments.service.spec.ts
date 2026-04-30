import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { AppointmentsService, AppointmentStatus } from "./appointments.service";
import { createPrismaMock, PrismaMock } from "../../test/prisma.mock";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BRANCH_ID = "branch-uuid-1";
const CUSTOMER_ID = "cust-uuid-1";
const SERVICE_ID = "svc-uuid-1";
const APT_ID = "apt-uuid-1";
const USER_ID = "user-uuid-1";

const makeAppointment = (overrides: Partial<any> = {}) => ({
  id: APT_ID,
  branchId: BRANCH_ID,
  customerId: CUSTOMER_ID,
  serviceId: SERVICE_ID,
  startAt: new Date("2025-06-15T10:00:00Z"),
  endAt: new Date("2025-06-15T11:00:00Z"),
  status: AppointmentStatus.CONFIRMED,
  source: "RECEPTION",
  notes: null,
  cancelReason: null,
  rescheduledFromId: null,
  rescheduledToId: null,
  createdById: USER_ID,
  createdAt: new Date("2025-06-01T00:00:00Z"),
  updatedAt: new Date("2025-06-01T00:00:00Z"),
  ...overrides,
});

const makeBranch = () => ({ id: BRANCH_ID, name: "Sede Principal", defaultCapacity: 3 });
const makeCustomer = () => ({ id: CUSTOMER_ID, firstName: "Juan", lastName: "Pérez" });
const makeService = () => ({
  id: SERVICE_ID,
  name: "Podología Básica",
  durationMinutes: 60,
  bufferMinutes: 0,
  isActive: true,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AppointmentsService", () => {
  let service: AppointmentsService;
  let prisma: PrismaMock;
  let holdsService: { getHold: jest.Mock; releaseHold: jest.Mock };

  beforeEach(() => {
    prisma = createPrismaMock();
    holdsService = { getHold: jest.fn(), releaseHold: jest.fn() };

    // $transaction executes the callback immediately using the same prisma mock
    prisma.$transaction.mockImplementation(async (cb: any) =>
      typeof cb === "function" ? cb(prisma) : Promise.all(cb)
    );

    // Instantiate without optional services to keep tests focused on business logic
    service = new AppointmentsService(prisma as any, holdsService as any);
  });

  // ─── cancelAppointment ────────────────────────────────────────────────────

  describe("cancelAppointment", () => {
    it("throws NotFoundException when the appointment does not exist", async () => {
      prisma.appointment.findUnique.mockResolvedValue(null);

      await expect(service.cancelAppointment(APT_ID, "Motivo")).rejects.toThrow(
        NotFoundException
      );
    });

    it("throws BadRequestException when the appointment is already CANCELED", async () => {
      prisma.appointment.findUnique.mockResolvedValue(
        makeAppointment({ status: AppointmentStatus.CANCELED })
      );

      await expect(service.cancelAppointment(APT_ID, "Motivo")).rejects.toThrow(
        BadRequestException
      );
    });

    it("cancels a CONFIRMED appointment and records history", async () => {
      const apt = makeAppointment();
      const canceled = { ...apt, status: AppointmentStatus.CANCELED, cancelReason: "Prueba" };

      prisma.appointment.findUnique.mockResolvedValue(apt);
      prisma.appointment.update.mockResolvedValue(canceled);
      prisma.appointmentStatusHistory.create.mockResolvedValue({});

      const result = await service.cancelAppointment(APT_ID, "Prueba", USER_ID);

      expect(result.status).toBe(AppointmentStatus.CANCELED);
      expect(result.cancel_reason).toBe("Prueba");

      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: APT_ID },
          data: expect.objectContaining({
            status: AppointmentStatus.CANCELED,
            cancelReason: "Prueba",
          }),
        })
      );
      expect(prisma.appointmentStatusHistory.create).toHaveBeenCalledTimes(1);
    });
  });

  // ─── checkInAppointment ───────────────────────────────────────────────────

  describe("checkInAppointment", () => {
    it("throws NotFoundException when the appointment does not exist", async () => {
      prisma.appointment.findUnique.mockResolvedValue(null);

      await expect(service.checkInAppointment(APT_ID)).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException when the appointment is not CONFIRMED", async () => {
      prisma.appointment.findUnique.mockResolvedValue(
        makeAppointment({ status: AppointmentStatus.IN_SERVICE })
      );

      await expect(service.checkInAppointment(APT_ID)).rejects.toThrow(BadRequestException);
    });

    it("transitions CONFIRMED → CHECKED_IN and records history", async () => {
      const apt = makeAppointment();
      const checkedIn = { ...apt, status: AppointmentStatus.CHECKED_IN };

      prisma.appointment.findUnique.mockResolvedValue(apt);
      prisma.appointment.update.mockResolvedValue(checkedIn);
      prisma.appointmentStatusHistory.create.mockResolvedValue({});

      const result = await service.checkInAppointment(APT_ID, USER_ID);

      expect(result.status).toBe(AppointmentStatus.CHECKED_IN);
      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: APT_ID },
          data: { status: AppointmentStatus.CHECKED_IN },
        })
      );
      expect(prisma.appointmentStatusHistory.create).toHaveBeenCalledTimes(1);
    });
  });

  // ─── startServiceAppointment ──────────────────────────────────────────────

  describe("startServiceAppointment", () => {
    it("throws BadRequestException when the appointment is not CHECKED_IN", async () => {
      prisma.appointment.findUnique.mockResolvedValue(
        makeAppointment({ status: AppointmentStatus.CONFIRMED })
      );

      await expect(service.startServiceAppointment(APT_ID)).rejects.toThrow(
        BadRequestException
      );
    });

    it("transitions CHECKED_IN → IN_SERVICE and records history", async () => {
      const apt = makeAppointment({ status: AppointmentStatus.CHECKED_IN });
      const inService = { ...apt, status: AppointmentStatus.IN_SERVICE };

      prisma.appointment.findUnique.mockResolvedValue(apt);
      prisma.appointment.update.mockResolvedValue(inService);
      prisma.appointmentStatusHistory.create.mockResolvedValue({});

      const result = await service.startServiceAppointment(APT_ID, USER_ID);

      expect(result.status).toBe(AppointmentStatus.IN_SERVICE);
      expect(prisma.appointmentStatusHistory.create).toHaveBeenCalledTimes(1);
    });
  });

  // ─── completeAppointment ──────────────────────────────────────────────────

  describe("completeAppointment", () => {
    it("throws BadRequestException when the appointment is not IN_SERVICE", async () => {
      prisma.appointment.findUnique.mockResolvedValue(
        makeAppointment({ status: AppointmentStatus.CHECKED_IN })
      );

      await expect(service.completeAppointment(APT_ID)).rejects.toThrow(
        BadRequestException
      );
    });

    it("transitions IN_SERVICE → COMPLETED and records history", async () => {
      const apt = makeAppointment({ status: AppointmentStatus.IN_SERVICE });
      const completed = { ...apt, status: AppointmentStatus.COMPLETED };

      prisma.appointment.findUnique.mockResolvedValue(apt);
      prisma.appointment.update.mockResolvedValue(completed);
      prisma.appointmentStatusHistory.create.mockResolvedValue({});

      const result = await service.completeAppointment(APT_ID, USER_ID);

      expect(result.status).toBe(AppointmentStatus.COMPLETED);
      expect(prisma.appointmentStatusHistory.create).toHaveBeenCalledTimes(1);
    });
  });

  // ─── markNoShow ───────────────────────────────────────────────────────────

  describe("markNoShow", () => {
    it("throws BadRequestException when the appointment is not CONFIRMED", async () => {
      prisma.appointment.findUnique.mockResolvedValue(
        makeAppointment({ status: AppointmentStatus.CHECKED_IN })
      );

      await expect(service.markNoShow(APT_ID)).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when called within the 15-minute grace period", async () => {
      // Appointment starts 5 minutes in the future — within grace window
      const futureStart = new Date(Date.now() + 5 * 60 * 1000);

      prisma.appointment.findUnique.mockResolvedValue(
        makeAppointment({ startAt: futureStart })
      );

      await expect(service.markNoShow(APT_ID)).rejects.toThrow(BadRequestException);
    });

    it("marks NO_SHOW when called after the grace period has elapsed", async () => {
      // Appointment started 20 minutes ago — past the 15-minute grace window
      const pastStart = new Date(Date.now() - 20 * 60 * 1000);
      const apt = makeAppointment({ startAt: pastStart });
      const noShow = { ...apt, status: AppointmentStatus.NO_SHOW };

      prisma.appointment.findUnique.mockResolvedValue(apt);
      prisma.appointment.update.mockResolvedValue(noShow);
      prisma.appointmentStatusHistory.create.mockResolvedValue({});

      const result = await service.markNoShow(APT_ID, USER_ID);

      expect(result.status).toBe(AppointmentStatus.NO_SHOW);
      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: APT_ID },
          data: { status: AppointmentStatus.NO_SHOW },
        })
      );
    });
  });

  // ─── getAppointments ──────────────────────────────────────────────────────

  describe("getAppointments", () => {
    const from = new Date("2025-06-15T08:00:00Z");
    const to = new Date("2025-06-15T18:00:00Z");

    it("uses an overlap filter — startAt lt to AND endAt gt from", async () => {
      prisma.appointment.findMany.mockResolvedValue([]);

      await service.getAppointments(BRANCH_ID, from, to);

      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branchId: BRANCH_ID,
            startAt: { lt: to },
            endAt: { gt: from },
          }),
        })
      );
    });

    it("includes optional status and customerId filters when provided", async () => {
      prisma.appointment.findMany.mockResolvedValue([]);

      await service.getAppointments(
        BRANCH_ID,
        from,
        to,
        AppointmentStatus.CONFIRMED,
        CUSTOMER_ID
      );

      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: AppointmentStatus.CONFIRMED,
            customerId: CUSTOMER_ID,
          }),
        })
      );
    });

    it("omits status and customerId filters when not provided", async () => {
      prisma.appointment.findMany.mockResolvedValue([]);

      await service.getAppointments(BRANCH_ID, from, to);

      const call = prisma.appointment.findMany.mock.calls[0][0] as any;
      expect(call.where.status).toBeUndefined();
      expect(call.where.customerId).toBeUndefined();
    });
  });

  // ─── createAppointment ────────────────────────────────────────────────────

  describe("createAppointment", () => {
    it("throws NotFoundException when the customer does not exist", async () => {
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(
        service.createAppointment(BRANCH_ID, CUSTOMER_ID, SERVICE_ID, new Date())
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException when the service does not exist", async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer());
      prisma.service.findUnique.mockResolvedValue(null);

      await expect(
        service.createAppointment(BRANCH_ID, CUSTOMER_ID, SERVICE_ID, new Date())
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException when the branch is at full capacity", async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer());
      prisma.service.findUnique.mockResolvedValue(makeService());
      prisma.branch.findUnique.mockResolvedValue(makeBranch()); // defaultCapacity: 3
      prisma.appointment.count.mockResolvedValue(3); // fully booked

      await expect(
        service.createAppointment(BRANCH_ID, CUSTOMER_ID, SERVICE_ID, new Date())
      ).rejects.toThrow(ConflictException);
    });

    it("creates the appointment and records status history on success", async () => {
      const startAt = new Date("2025-06-15T10:00:00Z");
      const apt = makeAppointment({ startAt });

      prisma.customer.findUnique.mockResolvedValue(makeCustomer());
      prisma.service.findUnique.mockResolvedValue(makeService());
      prisma.branch.findUnique.mockResolvedValue(makeBranch());
      prisma.appointment.count.mockResolvedValue(0); // slot available
      prisma.appointment.create.mockResolvedValue(apt);
      prisma.appointmentStatusHistory.create.mockResolvedValue({});

      const result = await service.createAppointment(
        BRANCH_ID,
        CUSTOMER_ID,
        SERVICE_ID,
        startAt,
        AppointmentStatus.CONFIRMED,
        undefined,
        "RECEPTION",
        USER_ID
      );

      expect(result.id).toBe(APT_ID);
      expect(result.status).toBe(AppointmentStatus.CONFIRMED);
      expect(prisma.appointment.create).toHaveBeenCalledTimes(1);
      expect(prisma.appointmentStatusHistory.create).toHaveBeenCalledTimes(1);
    });

    it("calculates endAt correctly using service duration and buffer", async () => {
      const startAt = new Date("2025-06-15T10:00:00Z");
      // 45 min duration + 15 min buffer = 60 min total → end at 11:00
      const svc = { ...makeService(), durationMinutes: 45, bufferMinutes: 15 };
      const expectedEnd = new Date(startAt.getTime() + 60 * 60 * 1000); // +60 min

      prisma.customer.findUnique.mockResolvedValue(makeCustomer());
      prisma.service.findUnique.mockResolvedValue(svc);
      prisma.branch.findUnique.mockResolvedValue(makeBranch());
      prisma.appointment.count.mockResolvedValue(0);
      prisma.appointment.create.mockResolvedValue(
        makeAppointment({ startAt, endAt: expectedEnd })
      );
      prisma.appointmentStatusHistory.create.mockResolvedValue({});

      await service.createAppointment(BRANCH_ID, CUSTOMER_ID, SERVICE_ID, startAt);

      const createCall = prisma.appointment.create.mock.calls[0][0] as any;
      expect(createCall.data.endAt).toEqual(expectedEnd);
    });
  });
});

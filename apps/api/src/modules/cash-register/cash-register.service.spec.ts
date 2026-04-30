import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { CashRegisterService } from "./cash-register.service";
import { createPrismaMock, PrismaMock } from "../../test/prisma.mock";
import { ManualMovementDto, MovementType } from "./dto/manual-movement.dto";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BRANCH_ID   = "branch-uuid-1";
const REGISTER_ID = "register-uuid-1";
const USER_ID     = "user-uuid-1";

const makeBranch = (overrides: Partial<any> = {}) => ({
  id:        BRANCH_ID,
  name:      "Sede Lima",
  isActive:  true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeRegister = (overrides: Partial<any> = {}) => ({
  id:             REGISTER_ID,
  branchId:       BRANCH_ID,
  status:         "OPEN",
  openingBalance: 100,
  openedAt:       new Date(),
  createdAt:      new Date(),
  updatedAt:      new Date(),
  closedAt:       null,
  closedById:     null,
  closingBalanceReported: null,
  closingBalanceSystem:   null,
  difference:     null,
  notes:          null,
  openedBy: { id: USER_ID, firstName: "Juan", lastName: "Pérez" },
  closedBy:  null,
  branch:   { name: "Sede Lima" },
  ...overrides,
});

const makeAggResult = (amount: number | null = null) => ({
  _sum: { amount },
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CashRegisterService", () => {
  let service: CashRegisterService;
  let prisma:  PrismaMock;
  let auditService: { log: jest.Mock };

  beforeEach(() => {
    prisma = createPrismaMock();
    auditService = { log: jest.fn() };

    service = new CashRegisterService(
      prisma as any,
      auditService as any,
      undefined,
    );
  });

  // ─── openRegister ──────────────────────────────────────────────────────────

  describe("openRegister()", () => {
    const dto = { branch_id: BRANCH_ID, opening_balance: 100, notes: null };

    it("creates a new cash register with status OPEN and openedById", async () => {
      prisma.branch.findUnique.mockResolvedValue(makeBranch());
      prisma.cashRegister.findFirst.mockResolvedValue(null);
      prisma.cashRegister.create.mockResolvedValue(makeRegister());

      await service.openRegister(dto, USER_ID);

      expect(prisma.cashRegister.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status:         "OPEN",
            openedBy:       { connect: { id: USER_ID } },
            openingBalance: dto.opening_balance,
          }),
        }),
      );
    });

    it("throws ConflictException when branch already has an open register", async () => {
      prisma.branch.findUnique.mockResolvedValue(makeBranch());
      prisma.cashRegister.findFirst.mockResolvedValue(makeRegister());

      await expect(service.openRegister(dto, USER_ID)).rejects.toThrow(ConflictException);
      expect(prisma.cashRegister.create).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when branch does not exist", async () => {
      prisma.branch.findUnique.mockResolvedValue(null);

      await expect(service.openRegister(dto, USER_ID)).rejects.toThrow(NotFoundException);
      expect(prisma.cashRegister.findFirst).not.toHaveBeenCalled();
    });
  });

  // ─── closeRegister ─────────────────────────────────────────────────────────

  describe("closeRegister()", () => {
    const closeDto = { closing_balance_reported: 200, notes: "cierre del día" };

    it("updates register to CLOSED with closingBalance, closedAt, closedById", async () => {
      prisma.cashRegister.findUnique.mockResolvedValue(makeRegister({ status: "OPEN", openingBalance: 100 }));
      prisma.cashMovement.aggregate
        .mockResolvedValueOnce(makeAggResult(150)) // IN
        .mockResolvedValueOnce(makeAggResult(50));  // OUT

      const closedRegister = makeRegister({
        status:                  "CLOSED",
        closedAt:                new Date(),
        closedById:              USER_ID,
        closingBalanceReported:  closeDto.closing_balance_reported,
        closingBalanceSystem:    200,
        difference:              0,
      });
      prisma.cashRegister.update.mockResolvedValue(closedRegister);

      await service.closeRegister(REGISTER_ID, closeDto, USER_ID);

      expect(prisma.cashRegister.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: REGISTER_ID },
          data:  expect.objectContaining({
            status:                 "CLOSED",
            closedBy:               { connect: { id: USER_ID } },
            closingBalanceReported: closeDto.closing_balance_reported,
          }),
        }),
      );
    });

    it("throws NotFoundException when register does not exist", async () => {
      prisma.cashRegister.findUnique.mockResolvedValue(null);

      await expect(service.closeRegister(REGISTER_ID, closeDto, USER_ID)).rejects.toThrow(NotFoundException);
      expect(prisma.cashRegister.update).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when register is already CLOSED", async () => {
      prisma.cashRegister.findUnique.mockResolvedValue(makeRegister({ status: "CLOSED" }));

      await expect(service.closeRegister(REGISTER_ID, closeDto, USER_ID)).rejects.toThrow(BadRequestException);
      expect(prisma.cashRegister.update).not.toHaveBeenCalled();
    });
  });

  // ─── addManualMovement ─────────────────────────────────────────────────────

  describe("addManualMovement()", () => {
    const makeMovement = (type: "IN" | "OUT") => ({
      id:             "movement-uuid-1",
      cashRegisterId: REGISTER_ID,
      type,
      amount:         50,
      reason:         "Prueba",
      createdAt:      new Date(),
      createdBy:      { id: USER_ID, firstName: "Juan", lastName: "Pérez" },
    });

    it("creates an IN movement — cashMovement.create called with type IN", async () => {
      const dto: ManualMovementDto = { type: MovementType.IN, amount: 50, reason: "Ingreso manual" };
      prisma.cashRegister.findUnique.mockResolvedValue(makeRegister({ status: "OPEN" }));
      prisma.cashMovement.create.mockResolvedValue(makeMovement("IN"));

      await service.addManualMovement(REGISTER_ID, dto, USER_ID);

      expect(prisma.cashMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: "IN" }),
        }),
      );
    });

    it("creates an OUT movement — cashMovement.create called with type OUT (sufficient balance)", async () => {
      const dto: ManualMovementDto = { type: MovementType.OUT, amount: 50, reason: "Egreso manual" };
      prisma.cashRegister.findUnique.mockResolvedValue(makeRegister({ status: "OPEN", openingBalance: 200 }));
      // For OUT, service aggregates first
      prisma.cashMovement.aggregate
        .mockResolvedValueOnce(makeAggResult(100))  // IN
        .mockResolvedValueOnce(makeAggResult(0));   // OUT
      prisma.cashMovement.create.mockResolvedValue(makeMovement("OUT"));

      await service.addManualMovement(REGISTER_ID, dto, USER_ID);

      expect(prisma.cashMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: "OUT" }),
        }),
      );
    });

    it("throws BadRequestException when register is not OPEN", async () => {
      const dto: ManualMovementDto = { type: MovementType.IN, amount: 50, reason: "Ingreso" };
      prisma.cashRegister.findUnique.mockResolvedValue(makeRegister({ status: "CLOSED" }));

      await expect(service.addManualMovement(REGISTER_ID, dto, USER_ID)).rejects.toThrow(BadRequestException);
      expect(prisma.cashMovement.create).not.toHaveBeenCalled();
    });
  });

  // ─── getRegisterById ───────────────────────────────────────────────────────

  describe("getRegisterById()", () => {
    it("returns register with calculated balance (openingBalance + totalIn - totalOut)", async () => {
      prisma.cashRegister.findUnique.mockResolvedValue(makeRegister({ openingBalance: 100 }));
      prisma.cashMovement.aggregate
        .mockResolvedValueOnce(makeAggResult(200)) // IN
        .mockResolvedValueOnce(makeAggResult(50)); // OUT

      const result = await service.getRegisterById(REGISTER_ID);

      // balance = 100 + 200 - 50 = 250
      expect(result.current_balance).toBe("250.00");
      expect(result.total_in).toBe("200.00");
      expect(result.total_out).toBe("50.00");
    });

    it("throws NotFoundException when register does not exist", async () => {
      prisma.cashRegister.findUnique.mockResolvedValue(null);

      await expect(service.getRegisterById(REGISTER_ID)).rejects.toThrow(NotFoundException);
    });
  });
});

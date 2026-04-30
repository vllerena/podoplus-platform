import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CacheService } from "../cache/cache.service";
import { OpenRegisterDto } from "./dto/open-register.dto";
import { CloseRegisterDto } from "./dto/close-register.dto";
import { ManualMovementDto } from "./dto/manual-movement.dto";

@Injectable()
export class CashRegisterService {
  private readonly logger = new Logger("CashRegisterService");

  constructor(
    private prisma: PrismaService,
    @Optional() private auditService?: AuditService,
    @Optional() private notificationsService?: NotificationsService,
    @Optional() private cacheService?: CacheService
  ) {}

  // ─────────────────────────────────────────────────────────────────
  // ABRIR CAJA
  // ─────────────────────────────────────────────────────────────────

  async openRegister(dto: OpenRegisterDto, openedById: string, idempotencyKey?: string) {
    // Idempotency check
    if (idempotencyKey && this.cacheService) {
      const cacheKey = `idempotency:cashregister:open:${idempotencyKey}`;
      const cached = await this.cacheService.get<ReturnType<CashRegisterService["formatRegister"]>>(cacheKey);
      if (cached !== null) {
        this.logger.warn(`Apertura de caja duplicada (idempotency): ${idempotencyKey}`);
        return cached;
      }
    }

    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branch_id } });
    if (!branch) throw new NotFoundException(`Sede ${dto.branch_id} no encontrada`);

    const existing = await this.prisma.cashRegister.findFirst({
      where: { branchId: dto.branch_id, status: "OPEN" },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe una caja abierta en esta sede (${existing.id}). Ciérrela primero.`
      );
    }

    const register = await this.prisma.cashRegister.create({
      data: {
        branch:         { connect: { id: dto.branch_id } },
        openedBy:       { connect: { id: openedById } },
        openingBalance: dto.opening_balance,
        status:         "OPEN",
        notes:          dto.notes ?? null,
      },
      include: { openedBy: true, branch: true },
    });

    this.auditService?.log({
      actorType: "USER",
      actorId:   openedById,
      branchId:  dto.branch_id,
      action:    "cash_register.opened",
      entityType: "cash_register",
      entityId:  register.id,
      metadata:  { openingBalance: dto.opening_balance },
    });

    this.notificationsService?.notify({
      userId:     openedById,
      type:       "cash_register",
      title:      "Caja abierta",
      body:       `Caja abierta en ${branch.name} con saldo inicial S/ ${dto.opening_balance.toFixed(2)}`,
      entityType: "cash_register",
      entityId:   register.id,
    });

    this.logger.log(
      `Caja abierta: ${register.id} en sede ${dto.branch_id} con saldo inicial S/ ${dto.opening_balance}`
    );

    return this.formatRegister(register);
  }

  // ─────────────────────────────────────────────────────────────────
  // CERRAR CAJA
  // ─────────────────────────────────────────────────────────────────

  async closeRegister(registerId: string, dto: CloseRegisterDto, closedById: string) {
    const register = await this.prisma.cashRegister.findUnique({
      where: { id: registerId },
    });
    if (!register) throw new NotFoundException(`Caja ${registerId} no encontrada`);
    if (register.status !== "OPEN") {
      throw new BadRequestException(`La caja ya está ${register.status}`);
    }

    // Calcular balance usando aggregate — más eficiente que cargar todos los movimientos
    const [inAgg, outAgg] = await Promise.all([
      this.prisma.cashMovement.aggregate({
        where: { cashRegisterId: registerId, type: "IN" },
        _sum:  { amount: true },
      }),
      this.prisma.cashMovement.aggregate({
        where: { cashRegisterId: registerId, type: "OUT" },
        _sum:  { amount: true },
      }),
    ]);

    const totalIn      = Number(inAgg._sum.amount  ?? 0);
    const totalOut     = Number(outAgg._sum.amount ?? 0);
    const systemBalance = Number(register.openingBalance) + totalIn - totalOut;
    const difference   = dto.closing_balance_reported - systemBalance;

    const updated = await this.prisma.cashRegister.update({
      where: { id: registerId },
      data: {
        status:                  "CLOSED",
        closedBy:                { connect: { id: closedById } },
        closedAt:                new Date(),
        closingBalanceReported:  dto.closing_balance_reported,
        closingBalanceSystem:    systemBalance,
        difference,
        notes:                   dto.notes ?? register.notes,
      },
      include: { openedBy: true, closedBy: true, branch: true },
    });

    this.auditService?.log({
      actorType: "USER",
      actorId:   closedById,
      branchId:  register.branchId,
      action:    "cash_register.closed",
      entityType: "cash_register",
      entityId:  registerId,
      metadata: {
        openingBalance:  Number(register.openingBalance),
        totalIn,
        totalOut,
        systemBalance,
        reportedBalance: dto.closing_balance_reported,
        difference,
      },
    });

    const diffStr =
      difference >= 0
        ? `+S/ ${difference.toFixed(2)}`
        : `-S/ ${Math.abs(difference).toFixed(2)}`;

    this.notificationsService?.notify({
      userId:     closedById,
      type:       "cash_register",
      title:      "Caja cerrada",
      body: `Caja cerrada. Sistema: S/ ${systemBalance.toFixed(2)} | Reportado: S/ ${dto.closing_balance_reported.toFixed(2)} | Diferencia: ${diffStr}`,
      entityType: "cash_register",
      entityId:   registerId,
    });

    this.logger.log(
      `Caja cerrada: ${registerId} — sistema: S/ ${systemBalance.toFixed(2)}, ` +
        `reportado: S/ ${dto.closing_balance_reported.toFixed(2)}, diferencia: S/ ${difference.toFixed(2)}`
    );

    return this.formatRegister(updated);
  }

  // ─────────────────────────────────────────────────────────────────
  // CONSULTAR CAJA ABIERTA POR SEDE
  // ─────────────────────────────────────────────────────────────────

  async getOpenRegister(branchId: string) {
    if (!branchId) throw new BadRequestException("branch_id es requerido");

    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException(`Sede ${branchId} no encontrada`);

    const register = await this.prisma.cashRegister.findFirst({
      where:   { branchId, status: "OPEN" },
      include: { openedBy: true, branch: true },
    });

    if (!register) return { open: false, register: null };

    // Balance calculado vía aggregate sin cargar todos los movimientos
    const [inAgg, outAgg] = await Promise.all([
      this.prisma.cashMovement.aggregate({
        where: { cashRegisterId: register.id, type: "IN" },
        _sum:  { amount: true },
      }),
      this.prisma.cashMovement.aggregate({
        where: { cashRegisterId: register.id, type: "OUT" },
        _sum:  { amount: true },
      }),
    ]);

    const totalIn  = Number(inAgg._sum.amount  ?? 0);
    const totalOut = Number(outAgg._sum.amount ?? 0);
    const balance  = Number(register.openingBalance) + totalIn - totalOut;

    return {
      open: true,
      register: {
        ...this.formatRegister(register),
        current_balance: balance.toFixed(2),
        total_in:        totalIn.toFixed(2),
        total_out:       totalOut.toFixed(2),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // DETALLE DE CAJA (por ID)
  // ─────────────────────────────────────────────────────────────────

  async getRegisterById(registerId: string) {
    const register = await this.prisma.cashRegister.findUnique({
      where:   { id: registerId },
      include: { openedBy: true, closedBy: true, branch: true },
    });
    if (!register) throw new NotFoundException(`Caja ${registerId} no encontrada`);

    const [inAgg, outAgg] = await Promise.all([
      this.prisma.cashMovement.aggregate({
        where: { cashRegisterId: registerId, type: "IN" },
        _sum:  { amount: true },
      }),
      this.prisma.cashMovement.aggregate({
        where: { cashRegisterId: registerId, type: "OUT" },
        _sum:  { amount: true },
      }),
    ]);

    const totalIn  = Number(inAgg._sum.amount  ?? 0);
    const totalOut = Number(outAgg._sum.amount ?? 0);
    const balance  = Number(register.openingBalance) + totalIn - totalOut;

    return {
      ...this.formatRegister(register),
      current_balance: balance.toFixed(2),
      total_in:        totalIn.toFixed(2),
      total_out:       totalOut.toFixed(2),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // RESUMEN / CUADRE DE CAJA
  // ─────────────────────────────────────────────────────────────────

  /**
   * Desglose del cuadre de caja: total por tipo de referencia (SALE, MANUAL…)
   * diferenciando entradas y salidas. Útil para el cuadre al cerrar.
   */
  async getRegisterSummary(registerId: string) {
    const register = await this.prisma.cashRegister.findUnique({
      where:   { id: registerId },
      include: { branch: true, openedBy: true, closedBy: true },
    });
    if (!register) throw new NotFoundException(`Caja ${registerId} no encontrada`);

    const [inAgg, outAgg, inCount, outCount] = await Promise.all([
      this.prisma.cashMovement.aggregate({
        where: { cashRegisterId: registerId, type: "IN" },
        _sum:  { amount: true },
      }),
      this.prisma.cashMovement.aggregate({
        where: { cashRegisterId: registerId, type: "OUT" },
        _sum:  { amount: true },
      }),
      this.prisma.cashMovement.count({ where: { cashRegisterId: registerId, type: "IN" } }),
      this.prisma.cashMovement.count({ where: { cashRegisterId: registerId, type: "OUT" } }),
    ]);

    const totalIn      = Number(inAgg._sum.amount  ?? 0);
    const totalOut     = Number(outAgg._sum.amount ?? 0);
    const systemBalance = Number(register.openingBalance) + totalIn - totalOut;

    return {
      register_id:              registerId,
      branch_id:                register.branchId,
      branch_name:              (register as any).branch?.name ?? null,
      status:                   register.status,
      opening_balance:          Number(register.openingBalance).toFixed(2),
      total_in:                 totalIn.toFixed(2),
      total_out:                totalOut.toFixed(2),
      total_movements:          inCount + outCount,
      movements_in_count:       inCount,
      movements_out_count:      outCount,
      system_balance:           systemBalance.toFixed(2),
      closing_balance_reported: register.closingBalanceReported
        ? Number(register.closingBalanceReported).toFixed(2)
        : null,
      closing_balance_system:   register.closingBalanceSystem
        ? Number(register.closingBalanceSystem).toFixed(2)
        : null,
      difference:               register.difference !== null && register.difference !== undefined
        ? Number(register.difference).toFixed(2)
        : null,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // HISTORIAL DE CAJAS POR SEDE (cursor-based)
  // ─────────────────────────────────────────────────────────────────

  async getRegisters(params: {
    branchId: string;
    status?:  string;
    cursor?:  string;
    limit?:   number;
  }) {
    const { branchId, status, cursor, limit: rawLimit = 20 } = params;
    const limit = Math.min(rawLimit, 100);

    if (!branchId) throw new BadRequestException("branch_id es requerido");
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException(`Sede ${branchId} no encontrada`);

    const where: any = { branchId };
    if (status) where.status = status;

    const findArgs: any = {
      where,
      include: { openedBy: true, closedBy: true },
      orderBy: { openedAt: "desc" },
      take:    limit + 1,
    };

    if (cursor) {
      findArgs.cursor = { id: cursor };
      findArgs.skip   = 1;
    }

    const rows     = await this.prisma.cashRegister.findMany(findArgs);
    const hasNext  = rows.length > limit;
    const data     = hasNext ? rows.slice(0, limit) : rows;
    const nextCursor = hasNext ? data[data.length - 1].id : null;

    return {
      data: data.map((r) => this.formatRegister(r)),
      nextCursor,
      hasNext,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // MOVIMIENTOS DE UNA CAJA (cursor-based)
  // ─────────────────────────────────────────────────────────────────

  async getMovements(params: {
    registerId: string;
    type?:      string;
    cursor?:    string;
    limit?:     number;
  }) {
    const { registerId, type, cursor, limit: rawLimit = 50 } = params;
    const limit = Math.min(rawLimit, 200);

    const register = await this.prisma.cashRegister.findUnique({
      where: { id: registerId },
    });
    if (!register) throw new NotFoundException(`Caja ${registerId} no encontrada`);

    const where: any = { cashRegisterId: registerId };
    if (type) where.type = type;

    const findArgs: any = {
      where,
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "asc" },
      take:    limit + 1,
    };

    if (cursor) {
      findArgs.cursor = { id: cursor };
      findArgs.skip   = 1;
    }

    const rows     = await this.prisma.cashMovement.findMany(findArgs);
    const hasNext  = rows.length > limit;
    const data     = hasNext ? rows.slice(0, limit) : rows;
    const nextCursor = hasNext ? data[data.length - 1].id : null;

    return {
      data: data.map((m) => this.formatMovement(m)),
      nextCursor,
      hasNext,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // MOVIMIENTO MANUAL
  // ─────────────────────────────────────────────────────────────────

  async addManualMovement(registerId: string, dto: ManualMovementDto, createdById: string) {
    const register = await this.prisma.cashRegister.findUnique({
      where: { id: registerId },
    });
    if (!register) throw new NotFoundException(`Caja ${registerId} no encontrada`);
    if (register.status !== "OPEN") {
      throw new BadRequestException("No se pueden registrar movimientos en una caja cerrada");
    }

    // Para egresos: validar saldo suficiente
    if (dto.type === "OUT") {
      const [inAgg, outAgg] = await Promise.all([
        this.prisma.cashMovement.aggregate({
          where: { cashRegisterId: registerId, type: "IN" },
          _sum:  { amount: true },
        }),
        this.prisma.cashMovement.aggregate({
          where: { cashRegisterId: registerId, type: "OUT" },
          _sum:  { amount: true },
        }),
      ]);

      const currentBalance =
        Number(register.openingBalance) +
        Number(inAgg._sum.amount  ?? 0) -
        Number(outAgg._sum.amount ?? 0);

      if (dto.amount > currentBalance) {
        throw new BadRequestException(
          `Saldo insuficiente. Disponible: S/ ${currentBalance.toFixed(2)}, solicitado: S/ ${dto.amount.toFixed(2)}`
        );
      }
    }

    const movement = await this.prisma.cashMovement.create({
      data: {
        cashRegister: { connect: { id: registerId } },
        type:         dto.type,
        amount:    dto.amount,
        reason:    dto.reason,
        createdBy: { connect: { id: createdById } },
      },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });

    this.auditService?.log({
      actorType:  "USER",
      actorId:    createdById,
      branchId:   register.branchId,
      action:     "cash_register.movement",
      entityType: "cash_register",
      entityId:   registerId,
      metadata:   { type: dto.type, amount: dto.amount, reason: dto.reason },
    });

    this.logger.log(
      `Movimiento manual en caja ${registerId}: ${dto.type} S/ ${dto.amount} — ${dto.reason}`
    );

    return this.formatMovement(movement);
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private formatRegister(r: any) {
    return {
      id:                       r.id,
      branch_id:                r.branchId,
      branch_name:              r.branch?.name ?? undefined,
      status:                   r.status,
      opening_balance:          Number(r.openingBalance).toFixed(2),
      opened_at:                r.openedAt.toISOString(),
      opened_by:                r.openedBy
        ? { id: r.openedBy.id, name: `${r.openedBy.firstName} ${r.openedBy.lastName}` }
        : undefined,
      closed_at:                r.closedAt ? r.closedAt.toISOString() : null,
      closed_by:                r.closedBy
        ? { id: r.closedBy.id, name: `${r.closedBy.firstName} ${r.closedBy.lastName}` }
        : null,
      closing_balance_reported: r.closingBalanceReported
        ? Number(r.closingBalanceReported).toFixed(2)
        : null,
      closing_balance_system:   r.closingBalanceSystem
        ? Number(r.closingBalanceSystem).toFixed(2)
        : null,
      difference:               r.difference !== null && r.difference !== undefined
        ? Number(r.difference).toFixed(2)
        : null,
      notes:                    r.notes ?? null,
      created_at:               r.createdAt.toISOString(),
      updated_at:               r.updatedAt.toISOString(),
    };
  }

  private formatMovement(m: any) {
    return {
      id:               m.id,
      cash_register_id: m.cashRegisterId,
      type:             m.type,
      amount:           Number(m.amount).toFixed(2),
      reason:     m.reason,
      created_by:       m.createdBy
        ? { id: m.createdBy.id, name: `${m.createdBy.firstName} ${m.createdBy.lastName}` }
        : { id: m.createdById },
      created_at:       m.createdAt.toISOString(),
    };
  }
}

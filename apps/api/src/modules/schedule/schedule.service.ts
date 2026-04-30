import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateBranchHoursDto,
  UpdateBranchHoursDto,
  CreateBlockDto,
  UpdateBlockDto,
  BulkLoadHoursDto,
  BulkLoadBlocksDto,
  BulkLoadScheduleExceptionsDto,
  CreateScheduleExceptionDto,
  UpdateScheduleExceptionDto,
} from "./dto";

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger("ScheduleService");

  constructor(private prisma: PrismaService) {}

  // ============================================================
  // BRANCH HOURS
  // ============================================================

  /** Acceso a sede ya verificado por BranchScopeGuard. */
  async getBranchHours(branchId: string) {
    return this.prisma.branchHour.findMany({
      where: { branchId },
      orderBy: { weekday: "asc" },
    });
  }

  /** Permiso schedule.manage y acceso a sede ya verificados en el controller. */
  async createBranchHours(branchId: string, dto: CreateBranchHoursDto) {
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException("startTime debe ser menor que endTime");
    }

    const existing = await this.prisma.branchHour.findFirst({
      where: {
        branchId,
        weekday: dto.weekday,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
    });
    if (existing) {
      throw new BadRequestException(
        "Ya existe un horario en este rango para este día"
      );
    }

    const hours = await this.prisma.branchHour.create({
      data: {
        branchId,
        weekday: dto.weekday,
        startTime: dto.startTime,
        endTime: dto.endTime,
        isActive: true,
      },
    });

    this.logger.log(
      `Horario creado para sede ${branchId}: ${dto.startTime}–${dto.endTime} (día ${dto.weekday})`
    );
    return hours;
  }

  /** Permiso schedule.manage y acceso a sede ya verificados en el controller. */
  async updateBranchHours(branchId: string, id: string, dto: UpdateBranchHoursDto) {
    const hours = await this.prisma.branchHour.findUnique({ where: { id } });
    if (!hours || hours.branchId !== branchId) {
      throw new NotFoundException("Horario no encontrado");
    }

    const effectiveStart = dto.startTime ?? hours.startTime;
    const effectiveEnd   = dto.endTime   ?? hours.endTime;
    if (effectiveStart >= effectiveEnd) {
      throw new BadRequestException("startTime debe ser menor que endTime");
    }

    const updated = await this.prisma.branchHour.update({
      where: { id },
      data: {
        weekday: dto.weekday ?? hours.weekday,
        startTime: dto.startTime ?? hours.startTime,
        endTime: dto.endTime ?? hours.endTime,
      },
    });

    this.logger.log(`Horario actualizado: ${id}`);
    return updated;
  }

  /** Permiso schedule.manage y acceso a sede ya verificados en el controller. */
  async deleteBranchHours(branchId: string, id: string) {
    const hours = await this.prisma.branchHour.findUnique({ where: { id } });
    if (!hours || hours.branchId !== branchId) {
      throw new NotFoundException("Horario no encontrado");
    }

    await this.prisma.branchHour.delete({ where: { id } });
    this.logger.log(`Horario eliminado: ${id}`);
    return { success: true };
  }

  // ============================================================
  // BLOCKS (Refrigerio, Feriados, etc.)
  // ============================================================

  /** Acceso a sede ya verificado por BranchScopeGuard. */
  async getBranchBlocks(branchId: string, from?: string, to?: string) {
    const where: any = { branchId };

    if (from && to) {
      where.startAt = { gte: new Date(from) };
      where.endAt = { lte: new Date(to) };
    }

    return this.prisma.branchBlock.findMany({
      where,
      orderBy: { startAt: "desc" },
    });
  }

  /** Permiso schedule.manage y acceso a sede ya verificados en el controller. */
  async createBlock(branchId: string, dto: CreateBlockDto, actorId: string) {
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException("startTime debe ser menor que endTime");
    }

    const [year, month, day] = dto.date.split("-").map(Number);
    const [startHour, startMin] = dto.startTime.split(":").map(Number);
    const [endHour, endMin] = dto.endTime.split(":").map(Number);

    const startAt = new Date(Date.UTC(year, month - 1, day, startHour, startMin, 0, 0));
    const endAt   = new Date(Date.UTC(year, month - 1, day, endHour,   endMin,   0, 0));

    const isRecurring = !!(dto.isRecurring && dto.weekday !== undefined);
    const blockStartTime =
      isRecurring && dto.recurringStartTime ? dto.recurringStartTime : null;
    const blockEndTime =
      isRecurring && dto.recurringEndTime ? dto.recurringEndTime : null;

    const block = await this.prisma.branchBlock.create({
      data: {
        branchId,
        type: dto.type,
        title: dto.title,
        startAt,
        endAt,
        isRecurring,
        weekday: isRecurring ? dto.weekday : null,
        startTime: blockStartTime,
        endTime: blockEndTime,
        createdById: actorId,
      },
    });

    this.logger.log(
      `Bloqueo creado para sede ${branchId}: ${dto.title} (${dto.type})`
    );
    return block;
  }

  /** Permiso schedule.manage y acceso a sede ya verificados en el controller. */
  async updateBlock(branchId: string, id: string, dto: UpdateBlockDto) {
    const block = await this.prisma.branchBlock.findUnique({ where: { id } });
    if (!block || block.branchId !== branchId) {
      throw new NotFoundException("Bloqueo no encontrado");
    }

    let startAt = block.startAt;
    let endAt = block.endAt;

    if (dto.date || dto.startTime || dto.endTime) {
      const dateToUse = dto.date || block.startAt.toISOString().split("T")[0];
      const startTimeToUse = dto.startTime || block.startTime || "00:00";
      const endTimeToUse = dto.endTime || block.endTime || "23:59";

      const [year, month, day] = dateToUse.split("-").map(Number);
      const [startHour, startMin] = startTimeToUse.split(":").map(Number);
      const [endHour, endMin] = endTimeToUse.split(":").map(Number);

      startAt = new Date(Date.UTC(year, month - 1, day, startHour, startMin, 0, 0));
      endAt   = new Date(Date.UTC(year, month - 1, day, endHour,   endMin,   0, 0));
    }

    const updated = await this.prisma.branchBlock.update({
      where: { id },
      data: {
        type: dto.type ?? block.type,
        title: dto.title ?? block.title,
        startAt,
        endAt,
        isRecurring: dto.isRecurring ?? block.isRecurring,
        weekday: dto.weekday ?? block.weekday,
        startTime: dto.recurringStartTime ?? block.startTime,
        endTime: dto.recurringEndTime ?? block.endTime,
      },
    });

    this.logger.log(`Bloqueo actualizado: ${id}`);
    return updated;
  }

  /** Permiso schedule.manage y acceso a sede ya verificados en el controller. */
  async deleteBlock(branchId: string, id: string) {
    const block = await this.prisma.branchBlock.findUnique({ where: { id } });
    if (!block || block.branchId !== branchId) {
      throw new NotFoundException("Bloqueo no encontrado");
    }

    await this.prisma.branchBlock.delete({ where: { id } });
    this.logger.log(`Bloqueo eliminado: ${id}`);
    return { success: true };
  }

  // ============================================================
  // SCHEDULE EXCEPTIONS (Overrides por fecha específica)
  // ============================================================

  /** Acceso a sede ya verificado por BranchScopeGuard. */
  async getScheduleExceptions(branchId: string, from?: string, to?: string) {
    const where: any = { branchId };

    if (from && to) {
      where.date = { gte: new Date(from), lte: new Date(to) };
    }

    return this.prisma.branchScheduleException.findMany({
      where,
      orderBy: { date: "asc" },
    });
  }

  /** Permiso schedule.manage y acceso a sede ya verificados en el controller. */
  async createScheduleException(
    branchId: string,
    dto: CreateScheduleExceptionDto,
    actorId: string
  ) {
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException("startTime debe ser menor que endTime");
    }

    const existingException =
      await this.prisma.branchScheduleException.findUnique({
        where: { branchId_date: { branchId, date: new Date(dto.date) } },
      });
    if (existingException) {
      throw new BadRequestException(
        "Ya existe una excepción de horario para esta fecha en esta sede"
      );
    }

    const exception = await this.prisma.branchScheduleException.create({
      data: {
        branchId,
        date: new Date(dto.date),
        startTime: dto.startTime,
        endTime: dto.endTime,
        reason: dto.reason,
        createdById: actorId,
      },
    });

    this.logger.log(
      `Excepción de horario creada para sede ${branchId} en ${dto.date}: ${dto.startTime}–${dto.endTime}`
    );
    return exception;
  }

  /** Permiso schedule.manage y acceso a sede ya verificados en el controller. */
  async updateScheduleException(
    branchId: string,
    id: string,
    dto: UpdateScheduleExceptionDto
  ) {
    const exception = await this.prisma.branchScheduleException.findUnique({
      where: { id },
    });
    if (!exception || exception.branchId !== branchId) {
      throw new NotFoundException("Excepción de horario no encontrada");
    }

    const updated = await this.prisma.branchScheduleException.update({
      where: { id },
      data: {
        startTime: dto.startTime ?? exception.startTime,
        endTime: dto.endTime ?? exception.endTime,
        reason: dto.reason ?? exception.reason,
      },
    });

    this.logger.log(`Excepción de horario actualizada: ${id}`);
    return updated;
  }

  /** Permiso schedule.manage y acceso a sede ya verificados en el controller. */
  async deleteScheduleException(branchId: string, id: string) {
    const exception = await this.prisma.branchScheduleException.findUnique({
      where: { id },
    });
    if (!exception || exception.branchId !== branchId) {
      throw new NotFoundException("Excepción de horario no encontrada");
    }

    await this.prisma.branchScheduleException.delete({ where: { id } });
    this.logger.log(`Excepción de horario eliminada: ${id}`);
    return { success: true };
  }

  /**
   * Resuelve el horario efectivo para una sede en una fecha:
   *   excepción específica → horario semanal → sede sin horario ese día
   *
   * Acceso a sede ya verificado por BranchScopeGuard.
   */
  async getEffectiveSchedule(branchId: string, date: string) {
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getUTCDay();

    const exception = await this.prisma.branchScheduleException.findUnique({
      where: { branchId_date: { branchId, date: dateObj } },
    });

    if (exception) {
      return {
        type: "exception",
        startTime: exception.startTime,
        endTime: exception.endTime,
        reason: exception.reason,
        date: exception.date,
      };
    }

    const weekdaySchedule = await this.prisma.branchHour.findFirst({
      where: { branchId, weekday: dayOfWeek, isActive: true },
    });

    if (weekdaySchedule) {
      return {
        type: "weekly",
        startTime: weekdaySchedule.startTime,
        endTime: weekdaySchedule.endTime,
        date: dateObj,
      };
    }

    throw new BadRequestException(
      `La sede ${branchId} no tiene horario definido para ${date}`
    );
  }

  // ============================================================
  // BULK OPERATIONS — rol SUPER_ADMIN / OPS_MANAGER verificado en el controller
  // ============================================================

  /**
   * Reemplaza todos los horarios de las sedes indicadas con los del DTO.
   */
  async bulkLoadHours(dto: BulkLoadHoursDto, actorId: string) {
    let branchIds = dto.branchIds;
    if (!branchIds || branchIds.length === 0) {
      const all = await this.prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      branchIds = all.map((b) => b.id);
    }

    const found = await this.prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true },
    });
    if (found.length !== branchIds.length) {
      throw new BadRequestException("Una o más sedes no existen");
    }

    const result = {
      totalBranches: branchIds.length,
      successCount: 0,
      failures: [] as { branchId: string; error: string }[],
    };

    for (const branchId of branchIds) {
      try {
        await this.prisma.branchHour.deleteMany({ where: { branchId } });
        const created = await this.prisma.branchHour.createMany({
          data: dto.hours.map((h) => ({
            branchId,
            weekday: h.weekday,
            startTime: h.startTime,
            endTime: h.endTime,
            isActive: true,
          })),
        });
        result.successCount++;
        this.logger.log(
          `Bulk hours — sede ${branchId}: ${created.count} registros (actor: ${actorId})`
        );
      } catch (error) {
        result.failures.push({ branchId, error: (error as Error).message });
        this.logger.error(
          `Bulk hours error — sede ${branchId}: ${(error as Error).message}`
        );
      }
    }

    return result;
  }

  /**
   * Agrega bloqueos en masa para las sedes indicadas.
   */
  async bulkLoadBlocks(dto: BulkLoadBlocksDto, actorId: string) {
    let branchIds = dto.branchIds;
    if (!branchIds || branchIds.length === 0) {
      const all = await this.prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      branchIds = all.map((b) => b.id);
    }

    const found = await this.prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true },
    });
    if (found.length !== branchIds.length) {
      throw new BadRequestException("Una o más sedes no existen");
    }

    const result = {
      totalBranches: branchIds.length,
      totalBlocksCreated: 0,
      successCount: 0,
      failures: [] as { branchId: string; error: string }[],
    };

    for (const branchId of branchIds) {
      try {
        const data = dto.blocks.map((b) => {
          const [year, month, day] = b.date.split("-").map(Number);
          const [sh, sm] = b.startTime.split(":").map(Number);
          const [eh, em] = b.endTime.split(":").map(Number);
          return {
            branchId,
            type: b.type,
            title: b.title,
            startAt: new Date(Date.UTC(year, month - 1, day, sh, sm, 0, 0)),
            endAt:   new Date(Date.UTC(year, month - 1, day, eh, em, 0, 0)),
            isRecurring: !!(b.weekday && b.recurringStartTime && b.recurringEndTime),
            weekday: b.weekday ?? null,
            startTime: b.recurringStartTime ?? null,
            endTime: b.recurringEndTime ?? null,
            createdById: actorId,
          };
        });

        const created = await this.prisma.branchBlock.createMany({ data });
        result.successCount++;
        result.totalBlocksCreated += created.count;
        this.logger.log(
          `Bulk blocks — sede ${branchId}: ${created.count} registros`
        );
      } catch (error) {
        result.failures.push({ branchId, error: (error as Error).message });
        this.logger.error(
          `Bulk blocks error — sede ${branchId}: ${(error as Error).message}`
        );
      }
    }

    return result;
  }

  /**
   * Agrega excepciones de horario en masa para las sedes indicadas.
   */
  async bulkLoadScheduleExceptions(
    dto: BulkLoadScheduleExceptionsDto,
    actorId: string
  ) {
    let branchIds = dto.branchIds;
    if (!branchIds || branchIds.length === 0) {
      const all = await this.prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      branchIds = all.map((b) => b.id);
    }

    const found = await this.prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true },
    });
    if (found.length !== branchIds.length) {
      throw new BadRequestException("Una o más sedes no existen");
    }

    const result = {
      totalBranches: branchIds.length,
      totalExceptionsCreated: 0,
      successCount: 0,
      failures: [] as { branchId: string; error: string }[],
    };

    for (const branchId of branchIds) {
      try {
        const created = await this.prisma.branchScheduleException.createMany({
          data: dto.exceptions.map((e) => ({
            branchId,
            date: new Date(e.date),
            startTime: e.startTime,
            endTime: e.endTime,
            reason: e.reason,
            createdById: actorId,
          })),
          skipDuplicates: true,
        });
        result.successCount++;
        result.totalExceptionsCreated += created.count;
        this.logger.log(
          `Bulk exceptions — sede ${branchId}: ${created.count} registros`
        );
      } catch (error) {
        result.failures.push({ branchId, error: (error as Error).message });
        this.logger.error(
          `Bulk exceptions error — sede ${branchId}: ${(error as Error).message}`
        );
      }
    }

    return result;
  }

  // ============================================================
  // TEMPLATE
  // ============================================================

  /** Devuelve la plantilla estándar de horarios (Lun–Vie 08–18, Sáb 08–16 + refrigerio 13–14). */
  getDefaultScheduleTemplate() {
    const hours = [
      { weekday: 1, startTime: "08:00", endTime: "18:00" },
      { weekday: 2, startTime: "08:00", endTime: "18:00" },
      { weekday: 3, startTime: "08:00", endTime: "18:00" },
      { weekday: 4, startTime: "08:00", endTime: "18:00" },
      { weekday: 5, startTime: "08:00", endTime: "18:00" },
      { weekday: 6, startTime: "08:00", endTime: "16:00" },
    ];

    const blocks = [1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      startTime: "13:00",
      endTime: "14:00",
      type: "LUNCH",
      title: "Refrigerio",
    }));

    return { hours, blocks };
  }
}

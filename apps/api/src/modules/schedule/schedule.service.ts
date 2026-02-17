import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";
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

  constructor(
    private prisma: PrismaService,
    private rbacService: RbacService
  ) {}

  // ============================================================
  // BRANCH HOURS
  // ============================================================

  /**
   * Obtiene horarios de una sede
   */
  async getBranchHours(branchId: string, userId: string) {
    // Validar acceso
    const hasAccess = await this.rbacService.hasAccessToBranch(
      userId,
      branchId
    );
    if (!hasAccess) {
      throw new ForbiddenException("No tienes acceso a esta sede");
    }

    // Validar que existe la sede
    await this.validateBranchExists(branchId);

    return this.prisma.branchHour.findMany({
      where: { branchId },
      orderBy: { weekday: "asc" },
    });
  }

  /**
   * Crea horario para una sede en un día
   */
  async createBranchHours(
    branchId: string,
    dto: CreateBranchHoursDto,
    userId: string
  ) {
    // Validar permiso
    const hasPermission = await this.rbacService.hasPermission(
      userId,
      "schedule.manage"
    );
    if (!hasPermission) {
      throw new ForbiddenException("No tienes permiso para gestionar horarios");
    }

    // Validar acceso a sede
    const hasAccess = await this.rbacService.hasAccessToBranch(
      userId,
      branchId
    );
    if (!hasAccess) {
      throw new ForbiddenException("No tienes acceso a esta sede");
    }

    // Validar que existe la sede
    await this.validateBranchExists(branchId);

    // Validar que startTime < endTime
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException("startTime debe ser menor que endTime");
    }

    // Validar que no exista conflicto
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
      `Horario creado para sede ${branchId}: ${dto.startTime} - ${dto.endTime} (día ${dto.weekday})`
    );

    return hours;
  }

  /**
   * Actualiza horario
   */
  async updateBranchHours(
    branchId: string,
    id: string,
    dto: UpdateBranchHoursDto,
    userId: string
  ) {
    // Validar permiso
    const hasPermission = await this.rbacService.hasPermission(
      userId,
      "schedule.manage"
    );
    if (!hasPermission) {
      throw new ForbiddenException("No tienes permiso para gestionar horarios");
    }

    // Validar acceso a sede
    const hasAccess = await this.rbacService.hasAccessToBranch(
      userId,
      branchId
    );
    if (!hasAccess) {
      throw new ForbiddenException("No tienes acceso a esta sede");
    }

    // Validar que existe
    const hours = await this.prisma.branchHour.findUnique({
      where: { id },
    });

    if (!hours || hours.branchId !== branchId) {
      throw new NotFoundException("Horario no encontrado");
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

  /**
   * Elimina horario
   */
  async deleteBranchHours(branchId: string, id: string, userId: string) {
    // Validar permiso
    const hasPermission = await this.rbacService.hasPermission(
      userId,
      "schedule.manage"
    );
    if (!hasPermission) {
      throw new ForbiddenException("No tienes permiso para gestionar horarios");
    }

    // Validar acceso a sede
    const hasAccess = await this.rbacService.hasAccessToBranch(
      userId,
      branchId
    );
    if (!hasAccess) {
      throw new ForbiddenException("No tienes acceso a esta sede");
    }

    // Validar que existe
    const hours = await this.prisma.branchHour.findUnique({
      where: { id },
    });

    if (!hours || hours.branchId !== branchId) {
      throw new NotFoundException("Horario no encontrado");
    }

    await this.prisma.branchHour.delete({
      where: { id },
    });

    this.logger.log(`Horario eliminado: ${id}`);

    return { success: true };
  }

  // ============================================================
  // BLOCKS (Bloqueos - Refrigerio, Feriados, etc)
  // ============================================================

  /**
   * Obtiene bloqueos de una sede
   */
  async getBranchBlocks(
    branchId: string,
    userId: string,
    from?: string,
    to?: string
  ) {
    // Validar acceso
    const hasAccess = await this.rbacService.hasAccessToBranch(
      userId,
      branchId
    );
    if (!hasAccess) {
      throw new ForbiddenException("No tienes acceso a esta sede");
    }

    // Validar que existe la sede
    await this.validateBranchExists(branchId);

    const where: any = { branchId };

    if (from && to) {
      where.startAt = {
        gte: new Date(from),
      };
      where.endAt = {
        lte: new Date(to),
      };
    }

    return this.prisma.branchBlock.findMany({
      where,
      orderBy: { startAt: "desc" },
    });
  }

  /**
   * Crea un bloqueo
   */
  async createBlock(branchId: string, dto: CreateBlockDto, userId: string) {
    // Validar permiso
    const hasPermission = await this.rbacService.hasPermission(
      userId,
      "schedule.manage"
    );
    if (!hasPermission) {
      throw new ForbiddenException("No tienes permiso para gestionar horarios");
    }

    // Validar acceso a sede
    const hasAccess = await this.rbacService.hasAccessToBranch(
      userId,
      branchId
    );
    if (!hasAccess) {
      throw new ForbiddenException("No tienes acceso a esta sede");
    }

    // Validar que existe la sede
    await this.validateBranchExists(branchId);

    // Validar que startTime < endTime
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException("startTime debe ser menor que endTime");
    }

    // Convertir fecha y horas a DateTime
    const [year, month, day] = dto.date.split("-").map(Number);
    const [startHour, startMin] = dto.startTime.split(":").map(Number);
    const [endHour, endMin] = dto.endTime.split(":").map(Number);

    const startAt = new Date(year, month - 1, day, startHour, startMin, 0, 0);
    const endAt = new Date(year, month - 1, day, endHour, endMin, 0, 0);

    // Para bloques recurrentes, usar los tiempos recurrentes
    const isRecurring = dto.isRecurring && dto.weekday !== undefined;
    let blockStartTime: string | null = null;
    let blockEndTime: string | null = null;

    if (isRecurring && dto.recurringStartTime && dto.recurringEndTime) {
      blockStartTime = dto.recurringStartTime;
      blockEndTime = dto.recurringEndTime;
    }

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
        createdById: userId,
      },
    });

    this.logger.log(
      `Bloqueo creado para sede ${branchId}: ${dto.title} (${dto.type})`
    );

    return block;
  }

  /**
   * Actualiza un bloqueo
   */
  async updateBlock(
    branchId: string,
    id: string,
    dto: UpdateBlockDto,
    userId: string
  ) {
    // Validar permiso
    const hasPermission = await this.rbacService.hasPermission(
      userId,
      "schedule.manage"
    );
    if (!hasPermission) {
      throw new ForbiddenException("No tienes permiso para gestionar horarios");
    }

    // Validar acceso a sede
    const hasAccess = await this.rbacService.hasAccessToBranch(
      userId,
      branchId
    );
    if (!hasAccess) {
      throw new ForbiddenException("No tienes acceso a esta sede");
    }

    // Validar que existe
    const block = await this.prisma.branchBlock.findUnique({
      where: { id },
    });

    if (!block || block.branchId !== branchId) {
      throw new NotFoundException("Bloqueo no encontrado");
    }

    // Procesar fechas y horas si se proporcionan
    let startAt = block.startAt;
    let endAt = block.endAt;
    let startTime = block.startTime;
    let endTime = block.endTime;

    if (dto.date || dto.startTime || dto.endTime) {
      const dateToUse = dto.date || block.startAt.toISOString().split("T")[0];
      const startTimeToUse = dto.startTime || block.startTime || "00:00";
      const endTimeToUse = dto.endTime || block.endTime || "23:59";

      const [year, month, day] = dateToUse.split("-").map(Number);
      const [startHour, startMin] = startTimeToUse.split(":").map(Number);
      const [endHour, endMin] = endTimeToUse.split(":").map(Number);

      startAt = new Date(year, month - 1, day, startHour, startMin, 0, 0);
      endAt = new Date(year, month - 1, day, endHour, endMin, 0, 0);
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
        startTime: dto.recurringStartTime ?? startTime,
        endTime: dto.recurringEndTime ?? endTime,
      },
    });

    this.logger.log(`Bloqueo actualizado: ${id}`);

    return updated;
  }

  /**
   * Elimina un bloqueo
   */
  async deleteBlock(branchId: string, id: string, userId: string) {
    // Validar permiso
    const hasPermission = await this.rbacService.hasPermission(
      userId,
      "schedule.manage"
    );
    if (!hasPermission) {
      throw new ForbiddenException("No tienes permiso para gestionar horarios");
    }

    // Validar acceso a sede
    const hasAccess = await this.rbacService.hasAccessToBranch(
      userId,
      branchId
    );
    if (!hasAccess) {
      throw new ForbiddenException("No tienes acceso a esta sede");
    }

    // Validar que existe
    const block = await this.prisma.branchBlock.findUnique({
      where: { id },
    });

    if (!block || block.branchId !== branchId) {
      throw new NotFoundException("Bloqueo no encontrado");
    }

    await this.prisma.branchBlock.delete({
      where: { id },
    });

    this.logger.log(`Bloqueo eliminado: ${id}`);

    return { success: true };
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async validateBranchExists(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw new NotFoundException(`Sede con ID ${branchId} no encontrada`);
    }
  }

  // ============================================================
  // BULK OPERATIONS
  // ============================================================

  /**
   * Carga horarios en masa para múltiples sedes
   * Limpia horarios existentes y crea los nuevos
   */
  async bulkLoadHours(dto: BulkLoadHoursDto, userId: string) {
    // Validar permiso
    const hasPermission = await this.rbacService.hasPermission(
      userId,
      "schedule.manage"
    );
    if (!hasPermission) {
      throw new ForbiddenException("No tienes permiso para gestionar horarios");
    }

    // Validar que es SUPER_ADMIN o GERENTE_OPERACIONES
    const isSuperAdmin = await this.rbacService.hasRole(userId, "SUPER_ADMIN");
    const isOpsManager = await this.rbacService.hasRole(userId, "OPS_MANAGER");

    if (!isSuperAdmin && !isOpsManager) {
      throw new ForbiddenException(
        "Solo SUPER_ADMIN o GERENTE_OPERACIONES pueden hacer carga masiva"
      );
    }

    // Si no especifica sedes, usar todas las activas
    let branchIds = dto.branchIds;
    if (!branchIds || branchIds.length === 0) {
      const branches = await this.prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      branchIds = branches.map((b) => b.id);
    }

    // Validar que todas las sedes existan
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true },
    });

    if (branches.length !== branchIds.length) {
      throw new BadRequestException("Una o más sedes no existen");
    }

    const result = {
      totalBranches: branchIds.length,
      successCount: 0,
      failures: [] as any[],
    };

    // Para cada sede, eliminar horarios existentes y crear nuevos
    for (const branchId of branchIds) {
      try {
        // Eliminar horarios existentes
        await this.prisma.branchHour.deleteMany({
          where: { branchId },
        });

        // Crear nuevos horarios
        const createdHours = await this.prisma.branchHour.createMany({
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
          `Horarios cargados exitosamente en sede ${branchId}: ${createdHours.count} registros`
        );
      } catch (error) {
        result.failures.push({
          branchId,
          error: error.message,
        });
        this.logger.error(
          `Error cargando horarios en sede ${branchId}: ${error.message}`
        );
      }
    }

    return result;
  }

  /**
   * Carga bloqueos en masa para múltiples sedes
   */
  async bulkLoadBlocks(dto: BulkLoadBlocksDto, userId: string) {
    // Validar permiso
    const hasPermission = await this.rbacService.hasPermission(
      userId,
      "schedule.manage"
    );
    if (!hasPermission) {
      throw new ForbiddenException("No tienes permiso para gestionar horarios");
    }

    // Validar que es SUPER_ADMIN o GERENTE_OPERACIONES
    const isSuperAdmin = await this.rbacService.hasRole(userId, "SUPER_ADMIN");
    const isOpsManager = await this.rbacService.hasRole(userId, "OPS_MANAGER");

    if (!isSuperAdmin && !isOpsManager) {
      throw new ForbiddenException(
        "Solo SUPER_ADMIN o GERENTE_OPERACIONES pueden hacer carga masiva"
      );
    }

    // Si no especifica sedes, usar todas las activas
    let branchIds = dto.branchIds;
    if (!branchIds || branchIds.length === 0) {
      const branches = await this.prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      branchIds = branches.map((b) => b.id);
    }

    // Validar que todas las sedes existan
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true },
    });

    if (branches.length !== branchIds.length) {
      throw new BadRequestException("Una o más sedes no existen");
    }

    const result = {
      totalBranches: branchIds.length,
      totalBlocksCreated: 0,
      successCount: 0,
      failures: [] as any[],
    };

    // Para cada sede, crear los bloqueos
    for (const branchId of branchIds) {
      try {
        const blocksToCreate = dto.blocks.map((b) => {
          const [year, month, day] = b.date.split("-").map(Number);
          const [startHour, startMin] = b.startTime.split(":").map(Number);
          const [endHour, endMin] = b.endTime.split(":").map(Number);

          const startAt = new Date(
            year,
            month - 1,
            day,
            startHour,
            startMin,
            0,
            0
          );
          const endAt = new Date(year, month - 1, day, endHour, endMin, 0, 0);

          return {
            branchId,
            type: b.type,
            title: b.title,
            startAt,
            endAt,
            isRecurring: !!(
              b.weekday &&
              b.recurringStartTime &&
              b.recurringEndTime
            ),
            weekday: b.weekday,
            startTime: b.recurringStartTime,
            endTime: b.recurringEndTime,
            createdById: userId,
          };
        });

        const createdBlocks = await this.prisma.branchBlock.createMany({
          data: blocksToCreate,
        });

        result.successCount++;
        result.totalBlocksCreated += createdBlocks.count;
        this.logger.log(
          `Bloqueos cargados exitosamente en sede ${branchId}: ${createdBlocks.count} registros`
        );
      } catch (error) {
        result.failures.push({
          branchId,
          error: (error as Error).message,
        });
        this.logger.error(
          `Error cargando bloqueos en sede ${branchId}: ${(error as Error).message}`
        );
      }
    }

    return result;
  }

  /**
   * Crea horarios por defecto (plantilla estándar)
   * Útil para inicializar nuevas sedes rápidamente
   */
  async createDefaultScheduleTemplate(branchIds?: string[], userId?: string) {
    // Plantilla estándar: Lunes a viernes 8-18, Sábado 8-16
    const defaultHours = [
      { weekday: 1, startTime: "08:00", endTime: "18:00" }, // Lunes
      { weekday: 2, startTime: "08:00", endTime: "18:00" }, // Martes
      { weekday: 3, startTime: "08:00", endTime: "18:00" }, // Miércoles
      { weekday: 4, startTime: "08:00", endTime: "18:00" }, // Jueves
      { weekday: 5, startTime: "08:00", endTime: "18:00" }, // Viernes
      { weekday: 6, startTime: "08:00", endTime: "16:00" }, // Sábado
    ];

    // Bloqueo estándar: Refrigerio 13:00-14:00 todos los días
    const defaultBlocks = [
      {
        weekday: 1,
        startTime: "13:00",
        endTime: "14:00",
        type: "LUNCH",
        title: "Refrigerio",
      },
      {
        weekday: 2,
        startTime: "13:00",
        endTime: "14:00",
        type: "LUNCH",
        title: "Refrigerio",
      },
      {
        weekday: 3,
        startTime: "13:00",
        endTime: "14:00",
        type: "LUNCH",
        title: "Refrigerio",
      },
      {
        weekday: 4,
        startTime: "13:00",
        endTime: "14:00",
        type: "LUNCH",
        title: "Refrigerio",
      },
      {
        weekday: 5,
        startTime: "13:00",
        endTime: "14:00",
        type: "LUNCH",
        title: "Refrigerio",
      },
      {
        weekday: 6,
        startTime: "13:00",
        endTime: "14:00",
        type: "LUNCH",
        title: "Refrigerio",
      },
    ];

    return {
      hours: defaultHours,
      blocks: defaultBlocks,
    };
  }

  // ============================================================
  // SCHEDULE EXCEPTIONS (Overrides por fecha específica)
  // ============================================================

  /**
   * Obtiene excepciones de horario para una sede
   */
  async getScheduleExceptions(
    branchId: string,
    userId: string,
    from?: string,
    to?: string
  ) {
    // Validar acceso
    const hasAccess = await this.rbacService.hasAccessToBranch(
      userId,
      branchId
    );
    if (!hasAccess) {
      throw new ForbiddenException("No tienes acceso a esta sede");
    }

    // Validar que existe la sede
    await this.validateBranchExists(branchId);

    const where: any = { branchId };

    if (from && to) {
      where.date = {
        gte: new Date(from),
        lte: new Date(to),
      };
    }

    return this.prisma.branchScheduleException.findMany({
      where,
      orderBy: { date: "asc" },
    });
  }

  /**
   * Crea una excepción de horario para una fecha específica
   */
  async createScheduleException(
    branchId: string,
    dto: CreateScheduleExceptionDto,
    userId: string
  ) {
    // Validar permiso
    const hasPermission = await this.rbacService.hasPermission(
      userId,
      "schedule.manage"
    );
    if (!hasPermission) {
      throw new ForbiddenException("No tienes permiso para gestionar horarios");
    }

    // Validar acceso a sede
    const hasAccess = await this.rbacService.hasAccessToBranch(
      userId,
      branchId
    );
    if (!hasAccess) {
      throw new ForbiddenException("No tienes acceso a esta sede");
    }

    // Validar que existe la sede
    await this.validateBranchExists(branchId);

    // Validar que startTime < endTime
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException("startTime debe ser menor que endTime");
    }

    // Validar que no exista ya una excepción para esa fecha
    const existingException =
      await this.prisma.branchScheduleException.findUnique({
        where: {
          branchId_date: {
            branchId,
            date: new Date(dto.date),
          },
        },
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
        createdById: userId,
      },
    });

    this.logger.log(
      `Excepción de horario creada para sede ${branchId} en fecha ${dto.date}: ${dto.startTime} - ${dto.endTime}`
    );

    return exception;
  }

  /**
   * Actualiza una excepción de horario
   */
  async updateScheduleException(
    branchId: string,
    id: string,
    dto: UpdateScheduleExceptionDto,
    userId: string
  ) {
    // Validar permiso
    const hasPermission = await this.rbacService.hasPermission(
      userId,
      "schedule.manage"
    );
    if (!hasPermission) {
      throw new ForbiddenException("No tienes permiso para gestionar horarios");
    }

    // Validar acceso a sede
    const hasAccess = await this.rbacService.hasAccessToBranch(
      userId,
      branchId
    );
    if (!hasAccess) {
      throw new ForbiddenException("No tienes acceso a esta sede");
    }

    // Validar que existe
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

  /**
   * Elimina una excepción de horario
   */
  async deleteScheduleException(branchId: string, id: string, userId: string) {
    // Validar permiso
    const hasPermission = await this.rbacService.hasPermission(
      userId,
      "schedule.manage"
    );
    if (!hasPermission) {
      throw new ForbiddenException("No tienes permiso para gestionar horarios");
    }

    // Validar acceso a sede
    const hasAccess = await this.rbacService.hasAccessToBranch(
      userId,
      branchId
    );
    if (!hasAccess) {
      throw new ForbiddenException("No tienes acceso a esta sede");
    }

    // Validar que existe
    const exception = await this.prisma.branchScheduleException.findUnique({
      where: { id },
    });

    if (!exception || exception.branchId !== branchId) {
      throw new NotFoundException("Excepción de horario no encontrada");
    }

    await this.prisma.branchScheduleException.delete({
      where: { id },
    });

    this.logger.log(`Excepción de horario eliminada: ${id}`);

    return { success: true };
  }

  /**
   * Obtiene el horario efectivo para una sede en una fecha específica
   * Resuelve: override específico → horario semanal → error
   */
  async getEffectiveSchedule(branchId: string, date: string, userId: string) {
    // Validar acceso
    const hasAccess = await this.rbacService.hasAccessToBranch(
      userId,
      branchId
    );
    if (!hasAccess) {
      throw new ForbiddenException("No tienes acceso a esta sede");
    }

    // Validar que existe la sede
    await this.validateBranchExists(branchId);

    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay(); // 0 = domingo, 6 = sábado

    // 1. Buscar override específico
    const exception = await this.prisma.branchScheduleException.findUnique({
      where: {
        branchId_date: {
          branchId,
          date: dateObj,
        },
      },
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

    // 2. Buscar por weekday
    const weekdaySchedule = await this.prisma.branchHour.findFirst({
      where: {
        branchId,
        weekday: dayOfWeek,
        isActive: true,
      },
    });

    if (weekdaySchedule) {
      return {
        type: "weekly",
        startTime: weekdaySchedule.startTime,
        endTime: weekdaySchedule.endTime,
        date: dateObj,
      };
    }

    // 3. Si no encuentra nada, la sede no atiende ese día
    throw new BadRequestException(
      `La sede ${branchId} no tiene horario definido para ${date}`
    );
  }

  /**
   * Carga excepciones en masa para múltiples sedes
   */
  async bulkLoadScheduleExceptions(
    dto: BulkLoadScheduleExceptionsDto,
    userId: string
  ) {
    // Validar permiso
    const hasPermission = await this.rbacService.hasPermission(
      userId,
      "schedule.manage"
    );
    if (!hasPermission) {
      throw new ForbiddenException("No tienes permiso para gestionar horarios");
    }

    // Validar que es SUPER_ADMIN o GERENTE_OPERACIONES
    const isSuperAdmin = await this.rbacService.hasRole(userId, "SUPER_ADMIN");
    const isOpsManager = await this.rbacService.hasRole(userId, "OPS_MANAGER");

    if (!isSuperAdmin && !isOpsManager) {
      throw new ForbiddenException(
        "Solo SUPER_ADMIN o GERENTE_OPERACIONES pueden hacer carga masiva"
      );
    }

    // Si no especifica sedes, usar todas las activas
    let branchIds = dto.branchIds;
    if (!branchIds || branchIds.length === 0) {
      const branches = await this.prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      branchIds = branches.map((b) => b.id);
    }

    // Validar que todas las sedes existan
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true },
    });

    if (branches.length !== branchIds.length) {
      throw new BadRequestException("Una o más sedes no existen");
    }

    const result = {
      totalBranches: branchIds.length,
      totalExceptionsCreated: 0,
      successCount: 0,
      failures: [] as any[],
    };

    // Para cada sede, crear las excepciones
    for (const branchId of branchIds) {
      try {
        const createdExceptions =
          await this.prisma.branchScheduleException.createMany({
            data: dto.exceptions.map((e) => ({
              branchId,
              date: new Date(e.date),
              startTime: e.startTime,
              endTime: e.endTime,
              reason: e.reason,
              createdById: userId,
            })),
            skipDuplicates: true,
          });

        result.successCount++;
        result.totalExceptionsCreated += createdExceptions.count;
        this.logger.log(
          `Excepciones de horario cargadas en sede ${branchId}: ${createdExceptions.count} registros`
        );
      } catch (error) {
        result.failures.push({
          branchId,
          error: error.message,
        });
        this.logger.error(
          `Error cargando excepciones en sede ${branchId}: ${error.message}`
        );
      }
    }

    return result;
  }
}

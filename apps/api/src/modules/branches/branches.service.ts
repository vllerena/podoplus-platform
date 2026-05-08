import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import { AuditService } from "../audit/audit.service";
import {
  CreateBranchDto,
  UpdateBranchDto,
  SetBranchHoursDto,
  CreateBranchBlockDto,
  CreateScheduleExceptionDto,
  SetServicePriceDto,
} from "./dto";

// Estados que bloquean la desactivación de una sede
const ACTIVE_APPOINTMENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_SERVICE",
];

// Tipos MIME permitidos para foto de sede
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES      = 5 * 1024 * 1024; // 5 MB

@Injectable()
export class BranchesService {
  private readonly logger = new Logger("BranchesService");

  constructor(
    private prisma: PrismaService,
    private rbacService: RbacService,
    @Optional() private auditService?: AuditService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // LISTAR SEDES
  // ─────────────────────────────────────────────────────────────────────────

  async findAll(userId: string) {
    const userPerms = await this.rbacService.getUserPermissions(userId);

    const where = userPerms.roles.includes("SUPER_ADMIN")
      ? {}
      : { users: { some: { userId } } };

    const branches = await this.prisma.branch.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        businessUnit: { select: { id: true, name: true } },
      },
    });

    return branches.map((b) => this.formatBranch(b));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DETALLE DE SEDE
  // ─────────────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        businessUnit: { select: { id: true, name: true } },
        users: {
          include: {
            user: {
              select: {
                id: true, email: true, firstName: true, lastName: true, isActive: true,
              },
            },
          },
        },
        hours: {
          orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
        },
      },
    });

    if (!branch) throw new NotFoundException(`Sede ${id} no encontrada`);
    return this.formatBranchDetail(branch);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CREAR SEDE
  // ─────────────────────────────────────────────────────────────────────────

  async create(dto: CreateBranchDto, actorId: string) {
    if (dto.code) {
      const existing = await this.prisma.branch.findUnique({ where: { code: dto.code } });
      if (existing) throw new BadRequestException(`Ya existe una sede con código ${dto.code}`);
    }

    const branch = await this.prisma.branch.create({
      data: {
        code:            dto.code,
        name:            dto.name,
        address:         dto.address,
        district:        dto.district,
        city:            dto.city,
        phone:           dto.phone,
        email:           dto.email,
        latitude:        dto.latitude,
        longitude:       dto.longitude,
        googleMapsUrl:   dto.googleMapsUrl,
        defaultCapacity: dto.defaultCapacity,
        timezone:        dto.timezone,
        isActive:        true,
      },
    });

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "branch.created", entityType: "branch", entityId: branch.id,
      metadata: { name: branch.name, code: branch.code },
    });

    this.logger.log(`Sede creada: ${branch.id} — ${branch.name}`);
    return this.formatBranch(branch);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACTUALIZAR SEDE
  // ─────────────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateBranchDto, actorId: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException(`Sede ${id} no encontrada`);

    const updated = await this.prisma.branch.update({
      where: { id },
      data: {
        name:            dto.name            ?? branch.name,
        address:         dto.address         ?? branch.address,
        district:        dto.district        ?? branch.district,
        city:            dto.city            ?? branch.city,
        phone:           dto.phone           ?? branch.phone,
        email:           dto.email           ?? branch.email,
        // Usar !== undefined (no ??) para preservar null al desasignar
        latitude:        dto.latitude        !== undefined ? dto.latitude        : branch.latitude,
        longitude:       dto.longitude       !== undefined ? dto.longitude       : branch.longitude,
        googleMapsUrl:   dto.googleMapsUrl   !== undefined ? dto.googleMapsUrl   : branch.googleMapsUrl,
        defaultCapacity: dto.defaultCapacity ?? branch.defaultCapacity,
        timezone:        dto.timezone        ?? branch.timezone,
        isActive:        dto.isActive        ?? branch.isActive,
        // Campos que antes se omitían — null es válido para desasignar
        businessUnitId:  dto.businessUnitId  !== undefined ? dto.businessUnitId  : branch.businessUnitId,
        attachedCode:    dto.attachedCode    !== undefined ? dto.attachedCode    : branch.attachedCode,
        banner:          dto.banner          !== undefined ? dto.banner          : branch.banner,
      },
      include: {
        businessUnit: { select: { id: true, name: true } },
      },
    });

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "branch.updated", entityType: "branch", entityId: id,
      metadata: dto as any,
    });

    this.logger.log(`Sede actualizada: ${id}`);
    return this.formatBranch(updated);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DESACTIVAR / ACTIVAR / ELIMINAR SEDE
  // ─────────────────────────────────────────────────────────────────────────

  async deactivate(id: string, actorId: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException(`Sede ${id} no encontrada`);

    const activeCount = await this.prisma.appointment.count({
      where: {
        branchId: id,
        status: { in: ACTIVE_APPOINTMENT_STATUSES },
        startAt: { gte: new Date() },
      },
    });

    if (activeCount > 0) {
      throw new BadRequestException(
        `No se puede desactivar la sede: tiene ${activeCount} cita${activeCount === 1 ? "" : "s"} activa${activeCount === 1 ? "" : "s"} pendiente${activeCount === 1 ? "" : "s"}. Cancélalas primero.`,
      );
    }

    const updated = await this.prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "branch.deactivated", entityType: "branch", entityId: id,
      metadata: { name: branch.name },
    });

    // Log de notificación (integrar con WhatsApp/email cuando esté configurado)
    this.logger.log(`[NOTIF] Sede desactivada: "${branch.name}" (${id}) por actorId=${actorId}`);

    return this.formatBranch(updated);
  }

  async activate(id: string, actorId: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException(`Sede ${id} no encontrada`);
    if (branch.isActive) throw new BadRequestException("La sede ya está activa");

    const updated = await this.prisma.branch.update({
      where: { id },
      data: { isActive: true },
    });

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "branch.activated", entityType: "branch", entityId: id,
      metadata: { name: branch.name },
    });

    this.logger.log(`Sede activada: ${id}`);
    return this.formatBranch(updated);
  }

  async deletePermanently(id: string, actorId: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException(`Sede ${id} no encontrada`);

    if (branch.isActive) {
      throw new BadRequestException("Desactiva la sede antes de eliminarla definitivamente");
    }

    const appointmentCount = await this.prisma.appointment.count({ where: { branchId: id } });
    if (appointmentCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar la sede: tiene ${appointmentCount} cita(s) en el historial. Desactívala en su lugar.`,
      );
    }

    await this.prisma.branch.delete({ where: { id } });

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "branch.deleted", entityType: "branch", entityId: id,
      metadata: { name: branch.name },
    });

    this.logger.warn(`Sede eliminada permanentemente: ${id} — ${branch.name}`);
    return { success: true, message: `Sede "${branch.name}" eliminada` };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FOTO DE SEDE
  // ─────────────────────────────────────────────────────────────────────────

  async uploadPhoto(branchId: string, buffer: Buffer, mimeType: string, actorId: string) {
    if (!ALLOWED_PHOTO_TYPES.includes(mimeType)) {
      throw new BadRequestException(`Tipo no permitido. Use: ${ALLOWED_PHOTO_TYPES.join(", ")}`);
    }
    if (buffer.length > MAX_PHOTO_BYTES) {
      throw new BadRequestException("La foto no puede superar 5 MB");
    }

    await this.assertBranchExists(branchId);
    await this.prisma.branch.update({
      where: { id: branchId },
      data:  { photoData: buffer, photoMimeType: mimeType },
    });

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "branch.photo_updated", entityType: "branch", entityId: branchId,
      metadata: { mimeType, bytes: buffer.length },
    });

    this.logger.log(`Foto actualizada para sede: ${branchId}`);
    return { message: "Foto de sede actualizada correctamente" };
  }

  async getPhoto(branchId: string): Promise<{ data: Buffer; mimeType: string } | null> {
    const branch = await this.prisma.branch.findUnique({
      where:  { id: branchId },
      select: { photoData: true, photoMimeType: true },
    });
    if (!branch?.photoData || !branch.photoMimeType) return null;
    return { data: Buffer.from(branch.photoData), mimeType: branch.photoMimeType };
  }

  async deletePhoto(branchId: string, actorId: string) {
    await this.assertBranchExists(branchId);
    await this.prisma.branch.update({
      where: { id: branchId },
      data:  { photoData: null, photoMimeType: null },
    });
    this.auditService?.log({
      actorType: "USER", actorId,
      action: "branch.photo_deleted", entityType: "branch", entityId: branchId,
    });
    return { message: "Foto de sede eliminada" };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HORARIOS (BranchHour) — reemplaza todos de una vez
  // ─────────────────────────────────────────────────────────────────────────

  async getHours(branchId: string) {
    await this.assertBranchExists(branchId);
    return this.prisma.branchHour.findMany({
      where:   { branchId },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    });
  }

  async setHours(branchId: string, dto: SetBranchHoursDto, actorId: string) {
    await this.assertBranchExists(branchId);

    await this.prisma.$transaction(async (tx) => {
      await tx.branchHour.deleteMany({ where: { branchId } });
      await tx.branchHour.createMany({
        data: dto.hours.map((h) => ({
          branchId,
          weekday:   h.weekday,
          startTime: h.startTime,
          endTime:   h.endTime,
          isActive:  h.isActive ?? true,
        })),
      });
    });

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "branch.hours_updated", entityType: "branch", entityId: branchId,
      metadata: { count: dto.hours.length },
    });

    this.logger.log(`Horarios actualizados: sede ${branchId} (${dto.hours.length} franjas)`);
    return this.getHours(branchId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BLOQUES DE TIEMPO (BranchBlock)
  // ─────────────────────────────────────────────────────────────────────────

  async getBlocks(branchId: string, from?: string, to?: string) {
    await this.assertBranchExists(branchId);

    // Parse date-only strings as local midnight to avoid UTC drift
    const fromDate = from ? this.parseLocalDate(from, false) : undefined;
    const toDate   = to   ? this.parseLocalDate(to,   true)  : undefined;

    return this.prisma.branchBlock.findMany({
      where: {
        branchId,
        ...(fromDate || toDate ? {
          startAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate   ? { lte: toDate }   : {}),
          },
        } : {}),
      },
      orderBy: { startAt: "asc" },
    });
  }

  async createBlock(branchId: string, dto: CreateBranchBlockDto, actorId: string) {
    await this.assertBranchExists(branchId);

    const start = new Date(dto.startAt);
    const end   = new Date(dto.endAt);
    if (end <= start) throw new BadRequestException("endAt debe ser posterior a startAt");

    const block = await this.prisma.branchBlock.create({
      data: {
        branchId,
        type:        dto.type,
        title:       dto.title,
        startAt:     start,
        endAt:       end,
        isRecurring: dto.isRecurring ?? false,
        weekday:     dto.weekday,
        startTime:   dto.startTime,
        endTime:     dto.endTime,
        createdById: actorId,
      },
    });

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "branch.block_created", entityType: "branch", entityId: branchId,
      metadata: { blockId: block.id, type: block.type, title: block.title },
    });

    return block;
  }

  async deleteBlock(branchId: string, blockId: string, actorId: string) {
    const block = await this.prisma.branchBlock.findFirst({
      where: { id: blockId, branchId },
    });
    if (!block) throw new NotFoundException(`Bloqueo ${blockId} no encontrado en sede ${branchId}`);

    await this.prisma.branchBlock.delete({ where: { id: blockId } });

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "branch.block_deleted", entityType: "branch", entityId: branchId,
      metadata: { blockId, title: block.title },
    });

    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXCEPCIONES DE HORARIO (BranchScheduleException)
  // ─────────────────────────────────────────────────────────────────────────

  async getScheduleExceptions(branchId: string) {
    await this.assertBranchExists(branchId);
    return this.prisma.branchScheduleException.findMany({
      where:   { branchId },
      orderBy: { date: "asc" },
    });
  }

  async createScheduleException(branchId: string, dto: CreateScheduleExceptionDto, actorId: string) {
    await this.assertBranchExists(branchId);

    const existing = await this.prisma.branchScheduleException.findUnique({
      where: { branchId_date: { branchId, date: new Date(dto.date) } },
    });
    if (existing) throw new BadRequestException(`Ya existe una excepción para la fecha ${dto.date}`);

    if (dto.endTime <= dto.startTime) {
      throw new BadRequestException("endTime debe ser posterior a startTime");
    }

    const exception = await this.prisma.branchScheduleException.create({
      data: {
        branchId,
        date:        new Date(dto.date),
        startTime:   dto.startTime,
        endTime:     dto.endTime,
        reason:      dto.reason,
        createdById: actorId,
      },
    });

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "branch.schedule_exception_created", entityType: "branch", entityId: branchId,
      metadata: { date: dto.date, startTime: dto.startTime, endTime: dto.endTime },
    });

    return exception;
  }

  async deleteScheduleException(branchId: string, exceptionId: string, actorId: string) {
    const ex = await this.prisma.branchScheduleException.findFirst({
      where: { id: exceptionId, branchId },
    });
    if (!ex) throw new NotFoundException(`Excepción ${exceptionId} no encontrada`);

    await this.prisma.branchScheduleException.delete({ where: { id: exceptionId } });

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "branch.schedule_exception_deleted", entityType: "branch", entityId: branchId,
      metadata: { exceptionId },
    });

    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRECIOS POR SERVICIO EN SEDE (ServiceBranchPrice)
  // ─────────────────────────────────────────────────────────────────────────

  async getServicePrices(branchId: string) {
    await this.assertBranchExists(branchId);
    return this.prisma.serviceBranchPrice.findMany({
      where: { branchId },
      include: {
        service: { select: { id: true, name: true, basePrice: true, isActive: true } },
      },
      orderBy: { service: { name: "asc" } },
    });
  }

  async setServicePrice(branchId: string, dto: SetServicePriceDto, actorId: string) {
    await this.assertBranchExists(branchId);

    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
    if (!service) throw new NotFoundException(`Servicio ${dto.serviceId} no encontrado`);

    const price = await this.prisma.serviceBranchPrice.upsert({
      where:  { serviceId_branchId: { serviceId: dto.serviceId, branchId } },
      update: { price: dto.price },
      create: { serviceId: dto.serviceId, branchId, price: dto.price },
      include: { service: { select: { id: true, name: true, basePrice: true } } },
    });

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "branch.service_price_set", entityType: "branch", entityId: branchId,
      metadata: { serviceId: dto.serviceId, price: dto.price },
    });

    this.logger.log(`Precio configurado: sede ${branchId} / servicio ${dto.serviceId} → S/ ${dto.price}`);
    return price;
  }

  async deleteServicePrice(branchId: string, serviceId: string, actorId: string) {
    const existing = await this.prisma.serviceBranchPrice.findUnique({
      where: { serviceId_branchId: { serviceId, branchId } },
    });
    if (!existing) throw new NotFoundException("Precio de servicio no encontrado");

    await this.prisma.serviceBranchPrice.delete({
      where: { serviceId_branchId: { serviceId, branchId } },
    });

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "branch.service_price_deleted", entityType: "branch", entityId: branchId,
      metadata: { serviceId },
    });

    return { success: true, message: "Precio personalizado eliminado. Se usará el precio base." };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MÉTRICAS DE SEDE
  // ─────────────────────────────────────────────────────────────────────────

  async getStats(branchId: string) {
    await this.assertBranchExists(branchId);

    const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;
    const now        = new Date();
    const nowLima    = new Date(now.getTime() - LIMA_OFFSET_MS);
    const y = nowLima.getUTCFullYear(), mo = nowLima.getUTCMonth(), d = nowLima.getUTCDate();
    const startMonth = new Date(Date.UTC(y, mo, 1, 0, 0, 0, 0));
    const endMonth   = new Date(Date.UTC(y, mo + 1, 0, 23, 59, 59, 999));
    const todayStart = new Date(Date.UTC(y, mo, d, 0, 0, 0, 0));
    const todayEnd   = new Date(Date.UTC(y, mo, d, 23, 59, 59, 999));

    const [
      totalMonth, completedMonth, canceledMonth, noShowMonth,
      upcomingToday, activeUsers, revenueMonth,
    ] = await Promise.all([
      this.prisma.appointment.count({ where: { branchId, startAt: { gte: startMonth, lte: endMonth } } }),
      this.prisma.appointment.count({ where: { branchId, status: "COMPLETED",  startAt: { gte: startMonth, lte: endMonth } } }),
      this.prisma.appointment.count({ where: { branchId, status: "CANCELED",   startAt: { gte: startMonth, lte: endMonth } } }),
      this.prisma.appointment.count({ where: { branchId, status: "NO_SHOW",    startAt: { gte: startMonth, lte: endMonth } } }),
      this.prisma.appointment.count({ where: { branchId, status: { in: ACTIVE_APPOINTMENT_STATUSES }, startAt: { gte: todayStart, lte: todayEnd } } }),
      this.prisma.userBranch.count({ where: { branchId } }),
      this.prisma.sale.aggregate({
        where: { branchId, status: { not: "VOIDED" }, createdAt: { gte: startMonth, lte: endMonth } },
        _sum: { totalAmount: true },
      }),
    ]);

    const completionRate = totalMonth > 0 ? Math.round((completedMonth / totalMonth) * 100) : 0;

    return {
      branchId,
      period: {
        from: this.formatDate(startMonth),
        to:   this.formatDate(endMonth),
      },
      appointments: {
        total:    totalMonth,
        completed: completedMonth,
        canceled:  canceledMonth,
        noShow:    noShowMonth,
        upcomingToday,
        completionRate: `${completionRate}%`,
      },
      revenue:     Number(revenueMonth._sum.totalAmount ?? 0),
      activeUsers,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HORARIO PÚBLICO (autoservicio — sin autenticación)
  // ─────────────────────────────────────────────────────────────────────────

  async getPublicInfo(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId, isActive: true },
      select: {
        id: true, name: true, address: true, district: true, city: true,
        phone: true, email: true, latitude: true, longitude: true,
        googleMapsUrl: true, timezone: true,
        hours: {
          where:   { isActive: true },
          orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
          select:  { weekday: true, startTime: true, endTime: true },
        },
        servicePrices: {
          include: {
            service: {
              select: {
                id: true, name: true, description: true,
                durationMinutes: true, basePrice: true, allowSelfService: true,
              },
            },
          },
        },
      },
    });

    if (!branch) throw new NotFoundException("Sede no encontrada o inactiva");

    const from   = new Date();
    const to     = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const blocks = await this.prisma.branchBlock.findMany({
      where: { branchId, startAt: { gte: from, lte: to } },
      select: { type: true, title: true, startAt: true, endAt: true },
      orderBy: { startAt: "asc" },
    });

    return {
      id:           branch.id,
      name:         branch.name,
      address:      branch.address,
      district:     branch.district,
      city:         branch.city,
      phone:        branch.phone,
      email:        branch.email,
      latitude:     branch.latitude  ? Number(branch.latitude)  : null,
      longitude:    branch.longitude ? Number(branch.longitude) : null,
      googleMapsUrl: branch.googleMapsUrl,
      timezone:     branch.timezone,
      hours:        branch.hours,
      upcomingBlocks: blocks,
      services: branch.servicePrices
        .filter((sp) => sp.service.allowSelfService)
        .map((sp) => ({
          id:              sp.service.id,
          name:            sp.service.name,
          description:     sp.service.description,
          durationMinutes: sp.service.durationMinutes,
          price:           Number(sp.price),
          basePrice:       Number(sp.service.basePrice),
        })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // USUARIOS DE SEDE
  // ─────────────────────────────────────────────────────────────────────────

  async assignUserToBranch(branchId: string, userId: string, actorId: string) {
    const [branch, user] = await Promise.all([
      this.prisma.branch.findUnique({ where: { id: branchId } }),
      this.prisma.user.findUnique({ where: { id: userId } }),
    ]);
    if (!branch) throw new NotFoundException(`Sede ${branchId} no encontrada`);
    if (!user)   throw new NotFoundException(`Usuario ${userId} no encontrado`);

    const existing = await this.prisma.userBranch.findUnique({
      where: { userId_branchId: { userId, branchId } },
    });
    if (existing) throw new BadRequestException("El usuario ya está asignado a esta sede");

    await this.prisma.userBranch.create({ data: { userId, branchId } });
    await this.rbacService.clearUserPermissionsCache(userId);

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "branch.user_assigned", entityType: "branch", entityId: branchId,
      metadata: { userId, branchName: branch.name },
    });

    this.logger.log(`Usuario ${userId} asignado a sede ${branchId}`);
    return { success: true, userId, branchId };
  }

  async removeUserFromBranch(branchId: string, userId: string, actorId: string) {
    const assignment = await this.prisma.userBranch.findUnique({
      where: { userId_branchId: { userId, branchId } },
    });
    if (!assignment) throw new NotFoundException("El usuario no está asignado a esta sede");

    await this.prisma.userBranch.delete({
      where: { userId_branchId: { userId, branchId } },
    });
    await this.rbacService.clearUserPermissionsCache(userId);

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "branch.user_removed", entityType: "branch", entityId: branchId,
      metadata: { userId },
    });

    return { success: true };
  }

  async getBranchUsers(branchId: string) {
    const userBranches = await this.prisma.userBranch.findMany({
      where: { branchId },
      include: {
        user: {
          select: {
            id: true, email: true, firstName: true, lastName: true, isActive: true,
            roles: { include: { role: { select: { code: true, name: true } } } },
          },
        },
      },
    });

    return userBranches.map((ub) => ({
      id:        ub.user.id,
      email:     ub.user.email,
      firstName: ub.user.firstName,
      lastName:  ub.user.lastName,
      isActive:  ub.user.isActive,
      roles:     ub.user.roles.map((r) => ({ code: r.role.code, name: r.role.name })),
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS PRIVADOS
  // ─────────────────────────────────────────────────────────────────────────

  /** Formats a Date as "YYYY-MM-DD" using local time (avoids UTC drift for Lima UTC-5). */
  private formatDate(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  private parseLocalDate(dateStr: string, endOfDay: boolean): Date {
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return new Date(NaN);
    const [year, month, day] = parts;
    if (endOfDay) return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  private async assertBranchExists(branchId: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException(`Sede ${branchId} no encontrada`);
    return branch;
  }

  private formatBranch(b: any) {
    return {
      id:              b.id,
      code:            b.code,
      name:            b.name,
      address:         b.address,
      district:        b.district,
      city:            b.city,
      phone:           b.phone,
      email:           b.email,
      latitude:        b.latitude  ? Number(b.latitude)  : null,
      longitude:       b.longitude ? Number(b.longitude) : null,
      googleMapsUrl:   b.googleMapsUrl,
      isActive:        b.isActive,
      defaultCapacity: b.defaultCapacity,
      timezone:        b.timezone,
      hasPhoto:        !!(b.photoData),
      banner:          b.banner          ?? null,
      attachedCode:    b.attachedCode    ?? null,
      ubigeo:          b.ubigeo          ?? null,
      businessUnitId:  b.businessUnitId  ?? null,
      businessUnit:    b.businessUnit
        ? { id: b.businessUnit.id, name: b.businessUnit.name }
        : undefined,
      createdAt:       b.createdAt?.toISOString(),
      updatedAt:       b.updatedAt?.toISOString(),
    };
  }

  private formatBranchDetail(b: any) {
    return {
      ...this.formatBranch(b),
      users: b.users?.map((ub: any) => ({
        id:        ub.user.id,
        email:     ub.user.email,
        firstName: ub.user.firstName,
        lastName:  ub.user.lastName,
        isActive:  ub.user.isActive,
      })) ?? [],
      hours: b.hours ?? [],
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SERIES DE DOCUMENTOS
  // ─────────────────────────────────────────────────────────────────────────

  async getSeries(branchId: string) {
    await this.assertBranchExists(branchId);
    const series = await this.prisma.branchSerie.findMany({
      where:   { branchId },
      orderBy: [{ tipoDocumento: "asc" }, { serie: "asc" }],
    });
    return series.map(this.formatSerie);
  }

  async createSerie(
    branchId: string,
    dto: import("./dto").CreateBranchSerieDto,
    userId: string,
  ) {
    await this.assertBranchExists(branchId);

    const existing = await this.prisma.branchSerie.findUnique({
      where: { branchId_serie: { branchId, serie: dto.serie.toUpperCase() } },
    });
    if (existing) {
      throw new BadRequestException(
        `La serie "${dto.serie.toUpperCase()}" ya existe para esta sede`,
      );
    }

    const serie = await this.prisma.branchSerie.create({
      data: {
        branchId,
        tipoDocumento: dto.tipoDocumento,
        serie:         dto.serie.toUpperCase(),
        contingencia:  dto.contingencia ?? false,
      },
    });

    this.auditService?.log({
      action:     "BRANCH_SERIE_CREATED",
      actorId:    userId,
      actorType:  "USER",
      entityType: "BranchSerie",
      entityId:   serie.id,
      metadata:   { branchId, serie: serie.serie, tipoDocumento: serie.tipoDocumento },
    });

    return this.formatSerie(serie);
  }

  async deleteSerie(branchId: string, serieId: string, userId: string) {
    const serie = await this.prisma.branchSerie.findFirst({
      where: { id: serieId, branchId },
    });
    if (!serie) {
      throw new NotFoundException(`Serie ${serieId} no encontrada en esta sede`);
    }

    await this.prisma.branchSerie.delete({ where: { id: serieId } });

    this.auditService?.log({
      action:     "BRANCH_SERIE_DELETED",
      actorId:    userId,
      actorType:  "USER",
      entityType: "BranchSerie",
      entityId:   serieId,
      metadata:   { branchId, serie: serie.serie },
    });

    return { success: true, message: `Serie "${serie.serie}" eliminada` };
  }

  private formatSerie(s: any) {
    return {
      id:            s.id,
      branchId:      s.branchId,
      tipoDocumento: s.tipoDocumento,
      serie:         s.serie,
      contingencia:  s.contingencia,
      createdAt:     s.createdAt?.toISOString(),
      updatedAt:     s.updatedAt?.toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BRANCH DASHBOARD
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET /v1/branches/:id/dashboard?date=YYYY-MM-DD
   *
   * Devuelve en una sola consulta todos los datos necesarios para el
   * Dashboard Sede: citas del día, ventas, caja abierta y ocupación.
   */
  async getDashboard(branchId: string, dateStr?: string) {
    // ── Fecha de consulta (hoy por defecto) ────────────────────────────────
    const tz = "America/Lima";
    const today = dateStr ?? new Date().toLocaleDateString("en-CA", { timeZone: tz });

    const dayStart = new Date(`${today}T00:00:00-05:00`);
    const dayEnd   = new Date(`${today}T23:59:59-05:00`);

    // ── Consultas paralelas ────────────────────────────────────────────────
    // Primero obtenemos la caja abierta para luego calcular su balance
    const cashRegister = await this.prisma.cashRegister.findFirst({
      where:   { branchId, status: "OPEN" },
      select:  { id: true, openingBalance: true, status: true },
      orderBy: { openedAt: "desc" },
    });

    // Balance real = saldo inicial + entradas - salidas
    let cashBalance = 0;
    if (cashRegister) {
      const [inAgg, outAgg] = await Promise.all([
        this.prisma.cashMovement.aggregate({
          where: { cashRegisterId: cashRegister.id, type: "IN" },
          _sum:  { amount: true },
        }),
        this.prisma.cashMovement.aggregate({
          where: { cashRegisterId: cashRegister.id, type: "OUT" },
          _sum:  { amount: true },
        }),
      ]);
      cashBalance =
        parseFloat(String(cashRegister.openingBalance)) +
        parseFloat(String(inAgg._sum.amount ?? 0)) -
        parseFloat(String(outAgg._sum.amount ?? 0));
    }

    const [branch, appointments, sales] = await Promise.all([
      this.prisma.branch.findUnique({
        where: { id: branchId },
        select: { id: true, name: true, defaultCapacity: true },
      }),

      this.prisma.appointment.findMany({
        where: { branchId, startAt: { gte: dayStart, lte: dayEnd } },
        select: { id: true, status: true },
      }),

      this.prisma.sale.findMany({
        where: {
          branchId,
          createdAt:  { gte: dayStart, lte: dayEnd },
          status:     { not: "VOIDED" },
        },
        select: {
          id: true,
          totalAmount:      true,
          paymentMethod:    true,
          tipoComprobante:  true,
        },
      }),
    ]);

    if (!branch) throw new NotFoundException(`Sede ${branchId} no encontrada`);

    // ── Citas: agrupar por estado ──────────────────────────────────────────
    const apptByStatus: Record<string, number> = {};
    for (const a of appointments) {
      apptByStatus[a.status] = (apptByStatus[a.status] ?? 0) + 1;
    }

    const activeStatuses = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"];
    const occupied = appointments.filter((a) => activeStatuses.includes(a.status)).length;
    const capacity = branch.defaultCapacity ?? 10;
    const occupancyPct = capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0;

    // ── Ventas: agrupar por tipo y medio de pago ───────────────────────────
    let totalVentas = 0;
    let facturaCount = 0;
    let facturaTotal = 0;
    let boletaCount  = 0;
    let boletaTotal  = 0;

    const paymentTotals: Record<string, { count: number; total: number }> = {};

    for (const s of sales) {
      const amount = Number(s.totalAmount) || 0;
      totalVentas += amount;

      const tipo = (s.tipoComprobante as string) ?? "";
      if (tipo === "01") {
        facturaCount++;
        facturaTotal += amount;
      } else if (tipo === "03" || !tipo) {
        boletaCount++;
        boletaTotal += amount;
      }

      const method = (s.paymentMethod as string) ?? "CASH";
      if (!paymentTotals[method]) paymentTotals[method] = { count: 0, total: 0 };
      paymentTotals[method].count++;
      paymentTotals[method].total += amount;
    }

    const PAYMENT_LABELS: Record<string, string> = {
      CASH:     "Efectivo",
      CARD:     "Tarjeta",
      YAPE:     "Yape",
      PLIN:     "Plin",
      TRANSFER: "Transferencia",
      MIXED:    "Mixto",
    };

    const byPaymentMethod = Object.entries(paymentTotals).map(([method, v]) => ({
      method,
      label: PAYMENT_LABELS[method] ?? method,
      count: v.count,
      total: +v.total.toFixed(2),
    }));

    return {
      branch_id:   branchId,
      branch_name: branch.name,
      date:        today,
      appointments: {
        total:       appointments.length,
        pending:     apptByStatus["PENDING"]    ?? 0,
        confirmed:   apptByStatus["CONFIRMED"]  ?? 0,
        checked_in:  apptByStatus["CHECKED_IN"] ?? 0,
        in_service:  apptByStatus["IN_SERVICE"] ?? 0,
        completed:   apptByStatus["COMPLETED"]  ?? 0,
        cancelled:   apptByStatus["CANCELED"]   ?? 0,
        no_show:     apptByStatus["NO_SHOW"]    ?? 0,
        rescheduled: apptByStatus["RESCHEDULED"] ?? 0,
      },
      occupancy: {
        total_slots:     capacity,
        occupied_slots:  occupied,
        available_slots: Math.max(0, capacity - occupied),
        pct:             occupancyPct,
      },
      sales: {
        count:    sales.length,
        total:    +totalVentas.toFixed(2),
        facturas: { count: facturaCount, total: +facturaTotal.toFixed(2) },
        boletas:  { count: boletaCount,  total: +boletaTotal.toFixed(2) },
        by_payment_method: byPaymentMethod,
      },
      cash_register: cashRegister
        ? {
            id:      cashRegister.id,
            balance: +cashBalance.toFixed(2),
            is_open: true,
          }
        : null,
    };
  }
}

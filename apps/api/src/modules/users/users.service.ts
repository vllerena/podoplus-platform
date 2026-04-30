import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { AuditService } from "../audit/audit.service";
import { RbacService } from "../rbac/rbac.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { AssignRoleDto } from "./dto/assign-role.dto";
import { AdminResetPasswordDto } from "./dto/reset-password.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";

// Tipos MIME permitidos para avatar
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES      = 2 * 1024 * 1024; // 2 MB

@Injectable()
export class UsersService {
  private readonly logger = new Logger("UsersService");

  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private rbacService: RbacService,
    @Optional() private auditService?: AuditService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // LISTAR USUARIOS — paginación por cursor
  // ─────────────────────────────────────────────────────────────────────────

  async getUsers(filters: {
    isActive?: boolean;
    roleCode?: string;
    branchId?: string;
    query?: string;
    limit?: number;
    cursor?: string; // id del último elemento de la página anterior
  }) {
    const { isActive, roleCode, branchId, query, cursor } = filters;
    const limit = Math.min(filters.limit ?? 20, 100);

    const where: any = {};
    if (isActive !== undefined) where.isActive = isActive;
    if (query) {
      where.OR = [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName:  { contains: query, mode: "insensitive" } },
        { email:     { contains: query, mode: "insensitive" } },
      ];
    }
    if (roleCode)  where.roles    = { some: { role: { code: roleCode } } };
    if (branchId)  where.branches = { some: { branchId } };

    const users = await this.prisma.user.findMany({
      where,
      include: {
        roles:    { include: { role: true } },
        branches: { include: { branch: { select: { id: true, name: true } } } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take:   limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasNext    = users.length > limit;
    const page       = hasNext ? users.slice(0, limit) : users;
    const nextCursor = hasNext ? page[page.length - 1].id : null;

    return {
      data:       page.map((u) => this.formatUser(u)),
      nextCursor,
      hasNext:    hasNext,
      limit,
      total:      page.length,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DETALLE DE USUARIO
  // ─────────────────────────────────────────────────────────────────────────

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
        branches: {
          include: { branch: { select: { id: true, name: true, code: true } } },
        },
      },
    });

    if (!user) throw new NotFoundException(`Usuario ${userId} no encontrado`);
    return this.formatUserDetail(user);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PERFIL PROPIO
  // ─────────────────────────────────────────────────────────────────────────

  async getMyProfile(userId: string) {
    return this.getUserById(userId);
  }

  async updateMyProfile(userId: string, dto: UpdateUserDto) {
    return this.updateUser(userId, dto, userId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AVATAR
  // ─────────────────────────────────────────────────────────────────────────

  async uploadAvatar(
    userId: string,
    buffer: Buffer,
    mimeType: string,
    actorId: string,
  ): Promise<{ message: string }> {
    if (!ALLOWED_AVATAR_TYPES.includes(mimeType)) {
      throw new BadRequestException(
        `Tipo de imagen no permitido. Use: ${ALLOWED_AVATAR_TYPES.join(", ")}`,
      );
    }
    if (buffer.length > MAX_AVATAR_BYTES) {
      throw new BadRequestException("El avatar no puede superar 2 MB");
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`Usuario ${userId} no encontrado`);

    await this.prisma.user.update({
      where: { id: userId },
      data:  { avatarData: buffer, avatarMimeType: mimeType },
    });

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "user.avatar_updated", entityType: "user", entityId: userId,
      metadata: { mimeType, bytes: buffer.length },
    });

    this.logger.log(`Avatar actualizado: userId=${userId}`);
    return { message: "Avatar actualizado correctamente" };
  }

  async getAvatar(userId: string): Promise<{ data: Buffer; mimeType: string } | null> {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { avatarData: true, avatarMimeType: true },
    });

    if (!user || !user.avatarData || !user.avatarMimeType) return null;

    return { data: Buffer.from(user.avatarData), mimeType: user.avatarMimeType };
  }

  async deleteAvatar(userId: string, actorId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`Usuario ${userId} no encontrado`);

    await this.prisma.user.update({
      where: { id: userId },
      data:  { avatarData: null, avatarMimeType: null },
    });

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "user.avatar_deleted", entityType: "user", entityId: userId,
    });

    return { message: "Avatar eliminado correctamente" };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CREAR USUARIO
  // ─────────────────────────────────────────────────────────────────────────

  async createUser(dto: CreateUserDto, createdById: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException(`Ya existe un usuario con email ${dto.email}`);
    }

    if (dto.phone) {
      const existingPhone = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (existingPhone) {
        throw new ConflictException(`Ya existe un usuario con teléfono ${dto.phone}`);
      }
    }

    const passwordHash = this.authService.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        firstName:      dto.firstName,
        lastName:       dto.lastName,
        email:          dto.email,
        phone:          dto.phone          ?? null,
        documentType:   dto.documentType   ?? null,
        documentNumber: dto.documentNumber ?? null,
        address:        dto.address        ?? null,
        birthDate:      dto.birthDate      ? new Date(dto.birthDate) : null,
        passwordHash,
        isActive:       true,
      },
      include: {
        roles:    { include: { role: true } },
        branches: { include: { branch: { select: { id: true, name: true } } } },
      },
    });

    if (dto.roleCode) {
      await this.assignRole(
        user.id,
        { role_code: dto.roleCode, branch_id: dto.branchId },
        createdById,
      );
    }

    this.auditService?.log({
      actorType: "USER", actorId: createdById,
      action: "user.created", entityType: "user", entityId: user.id,
      metadata: { email: dto.email, roleCode: dto.roleCode },
    });

    this.logger.log(`Usuario creado: ${user.id} — ${dto.email}`);
    return this.getUserById(user.id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACTUALIZAR USUARIO
  // ─────────────────────────────────────────────────────────────────────────

  async updateUser(userId: string, dto: UpdateUserDto, updatedById: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`Usuario ${userId} no encontrado`);

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) throw new ConflictException(`Email ${dto.email} ya está en uso`);
    }

    if (dto.phone && dto.phone !== user.phone) {
      const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (existing) throw new ConflictException(`Teléfono ${dto.phone} ya está en uso`);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName:      dto.firstName      ?? user.firstName,
        lastName:       dto.lastName       ?? user.lastName,
        email:          dto.email          ?? user.email,
        phone:          dto.phone          !== undefined ? dto.phone          : user.phone,
        documentType:   dto.documentType   !== undefined ? dto.documentType   : user.documentType,
        documentNumber: dto.documentNumber !== undefined ? dto.documentNumber : user.documentNumber,
        address:        dto.address        !== undefined ? dto.address        : user.address,
        birthDate:      dto.birthDate      !== undefined
          ? (dto.birthDate ? new Date(dto.birthDate) : null)
          : user.birthDate,
      },
      include: {
        roles:    { include: { role: true } },
        branches: { include: { branch: { select: { id: true, name: true } } } },
      },
    });

    this.auditService?.log({
      actorType: "USER", actorId: updatedById,
      action: "user.updated", entityType: "user", entityId: userId,
      metadata: dto as any,
    });

    this.logger.log(`Usuario actualizado: ${userId}`);
    return this.formatUser(updated);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIVAR / DESACTIVAR
  // ─────────────────────────────────────────────────────────────────────────

  async setActive(userId: string, isActive: boolean, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`Usuario ${userId} no encontrado`);

    if (userId === actorId && !isActive) {
      throw new BadRequestException("No puedes desactivarte a ti mismo");
    }

    await this.prisma.user.update({ where: { id: userId }, data: { isActive } });

    // Invalidar caché RBAC inmediatamente
    await this.rbacService.clearUserPermissionsCache(userId);

    // Si se desactiva, revocar todas las sesiones activas
    if (!isActive) {
      await this.authService.revokeAllUserSessions(userId);
    }

    this.auditService?.log({
      actorType: "USER", actorId,
      action: isActive ? "user.activated" : "user.deactivated",
      entityType: "user", entityId: userId,
    });

    this.logger.log(`Usuario ${userId} ${isActive ? "activado" : "desactivado"}`);
    return { success: true, userId, isActive };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESET CONTRASEÑA (admin)
  // ─────────────────────────────────────────────────────────────────────────

  async resetPassword(userId: string, dto: AdminResetPasswordDto, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`Usuario ${userId} no encontrado`);

    const passwordHash = this.authService.hashPassword(dto.new_password);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // Forzar re-login en todos los dispositivos del usuario afectado
    await this.authService.revokeAllUserSessions(userId);

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "user.password_reset", entityType: "user", entityId: userId,
    });

    this.logger.log(`Contraseña reseteada para usuario ${userId} por ${actorId}`);
    return { success: true, message: "Contraseña actualizada. El usuario deberá iniciar sesión nuevamente." };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CAMBIO DE CONTRASEÑA PROPIO
  // ─────────────────────────────────────────────────────────────────────────

  async changeMyPassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) throw new NotFoundException("Usuario no encontrado");

    if (!user.passwordHash) {
      throw new BadRequestException("Este usuario no tiene contraseña configurada");
    }

    // Verificar contraseña actual usando el método público de AuthService
    const isValid = this.authService.checkPassword(dto.currentPassword, user.passwordHash);

    if (!isValid) {
      throw new UnauthorizedException("La contraseña actual es incorrecta");
    }

    const passwordHash = this.authService.hashPassword(dto.newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // Revocar todas las sesiones (el usuario deberá hacer login con la nueva contraseña)
    await this.authService.revokeAllUserSessions(userId);

    this.auditService?.log({
      actorType: "USER", actorId: userId,
      action: "user.password_changed", entityType: "user", entityId: userId,
    });

    this.logger.log(`Contraseña cambiada: userId=${userId}`);
    return { success: true, message: "Contraseña actualizada. Inicia sesión nuevamente." };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ASIGNAR / REMOVER SEDE
  // ─────────────────────────────────────────────────────────────────────────

  async assignBranch(userId: string, branchId: string, actorId: string) {
    const user   = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user)   throw new NotFoundException(`Usuario ${userId} no encontrado`);

    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException(`Sede ${branchId} no encontrada`);

    await this.prisma.userBranch.upsert({
      where:  { userId_branchId: { userId, branchId } },
      update: {},
      create: { userId, branchId },
    });

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "user.branch_assigned", entityType: "user", entityId: userId,
      metadata: { branchId },
    });

    this.logger.log(`Sede ${branchId} asignada al usuario ${userId}`);
    return this.getUserById(userId);
  }

  async removeBranch(userId: string, branchId: string, actorId: string) {
    const existing = await this.prisma.userBranch.findUnique({
      where: { userId_branchId: { userId, branchId } },
    });
    if (!existing) throw new NotFoundException(`El usuario ${userId} no tiene asignada la sede ${branchId}`);

    await this.prisma.userBranch.delete({
      where: { userId_branchId: { userId, branchId } },
    });

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "user.branch_removed", entityType: "user", entityId: userId,
      metadata: { branchId },
    });

    this.logger.log(`Sede ${branchId} removida del usuario ${userId}`);
    return this.getUserById(userId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ASIGNAR ROL
  // ─────────────────────────────────────────────────────────────────────────

  async assignRole(userId: string, dto: AssignRoleDto, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`Usuario ${userId} no encontrado`);

    const role = await this.prisma.role.findUnique({ where: { code: dto.role_code } });
    if (!role) throw new NotFoundException(`Rol ${dto.role_code} no encontrado`);

    await this.prisma.userRole.upsert({
      where:  { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: { userId, roleId: role.id },
    });

    if (dto.branch_id) {
      const branch = await this.prisma.branch.findUnique({ where: { id: dto.branch_id } });
      if (!branch) throw new NotFoundException(`Sede ${dto.branch_id} no encontrada`);

      await this.prisma.userBranch.upsert({
        where:  { userId_branchId: { userId, branchId: dto.branch_id } },
        update: {},
        create: { userId, branchId: dto.branch_id },
      });
    }

    await this.rbacService.clearUserPermissionsCache(userId);

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "user.role_assigned", entityType: "user", entityId: userId,
      metadata: { roleCode: dto.role_code, branchId: dto.branch_id },
    });

    this.logger.log(`Rol ${dto.role_code} asignado a usuario ${userId}`);
    return this.getUserById(userId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REMOVER ROL
  // ─────────────────────────────────────────────────────────────────────────

  async removeRole(userId: string, roleCode: string, actorId: string) {
    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) throw new NotFoundException(`Rol ${roleCode} no encontrado`);

    const existing = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId: role.id } },
    });
    if (!existing) {
      throw new NotFoundException(`El usuario ${userId} no tiene el rol ${roleCode}`);
    }

    await this.prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId: role.id } },
    });

    await this.rbacService.clearUserPermissionsCache(userId);

    this.auditService?.log({
      actorType: "USER", actorId,
      action: "user.role_removed", entityType: "user", entityId: userId,
      metadata: { roleCode },
    });

    this.logger.log(`Rol ${roleCode} removido del usuario ${userId}`);
    return this.getUserById(userId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MÉTRICAS DE RENDIMIENTO
  // ─────────────────────────────────────────────────────────────────────────

  async getUserStats(userId: string, branchId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`Usuario ${userId} no encontrado`);

    const branchFilter = branchId ? { branchId } : {};

    const [
      appointmentsScheduled,
      appointmentsCompleted,
      appointmentsCanceled,
      appointmentsNoShow,
      salesCount,
      salesRevenue,
    ] = await Promise.all([
      // Citas agendadas (cualquier estado, creadas por el usuario)
      this.prisma.appointment.count({
        where: { createdById: userId, ...branchFilter },
      }),
      // Citas completadas
      this.prisma.appointment.count({
        where: { createdById: userId, status: "COMPLETED", ...branchFilter },
      }),
      // Citas canceladas
      this.prisma.appointment.count({
        where: { createdById: userId, status: "CANCELED", ...branchFilter },
      }),
      // No-shows
      this.prisma.appointment.count({
        where: { createdById: userId, status: "NO_SHOW", ...branchFilter },
      }),
      // Ventas generadas (no anuladas)
      this.prisma.sale.count({
        where: { createdById: userId, status: { not: "VOIDED" }, ...branchFilter },
      }),
      // Monto total de ventas
      this.prisma.sale.aggregate({
        where: { createdById: userId, status: { not: "VOIDED" }, ...branchFilter },
        _sum: { totalAmount: true },
      }),
    ]);

    const completionRate = appointmentsScheduled > 0
      ? Math.round((appointmentsCompleted / appointmentsScheduled) * 100)
      : 0;

    // Retorna estructura PLANA que espera el frontend
    return {
      scheduledAppointments:  appointmentsScheduled,
      completedAppointments:  appointmentsCompleted,
      cancelledAppointments:  appointmentsCanceled,
      noShowAppointments:     appointmentsNoShow,
      totalAppointments:      appointmentsScheduled,   // alias para compatibilidad
      completionRate,
      totalSales:             salesCount,
      totalRevenue:           Number(salesRevenue._sum.totalAmount ?? 0),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS PRIVADOS
  // ─────────────────────────────────────────────────────────────────────────

  private formatUser(u: any) {
    return {
      id:             u.id,
      firstName:      u.firstName,
      lastName:       u.lastName,
      fullName:       `${u.firstName} ${u.lastName}`,
      email:          u.email,
      phone:          u.phone          ?? null,
      documentType:   u.documentType   ?? null,
      documentNumber: u.documentNumber ?? null,
      address:        u.address        ?? null,
      birthDate:      u.birthDate      ? u.birthDate.toISOString() : null,
      lastLoginAt:    u.lastLoginAt    ? u.lastLoginAt.toISOString() : null,
      avatarUrl:      u.avatarData     ? `/v1/users/${u.id}/avatar` : null,
      isActive:       u.isActive,
      // Roles devueltos como objetos { code, name, branchId }
      roles: u.roles?.map((ur: any) => ({
        code:     ur.role?.code     ?? ur.code     ?? "",
        name:     ur.role?.name     ?? ur.name     ?? "",
        branchId: ur.branchId ?? null,
      })) ?? [],
      branches: u.branches?.map((ub: any) => ({
        id:   ub.branch?.id   ?? ub.id,
        name: ub.branch?.name ?? ub.name,
      })) ?? [],
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    };
  }

  private formatUserDetail(u: any) {
    return {
      ...this.formatUser(u),
      permissions: u.roles?.flatMap((ur: any) =>
        ur.role?.permissions?.map((rp: any) => rp.permission?.code) ?? []
      ).filter(Boolean) ?? [],
      branchesDetail: u.branches?.map((ub: any) => ({
        id:   ub.branch?.id   ?? ub.id,
        name: ub.branch?.name ?? ub.name,
        code: ub.branch?.code ?? null,
      })) ?? [],
    };
  }
}

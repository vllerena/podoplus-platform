import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRedis } from "@nestjs-modules/ioredis";
import { Redis } from "ioredis";
import { PrismaService } from "../prisma/prisma.service";

export interface UserPermissions {
  userId: string;
  roles: string[];
  permissions: string[];
  branchIds: string[];
}

const CACHE_TTL_SECONDS = 30;

@Injectable()
export class RbacService {
  private readonly logger = new Logger("RbacService");

  constructor(
    private prisma: PrismaService,
    @InjectRedis() private redis: Redis
  ) {}

  // ─────────────────────────────────────────────────────────────────
  // PERMISOS DE USUARIO (con caché Redis)
  // ─────────────────────────────────────────────────────────────────

  async getUserPermissions(userId: string): Promise<UserPermissions> {
    const cacheKey = `rbac:perms:${userId}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as UserPermissions;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        branches: true,
      },
    });

    if (!user || !user.isActive) {
      return { userId, roles: [], permissions: [], branchIds: [] };
    }

    const roles = user.roles.map((ur) => ur.role.code);
    const permissions = new Set<string>();
    const branchIds = user.branches.map((ub) => ub.branchId);

    user.roles.forEach((ur) => {
      ur.role.permissions.forEach((rp) => {
        permissions.add(rp.permission.code);
      });
    });

    const result: UserPermissions = {
      userId,
      roles,
      permissions: Array.from(permissions),
      branchIds,
    };

    await this.redis.set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL_SECONDS);

    return result;
  }

  /** Invalida el caché de permisos de un usuario. Llamar tras cambios de roles/estado. */
  async clearUserPermissionsCache(userId: string) {
    await this.redis.del(`rbac:perms:${userId}`);
  }

  // ─────────────────────────────────────────────────────────────────
  // VERIFICACIONES (todas en memoria, una sola query)
  // ─────────────────────────────────────────────────────────────────

  async hasPermission(userId: string, permissionCode: string): Promise<boolean> {
    const perms = await this.getUserPermissions(userId);
    return perms.permissions.includes(permissionCode);
  }

  async hasRole(userId: string, roleCode: string): Promise<boolean> {
    const perms = await this.getUserPermissions(userId);
    return perms.roles.includes(roleCode);
  }

  async hasAnyRole(userId: string, roleCodes: string[]): Promise<boolean> {
    const perms = await this.getUserPermissions(userId);
    return roleCodes.some((code) => perms.roles.includes(code));
  }

  async hasAccessToBranch(userId: string, branchId: string): Promise<boolean> {
    const perms = await this.getUserPermissions(userId);
    if (perms.roles.includes("SUPER_ADMIN")) return true;
    return perms.branchIds.includes(branchId);
  }

  async hasAllPermissions(userId: string, permissionCodes: string[]): Promise<boolean> {
    const perms = await this.getUserPermissions(userId);
    return permissionCodes.every((code) => perms.permissions.includes(code));
  }

  async hasAnyPermission(userId: string, permissionCodes: string[]): Promise<boolean> {
    const perms = await this.getUserPermissions(userId);
    return permissionCodes.some((code) => perms.permissions.includes(code));
  }

  // ─────────────────────────────────────────────────────────────────
  // ROLES
  // ─────────────────────────────────────────────────────────────────

  async getRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
      },
      orderBy: { code: "asc" },
    });
  }

  async getRoleById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
      },
    });
    if (!role) throw new NotFoundException(`Rol ${id} no encontrado`);
    return role;
  }

  // ─────────────────────────────────────────────────────────────────
  // PERMISOS
  // ─────────────────────────────────────────────────────────────────

  async getPermissions() {
    return this.prisma.permission.findMany({ orderBy: { code: "asc" } });
  }

  // ─────────────────────────────────────────────────────────────────
  // ROLE-PERMISSIONS
  // ─────────────────────────────────────────────────────────────────

  async assignPermissionToRole(roleId: string, permissionId: string) {
    const [role, permission] = await Promise.all([
      this.prisma.role.findUnique({ where: { id: roleId } }),
      this.prisma.permission.findUnique({ where: { id: permissionId } }),
    ]);
    if (!role) throw new NotFoundException(`Rol ${roleId} no encontrado`);
    if (!permission) throw new NotFoundException(`Permiso ${permissionId} no encontrado`);

    const existing = await this.prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId, permissionId } },
    });
    if (existing) {
      throw new ConflictException("El permiso ya está asignado a este rol");
    }

    const result = await this.prisma.rolePermission.create({
      data: { roleId, permissionId },
      include: { role: true, permission: true },
    });

    this.logger.log(`Permiso ${permission.code} asignado al rol ${role.code}`);
    return result;
  }

  async removePermissionFromRole(roleId: string, permissionId: string) {
    const existing = await this.prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId, permissionId } },
    });
    if (!existing) {
      throw new NotFoundException("Asignación de permiso no encontrada");
    }

    await this.prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId, permissionId } },
    });

    this.logger.log(`Permiso ${permissionId} removido del rol ${roleId}`);
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────
  // USER-ROLES
  // ─────────────────────────────────────────────────────────────────

  async assignRoleToUser(userId: string, roleId: string) {
    const [user, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.role.findUnique({ where: { id: roleId } }),
    ]);
    if (!user) throw new NotFoundException(`Usuario ${userId} no encontrado`);
    if (!role) throw new NotFoundException(`Rol ${roleId} no encontrado`);

    const existing = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });
    if (existing) {
      throw new ConflictException("El usuario ya tiene este rol asignado");
    }

    const result = await this.prisma.userRole.create({
      data: { userId, roleId },
      include: { role: true },
    });

    await this.clearUserPermissionsCache(userId);

    this.logger.log(`Rol ${role.code} asignado al usuario ${userId}`);
    return { userId, role: { id: role.id, code: role.code, name: role.name } };
  }

  async removeRoleFromUser(userId: string, roleId: string) {
    const existing = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });
    if (!existing) {
      throw new NotFoundException("Asignación de rol no encontrada");
    }

    await this.prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId } },
    });

    await this.clearUserPermissionsCache(userId);

    this.logger.log(`Rol ${roleId} removido del usuario ${userId}`);
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────
  // BRANCH (con campos seguros)
  // ─────────────────────────────────────────────────────────────────

  async getBranchWithUsers(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                isActive: true,
              },
            },
          },
        },
      },
    });
    if (!branch) throw new NotFoundException(`Sede ${branchId} no encontrada`);
    return branch;
  }

  // ─────────────────────────────────────────────────────────────────
  // SEED
  // ─────────────────────────────────────────────────────────────────

  async seedRolesAndPermissions() {
    const roleCodes = [
      "SUPER_ADMIN",
      "GENERAL_MANAGER",
      "OPS_MANAGER",
      "SUPERVISOR",
      "SUPERVISOR_ASSISTANT",
      "LOGISTICS",
      "QUALITY",
      "ACCOUNTING_HR",
      "RECEPTIONIST",
      "CUSTOMER",
    ];

    for (const code of roleCodes) {
      await this.prisma.role.upsert({
        where: { code },
        update: {},
        create: { code, name: code.replace(/_/g, " ") },
      });
    }

    const permissions = [
      // Appointments
      "appointment.create", "appointment.read", "appointment.update",
      "appointment.delete", "appointment.manage",
      // Branches
      "branch.read", "branch.manage",
      // Services / Availability
      "service.read", "service.manage",
      "availability.read",
      // Customers
      "customer.create", "customer.read", "customer.update",
      "customer.delete", "customer.dedup", "customer.merge",
      // Sales
      "sale.create", "sale.read", "sale.void", "sale.refund",
      // Cash
      "cash.open", "cash.close", "cash.read", "cash.adjust",
      // Inventory
      "inventory.read", "inventory.adjust", "inventory.transfer",
      // Plans / Subscriptions
      "plan.manage", "plan.read",
      "subscription.create", "subscription.read", "subscription.manage",
      // Reports
      "report.read", "report.export",
      // Settings / Schedule
      "settings.read", "settings.update", "schedule.manage", "capacity.manage",
      // Users / Roles
      "user.manage", "role.manage",
      // Notifications
      "whatsapp.send", "whatsapp.read",
      // Realtime
      "realtime.read",
      // Audit
      "audit.read",
      // Cash register
      "cash_register.read", "cash_register.manage",
      // Products
      "product.read", "product.manage",
      // Inventory (additional)
      "inventory.manage",
    ];

    for (const code of permissions) {
      await this.prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
    }

    this.logger.log("Roles and permissions seeded");
    return { roles: roleCodes.length, permissions: permissions.length };
  }
}

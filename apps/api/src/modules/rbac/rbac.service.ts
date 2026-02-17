import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UserPermissions {
  userId: string;
  roles: string[];
  permissions: string[];
  branchIds: string[];
}

@Injectable()
export class RbacService {
  private readonly logger = new Logger('RbacService');

  constructor(private prisma: PrismaService) {}

  /**
   * Obtiene permisos y roles del usuario
   */
  async getUserPermissions(userId: string): Promise<UserPermissions> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        branches: true,
      },
    });

    if (!user || !user.isActive) {
      return {
        userId,
        roles: [],
        permissions: [],
        branchIds: [],
      };
    }

    const roles = user.roles.map((ur) => ur.role.code);
    const permissions = new Set<string>();
    const branchIds = user.branches.map((ub) => ub.branchId);

    user.roles.forEach((ur) => {
      ur.role.permissions.forEach((rp) => {
        permissions.add(rp.permission.code);
      });
    });

    return {
      userId,
      roles,
      permissions: Array.from(permissions),
      branchIds,
    };
  }

  /**
   * Verifica si un usuario tiene un permiso específico
   */
  async hasPermission(userId: string, permissionCode: string): Promise<boolean> {
    const perms = await this.getUserPermissions(userId);
    return perms.permissions.includes(permissionCode);
  }

  /**
   * Verifica si un usuario tiene acceso a una sede
   */
  async hasAccessToBranch(userId: string, branchId: string): Promise<boolean> {
    const perms = await this.getUserPermissions(userId);

    // Super admin tiene acceso a todo
    if (perms.roles.includes('SUPER_ADMIN')) {
      return true;
    }

    // Verificar si está asignado a esa sede
    return perms.branchIds.includes(branchId);
  }

  /**
   * Verifica si un usuario tiene un rol específico
   */
  async hasRole(userId: string, roleCode: string): Promise<boolean> {
    const perms = await this.getUserPermissions(userId);
    return perms.roles.includes(roleCode);
  }

  /**
   * Verifica múltiples permisos (AND logic)
   */
  async hasAllPermissions(
    userId: string,
    permissionCodes: string[],
  ): Promise<boolean> {
    const perms = await this.getUserPermissions(userId);
    return permissionCodes.every((code) => perms.permissions.includes(code));
  }

  /**
   * Verifica múltiples permisos (OR logic)
   */
  async hasAnyPermission(
    userId: string,
    permissionCodes: string[],
  ): Promise<boolean> {
    const perms = await this.getUserPermissions(userId);
    return permissionCodes.some((code) => perms.permissions.includes(code));
  }

  /**
   * Seed de roles y permisos por defecto
   */
  async seedRolesAndPermissions() {
    // Roles
    const roleCodes = [
      'SUPER_ADMIN',
      'GENERAL_MANAGER',
      'OPS_MANAGER',
      'SUPERVISOR',
      'SUPERVISOR_ASSISTANT',
      'LOGISTICS',
      'QUALITY',
      'ACCOUNTING_HR',
      'RECEPTIONIST',
      'CUSTOMER',
    ];

    for (const code of roleCodes) {
      await this.prisma.role.upsert({
        where: { code },
        update: {},
        create: {
          code,
          name: code.replace(/_/g, ' '),
        },
      });
    }

    // Permisos por defecto
    const permissions = [
      // Appointments
      'appointment.create',
      'appointment.read',
      'appointment.update',
      'appointment.delete',
      'appointment.checkin',
      'appointment.no_show',

      // Customers
      'customer.create',
      'customer.read',
      'customer.update',
      'customer.delete',
      'customer.dedup',

      // Sales
      'sale.create',
      'sale.read',
      'sale.void',
      'sale.refund',

      // Cash
      'cash.open',
      'cash.close',
      'cash.read',
      'cash.adjust',

      // Inventory
      'inventory.read',
      'inventory.adjust',
      'inventory.transfer',

      // Plans
      'plan.create',
      'plan.read',
      'plan.assign',
      'plan.consume',

      // Reports
      'report.read',
      'report.export',

      // Settings
      'settings.read',
      'settings.update',
      'schedule.manage',
      'capacity.manage',

      // Users & Roles
      'user.manage',
      'role.manage',

      // WhatsApp
      'whatsapp.send',
      'whatsapp.read',
    ];

    for (const code of permissions) {
      await this.prisma.permission.upsert({
        where: { code },
        update: {},
        create: {
          code,
          description: code,
        },
      });
    }

    this.logger.log('Roles and permissions seeded');
  }
}
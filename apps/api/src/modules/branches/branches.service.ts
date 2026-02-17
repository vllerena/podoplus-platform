import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import { CreateBranchDto, UpdateBranchDto } from "./dto";

@Injectable()
export class BranchesService {
  private readonly logger = new Logger("BranchesService");

  constructor(
    private prisma: PrismaService,
    private rbacService: RbacService
  ) {}

  /**
   * Obtiene todas las sedes (filtradas por scope del usuario)
   */
  async findAll(userId: string) {
    const userPerms = await this.rbacService.getUserPermissions(userId);

    // Super admin ve todas las sedes
    if (userPerms.roles.includes("SUPER_ADMIN")) {
      return this.prisma.branch.findMany({
        orderBy: { createdAt: "desc" },
      });
    }

    // Otros usuarios solo ven sus sedes asignadas
    return this.prisma.branch.findMany({
      where: {
        users: {
          some: {
            userId,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Obtiene una sede por ID (con validación de scope)
   */
  async findOne(id: string, userId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException(`Sede con ID ${id} no encontrada`);
    }

    // Validar acceso
    const hasAccess = await this.rbacService.hasAccessToBranch(userId, id);
    if (!hasAccess) {
      throw new ForbiddenException("No tienes acceso a esta sede");
    }

    return branch;
  }

  /**
   * Crea una nueva sede (solo SUPER_ADMIN)
   */
  async create(dto: CreateBranchDto, userId: string) {
    // Validar permiso
    const isSuperAdmin = await this.rbacService.hasRole(userId, "SUPER_ADMIN");
    if (!isSuperAdmin) {
      throw new ForbiddenException("Solo SUPER_ADMIN puede crear sedes");
    }

    // Validar que el código sea único si se proporciona
    if (dto.code) {
      const existing = await this.prisma.branch.findUnique({
        where: { code: dto.code },
      });
      if (existing) {
        throw new BadRequestException(
          `Ya existe una sede con código ${dto.code}`
        );
      }
    }

    const branch = await this.prisma.branch.create({
      data: {
        code: dto.code,
        name: dto.name,
        address: dto.address,
        district: dto.district,
        city: dto.city,
        phone: dto.phone,
        defaultCapacity: dto.defaultCapacity,
        timezone: dto.timezone,
        isActive: true,
      },
    });

    this.logger.log(`Sede creada: ${branch.id} - ${branch.name}`);

    return branch;
  }

  /**
   * Actualiza una sede (solo SUPER_ADMIN)
   */
  async update(id: string, dto: UpdateBranchDto, userId: string) {
    // Validar permiso
    const isSuperAdmin = await this.rbacService.hasRole(userId, "SUPER_ADMIN");
    if (!isSuperAdmin) {
      throw new ForbiddenException("Solo SUPER_ADMIN puede actualizar sedes");
    }

    // Validar que existe
    const branch = await this.prisma.branch.findUnique({
      where: { id },
    });

    if (!branch) {
      throw new NotFoundException(`Sede con ID ${id} no encontrada`);
    }

    const updated = await this.prisma.branch.update({
      where: { id },
      data: {
        name: dto.name ?? branch.name,
        address: dto.address ?? branch.address,
        district: dto.district ?? branch.district,
        city: dto.city ?? branch.city,
        phone: dto.phone ?? branch.phone,
        defaultCapacity: dto.defaultCapacity ?? branch.defaultCapacity,
        timezone: dto.timezone ?? branch.timezone,
        isActive: dto.isActive ?? branch.isActive,
      },
    });

    this.logger.log(`Sede actualizada: ${updated.id}`);

    return updated;
  }

  /**
   * Desactiva una sede (soft delete)
   */
  async deactivate(id: string, userId: string) {
    // Validar permiso
    const isSuperAdmin = await this.rbacService.hasRole(userId, "SUPER_ADMIN");
    if (!isSuperAdmin) {
      throw new ForbiddenException("Solo SUPER_ADMIN puede desactivar sedes");
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id },
    });

    if (!branch) {
      throw new NotFoundException(`Sede con ID ${id} no encontrada`);
    }

    const updated = await this.prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`Sede desactivada: ${updated.id}`);

    return updated;
  }

  /**
   * Asigna un usuario a una sede
   */
  async assignUserToBranch(
    branchId: string,
    userId: string,
    requesterId: string
  ) {
    // Validar permiso
    const isSuperAdmin = await this.rbacService.hasRole(
      requesterId,
      "SUPER_ADMIN"
    );
    if (!isSuperAdmin) {
      throw new ForbiddenException(
        "Solo SUPER_ADMIN puede asignar usuarios a sedes"
      );
    }

    // Validar que existen ambos
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw new NotFoundException(`Sede con ID ${branchId} no encontrada`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    // Verificar si ya está asignado
    const existing = await this.prisma.userBranch.findUnique({
      where: {
        userId_branchId: {
          userId,
          branchId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException("El usuario ya está asignado a esta sede");
    }

    const assignment = await this.prisma.userBranch.create({
      data: {
        userId,
        branchId,
      },
    });

    this.logger.log(`Usuario ${userId} asignado a sede ${branchId}`);

    return assignment;
  }

  /**
   * Desasigna un usuario de una sede
   */
  async removeUserFromBranch(
    branchId: string,
    userId: string,
    requesterId: string
  ) {
    // Validar permiso
    const isSuperAdmin = await this.rbacService.hasRole(
      requesterId,
      "SUPER_ADMIN"
    );
    if (!isSuperAdmin) {
      throw new ForbiddenException(
        "Solo SUPER_ADMIN puede desasignar usuarios"
      );
    }

    const assignment = await this.prisma.userBranch.findUnique({
      where: {
        userId_branchId: {
          userId,
          branchId,
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException("El usuario no está asignado a esta sede");
    }

    await this.prisma.userBranch.delete({
      where: {
        userId_branchId: {
          userId,
          branchId,
        },
      },
    });

    this.logger.log(`Usuario ${userId} desasignado de sede ${branchId}`);

    return { success: true };
  }

  /**
   * Obtiene usuarios asignados a una sede
   */
  async getBranchUsers(branchId: string, userId: string) {
    // Validar acceso a la sede
    const hasAccess = await this.rbacService.hasAccessToBranch(
      userId,
      branchId
    );
    if (!hasAccess) {
      throw new ForbiddenException("No tienes acceso a esta sede");
    }

    const userBranches = await this.prisma.userBranch.findMany({
      where: { branchId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
            roles: {
              include: {
                role: {
                  select: {
                    code: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return userBranches.map((ub) => ({
      userId: ub.user.id,
      email: ub.user.email,
      firstName: ub.user.firstName,
      lastName: ub.user.lastName,
      isActive: ub.user.isActive,
      roles: ub.user.roles.map((r) => ({
        code: r.role.code,
        name: r.role.name,
      })),
    }));
  }
}

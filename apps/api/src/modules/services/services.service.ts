import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import { CreateServiceDto, UpdateServiceDto } from "./dto";

@Injectable()
export class ServicesService {
  private readonly logger = new Logger("ServicesService");

  constructor(
    private prisma: PrismaService,
    private rbacService: RbacService
  ) {}

  /**
   * Obtiene todos los servicios
   */
  async findAll(userId?: string, onlyActive: boolean = true) {
    return this.prisma.service.findMany({
      where: {
        isActive: onlyActive,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Obtiene un servicio por ID
   */
  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
    }

    return service;
  }

  /**
   * Crea un nuevo servicio (solo SUPER_ADMIN, GERENTE_OPERACIONES, LOGISTICA)
   */
  async create(dto: CreateServiceDto, userId: string) {
    // Validar permiso
    const hasPermission = await this.rbacService.hasPermission(
      userId,
      "settings.update"
    );
    if (!hasPermission) {
      throw new ForbiddenException("No tienes permiso para crear servicios");
    }

    const service = await this.prisma.service.create({
      data: {
        name: dto.name,
        description: dto.description,
        durationMinutes: dto.durationMinutes,
        bufferMinutes: dto.bufferMinutes ?? 0,
        basePrice: dto.basePrice,
        allowSelfService: dto.allowSelfService ?? false,
        isActive: true,
      },
    });

    this.logger.log(`Servicio creado: ${service.id} - ${service.name}`);

    return service;
  }

  /**
   * Actualiza un servicio
   */
  async update(id: string, dto: UpdateServiceDto, userId: string) {
    // Validar permiso
    const hasPermission = await this.rbacService.hasPermission(
      userId,
      "settings.update"
    );
    if (!hasPermission) {
      throw new ForbiddenException(
        "No tienes permiso para actualizar servicios"
      );
    }

    // Validar que existe
    const service = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
    }

    const updated = await this.prisma.service.update({
      where: { id },
      data: {
        name: dto.name ?? service.name,
        description: dto.description ?? service.description,
        durationMinutes: dto.durationMinutes ?? service.durationMinutes,
        bufferMinutes: dto.bufferMinutes ?? service.bufferMinutes,
        basePrice: dto.basePrice ?? service.basePrice,
        allowSelfService: dto.allowSelfService ?? service.allowSelfService,
        isActive: dto.isActive ?? service.isActive,
      },
    });

    this.logger.log(`Servicio actualizado: ${updated.id}`);

    return updated;
  }

  /**
   * Desactiva un servicio
   */
  async deactivate(id: string, userId: string) {
    // Validar permiso
    const hasPermission = await this.rbacService.hasPermission(
      userId,
      "settings.update"
    );
    if (!hasPermission) {
      throw new ForbiddenException(
        "No tienes permiso para desactivar servicios"
      );
    }

    const service = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
    }

    const updated = await this.prisma.service.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`Servicio desactivado: ${updated.id}`);

    return updated;
  }

  /**
   * Obtiene servicios disponibles para autoservicio (portal del cliente)
   */
  async findAvailableForSelfService() {
    return this.prisma.service.findMany({
      where: {
        isActive: true,
        allowSelfService: true,
      },
      orderBy: { name: "asc" },
    });
  }
}

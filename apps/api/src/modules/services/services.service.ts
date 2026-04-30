import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CacheService } from "../cache/cache.service";
import {
  CreateServiceDto,
  UpdateServiceDto,
  SetBranchPriceDto,
  CreateServiceCategoryDto,
  UpdateServiceCategoryDto,
} from "./dto";

// ─── Constantes ───────────────────────────────────────────────────────────────

const ACTIVE_APPOINTMENT_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"];

/** TTL de 5 minutos — los catálogos de servicios cambian raramente */
const CACHE_TTL          = 300;
const CACHE_KEY_ACTIVE   = "services:all:active";
const CACHE_KEY_ALL      = "services:all";
const CACHE_KEY_SS       = "services:self-service";
const CACHE_KEY_CATS     = "services:categories";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES     = 5 * 1024 * 1024; // 5 MB

/** IGV estándar en Perú (18 %). Usado para calcular el desglose en documentos SUNAT. */
const IGV_RATE = 0.18;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ServicesService {
  private readonly logger = new Logger("ServicesService");

  constructor(
    private readonly prisma:  PrismaService,
    private readonly cache:   CacheService,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  // ── Categorías ──────────────────────────────────────────────────────────────

  async listCategories() {
    return this.cache.wrap(CACHE_KEY_CATS, CACHE_TTL, async () => {
      const cats = await this.prisma.serviceCategory.findMany({
        orderBy: [{ order: "asc" }, { name: "asc" }],
        include: { _count: { select: { services: true } } },
      });
      return cats.map((c) => ({
        id:            c.id,
        name:          c.name,
        color:         c.color,
        order:         c.order,
        servicesCount: c._count.services,
        createdAt:     c.createdAt.toISOString(),
      }));
    });
  }

  async createCategory(dto: CreateServiceCategoryDto, actorId: string) {
    const existing = await this.prisma.serviceCategory.findUnique({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException(`Ya existe una categoría con el nombre "${dto.name}"`);

    const category = await this.prisma.serviceCategory.create({
      data: { name: dto.name, color: dto.color ?? "#6B7280", order: dto.order ?? 0 },
    });

    await this.cache.delPattern("services:*");

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "service_category.created",
      entityType: "service_category",
      entityId: category.id,
      metadata: { name: category.name },
    });

    this.logger.log(`Categoría creada: ${category.id} — "${category.name}"`);
    return category;
  }

  async updateCategory(categoryId: string, dto: UpdateServiceCategoryDto, actorId: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException(`Categoría ${categoryId} no encontrada`);

    if (dto.name && dto.name !== category.name) {
      const nameConflict = await this.prisma.serviceCategory.findUnique({
        where: { name: dto.name },
      });
      if (nameConflict) throw new ConflictException(`Ya existe una categoría con el nombre "${dto.name}"`);
    }

    const updated = await this.prisma.serviceCategory.update({
      where: { id: categoryId },
      data: {
        name:  dto.name  ?? category.name,
        color: dto.color ?? category.color,
        order: dto.order ?? category.order,
      },
      include: { _count: { select: { services: true } } },
    });

    await this.cache.delPattern("services:*");

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "service_category.updated",
      entityType: "service_category",
      entityId: categoryId,
      metadata: dto as any,
    });

    this.logger.log(`Categoría actualizada: ${categoryId} — "${updated.name}"`);
    return {
      id:            updated.id,
      name:          updated.name,
      color:         updated.color,
      order:         updated.order,
      servicesCount: updated._count.services,
      createdAt:     updated.createdAt.toISOString(),
    };
  }

  async deleteCategory(categoryId: string, actorId: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: categoryId },
      include: { _count: { select: { services: true } } },
    });
    if (!category) throw new NotFoundException(`Categoría ${categoryId} no encontrada`);

    if (category._count.services > 0) {
      throw new BadRequestException(
        `No se puede eliminar la categoría: tiene ${category._count.services} servicio${category._count.services === 1 ? "" : "s"} asignado${category._count.services === 1 ? "" : "s"}. Reasígnalos primero.`,
      );
    }

    await this.prisma.serviceCategory.delete({ where: { id: categoryId } });
    await this.cache.delPattern("services:*");

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "service_category.deleted",
      entityType: "service_category",
      entityId: categoryId,
      metadata: { name: category.name },
    });

    return { message: `Categoría "${category.name}" eliminada correctamente` };
  }

  // ── Lectura ──────────────────────────────────────────────────────────────────

  async findAll(onlyActive = true) {
    const key = onlyActive ? CACHE_KEY_ACTIVE : CACHE_KEY_ALL;
    return this.cache.wrap(key, CACHE_TTL, async () => {
      const services = await this.prisma.service.findMany({
        where:   onlyActive ? { isActive: true } : {},
        include: { category: { select: { id: true, name: true, color: true } } },
        orderBy: [{ category: { order: "asc" } }, { name: "asc" }],
      });
      return services.map((s) => this.formatService(s));
    });
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where:   { id },
      include: { category: { select: { id: true, name: true, color: true } } },
    });
    if (!service) throw new NotFoundException(`Servicio ${id} no encontrado`);
    return this.formatService(service);
  }

  async findAvailableForSelfService() {
    return this.cache.wrap(CACHE_KEY_SS, CACHE_TTL, async () => {
      const services = await this.prisma.service.findMany({
        where:   { isActive: true, allowSelfService: true },
        include: { category: { select: { id: true, name: true, color: true } } },
        orderBy: [{ category: { order: "asc" } }, { name: "asc" }],
      });
      return services.map((s) => this.formatService(s));
    });
  }

  // ── Mutaciones ───────────────────────────────────────────────────────────────

  async create(dto: CreateServiceDto, actorId: string) {
    if (dto.categoryId) await this.assertCategoryExists(dto.categoryId);

    const service = await this.prisma.service.create({
      data: {
        name:               dto.name,
        description:        dto.description        ?? null,
        durationMinutes:    dto.durationMinutes,
        bufferMinutes:      dto.bufferMinutes       ?? 0,
        basePrice:          dto.basePrice,
        allowSelfService:   dto.allowSelfService    ?? false,
        color:              dto.color               ?? "#6B7280",
        categoryId:         dto.categoryId          ?? null,
        internalCode:       dto.internalCode        ?? null,
        sunatProductCode:   dto.sunatProductCode    ?? null,
        unitTypeCode:       dto.unitTypeCode        ?? "ZZ",
        igvAffectationCode: dto.igvAffectationCode  ?? "10",
        hasIgv:             dto.hasIgv              ?? true,
        isActive:           true,
      },
      include: { category: { select: { id: true, name: true, color: true } } },
    });

    await this.cache.delPattern("services:*");

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "service.created",
      entityType: "service",
      entityId: service.id,
      metadata: { name: service.name, basePrice: Number(service.basePrice) },
    });

    this.logger.log(`Servicio creado: ${service.id} — ${service.name}`);
    this.logSunatSync("CREATE", service.id, service.name);

    return this.formatService(service);
  }

  async update(id: string, dto: UpdateServiceDto, actorId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { category: { select: { id: true, name: true, color: true } } },
    });
    if (!service) throw new NotFoundException(`Servicio ${id} no encontrado`);

    if (dto.categoryId && dto.categoryId !== service.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }

    const updated = await this.prisma.service.update({
      where: { id },
      data: {
        name:               dto.name               ?? service.name,
        description:        dto.description        !== undefined ? dto.description        : service.description,
        durationMinutes:    dto.durationMinutes     ?? service.durationMinutes,
        bufferMinutes:      dto.bufferMinutes       ?? service.bufferMinutes,
        basePrice:          dto.basePrice           ?? service.basePrice,
        allowSelfService:   dto.allowSelfService    ?? service.allowSelfService,
        color:              dto.color               ?? service.color,
        categoryId:         dto.categoryId          !== undefined ? dto.categoryId         : service.categoryId,
        internalCode:       dto.internalCode        !== undefined ? dto.internalCode        : service.internalCode,
        sunatProductCode:   dto.sunatProductCode    !== undefined ? dto.sunatProductCode    : service.sunatProductCode,
        unitTypeCode:       dto.unitTypeCode        ?? service.unitTypeCode,
        igvAffectationCode: dto.igvAffectationCode  ?? service.igvAffectationCode,
        hasIgv:             dto.hasIgv              ?? service.hasIgv,
      },
      include: { category: { select: { id: true, name: true, color: true } } },
    });

    await this.cache.delPattern("services:*");

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "service.updated",
      entityType: "service",
      entityId: id,
      metadata: dto as any,
    });

    this.logger.log(`Servicio actualizado: ${id}`);
    this.logSunatSync("UPDATE", id, updated.name);

    return this.formatService(updated);
  }

  /**
   * Desactiva un servicio. Bloquea si tiene citas activas futuras.
   */
  async deactivate(id: string, actorId: string) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundException(`Servicio ${id} no encontrado`);
    if (!service.isActive) throw new BadRequestException("El servicio ya está desactivado");

    const activeCount = await this.prisma.appointment.count({
      where: { serviceId: id, status: { in: ACTIVE_APPOINTMENT_STATUSES }, startAt: { gte: new Date() } },
    });

    if (activeCount > 0) {
      throw new BadRequestException(
        `No se puede desactivar el servicio: tiene ${activeCount} cita${activeCount === 1 ? "" : "s"} activa${activeCount === 1 ? "" : "s"} pendiente${activeCount === 1 ? "" : "s"}. Cancélalas primero.`,
      );
    }

    const updated = await this.prisma.service.update({
      where: { id },
      data:  { isActive: false },
      include: { category: { select: { id: true, name: true, color: true } } },
    });

    await this.cache.delPattern("services:*");

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "service.deactivated",
      entityType: "service",
      entityId: id,
      metadata: { name: service.name },
    });

    this.logger.log(`Servicio desactivado: ${id}`);
    return this.formatService(updated);
  }

  /**
   * Reactiva un servicio previamente desactivado.
   */
  async activate(id: string, actorId: string) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundException(`Servicio ${id} no encontrado`);
    if (service.isActive) throw new BadRequestException("El servicio ya está activo");

    const updated = await this.prisma.service.update({
      where: { id },
      data:  { isActive: true },
      include: { category: { select: { id: true, name: true, color: true } } },
    });

    await this.cache.delPattern("services:*");

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "service.activated",
      entityType: "service",
      entityId: id,
      metadata: { name: service.name },
    });

    this.logger.log(`Servicio reactivado: ${id}`);
    return this.formatService(updated);
  }

  // ── Imagen del servicio ──────────────────────────────────────────────────────

  async uploadImage(serviceId: string, buffer: Buffer, mimeType: string, actorId: string) {
    await this.assertServiceExists(serviceId);

    if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido. Solo se aceptan: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
      );
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException("El archivo supera el límite de 5 MB");
    }

    await this.prisma.service.update({
      where: { id: serviceId },
      data:  { imageData: buffer, imageMimeType: mimeType },
    });

    await this.cache.delPattern("services:*");

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "service.image_uploaded",
      entityType: "service",
      entityId: serviceId,
      metadata: { mimeType, sizeBytes: buffer.length },
    });

    this.logger.log(`Imagen subida para servicio ${serviceId}`);
    return { message: "Imagen del servicio actualizada correctamente" };
  }

  async getImage(serviceId: string): Promise<{ data: Buffer; mimeType: string } | null> {
    const service = await this.prisma.service.findUnique({
      where:  { id: serviceId },
      select: { imageData: true, imageMimeType: true },
    });
    if (!service || !service.imageData || !service.imageMimeType) return null;
    return { data: Buffer.from(service.imageData), mimeType: service.imageMimeType };
  }

  async deleteImage(serviceId: string, actorId: string) {
    await this.assertServiceExists(serviceId);

    await this.prisma.service.update({
      where: { id: serviceId },
      data:  { imageData: null, imageMimeType: null },
    });

    await this.cache.delPattern("services:*");

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "service.image_deleted",
      entityType: "service",
      entityId: serviceId,
    });

    return { message: "Imagen eliminada correctamente" };
  }

  // ── Historial de auditoría ───────────────────────────────────────────────────

  async getHistory(serviceId: string) {
    await this.assertServiceExists(serviceId);
    if (!this.auditService) return { data: [] };
    return { data: await this.auditService.getEntityHistory("service", serviceId) };
  }

  // ── Estadísticas ─────────────────────────────────────────────────────────────

  async getStats(serviceId: string) {
    await this.assertServiceExists(serviceId);

    const [
      totalAppointments,
      completedAppointments,
      canceledAppointments,
      noShowAppointments,
      revenueAgg,
      branchCount,
    ] = await Promise.all([
      this.prisma.appointment.count({ where: { serviceId } }),
      this.prisma.appointment.count({ where: { serviceId, status: "COMPLETED" } }),
      this.prisma.appointment.count({ where: { serviceId, status: "CANCELED" } }),
      this.prisma.appointment.count({ where: { serviceId, status: "NO_SHOW" } }),
      // Ingresos a través de SaleItems donde la venta está PAID
      this.prisma.saleItem.aggregate({
        where: { serviceId, sale: { status: "PAID" } },
        _sum:  { subtotal: true },
        _count: { id: true },
      }),
      this.prisma.serviceBranchPrice.count({ where: { serviceId } }),
    ]);

    const revenue     = Number(revenueAgg._sum.subtotal ?? 0);
    const salesCount  = revenueAgg._count.id;

    return {
      serviceId,
      totalAppointments,
      completedAppointments,
      canceledAppointments,
      noShowAppointments,
      completionRate:
        totalAppointments > 0
          ? Number(((completedAppointments / totalAppointments) * 100).toFixed(2))
          : 0,
      cancelRate:
        totalAppointments > 0
          ? Number(((canceledAppointments / totalAppointments) * 100).toFixed(2))
          : 0,
      totalRevenue:    revenue.toFixed(2),
      salesCount,
      branchesWithCustomPrice: branchCount,
    };
  }

  // ── Precios por sede ─────────────────────────────────────────────────────────

  async getBranchPrices(serviceId: string) {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundException(`Servicio ${serviceId} no encontrado`);

    const prices = await this.prisma.serviceBranchPrice.findMany({
      where:   { serviceId },
      include: { branch: { select: { id: true, name: true, code: true } } },
      orderBy: { branch: { name: "asc" } },
    });

    return {
      serviceId,
      serviceName: service.name,
      basePrice:   Number(service.basePrice).toFixed(2),
      branchPrices: prices.map((p) => ({
        branchId:   p.branchId,
        branchName: p.branch.name,
        branchCode: p.branch.code,
        price:      Number(p.price).toFixed(2),
        createdAt:  p.createdAt.toISOString(),
        updatedAt:  p.updatedAt.toISOString(),
      })),
    };
  }

  async setBranchPrice(serviceId: string, branchId: string, dto: SetBranchPriceDto, actorId: string) {
    const [service, branch] = await Promise.all([
      this.prisma.service.findUnique({ where: { id: serviceId } }),
      this.prisma.branch.findUnique({  where: { id: branchId  } }),
    ]);
    if (!service) throw new NotFoundException(`Servicio ${serviceId} no encontrado`);
    if (!branch)  throw new NotFoundException(`Sede ${branchId} no encontrada`);

    const result = await this.prisma.serviceBranchPrice.upsert({
      where:   { serviceId_branchId: { serviceId, branchId } },
      update:  { price: dto.price },
      create:  { serviceId, branchId, price: dto.price },
      include: { branch: { select: { id: true, name: true } } },
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "service.price_set",
      entityType: "service",
      entityId: serviceId,
      metadata: { branchId, branchName: branch.name, price: dto.price },
    });

    this.logger.log(`Precio de servicio ${serviceId} en sede ${branchId} → S/ ${dto.price}`);

    return {
      serviceId,
      branchId,
      branchName: (result as any).branch.name,
      price:      Number(result.price).toFixed(2),
      updatedAt:  result.updatedAt.toISOString(),
    };
  }

  async removeBranchPrice(serviceId: string, branchId: string, actorId: string) {
    const existing = await this.prisma.serviceBranchPrice.findUnique({
      where: { serviceId_branchId: { serviceId, branchId } },
    });
    if (!existing) throw new NotFoundException("Precio por sede no encontrado");

    await this.prisma.serviceBranchPrice.delete({
      where: { serviceId_branchId: { serviceId, branchId } },
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "service.price_removed",
      entityType: "service",
      entityId: serviceId,
      metadata: { branchId },
    });

    this.logger.log(`Precio personalizado eliminado: servicio ${serviceId} sede ${branchId}`);
    return { message: "Precio por sede eliminado. Se usará el precio base." };
  }

  // ── SUNAT / Facturación ──────────────────────────────────────────────────────

  /**
   * Construye el payload para registrar este servicio en sfeperu.com/api/item.
   * Llamar después de create/update para mantener sincronizado el catálogo.
   *
   * Campos clave para el sistema de facturación:
   *   - internal_id           ← internalCode (o id como fallback)
   *   - name / description    ← name
   *   - unit_type_id          ← unitTypeCode  ("ZZ" = Actividad de Servicio)
   *   - sale_unit_price       ← basePrice (precio base; la sede puede tener diferente)
   *   - sale_affectation_igv  ← igvAffectationCode
   *   - has_igv               ← hasIgv
   */
  buildSunatProductPayload(service: ReturnType<ServicesService["formatService"]>) {
    return {
      id:                             null, // null = crear nuevo en sfeperu
      item_type_id:                   "01",
      internal_id:                    service.internalCode ?? service.id,
      item_code:                      service.sunatProductCode ?? null,
      item_code_gs1:                  null,
      description:                    service.description ?? service.name,
      name:                           service.name,
      second_name:                    null,
      unit_type_id:                   service.unitTypeCode,
      currency_type_id:               "PEN",
      sale_unit_price:                Number(service.basePrice),
      purchase_unit_price:            0,
      has_isc:                        false,
      system_isc_type_id:             null,
      percentage_isc:                 0,
      suggested_price:                0,
      sale_affectation_igv_type_id:   service.igvAffectationCode,
      purchase_affectation_igv_type_id: service.igvAffectationCode,
      calculate_quantity:             false,
      stock:                          0,
      stock_min:                      0,
      has_igv:                        service.hasIgv,
      has_perception:                 false,
      item_unit_types:                [],
      percentage_of_profit:           0,
      percentage_perception:          0,
      image:                          null,
      image_url:                      null,
      temp_path:                      null,
      is_set:                         false,
    };
  }

  /**
   * Construye el item de línea para incluir en una factura/boleta SUNAT.
   *
   * @param service   Servicio formateado (de formatService)
   * @param quantity  Cantidad de sesiones/unidades
   * @param unitPrice Precio efectivo (basePrice o precio de sede)
   */
  buildSunatDocumentItem(
    service: ReturnType<ServicesService["formatService"]>,
    quantity: number,
    unitPrice: number,
  ) {
    const igvRate    = service.hasIgv && service.igvAffectationCode === "10" ? IGV_RATE : 0;
    const valorUnit  = igvRate > 0 ? unitPrice / (1 + igvRate) : unitPrice; // sin IGV
    const totalBase  = Number((valorUnit  * quantity).toFixed(2));
    const totalIgv   = Number((unitPrice * quantity - totalBase).toFixed(2));
    const totalItem  = Number((unitPrice * quantity).toFixed(2));

    return {
      codigo_interno:            service.internalCode ?? service.id,
      descripcion:               service.name,
      codigo_producto_sunat:     service.sunatProductCode ?? "",
      unidad_de_medida:          service.unitTypeCode,
      cantidad:                  quantity,
      valor_unitario:            Number(valorUnit.toFixed(6)),
      codigo_tipo_precio:        "01", // 01 = precio incluye IGV
      precio_unitario:           unitPrice,
      codigo_tipo_afectacion_igv: service.igvAffectationCode,
      total_base_igv:            totalBase,
      porcentaje_igv:            igvRate * 100,
      total_igv:                 totalIgv,
      total_impuestos:           totalIgv,
      total_valor_item:          totalBase,
      total_item:                totalItem,
    };
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────────

  /**
   * Respuesta formateada consistente.
   * basePrice se devuelve como string "100.00" para evitar problemas de Decimal.
   */
  formatService(service: any) {
    return {
      id:                service.id,
      name:              service.name,
      description:       service.description    ?? null,
      durationMinutes:   service.durationMinutes,
      bufferMinutes:     service.bufferMinutes,
      basePrice:         Number(service.basePrice).toFixed(2),
      isActive:          service.isActive,
      allowSelfService:  service.allowSelfService,
      color:             service.color,
      hasImage:          !!(service.imageData),
      categoryId:        service.categoryId  ?? null,
      category:          service.category    ?? null,
      // Campos SUNAT
      internalCode:      service.internalCode       ?? null,
      sunatProductCode:  service.sunatProductCode    ?? null,
      unitTypeCode:      service.unitTypeCode,
      igvAffectationCode: service.igvAffectationCode,
      hasIgv:            service.hasIgv,
      createdAt:         service.createdAt.toISOString(),
      updatedAt:         service.updatedAt.toISOString(),
    };
  }

  private async assertServiceExists(serviceId: string) {
    const s = await this.prisma.service.findUnique({
      where:  { id: serviceId },
      select: { id: true },
    });
    if (!s) throw new NotFoundException(`Servicio ${serviceId} no encontrado`);
    return s;
  }

  private async assertCategoryExists(categoryId: string) {
    const c = await this.prisma.serviceCategory.findUnique({
      where:  { id: categoryId },
      select: { id: true },
    });
    if (!c) throw new NotFoundException(`Categoría ${categoryId} no encontrada`);
    return c;
  }

  /**
   * Log de sincronización SUNAT pendiente.
   * En el futuro este método llamará a sfeperu.com/api/item via HttpService.
   */
  private logSunatSync(action: "CREATE" | "UPDATE", serviceId: string, name: string) {
    this.logger.log(
      `[SUNAT] Pendiente sync ${action} → servicio "${name}" (${serviceId}). ` +
      `Implementar llamada a sfeperu.com/api/item cuando el módulo de facturación esté activo.`,
    );
  }
}

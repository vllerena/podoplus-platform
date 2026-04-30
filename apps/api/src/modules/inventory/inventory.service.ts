import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CacheService } from "../cache/cache.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { CreateMovementDto } from "./dto/create-movement.dto";
import { BulkStockInitDto } from "./dto/bulk-stock-init.dto";

@Injectable()
export class InventoryService {
  private readonly logger = new Logger("InventoryService");

  constructor(
    private prisma: PrismaService,
    @Optional() private auditService?: AuditService,
    @Optional() private cacheService?: CacheService
  ) {}

  // ─────────────────────────────────────────────────────────────────
  // PRODUCTS
  // ─────────────────────────────────────────────────────────────────

  async createProduct(dto: CreateProductDto, actorId?: string) {
    const existing = await this.prisma.product.findUnique({
      where: { sku: dto.sku },
    });
    if (existing) {
      throw new ConflictException(`Ya existe un producto con SKU ${dto.sku}`);
    }

    const product = await this.prisma.product.create({
      data: {
        sku:                dto.sku,
        name:               dto.name,
        description:        dto.description        ?? null,
        unitType:           dto.unit_type,
        costPrice:          dto.cost_price ?? 0,
        salePrice:          dto.sale_price,
        isActive:           dto.is_active          ?? true,
        internalCode:       dto.internal_code      ?? null,
        sunatProductCode:   dto.sunat_product_code ?? null,
        unitTypeCode:       dto.unit_type_code     ?? "NIU",
        igvAffectationCode: dto.igv_affectation_code ?? "10",
        hasIgv:             dto.has_igv            ?? true,
      },
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "product.created",
      entityType: "product",
      entityId: product.id,
      metadata: { sku: product.sku, name: product.name },
    });

    this.logger.log(`Producto creado: ${product.id} (${product.sku})`);
    return this.formatProduct(product);
  }

  /**
   * Búsqueda de productos con cursor-based pagination.
   * Filtra por nombre/SKU (q) y estado (active).
   */
  async getProducts(params: {
    q?:         string;
    active?:    boolean;
    cursor?:    string;
    limit?:     number;
  } = {}) {
    const { q, active, cursor, limit: rawLimit = 50 } = params;
    const limit = Math.min(rawLimit, 200);

    const where: any = {};
    if (active !== undefined) where.isActive = active;
    if (q) {
      where.OR = [
        { name:         { contains: q, mode: "insensitive" } },
        { sku:          { contains: q, mode: "insensitive" } },
        { internalCode: { contains: q, mode: "insensitive" } },
      ];
    }

    const findArgs: any = {
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: limit + 1,
    };

    if (cursor) {
      findArgs.cursor = { id: cursor };
      findArgs.skip   = 1;
    }

    const rows     = await this.prisma.product.findMany(findArgs);
    const hasNext  = rows.length > limit;
    const data     = hasNext ? rows.slice(0, limit) : rows;
    const nextCursor = hasNext ? data[data.length - 1].id : null;

    return {
      data: data.map((p) => this.formatProduct(p)),
      nextCursor,
      hasNext,
    };
  }

  async getProductById(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Producto ${productId} no encontrado`);
    }
    return this.formatProduct(product);
  }

  async updateProduct(productId: string, dto: UpdateProductDto, actorId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Producto ${productId} no encontrado`);
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        ...(dto.name               !== undefined && { name:               dto.name }),
        ...(dto.description        !== undefined && { description:        dto.description }),
        ...(dto.unit_type          !== undefined && { unitType:           dto.unit_type }),
        ...(dto.cost_price         !== undefined && { costPrice:          dto.cost_price }),
        ...(dto.sale_price         !== undefined && { salePrice:          dto.sale_price }),
        ...(dto.is_active          !== undefined && { isActive:           dto.is_active }),
        ...(dto.internal_code      !== undefined && { internalCode:       dto.internal_code }),
        ...(dto.sunat_product_code !== undefined && { sunatProductCode:   dto.sunat_product_code }),
        ...(dto.unit_type_code     !== undefined && { unitTypeCode:       dto.unit_type_code }),
        ...(dto.igv_affectation_code !== undefined && { igvAffectationCode: dto.igv_affectation_code }),
        ...(dto.has_igv            !== undefined && { hasIgv:             dto.has_igv }),
      },
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "product.updated",
      entityType: "product",
      entityId: productId,
      metadata: dto as any,
    });

    this.logger.log(`Producto actualizado: ${productId}`);
    return this.formatProduct(updated);
  }

  async enableProduct(productId: string, actorId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Producto ${productId} no encontrado`);
    }
    if (product.isActive) {
      throw new BadRequestException("El producto ya está activo");
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data:  { isActive: true },
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "product.enabled",
      entityType: "product",
      entityId: productId,
      metadata: { sku: product.sku, name: product.name },
    });

    this.logger.log(`Producto activado: ${productId}`);
    return this.formatProduct(updated);
  }

  async disableProduct(productId: string, actorId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Producto ${productId} no encontrado`);
    }
    if (!product.isActive) {
      throw new BadRequestException("El producto ya está inactivo");
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data:  { isActive: false },
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action: "product.disabled",
      entityType: "product",
      entityId: productId,
      metadata: { sku: product.sku, name: product.name },
    });

    this.logger.log(`Producto desactivado: ${productId}`);
    return this.formatProduct(updated);
  }

  // ─────────────────────────────────────────────────────────────────
  // STOCK
  // ─────────────────────────────────────────────────────────────────

  /**
   * Stock actual por sede.
   * Con includeAll=true muestra TODOS los productos activos, incluso los que
   * aún no tienen un registro de stock (qty=0 implícito).
   */
  async getStocks(branchId: string, includeAll = false) {
    await this.getBranchOrThrow(branchId);

    if (includeAll) {
      const [products, stocks] = await Promise.all([
        this.prisma.product.findMany({
          where:   { isActive: true },
          orderBy: { name: "asc" },
        }),
        this.prisma.inventoryStock.findMany({ where: { branchId } }),
      ]);

      const stockMap = new Map(stocks.map((s) => [s.productId, s]));

      return products.map((p) => {
        const stock = stockMap.get(p.id);
        return {
          branch_id:    branchId,
          product_id:   p.id,
          product_sku:  p.sku,
          product_name: p.name,
          unit_type:    p.unitType,
          cost_price:   p.costPrice.toString(),
          sale_price:   p.salePrice.toString(),
          quantity:     stock?.quantity ?? 0,
          has_record:   !!stock,
          updated_at:   stock?.updatedAt.toISOString() ?? null,
        };
      });
    }

    const stocks = await this.prisma.inventoryStock.findMany({
      where:   { branchId },
      include: { product: true },
      orderBy: { product: { name: "asc" } },
    });

    return stocks.map((s) => ({
      branch_id:    s.branchId,
      product_id:   s.productId,
      product_sku:  s.product.sku,
      product_name: s.product.name,
      unit_type:    s.product.unitType,
      cost_price:   s.product.costPrice.toString(),
      sale_price:   s.product.salePrice.toString(),
      quantity:     s.quantity,
      has_record:   true,
      updated_at:   s.updatedAt.toISOString(),
    }));
  }

  /**
   * Productos con stock igual o inferior al umbral (default: 5).
   */
  async getLowStockAlerts(branchId: string, threshold = 5) {
    await this.getBranchOrThrow(branchId);

    if (threshold < 0) throw new BadRequestException("threshold no puede ser negativo");

    const stocks = await this.prisma.inventoryStock.findMany({
      where:   { branchId, quantity: { lte: threshold } },
      include: { product: true },
      orderBy: { quantity: "asc" },
    });

    return {
      branch_id: branchId,
      threshold,
      total_alerts: stocks.length,
      alerts: stocks.map((s) => ({
        product_id:   s.productId,
        product_sku:  s.product.sku,
        product_name: s.product.name,
        unit_type:    s.product.unitType,
        quantity:     s.quantity,
        is_out_of_stock: s.quantity === 0,
        updated_at:   s.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * Valoración del inventario de una sede:
   * suma(qty × costPrice) y suma(qty × salePrice) por producto.
   */
  async getInventoryValuation(branchId: string) {
    await this.getBranchOrThrow(branchId);

    const stocks = await this.prisma.inventoryStock.findMany({
      where:   { branchId, quantity: { gt: 0 } },
      include: { product: true },
      orderBy: { product: { name: "asc" } },
    });

    let totalCostValue   = 0;
    let totalSaleValue   = 0;

    const items = stocks.map((s) => {
      const costValue = s.quantity * Number(s.product.costPrice);
      const saleValue = s.quantity * Number(s.product.salePrice);
      totalCostValue += costValue;
      totalSaleValue += saleValue;
      return {
        product_id:   s.productId,
        product_sku:  s.product.sku,
        product_name: s.product.name,
        quantity:     s.quantity,
        unit_cost:    s.product.costPrice.toString(),
        unit_price:   s.product.salePrice.toString(),
        cost_value:   costValue.toFixed(2),
        sale_value:   saleValue.toFixed(2),
      };
    });

    return {
      branch_id:         branchId,
      total_products:    stocks.length,
      total_cost_value:  totalCostValue.toFixed(2),
      total_sale_value:  totalSaleValue.toFixed(2),
      potential_margin:  (totalSaleValue - totalCostValue).toFixed(2),
      items,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // MOVEMENTS
  // ─────────────────────────────────────────────────────────────────

  async registerMovement(
    dto: CreateMovementDto,
    createdById: string,
    idempotencyKey?: string
  ) {
    // Idempotency check
    if (idempotencyKey && this.cacheService) {
      const cacheKey = `idempotency:inventory:movement:${idempotencyKey}`;
      const cached = await this.cacheService.get<ReturnType<InventoryService["formatMovement"]>>(cacheKey);
      if (cached !== null) {
        this.logger.warn(`Movimiento de inventario duplicado (idempotency): ${idempotencyKey}`);
        return cached;
      }
    }

    await this.getBranchOrThrow(dto.branch_id);

    const product = await this.prisma.product.findUnique({
      where: { id: dto.product_id },
    });
    if (!product || !product.isActive) {
      throw new NotFoundException(
        `Producto ${dto.product_id} no encontrado o inactivo`
      );
    }

    if (dto.type === "TRANSFER_OUT" && !dto.target_branch_id) {
      throw new BadRequestException(
        "TRANSFER_OUT requiere target_branch_id (sede destino)"
      );
    }

    if (dto.type === "PURCHASE_IN" && dto.quantity === 0) {
      throw new BadRequestException("La cantidad de una compra debe ser mayor a 0");
    }

    if (dto.type === "TRANSFER_OUT") {
      const stock = await this.prisma.inventoryStock.findUnique({
        where: {
          branchId_productId: {
            branchId:  dto.branch_id,
            productId: dto.product_id,
          },
        },
      });
      if (!stock || stock.quantity < dto.quantity) {
        throw new ConflictException(
          `Stock insuficiente. Disponible: ${stock?.quantity ?? 0}, requerido: ${dto.quantity}`
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const movement = await tx.inventoryMovement.create({
        data: {
          branch:        { connect: { id: dto.branch_id } },
          product:       { connect: { id: dto.product_id } },
          type:          dto.type,
          quantity:      dto.quantity,
          referenceType: "MANUAL",
          reason:        dto.reason ?? null,
          createdBy:     { connect: { id: createdById } },
        },
      });

      if (dto.type === "PURCHASE_IN" || dto.type === "TRANSFER_IN") {
        await tx.inventoryStock.upsert({
          where:  { branchId_productId: { branchId: dto.branch_id, productId: dto.product_id } },
          update: { quantity: { increment: dto.quantity } },
          create: { branchId: dto.branch_id, productId: dto.product_id, quantity: dto.quantity },
        });
      } else if (dto.type === "TRANSFER_OUT") {
        await tx.inventoryStock.update({
          where: { branchId_productId: { branchId: dto.branch_id, productId: dto.product_id } },
          data:  { quantity: { decrement: dto.quantity } },
        });
        await tx.inventoryStock.upsert({
          where:  { branchId_productId: { branchId: dto.target_branch_id!, productId: dto.product_id } },
          update: { quantity: { increment: dto.quantity } },
          create: { branchId: dto.target_branch_id!, productId: dto.product_id, quantity: dto.quantity },
        });
        await tx.inventoryMovement.create({
          data: {
            branch:        { connect: { id: dto.target_branch_id! } },
            product:       { connect: { id: dto.product_id } },
            type:          "TRANSFER_IN",
            quantity:      dto.quantity,
            referenceType: "TRANSFER",
            referenceId:   movement.id,
            reason:        `Transferencia desde sede ${dto.branch_id}`,
            createdBy:     { connect: { id: createdById } },
          },
        });
      } else if (dto.type === "ADJUSTMENT") {
        // quantity es el stock final absoluto (puede ser 0 para vaciar)
        await tx.inventoryStock.upsert({
          where:  { branchId_productId: { branchId: dto.branch_id, productId: dto.product_id } },
          update: { quantity: dto.quantity },
          create: { branchId: dto.branch_id, productId: dto.product_id, quantity: dto.quantity },
        });
      }

      return movement;
    });

    this.auditService?.log({
      actorType: "USER",
      actorId:   createdById,
      branchId:  dto.branch_id,
      action:    "inventory.movement",
      entityType: "inventoryMovement",
      entityId:  result.id,
      metadata: {
        type:           dto.type,
        productId:      dto.product_id,
        productSku:     product.sku,
        quantity:       dto.quantity,
        targetBranchId: dto.target_branch_id,
        reason:         dto.reason,
      },
    });

    this.logger.log(
      `Movimiento ${dto.type}: producto ${product.sku}, qty ${dto.quantity}, sede ${dto.branch_id}`
    );

    const formatted = this.formatMovement(result);

    // Store idempotency result (24h TTL)
    if (idempotencyKey && this.cacheService) {
      const cacheKey = `idempotency:inventory:movement:${idempotencyKey}`;
      await this.cacheService.set(cacheKey, formatted, 86400);
    }

    return formatted;
  }

  /**
   * Historial de movimientos con cursor-based pagination.
   */
  async getMovements(params: {
    branchId:   string;
    productId?: string;
    type?:      string;
    from?:      Date;
    to?:        Date;
    cursor?:    string;
    limit?:     number;
  }) {
    const { branchId, productId, type, from, to, cursor, limit: rawLimit = 50 } = params;
    await this.getBranchOrThrow(branchId);

    const limit = Math.min(rawLimit, 200);

    const where: any = { branchId };
    if (productId) where.productId = productId;
    if (type)      where.type      = type;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to)   where.createdAt.lte = to;
    }

    const findArgs: any = {
      where,
      include: { product: true },
      orderBy: { createdAt: "desc" },
      take:    limit + 1,
    };

    if (cursor) {
      findArgs.cursor = { id: cursor };
      findArgs.skip   = 1;
    }

    const rows     = await this.prisma.inventoryMovement.findMany(findArgs);
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
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private async getBranchOrThrow(branchId: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException(`Sede ${branchId} no encontrada`);
    return branch;
  }

  private formatProduct(p: any) {
    return {
      id:                   p.id,
      sku:                  p.sku,
      name:                 p.name,
      description:          p.description          ?? null,
      unit_type:            p.unitType,
      cost_price:           p.costPrice.toString(),
      sale_price:           p.salePrice.toString(),
      is_active:            p.isActive,
      has_image:            !!(p.imageData),
      // SUNAT
      internal_code:        p.internalCode         ?? null,
      sunat_product_code:   p.sunatProductCode     ?? null,
      unit_type_code:       p.unitTypeCode,
      igv_affectation_code: p.igvAffectationCode,
      has_igv:              p.hasIgv,
      created_at:           p.createdAt.toISOString(),
      updated_at:           p.updatedAt.toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // PRODUCT IMAGE
  // ─────────────────────────────────────────────────────────────────

  async getProductImage(productId: string) {
    const product = await this.prisma.product.findUnique({
      where:  { id: productId },
      select: { imageData: true, imageMimeType: true },
    });
    if (!product || !product.imageData) return null;
    return { data: product.imageData, mimeType: product.imageMimeType ?? "image/jpeg" };
  }

  async uploadProductImage(productId: string, buffer: Buffer, mimeType: string, actorId?: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException(`Producto ${productId} no encontrado`);

    await this.prisma.product.update({
      where: { id: productId },
      data:  { imageData: buffer, imageMimeType: mimeType },
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action:    "product.image.uploaded",
      entityType: "product",
      entityId:  productId,
      metadata:  { mimeType },
    });

    return { message: "Imagen del producto cargada correctamente" };
  }

  async deleteProductImage(productId: string, actorId?: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException(`Producto ${productId} no encontrado`);

    await this.prisma.product.update({
      where: { id: productId },
      data:  { imageData: null, imageMimeType: null },
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action:    "product.image.deleted",
      entityType: "product",
      entityId:  productId,
      metadata:  {},
    });

    return { message: "Imagen del producto eliminada correctamente" };
  }

  // ─────────────────────────────────────────────────────────────────
  // BULK STOCK INIT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Inicialización masiva de stock para un producto en múltiples sedes.
   * Para cada entrada: si ya existe stock → lo reemplaza con ADJUSTMENT;
   * si no existe → lo crea y registra PURCHASE_IN.
   *
   * Se ejecuta dentro de una transacción única para garantizar atomicidad.
   */
  async bulkInitStock(dto: BulkStockInitDto, actorId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.product_id },
    });
    if (!product || !product.isActive) {
      throw new NotFoundException(`Producto ${dto.product_id} no encontrado o inactivo`);
    }

    // Validate all branches first (outside tx for better error messages)
    for (const entry of dto.entries) {
      await this.getBranchOrThrow(entry.branch_id);
    }

    const results = await this.prisma.$transaction(async (tx) => {
      const created: any[] = [];

      for (const entry of dto.entries) {
        const existing = await tx.inventoryStock.findUnique({
          where: {
            branchId_productId: {
              branchId:  entry.branch_id,
              productId: dto.product_id,
            },
          },
        });

        // Upsert stock (ADJUSTMENT semantics — quantity is absolute)
        await tx.inventoryStock.upsert({
          where:  { branchId_productId: { branchId: entry.branch_id, productId: dto.product_id } },
          update: { quantity: entry.quantity },
          create: { branchId: entry.branch_id, productId: dto.product_id, quantity: entry.quantity },
        });

        // Record movement
        const movType = existing ? "ADJUSTMENT" : "PURCHASE_IN";
        const movement = await tx.inventoryMovement.create({
          data: {
            branch:        { connect: { id: entry.branch_id } },
            product:       { connect: { id: dto.product_id } },
            type:          movType,
            quantity:      entry.quantity,
            referenceType: "BULK_INIT",
            reason:        dto.reason ?? "Inicialización de stock",
            createdBy:     { connect: { id: actorId } },
          },
        });

        created.push({ branch_id: entry.branch_id, quantity: entry.quantity, movement_id: movement.id });
      }

      return created;
    });

    this.auditService?.log({
      actorType: "USER",
      actorId,
      action:    "inventory.bulk_init_stock",
      entityType: "product",
      entityId:  dto.product_id,
      metadata:  { product_id: dto.product_id, entries: dto.entries.length },
    });

    this.logger.log(
      `Bulk stock init: producto ${product.sku}, ${dto.entries.length} sedes`
    );

    return {
      product_id:   dto.product_id,
      product_sku:  product.sku,
      product_name: product.name,
      entries_updated: results.length,
      entries: results,
    };
  }

  private formatMovement(m: any) {
    return {
      id:             m.id,
      branch_id:      m.branchId,
      product_id:     m.productId,
      product_sku:    m.product?.sku  ?? undefined,
      product_name:   m.product?.name ?? undefined,
      type:           m.type,
      quantity:       m.quantity,
      reference_type: m.referenceType ?? undefined,
      reference_id:   m.referenceId   ?? undefined,
      reason:         m.reason        ?? undefined,
      created_by:     m.createdById,
      created_at:     m.createdAt.toISOString(),
    };
  }
}

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Optional,
} from "@nestjs/common";
import { PrismaService }     from "../prisma/prisma.service";
import { AuditService }      from "../audit/audit.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { CreatePurchaseDto } from "./dto/create-purchase.dto";
import { UpdatePurchaseDto } from "./dto/update-purchase.dto";
import { CreatePurchaseItemDto } from "./dto/create-purchase.dto";

@Injectable()
export class PurchasesService {
  private readonly logger = new Logger("PurchasesService");

  constructor(
    private prisma:  PrismaService,
    @Optional() private audit?: AuditService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════
  // SUPPLIERS
  // ═══════════════════════════════════════════════════════════════════

  async createSupplier(dto: CreateSupplierDto) {
    if (dto.document_number) {
      const existing = await this.prisma.supplier.findUnique({
        where: { documentNumber: dto.document_number },
      });
      if (existing) {
        throw new ConflictException(
          `Ya existe un proveedor con el documento ${dto.document_number}`
        );
      }
    }

    const supplier = await this.prisma.supplier.create({
      data: {
        documentType:   dto.document_type   ?? "RUC",
        documentNumber: dto.document_number ?? null,
        name:           dto.name,
        address:        dto.address         ?? null,
        phone:          dto.phone           ?? null,
        email:          dto.email           ?? null,
      },
    });

    this.logger.log(`Proveedor creado: ${supplier.id} — ${supplier.name}`);
    return this.formatSupplier(supplier);
  }

  async listSuppliers(q?: string, onlyActive = true) {
    const where: any = {};
    if (onlyActive) where.isActive = true;
    if (q) {
      where.OR = [
        { name:           { contains: q, mode: "insensitive" } },
        { documentNumber: { contains: q, mode: "insensitive" } },
      ];
    }
    const suppliers = await this.prisma.supplier.findMany({
      where,
      orderBy: { name: "asc" },
    });
    return suppliers.map(this.formatSupplier);
  }

  async getSupplier(id: string) {
    const s = await this.prisma.supplier.findUnique({ where: { id } });
    if (!s) throw new NotFoundException(`Proveedor ${id} no encontrado`);
    return this.formatSupplier(s);
  }

  async updateSupplier(id: string, dto: Partial<CreateSupplierDto>) {
    const s = await this.prisma.supplier.findUnique({ where: { id } });
    if (!s) throw new NotFoundException(`Proveedor ${id} no encontrado`);

    if (dto.document_number && dto.document_number !== s.documentNumber) {
      const conflict = await this.prisma.supplier.findUnique({
        where: { documentNumber: dto.document_number },
      });
      if (conflict) {
        throw new ConflictException(
          `Ya existe un proveedor con el documento ${dto.document_number}`
        );
      }
    }

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: {
        ...(dto.document_type   !== undefined && { documentType:   dto.document_type }),
        ...(dto.document_number !== undefined && { documentNumber: dto.document_number }),
        ...(dto.name            !== undefined && { name:           dto.name }),
        ...(dto.address         !== undefined && { address:        dto.address }),
        ...(dto.phone           !== undefined && { phone:          dto.phone }),
        ...(dto.email           !== undefined && { email:          dto.email }),
      },
    });

    this.logger.log(`Proveedor actualizado: ${id}`);
    return this.formatSupplier(updated);
  }

  async disableSupplier(id: string) {
    const s = await this.prisma.supplier.findUnique({ where: { id } });
    if (!s) throw new NotFoundException(`Proveedor ${id} no encontrado`);
    const updated = await this.prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });
    return this.formatSupplier(updated);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PURCHASES
  // ═══════════════════════════════════════════════════════════════════

  async createPurchase(dto: CreatePurchaseDto, actorId: string) {
    // Validate supplier exists
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplier_id },
    });
    if (!supplier) {
      throw new NotFoundException(`Proveedor ${dto.supplier_id} no encontrado`);
    }

    // Check duplicate document
    const duplicate = await this.prisma.purchase.findUnique({
      where: {
        supplierId_voucherType_serie_number: {
          supplierId:  dto.supplier_id,
          voucherType: dto.voucher_type,
          serie:       dto.serie,
          number:      dto.number,
        },
      },
    });
    if (duplicate) {
      throw new ConflictException(
        `Ya existe una compra con el mismo comprobante (${dto.voucher_type} ${dto.serie}-${dto.number}) para este proveedor`
      );
    }

    // Validate business unit if provided
    if (dto.business_unit_id) {
      const bu = await this.prisma.businessUnit.findUnique({
        where: { id: dto.business_unit_id },
      });
      if (!bu) throw new NotFoundException(`Razón social ${dto.business_unit_id} no encontrada`);
    }

    const items = dto.items ?? [];

    // Validate all product and branch IDs in items
    for (const item of items) {
      const product = await this.prisma.product.findUnique({ where: { id: item.product_id } });
      if (!product) throw new NotFoundException(`Producto ${item.product_id} no encontrado`);
      const branch  = await this.prisma.branch.findUnique({ where: { id: item.branch_id } });
      if (!branch)  throw new NotFoundException(`Sede ${item.branch_id} no encontrada`);
    }

    const purchase = await this.prisma.purchase.create({
      data: {
        businessUnitId: dto.business_unit_id ?? null,
        supplierId:     dto.supplier_id,
        voucherType:    dto.voucher_type,
        serie:          dto.serie,
        number:         dto.number,
        emissionDate:   new Date(dto.emission_date),
        dueDate:        dto.due_date ? new Date(dto.due_date) : null,
        currency:       dto.currency     ?? "PEN",
        exchangeRate:   dto.exchange_rate ?? 1,
        subtotal:       dto.subtotal      ?? 0,
        taxAmount:      dto.tax_amount    ?? 0,
        totalAmount:    dto.total_amount  ?? 0,
        notes:          dto.notes         ?? null,
        status:         "DRAFT",
        createdById:    actorId,
        items: {
          create: items.map((i) => this.mapItemData(i)),
        },
      },
      include: { items: true, supplier: true },
    });

    this.audit?.log({
      actorType: "USER",
      actorId,
      action:    "purchase.created",
      entityType: "purchase",
      entityId:  purchase.id,
      metadata:  { voucherType: dto.voucher_type, serie: dto.serie, number: dto.number, supplierId: dto.supplier_id },
    });

    this.logger.log(`Compra creada: ${purchase.id} (${dto.voucher_type} ${dto.serie}-${dto.number})`);
    return this.formatPurchase(purchase);
  }

  async listPurchases(params: {
    supplierId?:     string;
    businessUnitId?: string;
    status?:         string;
    from?:           Date;
    to?:             Date;
    cursor?:         string;
    limit?:          number;
  }) {
    const { supplierId, businessUnitId, status, from, to, cursor, limit: rawLimit = 50 } = params;
    const limit = Math.min(rawLimit, 200);

    const where: any = {};
    if (supplierId)     where.supplierId     = supplierId;
    if (businessUnitId) where.businessUnitId = businessUnitId;
    if (status)         where.status         = status;
    if (from || to) {
      where.emissionDate = {};
      if (from) where.emissionDate.gte = from;
      if (to)   where.emissionDate.lte = to;
    }

    const findArgs: any = {
      where,
      include: { supplier: true, _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      take:    limit + 1,
    };

    if (cursor) {
      findArgs.cursor = { id: cursor };
      findArgs.skip   = 1;
    }

    const rows    = await this.prisma.purchase.findMany(findArgs);
    const hasNext = rows.length > limit;
    const data    = hasNext ? rows.slice(0, limit) : rows;

    return {
      data:       data.map((p) => this.formatPurchase(p)),
      nextCursor: hasNext ? data[data.length - 1].id : null,
      hasNext,
    };
  }

  async getPurchase(id: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where:   { id },
      include: {
        supplier:     true,
        businessUnit: { select: { id: true, name: true, ruc: true } },
        createdBy:    { select: { id: true, firstName: true, lastName: true, email: true } },
        items: {
          include: {
            product: { select: { id: true, sku: true, name: true, unitTypeCode: true } },
            branch:  { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
    if (!purchase) throw new NotFoundException(`Compra ${id} no encontrada`);
    return this.formatPurchaseDetail(purchase);
  }

  async updatePurchase(id: string, dto: UpdatePurchaseDto, actorId: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
    });
    if (!purchase) throw new NotFoundException(`Compra ${id} no encontrada`);
    if (purchase.status !== "DRAFT") {
      throw new BadRequestException("Solo se pueden editar compras en estado DRAFT");
    }

    // If items are being replaced, validate them first
    if (dto.items !== undefined) {
      for (const item of dto.items) {
        const product = await this.prisma.product.findUnique({ where: { id: item.product_id } });
        if (!product) throw new NotFoundException(`Producto ${item.product_id} no encontrado`);
        const branch  = await this.prisma.branch.findUnique({ where: { id: item.branch_id } });
        if (!branch)  throw new NotFoundException(`Sede ${item.branch_id} no encontrada`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Replace items if provided
      if (dto.items !== undefined) {
        await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
        if (dto.items.length > 0) {
          await tx.purchaseItem.createMany({
            data: dto.items.map((i) => ({ purchaseId: id, ...this.mapItemData(i) })),
          });
        }
      }

      await tx.purchase.update({
        where: { id },
        data: {
          ...(dto.business_unit_id !== undefined && { businessUnitId: dto.business_unit_id }),
          ...(dto.voucher_type     !== undefined && { voucherType:    dto.voucher_type }),
          ...(dto.serie            !== undefined && { serie:          dto.serie }),
          ...(dto.number           !== undefined && { number:         dto.number }),
          ...(dto.emission_date    !== undefined && { emissionDate:   new Date(dto.emission_date) }),
          ...(dto.due_date         !== undefined && { dueDate:        new Date(dto.due_date) }),
          ...(dto.currency         !== undefined && { currency:       dto.currency }),
          ...(dto.exchange_rate    !== undefined && { exchangeRate:   dto.exchange_rate }),
          ...(dto.subtotal         !== undefined && { subtotal:       dto.subtotal }),
          ...(dto.tax_amount       !== undefined && { taxAmount:      dto.tax_amount }),
          ...(dto.total_amount     !== undefined && { totalAmount:    dto.total_amount }),
          ...(dto.notes            !== undefined && { notes:          dto.notes }),
        },
      });
    });

    this.audit?.log({
      actorType: "USER",
      actorId,
      action:    "purchase.updated",
      entityType: "purchase",
      entityId:  id,
      metadata:  dto as any,
    });

    this.logger.log(`Compra actualizada: ${id}`);
    return this.getPurchase(id);
  }

  /**
   * Recibir una compra DRAFT → RECEIVED:
   * - Crea InventoryMovement (PURCHASE_IN) por cada ítem
   * - Actualiza InventoryStock (incrementa por sede)
   */
  async receivePurchase(id: string, actorId: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where:   { id },
      include: { items: true },
    });
    if (!purchase) throw new NotFoundException(`Compra ${id} no encontrada`);
    if (purchase.status !== "DRAFT") {
      throw new BadRequestException("Solo se pueden recibir compras en estado DRAFT");
    }
    if (purchase.items.length === 0) {
      throw new BadRequestException("La compra no tiene ítems registrados");
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Update purchase status
      await tx.purchase.update({
        where: { id },
        data:  { status: "RECEIVED", receivedAt: now },
      });

      // Process each item
      for (const item of purchase.items) {
        // Round quantity to integer for stock management
        const qty = Math.floor(Number(item.quantity));
        if (qty <= 0) continue;

        // Update stock
        await tx.inventoryStock.upsert({
          where: {
            branchId_productId: {
              branchId:  item.branchId,
              productId: item.productId,
            },
          },
          update: { quantity: { increment: qty } },
          create: { branchId: item.branchId, productId: item.productId, quantity: qty },
        });

        // Create kardex movement
        await tx.inventoryMovement.create({
          data: {
            branchId:      item.branchId,
            productId:     item.productId,
            type:          "PURCHASE_IN",
            quantity:      qty,
            lot:           item.lot ?? null,
            referenceType: "PURCHASE",
            referenceId:   id,
            reason:        item.lot
              ? `Compra recibida — Lote: ${item.lot}`
              : "Compra recibida",
            createdById:   actorId,
          },
        });
      }
    });

    this.audit?.log({
      actorType: "USER",
      actorId,
      action:    "purchase.received",
      entityType: "purchase",
      entityId:  id,
      metadata:  { itemCount: purchase.items.length, receivedAt: now },
    });

    this.logger.log(`Compra recibida: ${id} — ${purchase.items.length} ítems`);
    return this.getPurchase(id);
  }

  /**
   * Cancelar una compra — solo si está en estado DRAFT.
   * Las compras ya RECEIVED no se pueden cancelar desde aquí
   * (requeriría reversar stock manualmente con movimientos REMOVAL).
   */
  async cancelPurchase(id: string, reason: string, actorId: string) {
    const purchase = await this.prisma.purchase.findUnique({ where: { id } });
    if (!purchase) throw new NotFoundException(`Compra ${id} no encontrada`);
    if (purchase.status !== "DRAFT") {
      throw new BadRequestException(
        "Solo se pueden cancelar compras en estado DRAFT. " +
        "Para revertir una compra ya recibida, usa movimientos de tipo REMOVAL."
      );
    }

    const now = new Date();
    await this.prisma.purchase.update({
      where: { id },
      data:  { status: "CANCELLED", cancelledAt: now, cancelReason: reason ?? null },
    });

    this.audit?.log({
      actorType: "USER",
      actorId,
      action:    "purchase.cancelled",
      entityType: "purchase",
      entityId:  id,
      metadata:  { reason },
    });

    this.logger.log(`Compra cancelada: ${id}`);
    return { message: "Compra cancelada correctamente" };
  }

  // ═══════════════════════════════════════════════════════════════════
  // FORMATTERS
  // ═══════════════════════════════════════════════════════════════════

  private formatSupplier(s: any) {
    return {
      id:              s.id,
      document_type:   s.documentType,
      document_number: s.documentNumber ?? null,
      name:            s.name,
      address:         s.address   ?? null,
      phone:           s.phone     ?? null,
      email:           s.email     ?? null,
      is_active:       s.isActive,
      created_at:      s.createdAt.toISOString(),
      updated_at:      s.updatedAt.toISOString(),
    };
  }

  private formatPurchase(p: any) {
    return {
      id:               p.id,
      business_unit_id: p.businessUnitId   ?? null,
      supplier_id:      p.supplierId,
      supplier_name:    p.supplier?.name   ?? null,
      voucher_type:     p.voucherType,
      serie:            p.serie,
      number:           p.number,
      emission_date:    p.emissionDate.toISOString().split("T")[0],
      due_date:         p.dueDate ? p.dueDate.toISOString().split("T")[0] : null,
      currency:         p.currency,
      exchange_rate:    p.exchangeRate.toString(),
      subtotal:         p.subtotal.toString(),
      tax_amount:       p.taxAmount.toString(),
      total_amount:     p.totalAmount.toString(),
      status:           p.status,
      notes:            p.notes       ?? null,
      items_count:      p._count?.items ?? p.items?.length ?? 0,
      received_at:      p.receivedAt  ? p.receivedAt.toISOString()  : null,
      cancelled_at:     p.cancelledAt ? p.cancelledAt.toISOString() : null,
      cancel_reason:    p.cancelReason ?? null,
      created_at:       p.createdAt.toISOString(),
      updated_at:       p.updatedAt.toISOString(),
    };
  }

  private formatPurchaseDetail(p: any) {
    return {
      ...this.formatPurchase(p),
      supplier:     p.supplier     ? this.formatSupplier(p.supplier) : null,
      business_unit: p.businessUnit ?? null,
      created_by:   p.createdBy    ?? null,
      items:        (p.items ?? []).map((i: any) => this.formatPurchaseItem(i)),
    };
  }

  private formatPurchaseItem(i: any) {
    return {
      id:             i.id,
      purchase_id:    i.purchaseId,
      product_id:     i.productId,
      product_sku:    i.product?.sku  ?? null,
      product_name:   i.product?.name ?? null,
      branch_id:      i.branchId,
      branch_name:    i.branch?.name  ?? null,
      lot:            i.lot           ?? null,
      unit_type_code: i.unitTypeCode,
      quantity:       i.quantity.toString(),
      unit_value:     i.unitValue.toString(),
      unit_price:     i.unitPrice.toString(),
      discount:       i.discount.toString(),
      charge:         i.charge.toString(),
      total_amount:   i.totalAmount.toString(),
    };
  }

  private mapItemData(i: CreatePurchaseItemDto) {
    return {
      productId:    i.product_id,
      branchId:     i.branch_id,
      lot:          i.lot           ?? null,
      unitTypeCode: i.unit_type_code ?? "NIU",
      quantity:     i.quantity,
      unitValue:    i.unit_value,
      unitPrice:    i.unit_price,
      discount:     i.discount       ?? 0,
      charge:       i.charge         ?? 0,
      totalAmount:  i.total_amount,
    };
  }
}

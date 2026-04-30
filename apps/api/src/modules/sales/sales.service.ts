import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { writeSunatSyncLog, SunatSyncLogEntry } from "./sunat-log";
import { RealtimeService } from "../realtime/realtime.service";
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../email/email.service";
import { PlansService } from "../plans/plans.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateSaleDto, SaleItemDto } from "./dto/create-sale.dto";
import { VoidSaleDto } from "./dto/void-sale.dto";
import { RefundSaleDto } from "./dto/refund-sale.dto";

// ─── Sale statuses ────────────────────────────────────────────────────────────
export const SALE_STATUS = {
  PAID: "PAID",
  REFUNDED: "REFUNDED",
  VOIDED: "VOIDED",
} as const;

export type SaleStatus = (typeof SALE_STATUS)[keyof typeof SALE_STATUS];

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface SaleResponse {
  id: string;
  branch_id: string;
  customer_id?: string;
  customer_name?: string;
  appointment_id?: string;
  cash_register_id?: string;
  total_amount: string;
  discount_amount: string;
  payment_method: string;
  status: string;
  notes?: string;
  void_reason?: string;
  refund_amount?: string;
  refund_reason?: string;
  refunded_at?: string;
  refunded_by_id?: string;
  items: SaleItemResponse[];
  created_by: string;
  created_at: string;
  updated_at: string;
  // Facturación electrónica
  tipo_comprobante?: string;
  serie_documento?: string;
  numero_documento?: string;
  billing_tipo_doc?: string;
  billing_num_doc?: string;
  billing_razon_social?: string;
  sunat_external_id?: string;
  sunat_filename?: string;
  sunat_state_type_id?: string;
  sunat_state_desc?: string;
  sunat_print_ticket_url?: string;
  sunat_print_a4_url?: string;
  sunat_pdf_url?: string;
  sunat_xml_url?: string;
  sunat_cdr_url?: string;
  sunat_response_code?: string;
  sunat_response_desc?: string;
  sunat_emitted_at?: string;
}

export interface SaleItemResponse {
  id: string;
  item_type: string;
  product_id?: string;
  service_id?: string;
  plan_id?: string;
  name?: string;       // resolved from service/product/plan relation
  quantity: number;
  unit_price: string;
  subtotal: string;
  igv_affectation_code?: string;
  sunat_product_code?: string;
  unit_type_code?: string;
}

export interface SaleStatsResponse {
  branch_id: string;
  period: { from: string; to: string };
  total_revenue: string;
  total_refunded: string;
  net_revenue: string;
  total_sales: number;
  voided_count: number;
  refunded_count: number;
  by_payment_method: Record<string, string>;
  top_services: Array<{
    service_id: string;
    name: string;
    count: number;
    revenue: string;
  }>;
  top_products: Array<{
    product_id: string;
    name: string;
    count: number;
    revenue: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class SalesService {
  private readonly logger = new Logger("SalesService");

  constructor(
    private prisma: PrismaService,
    @Optional() private realtimeService?: RealtimeService,
    @Optional() private auditService?: AuditService,
    @Optional() private emailService?: EmailService,
    @Optional() private plansService?: PlansService,
    @Optional() private notificationsService?: NotificationsService,
  ) {}

  // ─────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────

  async createSale(
    dto: CreateSaleDto,
    createdById: string,
  ): Promise<SaleResponse> {
    // 1. Validar sede
    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.branch_id },
    });
    if (!branch) {
      throw new NotFoundException(`Sede ${dto.branch_id} no encontrada`);
    }

    // 2. Validar cliente (si se provee)
    if (dto.customer_id) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: dto.customer_id },
      });
      if (!customer) {
        throw new NotFoundException(`Cliente ${dto.customer_id} no encontrado`);
      }
      if (customer.deletedAt) {
        throw new BadRequestException(
          `El cliente ${dto.customer_id} está eliminado`,
        );
      }
    }

    // 3. Validar cita (si se provee) y verificar idempotencia
    if (dto.appointment_id) {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: dto.appointment_id },
        include: { sale: true },
      });
      if (!appointment) {
        throw new NotFoundException(`Cita ${dto.appointment_id} no encontrada`);
      }
      if (appointment.sale) {
        throw new ConflictException(
          `La cita ${dto.appointment_id} ya tiene una venta asociada (${appointment.sale.id})`,
        );
      }
    }

    // 4. Idempotency: si se provee idempotency_key, verificar duplicado
    if (dto.idempotency_key) {
      const existing = await this.prisma.sale.findFirst({
        where: {
          branchId: dto.branch_id,
          createdById,
          notes: dto.idempotency_key, // usamos notes como carrier temporal hasta tener campo dedicado
        },
      });
      if (existing) {
        this.logger.warn(
          `Venta duplicada (idempotency): ${dto.idempotency_key}`,
        );
        return this.getSaleById(existing.id);
      }
    }

    // 5. Validar ítems en batch (N+1 fix)
    await this.validateItems(dto.items, dto.branch_id);

    const subtotalBruto = dto.items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0,
    );
    const discount = dto.discount_amount ?? 0;
    const totalAmount = Math.max(0, subtotalBruto - discount);

    // 6. Buscar caja abierta si el pago es CASH
    let openRegisterId: string | null = null;
    if (dto.payment_method === "CASH") {
      const register = await this.prisma.cashRegister.findFirst({
        where: { branchId: dto.branch_id, status: "OPEN" },
      });
      openRegisterId = register?.id ?? null;
    }

    // 7. Resolver campos SUNAT de cada ítem (producto/servicio)
    const itemSunatData = await this.resolveItemSunatData(dto.items);

    // 8. Transacción principal
    const sale = await this.prisma.$transaction(
      async (tx) => {
        const newSale = await tx.sale.create({
          data: {
            branch: { connect: { id: dto.branch_id } },
            ...(dto.customer_id && {
              customer: { connect: { id: dto.customer_id } },
            }),
            ...(dto.appointment_id && {
              appointment: { connect: { id: dto.appointment_id } },
            }),
            ...(openRegisterId && {
              cashRegister: { connect: { id: openRegisterId } },
            }),
            totalAmount,
            discountAmount: discount,
            paymentMethod: dto.payment_method,
            status: SALE_STATUS.PAID,
            notes: dto.notes || null,
            createdBy: { connect: { id: createdById } },
            // Campos de facturación
            tipoComprobante:    dto.tipo_comprobante  || null,
            serieDocumento:     dto.serie_documento   || null,
            billingTipoDoc:     dto.customer_billing?.tipo_doc      || null,
            billingNumDoc:      dto.customer_billing?.num_doc       || null,
            billingRazonSocial: dto.customer_billing?.razon_social  || null,
            billingDireccion:   dto.customer_billing?.direccion     || null,
            billingEmail:       dto.customer_billing?.email         || null,
            billingTelefono:    dto.customer_billing?.telefono      || null,
            billingUbigeo:      dto.customer_billing?.ubigeo        || null,
            items: {
              create: dto.items.map((item, idx) => ({
                itemType: item.item_type,
                ...(item.product_id && {
                  product: { connect: { id: item.product_id } },
                }),
                ...(item.service_id && {
                  service: { connect: { id: item.service_id } },
                }),
                ...(item.plan_id && {
                  plan: { connect: { id: item.plan_id } },
                }),
                quantity: item.quantity,
                unitPrice: item.unit_price,
                subtotal: item.unit_price * item.quantity,
                igvAffectationCode: itemSunatData[idx]?.igvAffectationCode ?? "10",
                sunatProductCode:   itemSunatData[idx]?.sunatProductCode   ?? null,
                unitTypeCode:       itemSunatData[idx]?.unitTypeCode        ?? "NIU",
              })),
            },
          },
          include: {
            items: true,
            customer: {
              select: { firstName: true, lastName: true, email: true },
            },
          },
        });

        // Movimientos de inventario para ítems PRODUCT
        for (const item of dto.items) {
          if (item.item_type === "PRODUCT" && item.product_id) {
            const stock = await tx.inventoryStock.findUnique({
              where: {
                branchId_productId: {
                  branchId: dto.branch_id,
                  productId: item.product_id,
                },
              },
            });
            if (!stock || stock.quantity < item.quantity) {
              throw new ConflictException(
                `Stock insuficiente para producto ${item.product_id}. Disponible: ${stock?.quantity ?? 0}, requerido: ${item.quantity}`,
              );
            }

            await tx.inventoryStock.update({
              where: {
                branchId_productId: {
                  branchId: dto.branch_id,
                  productId: item.product_id,
                },
              },
              data: { quantity: { decrement: item.quantity } },
            });

            await tx.inventoryMovement.create({
              data: {
                branchId: dto.branch_id,
                productId: item.product_id,
                type: "SALE_OUT",
                quantity: item.quantity,
                referenceType: "SALE",
                referenceId: newSale.id,
                reason: `Venta ${newSale.id}`,
                createdById,
              },
            });
          }
        }

        // Movimiento de caja si pago CASH y caja abierta
        if (dto.payment_method === "CASH" && openRegisterId) {
          await tx.cashMovement.create({
            data: {
              cashRegisterId: openRegisterId,
              type: "IN",
              amount: totalAmount,
              reason: `Venta ${newSale.id}`,
              createdById,
            },
          });
        }

        return newSale;
      },
      { isolationLevel: "Serializable" },
    );

    this.auditService?.log({
      actorType: "USER",
      actorId: createdById,
      branchId: dto.branch_id,
      action: "sale.created",
      entityType: "sale",
      entityId: sale.id,
      metadata: {
        totalAmount,
        paymentMethod: dto.payment_method,
        itemCount: sale.items.length,
        customerId: dto.customer_id,
        appointmentId: dto.appointment_id,
      },
    });

    this.notificationsService?.notify({
      userId: createdById,
      type: "sale",
      title: "Venta registrada",
      body: `Venta por S/ ${totalAmount.toFixed(2)} via ${dto.payment_method} registrada correctamente`,
      entityType: "sale",
      entityId: sale.id,
    });

    if (sale.customer?.email && this.emailService) {
      this.emailService
        .sendTransactionalEmail(
          sale.customer.email,
          "Tu compra en Podoplus ha sido registrada",
          `Hola ${sale.customer.firstName ?? "cliente"},\n\nGracias por tu compra de S/ ${totalAmount.toFixed(2)}. Tu venta ha sido registrada correctamente y está siendo procesada.\n\nSi tienes preguntas, contacta a soporte.`,
          `<p>Hola ${sale.customer.firstName ?? "cliente"},</p>
           <p>Gracias por tu compra de <strong>S/ ${totalAmount.toFixed(2)}</strong>. Tu venta ha sido registrada correctamente y está siendo procesada.</p>
           <p>Si tienes preguntas, contacta a soporte.</p>`,
        )
        .catch((err) =>
          this.logger.warn(
            `No se pudo enviar email de venta registrada: ${err.message}`,
          ),
        );
    }

    this.realtimeService?.notifySaleCreated({
      id: sale.id,
      branch_id: sale.branchId,
      customer_id: sale.customerId ?? undefined,
      appointment_id: sale.appointmentId ?? undefined,
      total_amount: totalAmount.toFixed(2),
      payment_method: sale.paymentMethod,
      status: sale.status,
      items_count: sale.items.length,
      created_at: sale.createdAt.toISOString(),
    });

    this.logger.log(
      `Venta creada: ${sale.id} (${dto.payment_method}, S/ ${totalAmount})`,
    );

    // ── Facturación electrónica (sfeperu) ────────────────────────────────────
    let finalSale = sale;
    if (dto.tipo_comprobante && dto.serie_documento) {
      try {
        finalSale = await this.emitSunatDocument(sale, dto, createdById) ?? sale;
      } catch (err: any) {
        this.logger.warn(
          `Venta ${sale.id} creada pero facturación electrónica falló: ${err.message}`,
        );
        // No lanzamos error — la venta queda registrada aunque falle sfeperu
      }
    }

    // Auto-asignar suscripciones para ítems PLAN
    if (dto.customer_id && this.plansService) {
      const planItems = dto.items.filter(
        (i) => i.item_type === "PLAN" && i.plan_id,
      );
      for (const item of planItems) {
        try {
          await this.plansService.assignSubscription(
            {
              customer_id: dto.customer_id,
              plan_id: item.plan_id!,
              branch_id: dto.branch_id,
              appointment_id: dto.appointment_id,
            },
            createdById,
          );
        } catch (err: any) {
          this.logger.warn(
            `Auto-subscripción fallida para plan ${item.plan_id} en venta ${sale.id}: ${err.message}`,
          );
        }
      }
    }

    return this.formatSale(finalSale, finalSale.customer ?? sale.customer);
  }

  // ─────────────────────────────────────────────────────────────────
  // LIST
  // ─────────────────────────────────────────────────────────────────

  async getSales(
    branchId: string,
    from?: Date,
    to?: Date,
    status?: string,
    customerId?: string,
    cursor?: string,
    limit = 50,
  ): Promise<{ data: SaleResponse[]; nextCursor?: string; hasNext: boolean }> {
    const take = Math.min(limit, 100);

    const where: any = { branchId };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const sales = await this.prisma.sale.findMany({
      where,
      include: {
        items: {
          include: {
            service: { select: { name: true } },
            product: { select: { name: true } },
            plan:    { select: { name: true } },
          },
        },
        customer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasNext = sales.length > take;
    const page = hasNext ? sales.slice(0, take) : sales;
    const nextCursor = hasNext ? page[page.length - 1].id : undefined;

    return {
      data: page.map((s) => this.formatSale(s, s.customer)),
      nextCursor,
      hasNext,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // GET BY ID
  // ─────────────────────────────────────────────────────────────────

  async getSaleById(saleId: string): Promise<SaleResponse> {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: {
          include: {
            service: { select: { name: true } },
            product: { select: { name: true } },
            plan:    { select: { name: true } },
          },
        },
        customer: { select: { firstName: true, lastName: true } },
      },
    });

    if (!sale) {
      throw new NotFoundException(`Venta ${saleId} no encontrada`);
    }

    return this.formatSale(sale, sale.customer);
  }

  // ─────────────────────────────────────────────────────────────────
  // HISTORY
  // ─────────────────────────────────────────────────────────────────

  async getSaleHistory(saleId: string) {
    const sale = await this.prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) {
      throw new NotFoundException(`Venta ${saleId} no encontrada`);
    }

    const logs = await this.prisma.auditLog.findMany({
      where: { entityType: "sale", entityId: saleId },
      orderBy: { createdAt: "asc" },
    });

    return logs.map((l) => ({
      id: l.id,
      action: l.action,
      actor_type: l.actorType,
      actor_id: l.actorId,
      reason: l.reason,
      metadata: l.metadataJson,
      created_at: l.createdAt.toISOString(),
    }));
  }

  // ─────────────────────────────────────────────────────────────────
  // STATS
  // ─────────────────────────────────────────────────────────────────

  async getSaleStats(
    branchId: string,
    from?: Date,
    to?: Date,
  ): Promise<SaleStatsResponse> {
    const dateFilter =
      from || to
        ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } }
        : {};

    const baseWhere = { branchId, ...dateFilter };

    const [
      paidAgg,
      refundedAgg,
      voidedCount,
      refundedCount,
      allSales,
      serviceItems,
      productItems,
    ] = await Promise.all([
      // Revenue PAID
      this.prisma.sale.aggregate({
        where: { ...baseWhere, status: SALE_STATUS.PAID },
        _sum: { totalAmount: true },
        _count: true,
      }),
      // Revenue REFUNDED (para descuento del neto)
      this.prisma.sale.aggregate({
        where: { ...baseWhere, status: SALE_STATUS.REFUNDED },
        _sum: { refundAmount: true },
        _count: true,
      }),
      // Count VOIDED
      this.prisma.sale.count({
        where: { ...baseWhere, status: SALE_STATUS.VOIDED },
      }),
      // Count REFUNDED
      this.prisma.sale.count({
        where: { ...baseWhere, status: SALE_STATUS.REFUNDED },
      }),
      // Todas las PAID para calcular breakdown por método de pago
      this.prisma.sale.findMany({
        where: { ...baseWhere, status: SALE_STATUS.PAID },
        select: { paymentMethod: true, totalAmount: true },
      }),
      // Top servicios
      this.prisma.saleItem.findMany({
        where: {
          itemType: "SERVICE",
          sale: { ...baseWhere, status: SALE_STATUS.PAID },
        },
        select: {
          serviceId: true,
          quantity: true,
          subtotal: true,
          service: { select: { name: true } },
        },
      }),
      // Top productos
      this.prisma.saleItem.findMany({
        where: {
          itemType: "PRODUCT",
          sale: { ...baseWhere, status: SALE_STATUS.PAID },
        },
        select: {
          productId: true,
          quantity: true,
          subtotal: true,
          product: { select: { name: true } },
        },
      }),
    ]);

    const totalRevenue = Number(paidAgg._sum.totalAmount ?? 0);
    const totalRefunded = Number(refundedAgg._sum.refundAmount ?? 0);
    const netRevenue = totalRevenue - totalRefunded;
    const totalSales = paidAgg._count;

    // Breakdown por método de pago
    const byPaymentMethod: Record<string, number> = {};
    for (const s of allSales) {
      const method = s.paymentMethod;
      byPaymentMethod[method] =
        (byPaymentMethod[method] ?? 0) + Number(s.totalAmount);
    }

    // Top 5 servicios
    const serviceMap = new Map<
      string,
      { name: string; count: number; revenue: number }
    >();
    for (const item of serviceItems) {
      if (!item.serviceId) continue;
      const cur = serviceMap.get(item.serviceId) ?? {
        name: item.service?.name ?? "",
        count: 0,
        revenue: 0,
      };
      serviceMap.set(item.serviceId, {
        name: cur.name,
        count: cur.count + item.quantity,
        revenue: cur.revenue + Number(item.subtotal),
      });
    }

    // Top 5 productos
    const productMap = new Map<
      string,
      { name: string; count: number; revenue: number }
    >();
    for (const item of productItems) {
      if (!item.productId) continue;
      const cur = productMap.get(item.productId) ?? {
        name: item.product?.name ?? "",
        count: 0,
        revenue: 0,
      };
      productMap.set(item.productId, {
        name: cur.name,
        count: cur.count + item.quantity,
        revenue: cur.revenue + Number(item.subtotal),
      });
    }

    return {
      branch_id: branchId,
      period: {
        from: from ? this.formatDateOnly(from) : "all",
        to: to ? this.formatDateOnly(to) : "all",
      },
      total_revenue: totalRevenue.toFixed(2),
      total_refunded: totalRefunded.toFixed(2),
      net_revenue: netRevenue.toFixed(2),
      total_sales: totalSales,
      voided_count: voidedCount,
      refunded_count: refundedCount,
      by_payment_method: Object.fromEntries(
        Object.entries(byPaymentMethod).map(([k, v]) => [k, v.toFixed(2)]),
      ),
      top_services: [...serviceMap.entries()]
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 5)
        .map(([id, v]) => ({
          service_id: id,
          name: v.name,
          count: v.count,
          revenue: v.revenue.toFixed(2),
        })),
      top_products: [...productMap.entries()]
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 5)
        .map(([id, v]) => ({
          product_id: id,
          name: v.name,
          count: v.count,
          revenue: v.revenue.toFixed(2),
        })),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // VOID
  // ─────────────────────────────────────────────────────────────────

  async voidSale(
    saleId: string,
    dto: VoidSaleDto,
    createdById: string,
  ): Promise<SaleResponse> {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });

    if (!sale) {
      throw new NotFoundException(`Venta ${saleId} no encontrada`);
    }

    if (sale.status !== SALE_STATUS.PAID) {
      throw new BadRequestException(
        `No se puede anular una venta con estado ${sale.status}. Solo se permite en estado PAID`,
      );
    }

    const openRegister = await this.prisma.cashRegister.findFirst({
      where: { branchId: sale.branchId, status: "OPEN" },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const voided = await tx.sale.update({
        where: { id: saleId },
        data: { status: SALE_STATUS.VOIDED, voidReason: dto.reason },
        include: { items: true },
      });

      // Restaurar inventario de PRODUCT items
      for (const item of sale.items) {
        if (item.itemType === "PRODUCT" && item.productId) {
          await tx.inventoryStock.update({
            where: {
              branchId_productId: {
                branchId: sale.branchId,
                productId: item.productId,
              },
            },
            data: { quantity: { increment: item.quantity } },
          });

          await tx.inventoryMovement.create({
            data: {
              branchId: sale.branchId,
              productId: item.productId,
              type: "RETURN_IN",
              quantity: item.quantity,
              referenceType: "SALE",
              referenceId: saleId,
              reason: `Anulación venta ${saleId}: ${dto.reason}`,
              createdById,
            },
          });
        }
      }

      // Movimiento de caja OUT si CASH
      if (sale.paymentMethod === "CASH" && openRegister) {
        await tx.cashMovement.create({
          data: {
            cashRegisterId: openRegister.id,
            type: "OUT",
            amount: sale.totalAmount,
            reason: `Anulación venta ${saleId}: ${dto.reason}`,
            createdById,
          },
        });
      }

      return voided;
    });

    // Cancelar suscripciones de PLAN items (fuera del TX — best effort)
    if (this.plansService) {
      const planItems = sale.items.filter(
        (i) => i.itemType === "PLAN" && i.planId,
      );
      for (const item of planItems) {
        if (!item.planId) continue;
        try {
          // Buscar suscripción activa vinculada a la venta
          const sub = await this.prisma.customerSubscription.findFirst({
            where: {
              planId: item.planId,
              customerId: sale.customerId ?? undefined,
              status: { in: ["ACTIVE", "PENDING"] },
            },
          });
          if (sub) {
            await this.plansService.cancelSubscription(
              sub.id,
              { reason: `Anulación de venta ${saleId}: ${dto.reason}` },
              createdById,
            );
          }
        } catch (err: any) {
          this.logger.warn(
            `Error cancelando suscripción de plan ${item.planId} en anulación de venta ${saleId}: ${err.message}`,
          );
        }
      }
    }

    this.auditService?.log({
      actorType: "USER",
      actorId: createdById,
      branchId: sale.branchId,
      action: "sale.voided",
      entityType: "sale",
      entityId: saleId,
      reason: dto.reason,
      metadata: {
        totalAmount: sale.totalAmount,
        paymentMethod: sale.paymentMethod,
      },
    });

    this.notificationsService?.notify({
      userId: createdById,
      type: "sale",
      title: "Venta anulada",
      body: `Venta ${saleId} anulada${dto.reason ? `: ${dto.reason}` : ""}`,
      entityType: "sale",
      entityId: saleId,
    });

    this.realtimeService?.notifySaleVoided({
      id: saleId,
      branch_id: sale.branchId,
      void_reason: dto.reason,
      voided_at: new Date().toISOString(),
    });

    this.logger.log(`Venta anulada: ${saleId} - ${dto.reason}`);

    return this.formatSale(updated);
  }

  // ─────────────────────────────────────────────────────────────────
  // REFUND
  // ─────────────────────────────────────────────────────────────────

  async refundSale(
    saleId: string,
    dto: RefundSaleDto,
    createdById: string,
  ): Promise<SaleResponse> {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });

    if (!sale) {
      throw new NotFoundException(`Venta ${saleId} no encontrada`);
    }

    if (sale.status !== SALE_STATUS.PAID) {
      throw new BadRequestException(
        `No se puede reembolsar una venta con estado ${sale.status}. Solo se permite en estado PAID`,
      );
    }

    const totalAmount = Number(sale.totalAmount);
    if (dto.amount > totalAmount) {
      throw new BadRequestException(
        `El monto de reembolso (${dto.amount}) no puede superar el total de la venta (${totalAmount})`,
      );
    }

    const now = new Date();
    const isFullRefund = dto.amount === totalAmount;

    const openRegister = await this.prisma.cashRegister.findFirst({
      where: { branchId: sale.branchId, status: "OPEN" },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const refunded = await tx.sale.update({
        where: { id: saleId },
        data: {
          status: SALE_STATUS.REFUNDED,
          refundAmount: dto.amount,
          refundReason: dto.reason,
          refundedAt: now,
          refundedById: createdById,
        },
        include: { items: true },
      });

      // Si es reembolso COMPLETO → restaurar inventario de PRODUCT items
      if (isFullRefund) {
        for (const item of sale.items) {
          if (item.itemType === "PRODUCT" && item.productId) {
            await tx.inventoryStock.update({
              where: {
                branchId_productId: {
                  branchId: sale.branchId,
                  productId: item.productId,
                },
              },
              data: { quantity: { increment: item.quantity } },
            });

            await tx.inventoryMovement.create({
              data: {
                branchId: sale.branchId,
                productId: item.productId,
                type: "RETURN_IN",
                quantity: item.quantity,
                referenceType: "SALE",
                referenceId: saleId,
                reason: `Reembolso venta ${saleId}: ${dto.reason}`,
                createdById,
              },
            });
          }
        }
      }

      // Movimiento de caja OUT si CASH
      if (sale.paymentMethod === "CASH" && openRegister) {
        await tx.cashMovement.create({
          data: {
            cashRegisterId: openRegister.id,
            type: "OUT",
            amount: dto.amount,
            reason: `Reembolso venta ${saleId}: ${dto.reason}`,
            createdById,
          },
        });
      }

      return refunded;
    });

    // Cancelar suscripciones PLAN si reembolso completo (fuera del TX — best effort)
    if (isFullRefund && this.plansService && sale.customerId) {
      const planItems = sale.items.filter(
        (i) => i.itemType === "PLAN" && i.planId,
      );
      for (const item of planItems) {
        if (!item.planId) continue;
        try {
          const sub = await this.prisma.customerSubscription.findFirst({
            where: {
              planId: item.planId,
              customerId: sale.customerId,
              status: { in: ["ACTIVE", "PENDING"] },
            },
          });
          if (sub) {
            await this.plansService.cancelSubscription(
              sub.id,
              { reason: `Reembolso de venta ${saleId}: ${dto.reason}` },
              createdById,
            );
          }
        } catch (err: any) {
          this.logger.warn(
            `Error cancelando suscripción de plan ${item.planId} en reembolso de venta ${saleId}: ${err.message}`,
          );
        }
      }
    }

    this.auditService?.log({
      actorType: "USER",
      actorId: createdById,
      branchId: sale.branchId,
      action: "sale.refunded",
      entityType: "sale",
      entityId: saleId,
      reason: dto.reason,
      metadata: {
        refundAmount: dto.amount,
        totalAmount: sale.totalAmount,
        isFullRefund,
      },
    });

    this.logger.log(
      `Venta reembolsada: ${saleId} - S/ ${dto.amount} - ${dto.reason}`,
    );

    return this.formatSale(updated);
  }

  // ─────────────────────────────────────────────────────────────────
  // SUNAT HELPERS
  // ─────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────
  // PRIVATE: Resolución de campos SUNAT por ítem
  // ─────────────────────────────────────────────────────────────────

  private async resolveItemSunatData(items: import("./dto/create-sale.dto").SaleItemDto[]): Promise<Array<{
    igvAffectationCode: string;
    sunatProductCode: string | null;
    unitTypeCode: string;
  }>> {
    const productIds = items.filter(i => i.item_type === "PRODUCT" && i.product_id).map(i => i.product_id!);
    const serviceIds = items.filter(i => i.item_type === "SERVICE" && i.service_id).map(i => i.service_id!);

    const [products, services] = await Promise.all([
      productIds.length > 0 ? this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, igvAffectationCode: true, sunatProductCode: true, unitTypeCode: true },
      }) : [],
      serviceIds.length > 0 ? this.prisma.service.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true, igvAffectationCode: true, sunatProductCode: true, unitTypeCode: true },
      }) : [],
    ]);

    const productMap = new Map((products as any[]).map(p => [p.id, p]));
    const serviceMap = new Map((services as any[]).map(s => [s.id, s]));

    return items.map(item => {
      if (item.item_type === "PRODUCT" && item.product_id) {
        const p = productMap.get(item.product_id);
        return { igvAffectationCode: p?.igvAffectationCode ?? "10", sunatProductCode: p?.sunatProductCode ?? null, unitTypeCode: p?.unitTypeCode ?? "NIU" };
      }
      if (item.item_type === "SERVICE" && item.service_id) {
        const s = serviceMap.get(item.service_id);
        return { igvAffectationCode: s?.igvAffectationCode ?? "10", sunatProductCode: s?.sunatProductCode ?? null, unitTypeCode: s?.unitTypeCode ?? "ZZ" };
      }
      return { igvAffectationCode: "10", sunatProductCode: null, unitTypeCode: "NIU" };
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // PRIVATE: Emitir documento electrónico vía sfeperu
  // ─────────────────────────────────────────────────────────────────

  private async emitSunatDocument(sale: any, dto: import("./dto/create-sale.dto").CreateSaleDto, _createdById: string) {
    // Obtener businessUnit de la sede para leer endpoint y token
    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.branch_id },
      include: { businessUnit: { select: { sunatEndpoint: true, sunatToken: true } } },
    });

    const endpoint = branch?.businessUnit?.sunatEndpoint;
    const token    = branch?.businessUnit?.sunatToken;

    if (!endpoint || !token) {
      this.logger.warn(`Sede ${dto.branch_id} no tiene sunatEndpoint/sunatToken configurado`);
      return null;
    }

    const IGV_RATE = 0.18;
    const now      = new Date();
    const dateStr  = now.toISOString().slice(0, 10);
    const timeStr  = now.toTimeString().slice(0, 8);

    const items: any[] = (sale.items ?? []).map((item: any, idx: number) => {
      const qty      = item.quantity;
      const unitP    = Number(item.unitPrice);
      const igvCode  = item.igvAffectationCode ?? "10";
      const unitTC   = item.unitTypeCode       ?? "NIU";
      const sunatC   = item.sunatProductCode   ?? "";
      const internalC = item.product?.internalCode ?? item.service?.internalCode ?? "";
      const name     = item.product?.name ?? item.service?.name ?? item.plan?.name ?? `Item ${idx+1}`;

      const isGravado  = igvCode === "10";
      const valorUnit  = isGravado ? +(unitP / (1 + IGV_RATE)).toFixed(6) : unitP;
      const totalBase  = +(valorUnit * qty).toFixed(2);
      const totalIgv   = isGravado ? +(unitP * qty - totalBase).toFixed(2) : 0;
      const totalItem  = +(unitP * qty).toFixed(2);

      return {
        codigo_interno:            internalC,
        descripcion:               name,
        codigo_producto_sunat:     sunatC,
        unidad_de_medida:          unitTC,
        cantidad:                  qty,
        valor_unitario:            valorUnit,
        codigo_tipo_precio:        "01",
        precio_unitario:           unitP,
        codigo_tipo_afectacion_igv: igvCode,
        total_base_igv:            totalBase,
        porcentaje_igv:            18,
        total_igv:                 totalIgv,
        total_impuestos:           totalIgv,
        total_valor_item:          totalBase,
        total_item:                totalItem,
      };
    });

    const totalGravado = +items.reduce((s, i) => s + i.total_base_igv, 0).toFixed(2);
    const totalIgv     = +items.reduce((s, i) => s + i.total_igv, 0).toFixed(2);
    const totalVenta   = +Number(sale.totalAmount).toFixed(2);

    const billing = dto.customer_billing;
    const payload = {
      serie_documento:       dto.serie_documento,
      numero_documento:      "#",
      fecha_de_emision:      dateStr,
      hora_de_emision:       timeStr,
      codigo_tipo_operacion: "0101",
      codigo_tipo_documento: dto.tipo_comprobante,
      codigo_tipo_moneda:    "PEN",
      fecha_de_vencimiento:  dateStr,
      datos_del_cliente_o_receptor: {
        codigo_tipo_documento_identidad: billing?.tipo_doc  ?? "1",
        numero_documento:                billing?.num_doc   ?? "00000000",
        apellidos_y_nombres_o_razon_social: billing?.razon_social ?? "CLIENTE FINAL",
        codigo_pais:    "PE",
        ubigeo:         billing?.ubigeo   ?? "150101",
        direccion:      billing?.direccion ?? "",
        correo_electronico: billing?.email    ?? "",
        telefono:       billing?.telefono  ?? "",
      },
      totales: {
        total_exportacion:            0,
        total_operaciones_gravadas:   totalGravado,
        total_operaciones_inafectas:  0,
        total_operaciones_exoneradas: 0,
        total_operaciones_gratuitas:  0,
        total_igv:                    totalIgv,
        total_impuestos:              totalIgv,
        total_valor:                  totalGravado,
        total_venta:                  totalVenta,
      },
      items,
    };

    const apiUrl = `${endpoint.replace(/\/$/, "")}/api/documents`;
    this.logger.log(`Emitiendo comprobante ${dto.tipo_comprobante} vía sfeperu: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body:    JSON.stringify(payload),
    });

    const result: any = await response.json();
    this.logger.log(`Respuesta sfeperu para venta ${sale.id}: success=${result.success}, number=${result.data?.number}`);

    // Persistir campos del resultado
    const updated = await this.prisma.sale.update({
      where: { id: sale.id },
      data: {
        numeroDocumento:     result.data?.number            ?? null,
        sunatExternalId:     result.data?.external_id       ?? null,
        sunatFilename:       result.data?.filename          ?? null,
        sunatStateTypeId:    result.data?.state_type_id     ?? null,
        sunatStateDesc:      result.data?.state_type_description ?? null,
        sunatHash:           result.data?.hash              ?? null,
        sunatPrintTicketUrl: result.data?.print_ticket      ?? null,
        sunatPrintA4Url:     result.data_ws?.pdf_a4_filename
                               ? `${endpoint.replace(/\/$/, "")}/print/document/${result.data?.external_id}/a4`
                               : null,
        sunatPdfUrl:         result.links?.pdf              ?? null,
        sunatXmlUrl:         result.links?.xml              ?? null,
        sunatCdrUrl:         result.links?.cdr              ?? null,
        sunatResponseCode:   result.response?.code          ?? null,
        sunatResponseDesc:   result.response?.description   ?? null,
        sunatEmittedAt:      new Date(),
      },
      include: {
        items: true,
        customer: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    this.auditService?.log({
      actorType: "SYSTEM",
      actorId: null,
      branchId: dto.branch_id,
      action: "sale.sunat_emitted",
      entityType: "sale",
      entityId: sale.id,
      metadata: {
        tipoComprobante: dto.tipo_comprobante,
        serieDocumento:  dto.serie_documento,
        numeroDocumento: result.data?.number,
        success:         result.success,
      },
    });

    return updated;
  }

  /**
   * Construye el payload para emitir una factura/boleta a través de sfeperu.com.
   * Retorna el payload completo; el módulo de integración SUNAT se encarga del HTTP call.
   */
  buildSunatDocumentPayload(
    sale: any,
    docType: "01" | "03", // 01=Factura, 03=Boleta
    customer?: any,
  ) {
    const IGV_RATE = 0.18;

    const details = (sale.items ?? []).map((item: any) => {
      const qty = item.quantity;
      const unitPrice = Number(item.unitPrice);
      const hasIgv = item.product?.hasIgv ?? item.service?.hasIgv ?? true;
      const igvCode =
        item.product?.igvAffectationCode ??
        item.service?.igvAffectationCode ??
        "10";
      const unitTypeCode =
        item.product?.unitTypeCode ?? item.service?.unitTypeCode ?? "NIU";
      const sunatCode =
        item.product?.sunatProductCode ?? item.service?.sunatProductCode ?? "";
      const name = item.product?.name ?? item.service?.name ?? item.itemType;

      const isGravado = igvCode === "10" && hasIgv;
      const valorUnit = isGravado
        ? +(unitPrice / (1 + IGV_RATE)).toFixed(6)
        : unitPrice;
      const totalBase = +(valorUnit * qty).toFixed(2);
      const totalIgv = isGravado
        ? +(unitPrice * qty - totalBase).toFixed(2)
        : 0;
      const totalItem = +(unitPrice * qty).toFixed(2);

      return {
        codigo: item.product?.internalCode ?? item.service?.internalCode ?? "",
        codigoProductoSunat: sunatCode,
        descripcion: name,
        unidad: unitTypeCode,
        cantidad: qty,
        valorUnitario: valorUnit,
        precioUnitario: unitPrice,
        subtotal: totalBase,
        igv: totalIgv,
        total: totalItem,
        tipAfeIgv: igvCode,
      };
    });

    const totalGravado = +details
      .reduce((s: number, d: any) => s + d.subtotal, 0)
      .toFixed(2);
    const totalIgv = +details
      .reduce((s: number, d: any) => s + d.igv, 0)
      .toFixed(2);
    const totalVenta = +Number(sale.totalAmount).toFixed(2);

    return {
      tipoDocumento: docType,
      serie: docType === "01" ? "F001" : "B001",
      numero: null, // sfeperu genera el correlativo
      fechaEmision: new Date().toISOString().split("T")[0],
      moneda: "PEN",
      cliente: {
        tipoDocumento: customer?.documentType ?? "1", // 1=DNI, 6=RUC
        numeroDocumento: customer?.documentNumber ?? "00000000",
        razonSocial: customer
          ? `${customer.firstName} ${customer.lastName}`
          : "CLIENTE GENÉRICO",
      },
      detalle: details,
      totales: {
        totalGravadas: totalGravado,
        totalIgv,
        totalVenta,
        descuento: +Number(sale.discountAmount).toFixed(2),
      },
    };
  }

  async simulateSunatDocumentSync(saleId: string, docType: "01" | "03") {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: true,
        customer: true,
        branch: true,
      },
    });

    if (!sale) {
      throw new NotFoundException(`Venta ${saleId} no encontrada`);
    }

    if (sale.status !== SALE_STATUS.PAID) {
      throw new BadRequestException(
        "Solo se pueden sincronizar ventas con estado PAID",
      );
    }

    const payload = this.buildSunatDocumentPayload(
      sale,
      docType,
      sale.customer ?? undefined,
    );

    const documentNumber = `${docType === "01" ? "F001" : "B001"}-${String(
      Math.floor(Math.random() * 900000) + 100000,
    ).padStart(6, "0")}`;

    const sunatResponse = {
      status: "CONFIRMED",
      sunatTicketId: `SIMSUNAT-${Date.now()}`,
      sunatDocumentNumber: documentNumber,
      message: "Simulación de SUNAT exitosa.",
      confirmedAt: new Date().toISOString(),
    };

    const logEntry: SunatSyncLogEntry = {
      event: "SUNAT_DOCUMENT_SYNC",
      saleId,
      docType,
      serie: docType === "01" ? "F001" : "B001",
      requestPayload: payload,
      responsePayload: sunatResponse,
      createdAt: new Date().toISOString(),
    };

    await writeSunatSyncLog(logEntry);

    this.auditService?.log({
      actorType: "SYSTEM",
      actorId: null,
      branchId: sale.branchId,
      action: "sale.sunat_sync",
      entityType: "sale",
      entityId: saleId,
      metadata: {
        docType,
        documentNumber,
        sunatTicketId: sunatResponse.sunatTicketId,
        status: sunatResponse.status,
      },
    });

    return {
      payload,
      response: sunatResponse,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS PRIVADOS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Valida todos los ítems del carrito en batch (3 queries en lugar de N).
   */
  private async validateItems(
    items: SaleItemDto[],
    branchId: string,
  ): Promise<void> {
    const productIds = items
      .filter((i) => i.item_type === "PRODUCT")
      .map((i) => {
        if (!i.product_id)
          throw new BadRequestException(
            "Ítem de tipo PRODUCT requiere product_id",
          );
        return i.product_id;
      });

    const serviceIds = items
      .filter((i) => i.item_type === "SERVICE")
      .map((i) => {
        if (!i.service_id)
          throw new BadRequestException(
            "Ítem de tipo SERVICE requiere service_id",
          );
        return i.service_id;
      });

    const planIds = items
      .filter((i) => i.item_type === "PLAN")
      .map((i) => {
        if (!i.plan_id)
          throw new BadRequestException("Ítem de tipo PLAN requiere plan_id");
        return i.plan_id;
      });

    const [products, services, plans] = await Promise.all([
      productIds.length > 0
        ? this.prisma.product.findMany({ where: { id: { in: productIds } } })
        : [],
      serviceIds.length > 0
        ? this.prisma.service.findMany({ where: { id: { in: serviceIds } } })
        : [],
      planIds.length > 0
        ? this.prisma.plan.findMany({ where: { id: { in: planIds } } })
        : [],
    ]);

    for (const id of productIds) {
      const found = (products as any[]).find((p) => p.id === id);
      if (!found || !found.isActive)
        throw new NotFoundException(`Producto ${id} no encontrado o inactivo`);
    }
    for (const id of serviceIds) {
      const found = (services as any[]).find((s) => s.id === id);
      if (!found || !found.isActive)
        throw new NotFoundException(`Servicio ${id} no encontrado o inactivo`);
    }
    for (const id of planIds) {
      const found = (plans as any[]).find((p) => p.id === id);
      if (!found || !found.isActive)
        throw new NotFoundException(`Plan ${id} no encontrado o inactivo`);
    }
  }

  private formatSale(sale: any, customer?: any): SaleResponse {
    return {
      id: sale.id,
      branch_id: sale.branchId,
      customer_id: sale.customerId ?? undefined,
      customer_name: customer
        ? `${customer.firstName} ${customer.lastName}`.trim()
        : undefined,
      appointment_id: sale.appointmentId ?? undefined,
      cash_register_id: sale.cashRegisterId ?? undefined,
      total_amount: sale.totalAmount.toString(),
      discount_amount: sale.discountAmount.toString(),
      payment_method: sale.paymentMethod,
      status: sale.status,
      notes: sale.notes ?? undefined,
      void_reason: sale.voidReason ?? undefined,
      refund_amount: sale.refundAmount
        ? sale.refundAmount.toString()
        : undefined,
      refund_reason: sale.refundReason ?? undefined,
      refunded_at: sale.refundedAt ? sale.refundedAt.toISOString() : undefined,
      refunded_by_id: sale.refundedById ?? undefined,
      items: (sale.items ?? []).map((i: any) => this.formatItem(i)),
      created_by: sale.createdById,
      created_at: sale.createdAt.toISOString(),
      updated_at: sale.updatedAt.toISOString(),
      // Facturación electrónica
      tipo_comprobante:       sale.tipoComprobante     ?? undefined,
      serie_documento:        sale.serieDocumento      ?? undefined,
      numero_documento:       sale.numeroDocumento     ?? undefined,
      billing_tipo_doc:       sale.billingTipoDoc      ?? undefined,
      billing_num_doc:        sale.billingNumDoc        ?? undefined,
      billing_razon_social:   sale.billingRazonSocial  ?? undefined,
      sunat_external_id:      sale.sunatExternalId     ?? undefined,
      sunat_filename:         sale.sunatFilename       ?? undefined,
      sunat_state_type_id:    sale.sunatStateTypeId    ?? undefined,
      sunat_state_desc:       sale.sunatStateDesc      ?? undefined,
      sunat_print_ticket_url: sale.sunatPrintTicketUrl ?? undefined,
      sunat_print_a4_url:     sale.sunatPrintA4Url     ?? undefined,
      sunat_pdf_url:          sale.sunatPdfUrl         ?? undefined,
      sunat_xml_url:          sale.sunatXmlUrl         ?? undefined,
      sunat_cdr_url:          sale.sunatCdrUrl         ?? undefined,
      sunat_response_code:    sale.sunatResponseCode   ?? undefined,
      sunat_response_desc:    sale.sunatResponseDesc   ?? undefined,
      sunat_emitted_at:       sale.sunatEmittedAt ? sale.sunatEmittedAt.toISOString() : undefined,
    };
  }

  private formatDateOnly(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  private formatItem(item: any): SaleItemResponse {
    return {
      id:                  item.id,
      item_type:           item.itemType,
      product_id:          item.productId          ?? undefined,
      service_id:          item.serviceId          ?? undefined,
      plan_id:             item.planId             ?? undefined,
      name:                item.service?.name ?? item.product?.name ?? item.plan?.name ?? undefined,
      quantity:            item.quantity,
      unit_price:          item.unitPrice.toString(),
      subtotal:            item.subtotal.toString(),
      igv_affectation_code: item.igvAffectationCode ?? undefined,
      sunat_product_code:  item.sunatProductCode   ?? undefined,
      unit_type_code:      item.unitTypeCode        ?? undefined,
    };
  }
}

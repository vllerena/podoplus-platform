import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReportsService {
  private readonly logger = new Logger("ReportsService");

  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────
  // OPERATIONS REPORT
  // ─────────────────────────────────────────────────────────────────

  async getOperationsReport(branchId: string, from: Date, to: Date) {
    const [branch, appointments] = await Promise.all([
      this.getBranchOrThrow(branchId),
      this.prisma.appointment.findMany({
        where: { branchId, startAt: { gte: from, lte: to } },
        include: { service: true, customer: true },
        orderBy: { startAt: "asc" },
      }),
    ]);

    const total = appointments.length;
    const byStatus = this.groupBy(appointments, (a) => a.status);
    const bySource = this.groupBy(appointments, (a) => a.source);

    const serviceCount = new Map<string, { name: string; count: number }>();
    for (const a of appointments) {
      const key = a.serviceId;
      if (!serviceCount.has(key)) {
        serviceCount.set(key, { name: a.service?.name ?? key, count: 0 });
      }
      serviceCount.get(key)!.count++;
    }
    const topServices = [...serviceCount.entries()]
      .map(([id, v]) => ({ service_id: id, service_name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const dailyOccupancy = this.calcDailyOccupancy(appointments, branch.defaultCapacity, from, to);

    const completed = byStatus["COMPLETED"]?.length ?? 0;
    const noShow = byStatus["NO_SHOW"]?.length ?? 0;
    const canceled = byStatus["CANCELED"]?.length ?? 0;
    const attended =
      completed +
      (byStatus["CHECKED_IN"]?.length ?? 0) +
      (byStatus["IN_SERVICE"]?.length ?? 0);
    const noShowRate = total > 0 ? ((noShow / total) * 100).toFixed(1) : "0.0";
    const cancellationRate = total > 0 ? ((canceled / total) * 100).toFixed(1) : "0.0";
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : "0.0";

    return {
      branch_id: branchId,
      branch_name: branch.name,
      period: { from: this.formatDate(from), to: this.formatDate(to) },
      summary: {
        total_appointments: total,
        completed,
        attended,
        no_show: noShow,
        canceled,
        rescheduled: byStatus["RESCHEDULED"]?.length ?? 0,
        pending: byStatus["PENDING"]?.length ?? 0,
        confirmed: byStatus["CONFIRMED"]?.length ?? 0,
      },
      rates: {
        completion_rate_pct: completionRate,
        no_show_rate_pct: noShowRate,
        cancellation_rate_pct: cancellationRate,
      },
      by_source: {
        reception: bySource["RECEPTION"]?.length ?? 0,
        portal: bySource["PORTAL"]?.length ?? 0,
        staff: bySource["STAFF"]?.length ?? 0,
        system: bySource["SYSTEM"]?.length ?? 0,
      },
      top_services: topServices,
      daily_occupancy: dailyOccupancy,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // SALES REPORT
  // ─────────────────────────────────────────────────────────────────

  async getSalesReport(branchId: string, from: Date, to: Date) {
    const [branch, sales] = await Promise.all([
      this.getBranchOrThrow(branchId),
      this.prisma.sale.findMany({
        where: {
          branchId,
          status: { in: ["PAID", "REFUNDED"] },
          createdAt: { gte: from, lte: to },
        },
        include: { items: { include: { product: true, service: true, plan: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const paidSales = sales.filter((s) => s.status === "PAID");
    const refundedSales = sales.filter((s) => s.status === "REFUNDED");

    const totalRevenue = paidSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const totalDiscount = paidSales.reduce((sum, s) => sum + Number(s.discountAmount ?? 0), 0);
    const totalRefunded = refundedSales.reduce(
      (sum, s) => sum + Number(s.refundAmount ?? s.totalAmount),
      0
    );
    const netRevenue = totalRevenue - totalRefunded;
    const totalTransactions = paidSales.length;

    const byPayment = this.groupBy(paidSales, (s) => s.paymentMethod);
    const paymentBreakdown = Object.entries(byPayment).map(([method, items]) => ({
      method,
      count: items.length,
      total: items.reduce((sum, s) => sum + Number(s.totalAmount), 0).toFixed(2),
    }));

    const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
    const serviceMap = new Map<string, { name: string; qty: number; revenue: number }>();

    for (const sale of paidSales) {
      for (const item of sale.items) {
        if (item.itemType === "PRODUCT" && item.product) {
          const entry = productMap.get(item.productId) ?? {
            name: item.product.name,
            qty: 0,
            revenue: 0,
          };
          entry.qty += item.quantity;
          entry.revenue += Number(item.subtotal);
          productMap.set(item.productId, entry);
        } else if (item.itemType === "SERVICE" && item.service) {
          const entry = serviceMap.get(item.serviceId) ?? {
            name: item.service.name,
            qty: 0,
            revenue: 0,
          };
          entry.qty += item.quantity;
          entry.revenue += Number(item.subtotal);
          serviceMap.set(item.serviceId, entry);
        }
      }
    }

    const topProducts = [...productMap.entries()]
      .map(([id, v]) => ({
        product_id: id,
        name: v.name,
        qty_sold: v.qty,
        revenue: v.revenue.toFixed(2),
      }))
      .sort((a, b) => b.qty_sold - a.qty_sold)
      .slice(0, 5);

    const topServices = [...serviceMap.entries()]
      .map(([id, v]) => ({
        service_id: id,
        name: v.name,
        qty_sold: v.qty,
        revenue: v.revenue.toFixed(2),
      }))
      .sort((a, b) => Number(b.revenue) - Number(a.revenue))
      .slice(0, 5);

    const dailyRevenue = this.calcDailyRevenue(paidSales, from, to);

    return {
      branch_id: branchId,
      branch_name: branch.name,
      period: { from: this.formatDate(from), to: this.formatDate(to) },
      summary: {
        total_transactions: totalTransactions,
        refunded_count: refundedSales.length,
        total_revenue: totalRevenue.toFixed(2),
        total_discount: totalDiscount.toFixed(2),
        total_refunded: totalRefunded.toFixed(2),
        net_revenue: netRevenue.toFixed(2),
        avg_ticket:
          totalTransactions > 0 ? (totalRevenue / totalTransactions).toFixed(2) : "0.00",
      },
      payment_breakdown: paymentBreakdown,
      top_products: topProducts,
      top_services: topServices,
      daily_revenue: dailyRevenue,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // NO-SHOW REPORT
  // ─────────────────────────────────────────────────────────────────

  async getNoShowReport(branchId: string, from: Date, to: Date) {
    const [branch, noShows, cancellations] = await Promise.all([
      this.getBranchOrThrow(branchId),
      this.prisma.appointment.findMany({
        where: { branchId, status: "NO_SHOW", startAt: { gte: from, lte: to } },
        include: { customer: true, service: true },
        orderBy: { startAt: "desc" },
      }),
      this.prisma.appointment.findMany({
        where: { branchId, status: "CANCELED", startAt: { gte: from, lte: to } },
        include: { customer: true, service: true },
        orderBy: { startAt: "desc" },
      }),
    ]);

    const noShowByCustomer = new Map<string, { name: string; count: number }>();
    for (const a of noShows) {
      const name = `${a.customer?.firstName ?? ""} ${a.customer?.lastName ?? ""}`.trim();
      const entry = noShowByCustomer.get(a.customerId) ?? { name, count: 0 };
      entry.count++;
      noShowByCustomer.set(a.customerId, entry);
    }
    const topNoShowCustomers = [...noShowByCustomer.entries()]
      .map(([id, v]) => ({ customer_id: id, name: v.name, no_show_count: v.count }))
      .sort((a, b) => b.no_show_count - a.no_show_count)
      .slice(0, 10);

    const cancelReasons = new Map<string, number>();
    for (const a of cancellations) {
      const reason = a.cancelReason ?? "Sin motivo";
      cancelReasons.set(reason, (cancelReasons.get(reason) ?? 0) + 1);
    }
    const topCancelReasons = [...cancelReasons.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const total = noShows.length + cancellations.length;

    return {
      branch_id: branchId,
      branch_name: branch.name,
      period: { from: this.formatDate(from), to: this.formatDate(to) },
      summary: {
        total_no_shows: noShows.length,
        total_cancellations: cancellations.length,
        total_incidents: total,
      },
      top_no_show_customers: topNoShowCustomers,
      top_cancel_reasons: topCancelReasons,
      no_show_detail: noShows.slice(0, 50).map((a) => ({
        appointment_id: a.id,
        customer_name: `${a.customer?.firstName ?? ""} ${a.customer?.lastName ?? ""}`.trim(),
        service_name: a.service?.name ?? "",
        scheduled_at: a.startAt.toISOString(),
      })),
      cancellation_detail: cancellations.slice(0, 50).map((a) => ({
        appointment_id: a.id,
        customer_name: `${a.customer?.firstName ?? ""} ${a.customer?.lastName ?? ""}`.trim(),
        service_name: a.service?.name ?? "",
        scheduled_at: a.startAt.toISOString(),
        cancel_reason: a.cancelReason ?? "Sin motivo",
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // INVENTORY REPORT
  // ─────────────────────────────────────────────────────────────────

  async getInventoryReport(branchId: string, from: Date, to: Date, lowStockThreshold = 5) {
    const [branch, stocks, movements] = await Promise.all([
      this.getBranchOrThrow(branchId),
      this.prisma.inventoryStock.findMany({
        where: { branchId },
        include: { product: true },
        orderBy: { product: { name: "asc" } },
      }),
      this.prisma.inventoryMovement.findMany({
        where: { branchId, createdAt: { gte: from, lte: to } },
        include: { product: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const lowStock = stocks.filter((s) => s.quantity <= lowStockThreshold);
    const outOfStock = stocks.filter((s) => s.quantity === 0);

    const rotation = new Map<string, { name: string; sold: number; purchased: number }>();
    for (const m of movements) {
      const entry = rotation.get(m.productId) ?? {
        name: m.product?.name ?? m.productId,
        sold: 0,
        purchased: 0,
      };
      if (m.type === "SALE_OUT") entry.sold += m.quantity;
      if (m.type === "PURCHASE_IN") entry.purchased += m.quantity;
      rotation.set(m.productId, entry);
    }
    const topRotation = [...rotation.entries()]
      .map(([id, v]) => ({
        product_id: id,
        name: v.name,
        units_sold: v.sold,
        units_purchased: v.purchased,
      }))
      .sort((a, b) => b.units_sold - a.units_sold)
      .slice(0, 10);

    return {
      branch_id: branchId,
      branch_name: branch.name,
      period: { from: this.formatDate(from), to: this.formatDate(to) },
      summary: {
        total_products: stocks.length,
        low_stock_count: lowStock.length,
        out_of_stock_count: outOfStock.length,
        total_movements_in_period: movements.length,
        low_stock_threshold: lowStockThreshold,
      },
      current_stock: stocks.map((s) => ({
        product_id: s.productId,
        sku: s.product.sku,
        name: s.product.name,
        unit_type: s.product.unitType,
        quantity: s.quantity,
        is_low_stock: s.quantity <= lowStockThreshold,
        is_out_of_stock: s.quantity === 0,
        updated_at: s.updatedAt.toISOString(),
      })),
      low_stock_alerts: lowStock.map((s) => ({
        product_id: s.productId,
        sku: s.product.sku,
        name: s.product.name,
        quantity: s.quantity,
      })),
      top_rotation: topRotation,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // DASHBOARD REPORT — KPIs unificados de la sede en el período
  // ─────────────────────────────────────────────────────────────────

  async getDashboardReport(branchId: string, from: Date, to: Date) {
    const [branch, appointments, sales, activeSubsCount, lowStockCount] = await Promise.all([
      this.getBranchOrThrow(branchId),
      this.prisma.appointment.findMany({
        where: { branchId, startAt: { gte: from, lte: to } },
        select: { status: true },
      }),
      this.prisma.sale.findMany({
        where: {
          branchId,
          status: { in: ["PAID", "REFUNDED"] },
          createdAt: { gte: from, lte: to },
        },
        select: { status: true, totalAmount: true, refundAmount: true },
      }),
      this.prisma.customerSubscription.count({
        where: { branchId, status: "ACTIVE" },
      }),
      this.prisma.inventoryStock.count({
        where: { branchId, quantity: { lte: 5 } },
      }),
    ]);

    const totalAppts = appointments.length;
    const completedAppts = appointments.filter((a) => a.status === "COMPLETED").length;
    const noShowAppts = appointments.filter((a) => a.status === "NO_SHOW").length;
    const canceledAppts = appointments.filter((a) => a.status === "CANCELED").length;

    const paidSales = sales.filter((s) => s.status === "PAID");
    const refundedSales = sales.filter((s) => s.status === "REFUNDED");
    const totalRevenue = paidSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const totalRefunded = refundedSales.reduce(
      (sum, s) => sum + Number(s.refundAmount ?? s.totalAmount),
      0
    );

    return {
      branch_id: branchId,
      branch_name: branch.name,
      period: { from: this.formatDate(from), to: this.formatDate(to) },
      appointments: {
        total: totalAppts,
        completed: completedAppts,
        no_show: noShowAppts,
        canceled: canceledAppts,
        completion_rate_pct:
          totalAppts > 0 ? ((completedAppts / totalAppts) * 100).toFixed(1) : "0.0",
        no_show_rate_pct:
          totalAppts > 0 ? ((noShowAppts / totalAppts) * 100).toFixed(1) : "0.0",
      },
      sales: {
        total_transactions: paidSales.length,
        refunded_count: refundedSales.length,
        total_revenue: totalRevenue.toFixed(2),
        total_refunded: totalRefunded.toFixed(2),
        net_revenue: (totalRevenue - totalRefunded).toFixed(2),
      },
      subscriptions: {
        active_count: activeSubsCount,
      },
      inventory: {
        low_stock_count: lowStockCount,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // CUSTOMERS REPORT — nuevos vs recurrentes, top spenders, top visitantes
  // ─────────────────────────────────────────────────────────────────

  async getCustomersReport(branchId: string, from: Date, to: Date) {
    const [branch, appointments, sales] = await Promise.all([
      this.getBranchOrThrow(branchId),
      this.prisma.appointment.findMany({
        where: {
          branchId,
          startAt: { gte: from, lte: to },
          customer: { deletedAt: null },
        },
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, createdAt: true },
          },
        },
        orderBy: { startAt: "asc" },
      }),
      this.prisma.sale.findMany({
        where: {
          branchId,
          status: { in: ["PAID", "REFUNDED"] },
          createdAt: { gte: from, lte: to },
          customerId: { not: null },
        },
        select: { customerId: true, totalAmount: true, refundAmount: true, status: true },
      }),
    ]);

    // Build customer map with appointment counts
    const customerMap = new Map<
      string,
      { name: string; createdAt: Date; apptCount: number }
    >();
    for (const a of appointments) {
      if (!a.customer) continue;
      const existing = customerMap.get(a.customerId);
      if (existing) {
        existing.apptCount++;
      } else {
        customerMap.set(a.customerId, {
          name: `${a.customer.firstName} ${a.customer.lastName}`.trim(),
          createdAt: a.customer.createdAt,
          apptCount: 1,
        });
      }
    }

    // New customers: created within the report period
    let newCustomers = 0;
    let returningCustomers = 0;
    for (const c of customerMap.values()) {
      if (c.createdAt >= from && c.createdAt <= to) newCustomers++;
      else returningCustomers++;
    }

    // Build spending map (net of refunds)
    const spendingMap = new Map<string, number>();
    for (const s of sales) {
      if (!s.customerId) continue;
      const delta =
        s.status === "REFUNDED"
          ? -Number(s.refundAmount ?? s.totalAmount)
          : Number(s.totalAmount);
      spendingMap.set(s.customerId, (spendingMap.get(s.customerId) ?? 0) + delta);
    }

    const topSpenders = [...spendingMap.entries()]
      .map(([id, total]) => {
        const c = customerMap.get(id);
        return {
          customer_id: id,
          name: c?.name ?? id,
          total_spent: total.toFixed(2),
        };
      })
      .sort((a, b) => Number(b.total_spent) - Number(a.total_spent))
      .slice(0, 10);

    const topVisitors = [...customerMap.entries()]
      .map(([id, v]) => ({
        customer_id: id,
        name: v.name,
        appointment_count: v.apptCount,
      }))
      .sort((a, b) => b.appointment_count - a.appointment_count)
      .slice(0, 10);

    return {
      branch_id: branchId,
      branch_name: branch.name,
      period: { from: this.formatDate(from), to: this.formatDate(to) },
      summary: {
        unique_customers_with_appointments: customerMap.size,
        new_customers: newCustomers,
        returning_customers: returningCustomers,
        unique_customers_with_sales: spendingMap.size,
      },
      top_spenders: topSpenders,
      top_visitors: topVisitors,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // PLANS REPORT — uso de planes, sesiones, churn por plan
  // ─────────────────────────────────────────────────────────────────

  async getPlansReport(branchId: string, from: Date, to: Date) {
    const [branch, subscriptions, activePlansCount] = await Promise.all([
      this.getBranchOrThrow(branchId),
      this.prisma.customerSubscription.findMany({
        where: { branchId },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              price: true,
              includedSessions: true,
              color: true,
            },
          },
        },
      }),
      this.prisma.plan.count({ where: { isActive: true } }),
    ]);

    const newInPeriod = subscriptions.filter(
      (s) => s.startDate >= from && s.startDate <= to
    );

    // Build per-plan stats from all subscriptions
    const planMap = new Map<
      string,
      {
        name: string;
        price: number;
        includedSessions: number;
        color: string | null;
        active: number;
        paused: number;
        canceled: number;
        expired: number;
        new_in_period: number;
        sessions_consumed: number;
        sessions_remaining: number;
      }
    >();

    for (const s of subscriptions) {
      if (!planMap.has(s.planId)) {
        planMap.set(s.planId, {
          name: s.plan?.name ?? s.planId,
          price: Number(s.plan?.price ?? 0),
          includedSessions: s.plan?.includedSessions ?? 0,
          color: s.plan?.color ?? null,
          active: 0,
          paused: 0,
          canceled: 0,
          expired: 0,
          new_in_period: 0,
          sessions_consumed: 0,
          sessions_remaining: 0,
        });
      }
      const entry = planMap.get(s.planId)!;

      if (s.status === "ACTIVE") entry.active++;
      else if (s.status === "PAUSED") entry.paused++;
      else if (s.status === "CANCELED") entry.canceled++;
      else if (s.status === "EXPIRED") entry.expired++;

      const included = s.plan?.includedSessions ?? 0;
      const remaining = s.remainingSessions ?? 0;
      entry.sessions_consumed += Math.max(0, included - remaining);
      entry.sessions_remaining += remaining;
    }

    for (const s of newInPeriod) {
      const entry = planMap.get(s.planId);
      if (entry) entry.new_in_period++;
    }

    const byPlan = [...planMap.entries()].map(([id, v]) => {
      const totalSessions = v.sessions_consumed + v.sessions_remaining;
      return {
        plan_id: id,
        name: v.name,
        color: v.color,
        price: v.price.toFixed(2),
        included_sessions: v.includedSessions,
        total_subscriptions: v.active + v.paused + v.canceled + v.expired,
        active: v.active,
        paused: v.paused,
        canceled: v.canceled,
        expired: v.expired,
        new_in_period: v.new_in_period,
        sessions_consumed: v.sessions_consumed,
        sessions_remaining: v.sessions_remaining,
        consumption_rate_pct:
          totalSessions > 0
            ? ((v.sessions_consumed / totalSessions) * 100).toFixed(1)
            : "0.0",
      };
    });

    const totalActive = subscriptions.filter((s) => s.status === "ACTIVE").length;
    const totalPaused = subscriptions.filter((s) => s.status === "PAUSED").length;

    return {
      branch_id: branchId,
      branch_name: branch.name,
      period: { from: this.formatDate(from), to: this.formatDate(to) },
      summary: {
        total_active_subscriptions: totalActive,
        total_paused_subscriptions: totalPaused,
        new_subscriptions_in_period: newInPeriod.length,
        active_plans_count: activePlansCount,
      },
      by_plan: byPlan,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // CSV EXPORTS
  // ─────────────────────────────────────────────────────────────────

  async getNoShowReportCSV(branchId: string, from: Date, to: Date): Promise<string> {
    await this.getBranchOrThrow(branchId);
    const [noShows, cancellations] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { branchId, status: "NO_SHOW", startAt: { gte: from, lte: to } },
        include: { customer: true, service: true },
        orderBy: { startAt: "desc" },
      }),
      this.prisma.appointment.findMany({
        where: { branchId, status: "CANCELED", startAt: { gte: from, lte: to } },
        include: { customer: true, service: true },
        orderBy: { startAt: "desc" },
      }),
    ]);

    const rows = [
      ...noShows.map((a) => ({
        tipo: "NO_SHOW",
        cita_id: a.id,
        fecha: this.formatDate(a.startAt),
        hora: `${String(a.startAt.getHours()).padStart(2, "0")}:${String(a.startAt.getMinutes()).padStart(2, "0")}`,
        cliente: a.customer ? `${a.customer.firstName} ${a.customer.lastName}` : "Anónimo",
        servicio: a.service?.name ?? "",
        motivo: "",
      })),
      ...cancellations.map((a) => ({
        tipo: "CANCELADO",
        cita_id: a.id,
        fecha: this.formatDate(a.startAt),
        hora: `${String(a.startAt.getHours()).padStart(2, "0")}:${String(a.startAt.getMinutes()).padStart(2, "0")}`,
        cliente: a.customer ? `${a.customer.firstName} ${a.customer.lastName}` : "Anónimo",
        servicio: a.service?.name ?? "",
        motivo: a.cancelReason ?? "Sin motivo",
      })),
    ].sort((a, b) => b.fecha.localeCompare(a.fecha));

    return this.toCSV(rows, [
      { key: "tipo", header: "Tipo" },
      { key: "cita_id", header: "ID Cita" },
      { key: "fecha", header: "Fecha" },
      { key: "hora", header: "Hora" },
      { key: "cliente", header: "Cliente" },
      { key: "servicio", header: "Servicio" },
      { key: "motivo", header: "Motivo Cancelación" },
    ]);
  }

  async getOperationsReportCSV(branchId: string, from: Date, to: Date): Promise<string> {
    await this.getBranchOrThrow(branchId);
    const appointments = await this.prisma.appointment.findMany({
      where: { branchId, startAt: { gte: from, lte: to } },
      include: { service: true, customer: true },
      orderBy: { startAt: "asc" },
    });

    const rows = appointments.map((a) => ({
      id: a.id,
      fecha: this.formatDate(a.startAt),
      hora: `${String(a.startAt.getHours()).padStart(2, "0")}:${String(a.startAt.getMinutes()).padStart(2, "0")}`,
      estado: a.status,
      fuente: a.source,
      servicio: a.service?.name ?? "",
      cliente: a.customer ? `${a.customer.firstName} ${a.customer.lastName}` : "Anónimo",
      motivo_cancelacion: a.cancelReason ?? "",
    }));

    return this.toCSV(rows, [
      { key: "id", header: "ID Cita" },
      { key: "fecha", header: "Fecha" },
      { key: "hora", header: "Hora" },
      { key: "estado", header: "Estado" },
      { key: "fuente", header: "Fuente" },
      { key: "servicio", header: "Servicio" },
      { key: "cliente", header: "Cliente" },
      { key: "motivo_cancelacion", header: "Motivo Cancelación" },
    ]);
  }

  async getSalesReportCSV(branchId: string, from: Date, to: Date): Promise<string> {
    await this.getBranchOrThrow(branchId);
    const sales = await this.prisma.sale.findMany({
      where: {
        branchId,
        status: { in: ["PAID", "REFUNDED"] },
        createdAt: { gte: from, lte: to },
      },
      include: {
        items: { include: { product: true, service: true, plan: true } },
        customer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const rows: Record<string, string | number>[] = [];
    for (const sale of sales) {
      const customerName = sale.customer
        ? `${sale.customer.firstName} ${sale.customer.lastName}`.trim()
        : "Anónimo";
      for (const item of sale.items) {
        rows.push({
          venta_id: sale.id,
          fecha: this.formatDate(sale.createdAt),
          estado: sale.status,
          cliente: customerName,
          metodo_pago: sale.paymentMethod,
          total_venta: Number(sale.totalAmount).toFixed(2),
          descuento: Number(sale.discountAmount ?? 0).toFixed(2),
          monto_reembolso: Number(sale.refundAmount ?? 0).toFixed(2),
          tipo_item: item.itemType,
          producto_servicio: item.product?.name ?? item.service?.name ?? item.plan?.name ?? "",
          cantidad: item.quantity,
          precio_unitario: Number(item.unitPrice).toFixed(2),
          subtotal: Number(item.subtotal).toFixed(2),
        });
      }
    }

    return this.toCSV(rows, [
      { key: "venta_id", header: "ID Venta" },
      { key: "fecha", header: "Fecha" },
      { key: "estado", header: "Estado" },
      { key: "cliente", header: "Cliente" },
      { key: "metodo_pago", header: "Método Pago" },
      { key: "total_venta", header: "Total Venta" },
      { key: "descuento", header: "Descuento" },
      { key: "monto_reembolso", header: "Reembolso" },
      { key: "tipo_item", header: "Tipo" },
      { key: "producto_servicio", header: "Producto / Servicio / Plan" },
      { key: "cantidad", header: "Cantidad" },
      { key: "precio_unitario", header: "Precio Unitario" },
      { key: "subtotal", header: "Subtotal" },
    ]);
  }

  async getInventoryReportCSV(branchId: string): Promise<string> {
    await this.getBranchOrThrow(branchId);
    const stocks = await this.prisma.inventoryStock.findMany({
      where: { branchId },
      include: { product: true },
      orderBy: { product: { name: "asc" } },
    });

    const rows = stocks.map((s) => ({
      sku: s.product.sku,
      nombre: s.product.name,
      unidad: s.product.unitType,
      cantidad: s.quantity,
      ultima_actualizacion: this.formatDate(s.updatedAt),
    }));

    return this.toCSV(rows, [
      { key: "sku", header: "SKU" },
      { key: "nombre", header: "Producto" },
      { key: "unidad", header: "Unidad" },
      { key: "cantidad", header: "Stock Actual" },
      { key: "ultima_actualizacion", header: "Última Actualización" },
    ]);
  }

  async getCustomersReportCSV(branchId: string, from: Date, to: Date): Promise<string> {
    await this.getBranchOrThrow(branchId);
    const appointments = await this.prisma.appointment.findMany({
      where: {
        branchId,
        startAt: { gte: from, lte: to },
        customer: { deletedAt: null },
      },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, phone: true, createdAt: true },
        },
      },
      orderBy: { startAt: "asc" },
    });

    const customerMap = new Map<
      string,
      { name: string; phone: string; createdAt: Date; apptCount: number }
    >();
    for (const a of appointments) {
      if (!a.customer) continue;
      const existing = customerMap.get(a.customerId);
      if (existing) {
        existing.apptCount++;
      } else {
        customerMap.set(a.customerId, {
          name: `${a.customer.firstName} ${a.customer.lastName}`.trim(),
          phone: a.customer.phone ?? "",
          createdAt: a.customer.createdAt,
          apptCount: 1,
        });
      }
    }

    const rows = [...customerMap.entries()]
      .map(([id, v]) => ({
        cliente_id: id,
        nombre: v.name,
        telefono: v.phone,
        es_nuevo: v.createdAt >= from && v.createdAt <= to ? "Sí" : "No",
        fecha_registro: this.formatDate(v.createdAt),
        total_citas: v.apptCount,
      }))
      .sort((a, b) => b.total_citas - a.total_citas);

    return this.toCSV(rows, [
      { key: "cliente_id", header: "ID Cliente" },
      { key: "nombre", header: "Nombre" },
      { key: "telefono", header: "Teléfono" },
      { key: "es_nuevo", header: "¿Nuevo?" },
      { key: "fecha_registro", header: "Fecha Registro" },
      { key: "total_citas", header: "Citas en Período" },
    ]);
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private async getBranchOrThrow(branchId: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException(`Sede ${branchId} no encontrada`);
    return branch;
  }

  private groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return items.reduce(
      (acc, item) => {
        const key = keyFn(item);
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      },
      {} as Record<string, T[]>
    );
  }

  private calcDailyOccupancy(
    appointments: { status: string; startAt: Date }[],
    capacity: number,
    from: Date,
    to: Date
  ) {
    const activeStatuses = ["CONFIRMED", "CHECKED_IN", "IN_SERVICE", "COMPLETED"];
    const dayMap = new Map<string, number>();

    for (const a of appointments) {
      if (!activeStatuses.includes(a.status)) continue;
      const day = this.formatDate(a.startAt);
      dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
    }

    const days = this.dateRange(from, to);
    return days.map((day) => {
      const count = dayMap.get(day) ?? 0;
      // Asunción: 8h de atención, slots de 30 min = 16 slots × capacidad
      const maxSlots = capacity * 16;
      const pct = maxSlots > 0 ? Math.min(100, (count / maxSlots) * 100).toFixed(1) : "0.0";
      return { date: day, appointments: count, occupancy_pct: pct };
    });
  }

  private calcDailyRevenue(sales: { createdAt: Date; totalAmount: unknown }[], from: Date, to: Date) {
    const revenueMap = new Map<string, number>();
    const countMap = new Map<string, number>();

    for (const s of sales) {
      const day = this.formatDate(s.createdAt);
      revenueMap.set(day, (revenueMap.get(day) ?? 0) + Number(s.totalAmount));
      countMap.set(day, (countMap.get(day) ?? 0) + 1);
    }

    return this.dateRange(from, to).map((day) => ({
      date: day,
      revenue: (revenueMap.get(day) ?? 0).toFixed(2),
      transactions: countMap.get(day) ?? 0,
    }));
  }

  /**
   * Genera un rango de fechas en hora local (sin desfase UTC).
   */
  private dateRange(from: Date, to: Date): string[] {
    const days: string[] = [];
    const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
    const end    = new Date(Date.UTC(to.getUTCFullYear(),   to.getUTCMonth(),   to.getUTCDate()));

    while (cursor <= end && days.length < 366) {
      days.push(this.formatDate(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return days;
  }

  private formatDate(d: Date): string {
    const year  = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day   = String(d.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private toCSV(
    rows: Record<string, string | number>[],
    columns: { key: string; header: string }[]
  ): string {
    const header = columns.map((c) => `"${c.header}"`).join(",");
    const lines = rows.map((row) =>
      columns
        .map((c) => {
          const val = row[c.key] ?? "";
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    return [header, ...lines].join("\r\n");
  }
}

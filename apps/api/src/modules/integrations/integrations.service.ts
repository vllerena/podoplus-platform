import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

export type IntegrationStatus = "live" | "simulated" | "not_configured";

export interface WhatsappStats {
  total:       number;
  sentToday:   number;
  failedToday: number;
  byStatus:    Record<string, number>;
}

export interface WhatsappLogEntry {
  id:                string;
  branchId:          string;
  branchName?:       string;
  customerId?:       string;
  customerName?:     string;
  appointmentId?:    string;
  toPhone:           string;
  messageType:       string;
  templateName?:     string;
  messageBody?:      string;
  status:            string;
  providerMessageId?: string;
  errorMessage?:     string;
  scheduledFor?:     string;
  sentAt?:           string;
  createdAt:         string;
}

export interface WhatsappLogsPage {
  total:      number;
  limit:      number;
  offset:     number;
  nextCursor: string | null;
  data:       WhatsappLogEntry[];
}

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ─────────────────────────────────────────────────────────────────
  // STATUS
  // ─────────────────────────────────────────────────────────────────

  getIntegrationsStatus(): Record<string, IntegrationStatus> {
    const hasWhatsapp = !!(
      this.config.get<string>("WHATSAPP_ACCESS_TOKEN") &&
      this.config.get<string>("WHATSAPP_PHONE_NUMBER_ID")
    );

    return {
      whatsapp: hasWhatsapp ? "live" : "simulated",
      sunat:    "not_configured",
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // WHATSAPP STATS
  // ─────────────────────────────────────────────────────────────────

  async getWhatsappStats(branchId?: string): Promise<WhatsappStats> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const base: any = branchId ? { branchId } : {};

    const [total, sentToday, failedToday, grouped] = await Promise.all([
      this.prisma.whatsappMessageLog.count({ where: base }),
      this.prisma.whatsappMessageLog.count({
        where: { ...base, status: "SENT", sentAt: { gte: todayStart } },
      }),
      this.prisma.whatsappMessageLog.count({
        where: { ...base, status: "FAILED", createdAt: { gte: todayStart } },
      }),
      this.prisma.whatsappMessageLog.groupBy({
        by: ["status"],
        _count: { id: true },
        where: base,
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const g of grouped) byStatus[g.status] = g._count.id;

    return { total, sentToday, failedToday, byStatus };
  }

  // ─────────────────────────────────────────────────────────────────
  // WHATSAPP LOGS
  // ─────────────────────────────────────────────────────────────────

  async getWhatsappLogs(filters: {
    branchId?: string;
    status?:   string;
    from?:     Date;
    to?:       Date;
    limit?:    number;
    offset?:   number;
    cursor?:   string;
  }): Promise<WhatsappLogsPage> {
    const limit  = Math.min(filters.limit  ?? 50, 200);
    const offset = filters.offset ?? 0;

    const where: any = {};
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.status)   where.status   = filters.status;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to)   where.createdAt.lte = filters.to;
    }

    const include = {
      branch:   { select: { name: true } },
      customer: { select: { firstName: true, lastName: true } },
      template: { select: { name: true } },
    };

    const useCursor = !!filters.cursor;

    if (useCursor) {
      const logs = await this.prisma.whatsappMessageLog.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
        take:    limit + 1,
        cursor:  { id: filters.cursor },
        skip:    1,
      });
      const hasMore   = logs.length > limit;
      const page      = hasMore ? logs.slice(0, limit) : logs;
      const nextCursor = hasMore ? page[page.length - 1].id : null;
      return { total: null, limit, offset: null, nextCursor, data: page.map(this.formatLog) };
    }

    const [logs, total] = await Promise.all([
      this.prisma.whatsappMessageLog.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
        take:    limit,
        skip:    offset,
      }),
      this.prisma.whatsappMessageLog.count({ where }),
    ]);

    const nextCursor = logs.length === limit ? logs[logs.length - 1].id : null;
    return { total, limit, offset, nextCursor, data: logs.map(this.formatLog) };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPER
  // ─────────────────────────────────────────────────────────────────

  private formatLog(l: any): WhatsappLogEntry {
    const payload = l.payloadJson as any ?? {};
    return {
      id:                l.id,
      branchId:          l.branchId,
      branchName:        l.branch?.name,
      customerId:        l.customerId ?? undefined,
      customerName:      l.customer
        ? `${l.customer.firstName} ${l.customer.lastName}`.trim()
        : undefined,
      appointmentId:     l.appointmentId ?? undefined,
      toPhone:           l.toPhone,
      messageType:       l.messageType,
      templateName:      l.template?.name ?? payload.templateName ?? undefined,
      messageBody:       payload.messageBody ?? undefined,
      status:            l.status,
      providerMessageId: l.providerMessageId ?? undefined,
      errorMessage:      l.errorMessage ?? undefined,
      scheduledFor:      l.scheduledFor?.toISOString() ?? undefined,
      sentAt:            l.sentAt?.toISOString() ?? undefined,
      createdAt:         l.createdAt.toISOString(),
    };
  }
}

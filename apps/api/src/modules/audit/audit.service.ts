import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { QueuePublisherService } from "../queue/queue-publisher.service";

export type AuditActorType = "USER" | "SYSTEM";

export interface AuditLogParams {
  actorType: AuditActorType;
  actorId?: string;
  branchId?: string;
  action: string;
  entityType: string;
  entityId: string;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface AuditLogsPage {
  total: number;
  limit: number;
  /** null cuando se usa paginación por cursor */
  offset: number | null;
  /** ID del último registro devuelto — úsalo como `cursor` en la siguiente request */
  nextCursor: string | null;
  data: AuditLogEntry[];
}

export interface AuditLogEntry {
  id: string;
  actor_type: string;
  actor_id?: string;
  actor_name?: string;
  branch_id?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  reason?: string;
  metadata?: any;
  created_at: string;
}

/**
 * Convención de acciones:
 *   appointment.created | appointment.confirmed | appointment.canceled
 *   appointment.rescheduled | appointment.completed | appointment.no_show
 *   sale.created | sale.voided | sale.refunded
 *   subscription.assigned | subscription.consumed | subscription.renewed | subscription.canceled
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger("AuditService");

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly queuePublisher?: QueuePublisherService
  ) {}

  /**
   * Registra una entrada en el audit log.
   *
   * Si el QueuePublisher está disponible, encola el job en BullMQ y el
   * Worker lo persiste en DB de forma asíncrona (mayor resiliencia).
   * Si no, escribe directamente (fire-and-forget).
   */
  log(params: AuditLogParams): void {
    if (this.queuePublisher) {
      this.queuePublisher.publishAuditLog(params).catch((err) => {
        // Fallback: si la cola no está disponible, escribe directo
        this.logger.warn(
          `Queue no disponible para audit log [${params.action}], escribiendo directo: ${err.message}`
        );
        this.persist(params).catch((e) =>
          this.logger.error(`Error guardando audit log [${params.action}]: ${e.message}`)
        );
      });
    } else {
      this.persist(params).catch((err) =>
        this.logger.error(`Error guardando audit log [${params.action}]: ${err.message}`)
      );
    }
  }

  private async persist(params: AuditLogParams): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorType: params.actorType,
        actorId: params.actorId ?? null,
        branchId: params.branchId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        reason: params.reason ?? null,
        metadataJson: params.metadata ?? undefined,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // QUERIES — con soporte cursor-based y offset pagination
  // ─────────────────────────────────────────────────────────────────

  /**
   * Consulta el audit log con paginación dual:
   *
   * • Offset (default): `{ limit, offset }` — compatible con tablas pequeñas/medianas.
   * • Cursor-based: `{ cursor: "<id>" }` — eficiente a cualquier escala. Ideal para
   *   infinite scroll y tablas grandes (millones de registros).
   *   El cursor es el `id` del último registro recibido; se devuelve como `nextCursor`.
   */
  async getLogs(filters: {
    branchId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    actorId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
    cursor?: string;
  }): Promise<AuditLogsPage> {
    const where: any = {};

    if (filters.branchId)   where.branchId   = filters.branchId;
    if (filters.entityType) where.entityType  = filters.entityType;
    if (filters.entityId)   where.entityId    = filters.entityId;
    if (filters.action)     where.action      = { contains: filters.action };
    if (filters.actorId)    where.actorId     = filters.actorId;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to)   where.createdAt.lte = filters.to;
    }

    const limit = Math.min(filters.limit ?? 50, 200);
    const useCursor = !!filters.cursor;

    // ── Cursor-based ─────────────────────────────────────────────────────────
    if (useCursor) {
      const logs = await this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: limit + 1, // Fetch one extra to determine if there's a next page
        cursor: { id: filters.cursor },
        skip: 1,         // Skip the cursor record itself
      });

      const hasMore = logs.length > limit;
      const page    = hasMore ? logs.slice(0, limit) : logs;
      const nextCursor = hasMore ? page[page.length - 1].id : null;

      return {
        total: null, // Total count is expensive with cursor pagination
        limit,
        offset: null,
        nextCursor,
        data: page.map(this.formatLog),
      };
    }

    // ── Offset-based ─────────────────────────────────────────────────────────
    const offset = filters.offset ?? 0;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const nextCursor = logs.length === limit ? logs[logs.length - 1].id : null;

    return {
      total,
      limit,
      offset,
      nextCursor,
      data: logs.map(this.formatLog),
    };
  }

  async getEntityHistory(entityType: string, entityId: string): Promise<AuditLogEntry[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      include: { actor: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });

    return logs.map(this.formatLog);
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private formatLog(l: any): AuditLogEntry {
    return {
      id: l.id,
      actor_type: l.actorType,
      actor_id: l.actorId ?? undefined,
      actor_name: l.actor
        ? `${l.actor.firstName} ${l.actor.lastName}`.trim()
        : undefined,
      branch_id: l.branchId ?? undefined,
      action: l.action,
      entity_type: l.entityType,
      entity_id: l.entityId,
      reason: l.reason ?? undefined,
      metadata: l.metadataJson ?? undefined,
      created_at: l.createdAt.toISOString(),
    };
  }
}

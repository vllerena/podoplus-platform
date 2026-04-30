import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CacheService } from "../cache/cache.service";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";
import { AssignSubscriptionDto } from "./dto/assign-subscription.dto";
import { ConsumeSessionDto } from "./dto/consume-session.dto";
import { CancelSubscriptionDto } from "./dto/cancel-subscription.dto";
import { PauseSubscriptionDto } from "./dto/pause-subscription.dto";

// Sentinel para planes de tipo DATE (sesiones ilimitadas)
const UNLIMITED_SESSIONS = 9999;

// TTL de 5 minutos — el catálogo de planes cambia raramente
const CACHE_TTL = 300;
const CACHE_KEY_ACTIVE = "plans:all:active";
const CACHE_KEY_ALL    = "plans:all";

export type PlanType = "SESSION" | "DATE" | "HYBRID";
export type SubscriptionStatus = "ACTIVE" | "PAUSED" | "CANCELED" | "EXPIRED";

// Statuses desde los que se puede pausar
const PAUSABLE_STATUSES: SubscriptionStatus[] = ["ACTIVE"];
// Statuses desde los que se puede resumir
const RESUMABLE_STATUSES: SubscriptionStatus[] = ["PAUSED"];
// Statuses desde los que se puede cancelar
const CANCELABLE_STATUSES: SubscriptionStatus[] = ["ACTIVE", "PAUSED"];

@Injectable()
export class PlansService {
  private readonly logger = new Logger("PlansService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly notificationsService?: NotificationsService
  ) {}

  // ─────────────────────────────────────────────────────────────────
  // PLANS
  // ─────────────────────────────────────────────────────────────────

  async createPlan(dto: CreatePlanDto, actorId?: string) {
    const includedSessions =
      dto.plan_type === "DATE"
        ? UNLIMITED_SESSIONS
        : (dto.included_sessions ?? 1);

    const plan = await this.prisma.plan.create({
      data: {
        name:             dto.name,
        description:      dto.description ?? null,
        planType:         dto.plan_type,
        price:            dto.price,
        durationDays:     dto.duration_days,
        includedSessions,
        isActive:         dto.is_active ?? true,
        color:            dto.color ?? null,
      },
    });

    await this.cache.delPattern("plans:*");

    this.auditService?.log({
      actorType:  "USER",
      actorId,
      action:     "plan.created",
      entityType: "plan",
      entityId:   plan.id,
      metadata:   { name: plan.name, planType: plan.planType, price: plan.price },
    });

    this.logger.log(`Plan creado: ${plan.id} (${plan.planType})`);
    return this.formatPlan(plan);
  }

  async getPlans(onlyActive?: boolean) {
    const key   = onlyActive ? CACHE_KEY_ACTIVE : CACHE_KEY_ALL;
    const where = onlyActive ? { isActive: true } : {};
    return this.cache.wrap(key, CACHE_TTL, async () => {
      const plans = await this.prisma.plan.findMany({
        where,
        orderBy: { name: "asc" },
      });
      return plans.map((p) => this.formatPlan(p));
    });
  }

  async getPlanById(planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} no encontrado`);
    return this.formatPlan(plan);
  }

  async updatePlan(planId: string, dto: UpdatePlanDto, actorId?: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} no encontrado`);

    const updated = await this.prisma.plan.update({
      where: { id: planId },
      data: {
        ...(dto.name              !== undefined && { name: dto.name }),
        ...(dto.description       !== undefined && { description: dto.description }),
        ...(dto.price             !== undefined && { price: dto.price }),
        ...(dto.duration_days     !== undefined && { durationDays: dto.duration_days }),
        ...(dto.included_sessions !== undefined && { includedSessions: dto.included_sessions }),
        ...(dto.is_active         !== undefined && { isActive: dto.is_active }),
        ...(dto.color             !== undefined && { color: dto.color }),
      },
    });

    await this.cache.delPattern("plans:*");

    this.auditService?.log({
      actorType:  "USER",
      actorId,
      action:     "plan.updated",
      entityType: "plan",
      entityId:   planId,
      metadata:   { changes: dto },
    });

    this.logger.log(`Plan actualizado: ${planId}`);
    return this.formatPlan(updated);
  }

  async activatePlan(planId: string, actorId?: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} no encontrado`);
    if (plan.isActive) throw new BadRequestException("El plan ya está activo");

    const updated = await this.prisma.plan.update({
      where: { id: planId },
      data:  { isActive: true },
    });

    await this.cache.delPattern("plans:*");
    this.logger.log(`Plan activado: ${planId}`);
    return this.formatPlan(updated);
  }

  async deactivatePlan(planId: string, actorId?: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} no encontrado`);
    if (!plan.isActive) throw new BadRequestException("El plan ya está inactivo");

    const updated = await this.prisma.plan.update({
      where: { id: planId },
      data:  { isActive: false },
    });

    await this.cache.delPattern("plans:*");
    this.logger.log(`Plan desactivado: ${planId}`);
    return this.formatPlan(updated);
  }

  // ─────────────────────────────────────────────────────────────────
  // SUBSCRIPTIONS — ASSIGN
  // ─────────────────────────────────────────────────────────────────

  async assignSubscription(dto: AssignSubscriptionDto, createdById: string) {
    // branch_id es opcional — la suscripción es válida en cualquier sede
    const [customer, plan, branch] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: dto.customer_id } }),
      this.prisma.plan.findUnique({ where: { id: dto.plan_id } }),
      dto.branch_id
        ? this.prisma.branch.findUnique({ where: { id: dto.branch_id } })
        : Promise.resolve(null),
    ]);

    if (!customer)
      throw new NotFoundException(`Cliente ${dto.customer_id} no encontrado`);
    if (customer.deletedAt)
      throw new BadRequestException(`El cliente ${dto.customer_id} está eliminado`);
    if (!plan || !plan.isActive)
      throw new NotFoundException(`Plan ${dto.plan_id} no encontrado o inactivo`);
    if (dto.branch_id && !branch)
      throw new NotFoundException(`Sede ${dto.branch_id} no encontrada`);

    const existing = await this.prisma.customerSubscription.findFirst({
      where: { customerId: dto.customer_id, planId: dto.plan_id, status: "ACTIVE" },
    });
    if (existing) {
      throw new ConflictException(
        `El cliente ya tiene una suscripción activa para el plan "${plan.name}" (${existing.id})`
      );
    }

    const startDate = dto.start_date ? new Date(dto.start_date) : new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + plan.durationDays);

    const subscription = await this.prisma.customerSubscription.create({
      data: {
        customer:    { connect: { id: dto.customer_id } },
        plan:        { connect: { id: dto.plan_id } },
        ...(dto.branch_id && { branch: { connect: { id: dto.branch_id } } }),
        ...(dto.appointment_id && { appointment: { connect: { id: dto.appointment_id } } }),
        status:            "ACTIVE",
        startDate,
        endDate,
        remainingSessions: plan.includedSessions,
        createdBy:         { connect: { id: createdById } },
      },
      include: { plan: true, customer: true },
    });

    this.auditService?.log({
      actorType:  "USER",
      actorId:    createdById,
      branchId:   dto.branch_id,
      action:     "subscription.assigned",
      entityType: "subscription",
      entityId:   subscription.id,
      metadata: {
        planId:    dto.plan_id,
        planName:  plan.name,
        planType:  plan.planType,
        customerId: dto.customer_id,
      },
    });

    this.notificationsService?.notify({
      userId: createdById,
      type:   "subscription",
      title:  "Plan asignado",
      body:   `Plan "${plan.name}" asignado correctamente a ${subscription.customer.firstName} ${subscription.customer.lastName}`,
      entityType: "subscription",
      entityId:   subscription.id,
    });

    this.logger.log(
      `Suscripción asignada: ${subscription.id} (${plan.planType}) ` +
      `cliente ${dto.customer_id} → plan "${plan.name}"`
    );

    return this.formatSubscription(subscription, subscription.customer);
  }

  // ─────────────────────────────────────────────────────────────────
  // SUBSCRIPTIONS — QUERIES
  // ─────────────────────────────────────────────────────────────────

  async getSubscriptionById(subscriptionId: string) {
    const sub = await this.prisma.customerSubscription.findUnique({
      where:   { id: subscriptionId },
      include: {
        plan:         true,
        customer:     true,
        consumptions: { orderBy: { consumedAt: "desc" }, take: 50 },
      },
    });
    if (!sub) throw new NotFoundException(`Suscripción ${subscriptionId} no encontrada`);

    const synced = await this.syncExpiryByDate(sub);

    return {
      ...this.formatSubscription(synced, synced.customer),
      consumptions: sub.consumptions.map((c) => ({
        id:                c.id,
        appointment_id:    c.appointmentId ?? undefined,
        consumed_sessions: c.consumedSessions,
        notes:             (c as any).notes ?? undefined,
        consumed_at:       c.consumedAt.toISOString(),
      })),
    };
  }

  async getCustomerSubscriptions(customerId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException(`Cliente ${customerId} no encontrado`);

    // Expirar en batch las suscripciones activas DATE/HYBRID vencidas — 1 query
    await this.prisma.customerSubscription.updateMany({
      where: {
        customerId,
        status:  "ACTIVE",
        endDate: { lt: new Date() },
        plan: { planType: { in: ["DATE", "HYBRID"] } },
      },
      data: { status: "EXPIRED" },
    });

    const subs = await this.prisma.customerSubscription.findMany({
      where:   { customerId },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });

    return subs.map((s) => this.formatSubscription(s));
  }

  async getSubscriptionStats(customerId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException(`Cliente ${customerId} no encontrado`);

    const [subs, totalConsumed] = await Promise.all([
      this.prisma.customerSubscription.findMany({
        where:   { customerId },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.subscriptionConsumption.aggregate({
        where: { subscription: { customerId } },
        _sum:  { consumedSessions: true },
        _count: true,
      }),
    ]);

    const active   = subs.filter((s) => s.status === "ACTIVE");
    const paused   = subs.filter((s) => s.status === "PAUSED");
    const expired  = subs.filter((s) => s.status === "EXPIRED");
    const canceled = subs.filter((s) => s.status === "CANCELED");

    const totalRemaining = active.reduce((sum, s) => {
      return s.remainingSessions === UNLIMITED_SESSIONS ? sum : sum + s.remainingSessions;
    }, 0);

    // Agrupación por plan
    const byPlan: Record<string, { plan_name: string; total_subs: number; total_consumed: number }> = {};
    for (const s of subs) {
      const pid = s.planId;
      if (!byPlan[pid]) {
        byPlan[pid] = { plan_name: s.plan.name, total_subs: 0, total_consumed: 0 };
      }
      byPlan[pid].total_subs++;
    }

    return {
      customer_id:          customerId,
      customer_name:        `${customer.firstName} ${customer.lastName}`.trim(),
      total_subscriptions:  subs.length,
      active_count:         active.length,
      paused_count:         paused.length,
      expired_count:        expired.length,
      canceled_count:       canceled.length,
      total_sessions_consumed: totalConsumed._sum.consumedSessions ?? 0,
      total_consumption_records: totalConsumed._count,
      total_remaining_sessions:  totalRemaining,
      active_subscriptions: active.map((s) => ({
        id:                s.id,
        plan_name:         s.plan.name,
        plan_type:         s.plan.planType,
        end_date:          s.endDate.toISOString().split("T")[0],
        remaining_sessions: s.remainingSessions === UNLIMITED_SESSIONS
          ? "unlimited"
          : s.remainingSessions,
      })),
      by_plan: Object.entries(byPlan).map(([planId, v]) => ({
        plan_id:       planId,
        plan_name:     v.plan_name,
        total_subs:    v.total_subs,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // SUBSCRIPTIONS — LIST (global)
  // ─────────────────────────────────────────────────────────────────

  async listSubscriptions(filters: {
    branchId?: string;
    status?:   SubscriptionStatus;
    planId?:   string;
    cursor?:   string;
    limit?:    number;
  }) {
    const take = Math.min(filters.limit ?? 20, 100);

    // Batch-expire overdue DATE/HYBRID subscriptions before querying
    const expireWhere: any = {
      status:  "ACTIVE",
      endDate: { lt: new Date() },
      plan:    { planType: { in: ["DATE", "HYBRID"] } },
    };
    if (filters.branchId) expireWhere.branchId = filters.branchId;
    await this.prisma.customerSubscription.updateMany({
      where: expireWhere,
      data:  { status: "EXPIRED" },
    });

    const where: any = {};
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.status)   where.status   = filters.status;
    if (filters.planId)   where.planId   = filters.planId;

    const [total, subs] = await Promise.all([
      this.prisma.customerSubscription.count({ where }),
      this.prisma.customerSubscription.findMany({
        where,
        include: { plan: true, customer: true },
        orderBy: { createdAt: "desc" },
        take:    take + 1,
        ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      }),
    ]);

    const hasNext    = subs.length > take;
    const data       = hasNext ? subs.slice(0, take) : subs;
    const nextCursor = hasNext ? data[data.length - 1].id : undefined;

    return {
      data:       data.map((s) => this.formatSubscription(s, s.customer)),
      total,
      nextCursor,
      hasNext,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // SUBSCRIPTIONS — CONSUME
  // ─────────────────────────────────────────────────────────────────

  async consumeSession(
    subscriptionId: string,
    dto: ConsumeSessionDto,
    createdById: string
  ) {
    const sub = await this.prisma.customerSubscription.findUnique({
      where:   { id: subscriptionId },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException(`Suscripción ${subscriptionId} no encontrada`);

    if (sub.status !== "ACTIVE") {
      throw new BadRequestException(
        `No se puede consumir una suscripción con estado ${sub.status}`
      );
    }

    const planType = sub.plan.planType as PlanType;
    const now = new Date();

    if (planType === "DATE" || planType === "HYBRID") {
      if (now > sub.endDate) {
        await this.prisma.customerSubscription.update({
          where: { id: subscriptionId },
          data:  { status: "EXPIRED" },
        });
        throw new BadRequestException(
          `La suscripción venció el ${sub.endDate.toISOString().split("T")[0]}`
        );
      }
    }

    if (planType === "SESSION" || planType === "HYBRID") {
      if (sub.remainingSessions <= 0) {
        throw new BadRequestException("La suscripción no tiene sesiones disponibles");
      }
    }

    const newRemaining =
      planType === "DATE"
        ? sub.remainingSessions
        : sub.remainingSessions - 1;

    const expiresNow =
      (planType === "SESSION" || planType === "HYBRID") && newRemaining <= 0;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.subscriptionConsumption.create({
        data: {
          subscription: { connect: { id: subscriptionId } },
          ...(dto.appointment_id && { appointment: { connect: { id: dto.appointment_id } } }),
          consumedSessions: 1,
          ...(dto.notes && { notes: dto.notes }),
          createdBy:        { connect: { id: createdById } },
        },
      });

      const updated = await tx.customerSubscription.update({
        where: { id: subscriptionId },
        data: {
          remainingSessions: newRemaining,
          status:            expiresNow ? "EXPIRED" : "ACTIVE",
        },
        include: { plan: true },
      });

      return updated;
    });

    this.auditService?.log({
      actorType:  "USER",
      actorId:    createdById,
      branchId:   sub.branchId,
      action:     "subscription.consumed",
      entityType: "subscription",
      entityId:   subscriptionId,
      metadata: {
        appointmentId:   dto.appointment_id,
        planType,
        remainingBefore: sub.remainingSessions,
        remainingAfter:  newRemaining,
        expired:         expiresNow,
      },
    });

    if (expiresNow) {
      this.logger.log(`Suscripción ${subscriptionId} expirada: sesiones agotadas`);
    } else {
      this.logger.log(`Sesión consumida: ${subscriptionId} — restantes: ${newRemaining}`);
    }

    // Notificar si quedan pocas sesiones
    if (!expiresNow && newRemaining <= 2 && planType !== "DATE") {
      this.notificationsService?.notify({
        userId:     createdById,
        type:       "subscription",
        title:      "Pocas sesiones restantes",
        body:       `La suscripción del cliente tiene solo ${newRemaining} sesión(es) restante(s). ¡Considera renovar!`,
        entityType: "subscription",
        entityId:   subscriptionId,
      });
    }

    return this.formatSubscription(result);
  }

  // ─────────────────────────────────────────────────────────────────
  // SUBSCRIPTIONS — PAUSE / RESUME
  // ─────────────────────────────────────────────────────────────────

  async pauseSubscription(
    subscriptionId: string,
    dto: PauseSubscriptionDto,
    actorId: string
  ) {
    const sub = await this.prisma.customerSubscription.findUnique({
      where:   { id: subscriptionId },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException(`Suscripción ${subscriptionId} no encontrada`);

    if (!PAUSABLE_STATUSES.includes(sub.status as SubscriptionStatus)) {
      throw new BadRequestException(
        `No se puede pausar una suscripción en estado ${sub.status}. Solo se permite en: ${PAUSABLE_STATUSES.join(", ")}`
      );
    }

    const now = new Date();

    const updated = await this.prisma.customerSubscription.update({
      where: { id: subscriptionId },
      data: {
        status:       "PAUSED",
        pausedAt:     now,
        pausedReason: dto.reason ?? null,
      },
      include: { plan: true },
    });

    this.auditService?.log({
      actorType:  "USER",
      actorId,
      branchId:   sub.branchId,
      action:     "subscription.paused",
      entityType: "subscription",
      entityId:   subscriptionId,
      reason:     dto.reason,
    });

    this.logger.log(`Suscripción pausada: ${subscriptionId}`);
    return this.formatSubscription(updated);
  }

  async resumeSubscription(subscriptionId: string, actorId: string) {
    const sub = await this.prisma.customerSubscription.findUnique({
      where:   { id: subscriptionId },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException(`Suscripción ${subscriptionId} no encontrada`);

    if (!RESUMABLE_STATUSES.includes(sub.status as SubscriptionStatus)) {
      throw new BadRequestException(
        `No se puede resumir una suscripción en estado ${sub.status}. Solo se permite en: ${RESUMABLE_STATUSES.join(", ")}`
      );
    }

    // Si la suscripción venció mientras estaba pausada → EXPIRED
    if (new Date() > sub.endDate) {
      const expired = await this.prisma.customerSubscription.update({
        where: { id: subscriptionId },
        data:  { status: "EXPIRED", pausedAt: null, pausedReason: null },
        include: { plan: true },
      });
      this.logger.log(`Suscripción ${subscriptionId} venció durante la pausa → EXPIRED`);
      return this.formatSubscription(expired);
    }

    // Extender endDate por los días que estuvo pausada
    const pausedAt    = sub.pausedAt ?? new Date();
    const now         = new Date();
    const pausedDays  = Math.ceil((now.getTime() - pausedAt.getTime()) / (1000 * 60 * 60 * 24));
    const newEndDate  = new Date(sub.endDate);
    newEndDate.setUTCDate(newEndDate.getUTCDate() + pausedDays);

    const updated = await this.prisma.customerSubscription.update({
      where: { id: subscriptionId },
      data: {
        status:       "ACTIVE",
        endDate:      newEndDate,
        pausedAt:     null,
        pausedReason: null,
      },
      include: { plan: true },
    });

    this.auditService?.log({
      actorType:  "USER",
      actorId,
      branchId:   sub.branchId,
      action:     "subscription.resumed",
      entityType: "subscription",
      entityId:   subscriptionId,
      metadata:   { pausedDays, newEndDate },
    });

    this.logger.log(
      `Suscripción resumida: ${subscriptionId} (pausada ${pausedDays} día(s), nueva endDate: ${newEndDate.toISOString().split("T")[0]})`
    );
    return this.formatSubscription(updated);
  }

  // ─────────────────────────────────────────────────────────────────
  // SUBSCRIPTIONS — RENEW
  // ─────────────────────────────────────────────────────────────────

  async renewSubscription(subscriptionId: string, createdById: string) {
    const sub = await this.prisma.customerSubscription.findUnique({
      where:   { id: subscriptionId },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException(`Suscripción ${subscriptionId} no encontrada`);

    if (sub.status === "CANCELED") {
      throw new BadRequestException("No se puede renovar una suscripción cancelada");
    }

    const plan = sub.plan;
    const now  = new Date();
    now.setUTCHours(0, 0, 0, 0);
    const newStart = sub.endDate > now ? sub.endDate : now;
    const newEnd   = new Date(newStart);
    newEnd.setUTCDate(newEnd.getUTCDate() + plan.durationDays);

    // Marcar la anterior como EXPIRED
    await this.prisma.customerSubscription.update({
      where: { id: subscriptionId },
      data:  { status: "EXPIRED" },
    });

    // Crear nueva suscripción con link a la anterior
    const renewed = await this.prisma.customerSubscription.create({
      data: {
        customer:       { connect: { id: sub.customerId } },
        plan:           { connect: { id: sub.planId } },
        ...(sub.branchId && { branch: { connect: { id: sub.branchId } } }),
        status:         "ACTIVE",
        startDate:      newStart,
        endDate:        newEnd,
        remainingSessions: plan.includedSessions,
        renewedFromId:  subscriptionId,
        createdBy:      { connect: { id: createdById } },
      },
      include: { plan: true },
    });

    this.auditService?.log({
      actorType:  "USER",
      actorId:    createdById,
      branchId:   sub.branchId,
      action:     "subscription.renewed",
      entityType: "subscription",
      entityId:   subscriptionId,
      metadata:   { newSubscriptionId: renewed.id, newEndDate: newEnd },
    });

    this.logger.log(`Suscripción renovada: ${subscriptionId} → nueva: ${renewed.id}`);
    return this.formatSubscription(renewed);
  }

  // ─────────────────────────────────────────────────────────────────
  // SUBSCRIPTIONS — CANCEL
  // ─────────────────────────────────────────────────────────────────

  async cancelSubscription(
    subscriptionId: string,
    dto: CancelSubscriptionDto,
    canceledById: string
  ) {
    const sub = await this.prisma.customerSubscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!sub) throw new NotFoundException(`Suscripción ${subscriptionId} no encontrada`);

    if (!CANCELABLE_STATUSES.includes(sub.status as SubscriptionStatus)) {
      throw new BadRequestException(
        `La suscripción ya está en estado ${sub.status}. Solo se puede cancelar desde: ${CANCELABLE_STATUSES.join(", ")}`
      );
    }

    const now = new Date();

    const updated = await this.prisma.customerSubscription.update({
      where: { id: subscriptionId },
      data: {
        status:       "CANCELED",
        cancelReason: dto.reason,
        canceledAt:   now,
        canceledBy:   { connect: { id: canceledById } },
      },
      include: { plan: true },
    });

    this.auditService?.log({
      actorType:  "USER",
      actorId:    canceledById,
      branchId:   sub.branchId,
      action:     "subscription.canceled",
      entityType: "subscription",
      entityId:   subscriptionId,
      reason:     dto.reason,
      metadata:   { previousStatus: sub.status },
    });

    this.logger.log(`Suscripción cancelada: ${subscriptionId} — ${dto.reason}`);
    return this.formatSubscription(updated);
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private async syncExpiryByDate(sub: any): Promise<any> {
    const planType = sub.plan?.planType ?? sub.planType;
    if (
      sub.status === "ACTIVE" &&
      (planType === "DATE" || planType === "HYBRID") &&
      new Date() > sub.endDate
    ) {
      return this.prisma.customerSubscription.update({
        where:   { id: sub.id },
        data:    { status: "EXPIRED" },
        include: { plan: true, customer: true, consumptions: true },
      });
    }
    return sub;
  }

  private formatPlan(p: any) {
    const planType = p.planType as PlanType;
    return {
      id:                p.id,
      name:              p.name,
      description:       p.description ?? undefined,
      plan_type:         planType,
      price:             p.price.toString(),
      duration_days:     p.durationDays,
      included_sessions: planType === "DATE" ? "unlimited" : p.includedSessions,
      is_active:         p.isActive,
      color:             p.color ?? undefined,
      created_at:        p.createdAt.toISOString(),
      updated_at:        p.updatedAt.toISOString(),
    };
  }

  private formatSubscription(sub: any, customer?: any) {
    const planType    = (sub.plan?.planType ?? "") as PlanType;
    const isUnlimited = planType === "DATE";

    return {
      id:                 sub.id,
      customer_id:        sub.customerId,
      customer_name:      customer
        ? `${customer.firstName} ${customer.lastName}`.trim()
        : undefined,
      plan_id:            sub.planId,
      plan_name:          sub.plan?.name ?? undefined,
      plan_type:          planType,
      plan_color:         sub.plan?.color ?? undefined,
      branch_id:          sub.branchId,
      status:             sub.status as SubscriptionStatus,
      start_date:         sub.startDate.toISOString().split("T")[0],
      end_date:           sub.endDate.toISOString().split("T")[0],
      remaining_sessions: isUnlimited ? "unlimited" : sub.remainingSessions,
      cancel_reason:      sub.cancelReason ?? undefined,
      canceled_at:        sub.canceledAt ? sub.canceledAt.toISOString() : undefined,
      paused_at:          sub.pausedAt   ? sub.pausedAt.toISOString()   : undefined,
      paused_reason:      sub.pausedReason ?? undefined,
      renewed_from_id:    sub.renewedFromId ?? undefined,
      created_at:         sub.createdAt.toISOString(),
      updated_at:         sub.updatedAt.toISOString(),
    };
  }
}

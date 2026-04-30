import { PrismaClient } from "@prisma/client";
import { logger } from "../lib/logger";

const CTX = "ExpireSubscriptions";

/**
 * Marca como EXPIRED todas las suscripciones activas cuya endDate ya pasó.
 * Aplica a tipos DATE e HYBRID (SESSION nunca expira por fecha, solo por sesiones).
 */
export async function expireSubscriptions(prisma: PrismaClient): Promise<void> {
  const now = new Date();

  // Buscar suscripciones activas con fecha de vencimiento pasada
  const expired = await prisma.customerSubscription.findMany({
    where: {
      status: "ACTIVE",
      endDate: { lt: now },
      // SESSION puras tienen endDate muy lejano (sentinel), pero verificamos por plan
      plan: {
        planType: { in: ["DATE", "HYBRID"] },
      },
    },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true } },
      plan: { select: { id: true, name: true, planType: true } },
    },
  });

  if (expired.length === 0) {
    logger.info(CTX, "Sin suscripciones para expirar");
    return;
  }

  logger.info(CTX, `Expirando ${expired.length} suscripción(es)...`);

  // Un solo UPDATE para todas las suscripciones en lugar de N queries individuales
  const expiredIds = expired.map((s) => s.id);
  try {
    const { count } = await prisma.customerSubscription.updateMany({
      where: { id: { in: expiredIds } },
      data:  { status: "EXPIRED" },
    });
    logger.info(CTX, `✓ ${count} suscripción(es) marcadas como EXPIRED`);
  } catch (err) {
    logger.error(CTX, "Error en updateMany de suscripciones expiradas", err);
    return;
  }

  // Log detallado por suscripción (solo informativo, ya sin queries adicionales)
  for (const sub of expired) {
    logger.info(
      CTX,
      `  • ${sub.id} — ${sub.customer.firstName} ${sub.customer.lastName}` +
        ` — ${sub.plan.name} (${sub.plan.planType})` +
        ` — venció: ${sub.endDate.toISOString().split("T")[0]}`,
    );
  }

  logger.info(CTX, `Completado: ${expired.length} suscripción(es) expirada(s)`);
}

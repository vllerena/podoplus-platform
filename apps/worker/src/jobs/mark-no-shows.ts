import { PrismaClient } from "@prisma/client";
import { logger } from "../lib/logger";

const CTX = "MarkNoShows";

/**
 * Marca como NO_SHOW las citas que:
 * - Siguen en estado SCHEDULED
 * - Su endAt ya pasó (la cita terminó y nadie la completó o canceló)
 * - Con un margen de gracia de 30 minutos (por si el staff olvidó actualizarla)
 *
 * Se ejecuta cada 15 minutos.
 */
export async function markNoShows(prisma: PrismaClient): Promise<void> {
  // Margen de gracia: 30 minutos después del fin de la cita
  const gracePeriodMs = 30 * 60 * 1000;
  const cutoff = new Date(Date.now() - gracePeriodMs);

  const stale = await prisma.appointment.findMany({
    where: {
      status: "SCHEDULED",
      endAt: { lt: cutoff },
    },
    include: {
      customer: { select: { firstName: true, lastName: true } },
      service: { select: { name: true } },
      branch: { select: { name: true } },
    },
  });

  if (stale.length === 0) {
    logger.info(CTX, "Sin citas para marcar como NO_SHOW");
    return;
  }

  logger.info(CTX, `Marcando ${stale.length} cita(s) como NO_SHOW...`);

  for (const appt of stale) {
    try {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { status: "NO_SHOW" },
      });

      // Registrar en historial de estados
      await prisma.appointmentStatusHistory.create({
        data: {
          appointment: { connect: { id: appt.id } },
          fromStatus: "SCHEDULED",
          toStatus: "NO_SHOW",
          changedByType: "SYSTEM",
          reason: "Marcado automáticamente por worker — cita pasada sin confirmación",
        },
      });

      const customerName = appt.customer
        ? `${appt.customer.firstName} ${appt.customer.lastName}`
        : "Anónimo";

      logger.info(
        CTX,
        `✓ NO_SHOW: ${appt.id}` +
          ` — ${customerName}` +
          ` — ${appt.service?.name ?? ""}` +
          ` — ${appt.endAt.toISOString()}` +
          ` en ${appt.branch?.name ?? ""}`
      );
    } catch (err) {
      logger.error(CTX, `Error marcando NO_SHOW en cita ${appt.id}`, err);
    }
  }

  logger.info(CTX, `Completado: ${stale.length} cita(s) marcada(s) como NO_SHOW`);
}

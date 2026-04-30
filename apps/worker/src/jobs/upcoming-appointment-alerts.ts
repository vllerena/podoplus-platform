import { PrismaClient } from "@prisma/client";
import { logger } from "../lib/logger";

const CTX = "UpcomingAppointmentAlerts";

// ── Tipos locales para el resultado del findMany (cast as any) ────────────────
// Necesarios mientras el Prisma Client no incluye upcomingAlertSentAt en sus tipos.
// Eliminar una vez que se ejecute `pnpm --filter @podoplus/worker run prisma:generate`.
interface UpcomingAppointment {
  id:         string;
  status:     string;
  startAt:    Date;
  customer:   { firstName: string; lastName: string } | null;
  service:    { name: string } | null;
  branch:     {
    name:  string;
    users: Array<{ user: { id: string; isActive: boolean } }>;
  } | null;
}

/**
 * Detecta citas próximas a iniciar (PENDING / CONFIRMED) y notifica
 * al staff asignado a la sede correspondiente.
 *
 * Ventana de detección: citas que arrancan entre 10 y 35 minutos desde ahora.
 *   · Window de 25 min > intervalo de cron (5 min) → ninguna cita queda sin detectar.
 *   · Filtro `upcomingAlertSentAt IS NULL` → cada cita se notifica exactamente UNA vez.
 *
 * Se ejecuta cada 5 minutos.
 */
export async function sendUpcomingAppointmentAlerts(
  prisma: PrismaClient,
): Promise<void> {
  const now          = new Date();
  const windowStart  = new Date(now.getTime() + 10 * 60_000);  // +10 min
  const windowEnd    = new Date(now.getTime() + 35 * 60_000);  // +35 min

  // ── Buscar citas dentro de la ventana ──────────────────────────────────────
  // Nota: upcomingAlertSentAt es un campo nuevo — cast `as any` temporal hasta
  // que se regenere el Prisma Client (pnpm --filter @podoplus/worker run prisma:generate)
  const appointments: UpcomingAppointment[] = await (prisma.appointment as any).findMany({
    where: {
      status:             { in: ["PENDING", "CONFIRMED"] },
      upcomingAlertSentAt: null,
      startAt:            { gte: windowStart, lte: windowEnd },
    },
    include: {
      customer: {
        select: { firstName: true, lastName: true },
      },
      service: {
        select: { name: true },
      },
      branch: {
        select: {
          name: true,
          // Usuarios asignados a esta sede (opción A: por sede)
          users: {
            select: {
              user: {
                select: { id: true, isActive: true },
              },
            },
          },
        },
      },
    },
    orderBy: { startAt: "asc" },
  });

  if (appointments.length === 0) {
    logger.info(CTX, "Sin citas próximas para alertar");
    return;
  }

  logger.info(
    CTX,
    `Detectadas ${appointments.length} cita(s) próximas en ventana ` +
      `${windowStart.toISOString()} → ${windowEnd.toISOString()}`,
  );

  let totalNotifications = 0;
  let totalErrors        = 0;

  for (const appt of appointments) {
    try {
      // ── Hora en Lima (UTC-5) para el body de la notificación ────────────────
      const timeStr = appt.startAt.toLocaleTimeString("es-PE", {
        timeZone: "America/Lima",
        hour:     "2-digit",
        minute:   "2-digit",
        hour12:   false,
      });

      const minsRemaining = Math.round(
        (appt.startAt.getTime() - now.getTime()) / 60_000,
      );

      const customerName = appt.customer
        ? `${appt.customer.firstName} ${appt.customer.lastName}`
        : "Cliente";

      const serviceName = appt.service?.name ?? "Servicio";
      const branchName  = appt.branch?.name  ?? "Sede";

      const statusLabel = appt.status === "PENDING" ? "Pendiente" : "Confirmada";

      const title = "⏰ Cita próxima a iniciar";
      const body  =
        `${serviceName} con ${customerName} — ${timeStr} ` +
        `(en ~${minsRemaining} min) · ${branchName} · Estado: ${statusLabel}`;

      // ── Usuarios activos asignados a la sede ────────────────────────────────
      const branchUserIds = (appt.branch?.users ?? [])
        .filter((ub) => ub.user.isActive)
        .map((ub) => ub.user.id);

      if (branchUserIds.length === 0) {
        logger.warn(
          CTX,
          `Cita ${appt.id} — sin usuarios activos en sede "${branchName}", omitiendo`,
        );
        // Marcamos igual para no reintentar en el siguiente ciclo
        await (prisma.appointment as any).update({
          where: { id: appt.id },
          data:  { upcomingAlertSentAt: now },
        });
        continue;
      }

      // ── Crear notificación para cada usuario de la sede ─────────────────────
      await prisma.notification.createMany({
        data: branchUserIds.map((userId) => ({
          userId,
          type:       "appointment",
          title,
          body,
          entityType: "appointment",
          entityId:   appt.id,
        })),
        skipDuplicates: true,
      });

      // ── Marcar la cita como alertada (deduplicación) ─────────────────────────
      await (prisma.appointment as any).update({
        where: { id: appt.id },
        data:  { upcomingAlertSentAt: now },
      });

      totalNotifications += branchUserIds.length;

      logger.info(
        CTX,
        `✓ Cita ${appt.id} — "${serviceName}" con ${customerName}` +
          ` a las ${timeStr} — ${branchUserIds.length} notificación(es) enviadas`,
      );
    } catch (err) {
      totalErrors++;
      logger.error(
        CTX,
        `Error procesando alerta para cita ${appt.id}`,
        err,
      );
    }
  }

  logger.info(
    CTX,
    `Completado: ${appointments.length} cita(s) procesada(s), ` +
      `${totalNotifications} notificación(es) creadas, ${totalErrors} error(es)`,
  );
}

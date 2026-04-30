import { PrismaClient } from "@prisma/client";
import { logger } from "../lib/logger";
import { logNotification, NotificationJobData } from "../lib/notification-log";

// Re-export so main.ts can import it from here
export type { NotificationJobData };

/**
 * Persiste una notificación interna publicada por la API.
 * Se ejecuta en el Worker para desacoplar la escritura del ciclo request/response.
 * También crea un registro JSON local para soporte interno mientras no haya un
 * canal externo (WhatsApp/email) configurado.
 */
export async function sendNotification(
  prisma: PrismaClient,
  data: NotificationJobData,
): Promise<void> {
  // Guard: Prisma lanzaría P2025 si userId es undefined/vacío
  if (!data.userId) {
    logger.warn(
      "Notifications",
      `[notification:${data.type}] ignorada — userId ausente`,
    );
    return;
  }

  await prisma.notification.create({
    data: {
      user: { connect: { id: data.userId } },
      type: data.type,
      title: data.title,
      body: data.body,
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
    },
  });

  await logNotification(data);
  logger.info(
    "Notifications",
    `[notification:${data.type}] → user ${data.userId}`,
  );
}

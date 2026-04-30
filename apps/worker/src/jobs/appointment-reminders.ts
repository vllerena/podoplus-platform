import { PrismaClient } from "@prisma/client";
import { logger } from "../lib/logger";

const CTX = "AppointmentReminders";

/**
 * Envía recordatorios para citas del día siguiente.
 * Por ahora loguea los recordatorios pendientes.
 * Cuando se integre WhatsApp Cloud API, aquí se llamará al servicio de mensajería
 * y se registrará en WhatsappMessageLog con branchId, toPhone, payloadJson, etc.
 */
export async function sendAppointmentReminders(
  prisma: PrismaClient
): Promise<void> {
  const now = new Date();

  // Rango: mañana 00:00 → 23:59 UTC
  // (las citas se almacenan en UTC — usar métodos UTC para evitar drift)
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0,
  ));

  const tomorrowEnd = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    23, 59, 59, 999,
  ));

  const appointments = await prisma.appointment.findMany({
    where: {
      status: "SCHEDULED",
      startAt: { gte: tomorrow, lte: tomorrowEnd },
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          whatsappOptIn: true,
        },
      },
      service: { select: { name: true } },
      branch: { select: { name: true } },
    },
    orderBy: { startAt: "asc" },
  });

  if (appointments.length === 0) {
    logger.info(CTX, `Sin citas para recordar el ${tomorrow.toISOString().split("T")[0]}`);
    return;
  }

  logger.info(
    CTX,
    `Procesando recordatorios para ${appointments.length} cita(s) de mañana ${tomorrow.toISOString().split("T")[0]}`
  );

  let withWhatsApp = 0;
  let withoutChannel = 0;

  for (const appt of appointments) {
    const customer = appt.customer;
    // Mostrar hora en UTC (almacenamiento wall-clock)
    const hour = appt.startAt.getUTCHours().toString().padStart(2, "0");
    const min  = appt.startAt.getUTCMinutes().toString().padStart(2, "0");
    const timeStr = `${hour}:${min}`;

    if (!customer) {
      withoutChannel++;
      continue;
    }

    if (customer.whatsappOptIn && customer.phone) {
      // TODO: Llamar a WhatsApp Cloud API aquí cuando esté configurada:
      // await whatsappService.sendTemplate(customer.phone, "appointment_reminder", {
      //   name: customer.firstName,
      //   service: appt.service?.name,
      //   time: timeStr,
      //   branch: appt.branch?.name,
      // });
      logger.info(
        CTX,
        `[WhatsApp PENDIENTE] ${customer.firstName} ${customer.lastName}` +
          ` (${customer.phone}) — ${appt.service?.name} a las ${timeStr}` +
          ` en ${appt.branch?.name}`
      );
      withWhatsApp++;
    } else {
      logger.info(
        CTX,
        `[Sin canal] ${customer.firstName} ${customer.lastName}` +
          ` — ${appt.service?.name} a las ${timeStr} — sin WhatsApp opt-in`
      );
      withoutChannel++;
    }
  }

  logger.info(
    CTX,
    `Completado: ${withWhatsApp} con WhatsApp, ${withoutChannel} sin canal`
  );
}

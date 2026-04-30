import "dotenv/config";
import { Queue, Worker, Job } from "bullmq";
import prisma from "./lib/prisma";
import { redisConnection } from "./lib/redis";
import { logger } from "./lib/logger";
import { expireSubscriptions }    from "./jobs/expire-subscriptions";
import { markNoShows }            from "./jobs/mark-no-shows";
import { sendAppointmentReminders } from "./jobs/appointment-reminders";
import { sendUpcomingAppointmentAlerts } from "./jobs/upcoming-appointment-alerts";
import { persistAuditLog, AuditLogJobData }    from "./jobs/persist-audit-log";
import { sendNotification, NotificationJobData } from "./jobs/send-notification";

// ─────────────────────────────────────────────────────────────────────────────
// DEFINICIÓN DE COLAS
// ─────────────────────────────────────────────────────────────────────────────

const QUEUES = {
  EXPIRE_SUBS:      "expire-subscriptions",
  NO_SHOWS:         "mark-no-shows",
  REMINDERS:        "appointment-reminders",
  UPCOMING_ALERTS:  "upcoming-appointment-alerts",
  AUDIT_LOG:        "audit-log",
  NOTIFICATIONS:    "notifications",
} as const;

// Cron patterns (UTC — servidor configurado en UTC)
const CRONS = {
  EVERY_5_MIN:  "*/5 * * * *",
  EVERY_15_MIN: "*/15 * * * *",
  EVERY_HOUR:   "0 * * * *",
  DAILY_8AM:    "0 13 * * *",  // 08:00 Lima (UTC-5) = 13:00 UTC
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────────────────────────────────────────

// Registros globales para graceful shutdown
const allWorkers: Worker[] = [];
const allQueues:  Queue[]  = [];

async function bootstrap() {
  logger.info("Worker", "=== Podoplus Worker iniciando ===");
  logger.info("Worker", `Entorno: ${process.env.NODE_ENV || "development"}`);
  logger.info("Worker", `Redis: ${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || "6379"}`);

  try {
    await prisma.$connect();
    logger.info("Worker", "✓ Conectado a PostgreSQL");
  } catch (err) {
    logger.error("Worker", "No se pudo conectar a PostgreSQL", err);
    process.exit(1);
  }

  // ── 1. MARCAR NO-SHOWS (cada 15 minutos) ──────────────────────────────────
  const noShowsQueue = new Queue(QUEUES.NO_SHOWS, { connection: redisConnection });
  await noShowsQueue.add("mark", {}, {
    repeat: { pattern: CRONS.EVERY_15_MIN },
    removeOnComplete: { count: 10 },
    removeOnFail:     { count: 20 },
  });
  const noShowsWorker = new Worker(QUEUES.NO_SHOWS, async (_job: Job) => markNoShows(prisma), {
    connection: redisConnection,
    concurrency: 1,
  });
  allQueues.push(noShowsQueue);
  allWorkers.push(noShowsWorker);
  logger.info("Worker", `✓ Job registrado: mark-no-shows [${CRONS.EVERY_15_MIN}]`);

  // ── 2. EXPIRAR SUSCRIPCIONES (cada hora) ──────────────────────────────────
  const subsQueue = new Queue(QUEUES.EXPIRE_SUBS, { connection: redisConnection });
  await subsQueue.add("expire", {}, {
    repeat: { pattern: CRONS.EVERY_HOUR },
    removeOnComplete: { count: 10 },
    removeOnFail:     { count: 20 },
  });
  const subsWorker = new Worker(QUEUES.EXPIRE_SUBS, async (_job: Job) => expireSubscriptions(prisma), {
    connection: redisConnection,
    concurrency: 1,
  });
  allQueues.push(subsQueue);
  allWorkers.push(subsWorker);
  logger.info("Worker", `✓ Job registrado: expire-subscriptions [${CRONS.EVERY_HOUR}]`);

  // ── 3. RECORDATORIOS DE CITAS (08:00 Lima diario) ─────────────────────────
  const remindersQueue = new Queue(QUEUES.REMINDERS, { connection: redisConnection });
  await remindersQueue.add("remind", {}, {
    repeat: { pattern: CRONS.DAILY_8AM },
    removeOnComplete: { count: 10 },
    removeOnFail:     { count: 20 },
  });
  const remindersWorker = new Worker(
    QUEUES.REMINDERS,
    async (_job: Job) => sendAppointmentReminders(prisma),
    { connection: redisConnection, concurrency: 1 },
  );
  allQueues.push(remindersQueue);
  allWorkers.push(remindersWorker);
  logger.info("Worker", `✓ Job registrado: appointment-reminders [${CRONS.DAILY_8AM}]`);

  // ── 4. ALERTAS DE CITAS PRÓXIMAS (cada 5 minutos) ────────────────────────
  const upcomingAlertsQueue = new Queue(QUEUES.UPCOMING_ALERTS, { connection: redisConnection });
  await upcomingAlertsQueue.add("alert", {}, {
    repeat:           { pattern: CRONS.EVERY_5_MIN },
    removeOnComplete: { count: 10 },
    removeOnFail:     { count: 20 },
  });
  const upcomingAlertsWorker = new Worker(
    QUEUES.UPCOMING_ALERTS,
    async (_job: Job) => sendUpcomingAppointmentAlerts(prisma),
    { connection: redisConnection, concurrency: 1 },
  );
  allQueues.push(upcomingAlertsQueue);
  allWorkers.push(upcomingAlertsWorker);
  logger.info("Worker", `✓ Job registrado: upcoming-appointment-alerts [${CRONS.EVERY_5_MIN}]`);

  // ── 5. AUDIT LOG (publicado por la API) ────────────────────────────────────
  // Los reintentos (attempts/backoff) se configuran en QueuePublisherService
  // al publicar cada job — no son opción de WorkerOptions.
  const auditWorker = new Worker(
    QUEUES.AUDIT_LOG,
    async (job: Job<AuditLogJobData>) => persistAuditLog(prisma, job.data),
    { connection: redisConnection, concurrency: 5 },
  );
  allWorkers.push(auditWorker);
  logger.info("Worker", "✓ Worker registrado: audit-log [concurrency: 5]");

  // ── 6. NOTIFICACIONES (publicadas por la API) ──────────────────────────────
  const notificationsWorker = new Worker(
    QUEUES.NOTIFICATIONS,
    async (job: Job<NotificationJobData>) => sendNotification(prisma, job.data),
    { connection: redisConnection, concurrency: 5 },
  );
  allWorkers.push(notificationsWorker);
  logger.info("Worker", "✓ Worker registrado: notifications [concurrency: 5]");

  // ── Ejecutar jobs críticos inmediatamente al arrancar ──────────────────────
  logger.info("Worker", "Ejecutando jobs de arranque...");
  await Promise.allSettled([
    expireSubscriptions(prisma),
    markNoShows(prisma),
  ]);

  logger.info("Worker", "=== Worker listo y escuchando jobs ===\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────────────────────────────────────

async function shutdown() {
  logger.info("Worker", "Señal de apagado recibida. Cerrando workers y colas...");

  // 1. Pausar workers para que no tomen nuevos jobs
  await Promise.allSettled(allWorkers.map((w) => w.pause()));

  // 2. Esperar a que terminen los jobs en curso (máx 30s) y cerrar
  await Promise.allSettled(allWorkers.map((w) => w.close()));

  // 3. Cerrar conexiones de Queue
  await Promise.allSettled(allQueues.map((q) => q.close()));

  // 4. Desconectar Prisma
  await prisma.$disconnect();

  logger.info("Worker", "✓ Worker detenido correctamente");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT",  shutdown);

bootstrap().catch((err) => {
  logger.error("Worker", "Error fatal en bootstrap", err);
  process.exit(1);
});

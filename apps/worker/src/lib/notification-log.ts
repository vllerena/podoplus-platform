import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { logger } from "./logger";

export interface NotificationJobData {
  userId: string;
  type: string;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
}

const DEFAULT_NOTIFICATION_LOG_PATH = process.env.NOTIFICATION_LOG_PATH
  ? resolve(process.cwd(), process.env.NOTIFICATION_LOG_PATH)
  : resolve(process.cwd(), "logs/notifications.jsonl");

export async function logNotification(
  data: NotificationJobData,
): Promise<void> {
  try {
    const logDir = dirname(DEFAULT_NOTIFICATION_LOG_PATH);
    await fs.mkdir(logDir, { recursive: true });

    const record = JSON.stringify({
      ...data,
      loggedAt: new Date().toISOString(),
    });

    await fs.appendFile(DEFAULT_NOTIFICATION_LOG_PATH, `${record}\n`, "utf8");
    logger.info(
      "Notifications",
      `[notification:${data.type}] registro interno guardado en ${DEFAULT_NOTIFICATION_LOG_PATH}`,
    );
  } catch (error) {
    logger.warn(
      "Notifications",
      `No se pudo escribir el registro de notificación interno: ${(error as Error).message}`,
    );
  }
}

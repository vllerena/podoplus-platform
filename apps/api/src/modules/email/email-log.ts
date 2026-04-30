import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { Logger } from "@nestjs/common";

const logger = new Logger("EmailLog");

export interface EmailLogEntry {
  to: string | string[];
  from: string;
  subject: string;
  text?: string;
  html?: string;
  status: "SENT" | "LOGGED" | "FAILED";
  messageId?: string;
  errorMessage?: string;
  createdAt: string;
}

const DEFAULT_EMAIL_LOG_PATH = process.env.EMAIL_LOG_PATH
  ? resolve(process.cwd(), process.env.EMAIL_LOG_PATH)
  : resolve(process.cwd(), "logs/email.jsonl");

export async function writeEmailLog(entry: EmailLogEntry): Promise<void> {
  try {
    const dir = dirname(DEFAULT_EMAIL_LOG_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(
      DEFAULT_EMAIL_LOG_PATH,
      `${JSON.stringify(entry)}\n`,
      "utf8",
    );
    logger.log(`Email log escrito en ${DEFAULT_EMAIL_LOG_PATH}`);
  } catch (error) {
    logger.warn(
      `No se pudo escribir el registro de email: ${(error as Error).message}`,
    );
  }
}

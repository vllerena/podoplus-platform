import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { Logger } from "@nestjs/common";

const logger = new Logger("SunatSyncLog");

export interface SunatSyncLogEntry {
  event: "SUNAT_DOCUMENT_SYNC";
  saleId: string;
  docType: "01" | "03";
  serie: string;
  requestPayload: any;
  responsePayload: any;
  createdAt: string;
}

const DEFAULT_SUNAT_SYNC_LOG_PATH = process.env.SUNAT_SYNC_LOG_PATH
  ? resolve(process.cwd(), process.env.SUNAT_SYNC_LOG_PATH)
  : resolve(process.cwd(), "logs/sunat-sync.jsonl");

export async function writeSunatSyncLog(
  entry: SunatSyncLogEntry,
): Promise<void> {
  try {
    const logDir = dirname(DEFAULT_SUNAT_SYNC_LOG_PATH);
    await fs.mkdir(logDir, { recursive: true });
    await fs.appendFile(
      DEFAULT_SUNAT_SYNC_LOG_PATH,
      `${JSON.stringify(entry)}\n`,
      "utf8",
    );
    logger.log(`Registro SUNAT escrito en ${DEFAULT_SUNAT_SYNC_LOG_PATH}`);
  } catch (error) {
    logger.warn(
      `No se pudo escribir el registro SUNAT: ${(error as Error).message}`,
    );
  }
}

import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import { resolve, dirname } from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SunatLogEntry {
  timestamp: string;
  saleId: string;
  branchId: string;
  documentType: "01" | "03";
  documentNumber: string;
  requestPayload: Record<string, unknown>;
  simulatedResponse: Record<string, unknown>;
  status: "SIMULATED" | "SENT" | "ERROR";
  errorMessage?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class SunatLogService {
  private readonly logger = new Logger("SunatLogService");

  private readonly logPath: string = process.env.SUNAT_LOG_PATH
    ? resolve(process.cwd(), process.env.SUNAT_LOG_PATH)
    : resolve(process.cwd(), "logs/sunat.jsonl");

  /**
   * Appends a single JSON line to logs/sunat.jsonl and emits a NestJS log.
   * Creates the logs/ directory if it does not already exist.
   * All I/O errors are caught and logged as warnings — they must never
   * propagate to the caller.
   */
  logRequest(entry: SunatLogEntry): void {
    try {
      const dir = dirname(this.logPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(this.logPath, `${JSON.stringify(entry)}\n`, "utf8");

      this.logger.log(
        `[SUNAT] saleId=${entry.saleId} branchId=${entry.branchId} ` +
          `docType=${entry.documentType} docNumber=${entry.documentNumber} ` +
          `status=${entry.status}`,
      );
    } catch (err: unknown) {
      this.logger.warn(
        `[SunatLogService] No se pudo escribir en ${this.logPath}: ${(err as Error).message}`,
      );
    }
  }
}

import { Injectable, Logger, Optional } from "@nestjs/common";
import * as fs from "fs";
import { resolve, dirname } from "path";
import { PrismaService } from "../prisma/prisma.service";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WhatsappLogEntry {
  timestamp: string;
  recipientPhone: string;
  messageType: "TEXT" | "TEMPLATE";
  templateName?: string;
  variables?: Record<string, string>;
  messageBody: string;
  status: "SIMULATED" | "SENT" | "FAILED";
  whatsappMessageId?: string;
  errorMessage?: string;
  customerId?: string;
  appointmentId?: string;
  /** branchId is required when persisting to WhatsappMessageLog (Prisma model). */
  branchId?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class WhatsappLogService {
  private readonly logger = new Logger("WhatsappLogService");

  private readonly logPath: string = process.env.WHATSAPP_LOG_PATH
    ? resolve(process.cwd(), process.env.WHATSAPP_LOG_PATH)
    : resolve(process.cwd(), "logs/whatsapp.jsonl");

  constructor(
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  // ─────────────────────────────────────────────────────────────────
  // CORE LOG METHOD
  // ─────────────────────────────────────────────────────────────────

  /**
   * Appends one JSON line to logs/whatsapp.jsonl, emits a NestJS log, and
   * optionally persists to the WhatsappMessageLog Prisma model when branchId
   * is present and Prisma is available.
   *
   * All errors are caught internally — this method must never throw.
   */
  logMessage(entry: WhatsappLogEntry): void {
    // 1. File log (synchronous append — best-effort)
    try {
      const dir = dirname(this.logPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(this.logPath, `${JSON.stringify(entry)}\n`, "utf8");
    } catch (err: unknown) {
      this.logger.warn(
        `[WhatsappLogService] No se pudo escribir en ${this.logPath}: ${(err as Error).message}`,
      );
    }

    // 2. NestJS structured log
    this.logger.log(
      `[WhatsApp] phone=${entry.recipientPhone} type=${entry.messageType} ` +
        (entry.templateName ? `template=${entry.templateName} ` : "") +
        `status=${entry.status}` +
        (entry.customerId ? ` customerId=${entry.customerId}` : "") +
        (entry.appointmentId ? ` appointmentId=${entry.appointmentId}` : ""),
    );

    // 3. Prisma persistence — fire-and-forget, only when branchId is available
    if (this.prisma && entry.branchId) {
      this.persistToDB(entry).catch((err: unknown) => {
        this.logger.warn(
          `[WhatsappLogService] No se pudo persistir en DB: ${(err as Error).message}`,
        );
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // APPOINTMENT REMINDER
  // ─────────────────────────────────────────────────────────────────

  /**
   * Builds a structured WhatsApp reminder entry and calls logMessage().
   * Status is always SIMULATED until the real API integration is wired.
   */
  sendAppointmentReminder(
    phone: string,
    customerName: string,
    appointmentDate: string,
    serviceName: string,
    branchName: string,
    options?: {
      customerId?: string;
      appointmentId?: string;
      branchId?: string;
    },
  ): void {
    const templateName = "appointment_reminder";
    const variables: Record<string, string> = {
      "1": customerName,
      "2": appointmentDate,
      "3": serviceName,
      "4": branchName,
    };

    const messageBody =
      `Hola ${customerName}, te recordamos que tienes una cita el ${appointmentDate} ` +
      `para ${serviceName} en ${branchName}. ¡Te esperamos!`;

    const entry: WhatsappLogEntry = {
      timestamp: new Date().toISOString(),
      recipientPhone: phone,
      messageType: "TEMPLATE",
      templateName,
      variables,
      messageBody,
      status: "SIMULATED",
      customerId: options?.customerId,
      appointmentId: options?.appointmentId,
      branchId: options?.branchId,
    };

    this.logMessage(entry);
  }

  // ─────────────────────────────────────────────────────────────────
  // APPOINTMENT CONFIRMATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Builds a structured WhatsApp confirmation entry and calls logMessage().
   * Status is always SIMULATED until the real API integration is wired.
   */
  sendAppointmentConfirmation(
    phone: string,
    customerName: string,
    appointmentDate: string,
    serviceName: string,
    branchName: string,
    options?: {
      customerId?: string;
      appointmentId?: string;
      branchId?: string;
    },
  ): void {
    const templateName = "appointment_confirmation";
    const variables: Record<string, string> = {
      "1": customerName,
      "2": appointmentDate,
      "3": serviceName,
      "4": branchName,
    };

    const messageBody =
      `Hola ${customerName}, tu cita para ${serviceName} el ${appointmentDate} ` +
      `en ${branchName} ha sido confirmada. Si necesitas cambiarla, ` +
      `contáctanos con anticipación.`;

    const entry: WhatsappLogEntry = {
      timestamp: new Date().toISOString(),
      recipientPhone: phone,
      messageType: "TEMPLATE",
      templateName,
      variables,
      messageBody,
      status: "SIMULATED",
      customerId: options?.customerId,
      appointmentId: options?.appointmentId,
      branchId: options?.branchId,
    };

    this.logMessage(entry);
  }

  // ─────────────────────────────────────────────────────────────────
  // INTERNAL: persist to WhatsappMessageLog
  // ─────────────────────────────────────────────────────────────────

  private async persistToDB(entry: WhatsappLogEntry): Promise<void> {
    if (!this.prisma || !entry.branchId) return;

    // Map simulation status to Prisma enum values
    const dbStatus =
      entry.status === "SIMULATED"
        ? "QUEUED"
        : entry.status === "SENT"
          ? "SENT"
          : "FAILED";

    await this.prisma.whatsappMessageLog.create({
      data: {
        branch: { connect: { id: entry.branchId } },
        ...(entry.customerId && {
          customer: { connect: { id: entry.customerId } },
        }),
        ...(entry.appointmentId && {
          appointment: { connect: { id: entry.appointmentId } },
        }),
        toPhone: entry.recipientPhone,
        messageType: entry.messageType,
        payloadJson: {
          templateName: entry.templateName ?? null,
          variables: entry.variables ?? null,
          messageBody: entry.messageBody,
          simulatedAt: entry.timestamp,
        },
        status: dbStatus,
        providerMessageId: entry.whatsappMessageId ?? null,
        errorMessage: entry.errorMessage ?? null,
      },
    });
  }
}

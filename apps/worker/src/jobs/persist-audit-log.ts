import { PrismaClient } from "@prisma/client";
import { logger } from "../lib/logger";

export interface AuditLogJobData {
  actorType: "USER" | "SYSTEM";
  actorId?: string;
  branchId?: string;
  action: string;
  entityType: string;
  entityId: string;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Persiste una entrada de audit log publicada por la API.
 * Se ejecuta en el Worker para desacoplar la escritura del ciclo request/response.
 */
export async function persistAuditLog(
  prisma: PrismaClient,
  data: AuditLogJobData
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorType:    data.actorType,
      actorId:      data.actorId   ?? null,
      branchId:     data.branchId  ?? null,
      action:       data.action,
      entityType:   data.entityType,
      entityId:     data.entityId,
      reason:       data.reason    ?? null,
      metadataJson: data.metadata  ?? undefined,
    },
  });

  logger.info("AuditLog", `[audit] ${data.action} → ${data.entityType}/${data.entityId}`);
}

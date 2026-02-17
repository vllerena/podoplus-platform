import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { Redis } from "ioredis";
import { InjectRedis } from "@nestjs-modules/ioredis";
import { PrismaService } from "../prisma/prisma.service";
import { formatDateOnly, formatTimeOnly } from "../../utils/timezone";

@Injectable()
export class HoldsService {
  private readonly logger = new Logger("HoldsService");

  constructor(
    @InjectRedis() private redis: Redis,
    private prisma: PrismaService
  ) {}

  /**
   * Crea un nuevo hold (bloqueo temporal de slot)
   * startAt y endAt ya vienen como Date objects en formato correcto
   */
  async createHold(
    branchId: string,
    serviceId: string,
    startAt: Date,
    endAt: Date,
    holderType: "USER" | "CUSTOMER",
    holderId: string,
    createdBy: string
  ): Promise<{
    hold_id: string;
    branch_id: string;
    service_id: string;
    start_at: string;
    end_at: string;
    expires_at: string;
  }> {
    // Validar que startAt < endAt
    if (startAt >= endAt) {
      throw new BadRequestException("startAt debe ser menor que endAt");
    }

    // Crear ID único para el hold
    const holdId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // TTL: 90 segundos
    const ttlSeconds = 90;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    // Payload del hold en Redis
    const holdPayload = {
      hold_id: holdId,
      branch_id: branchId,
      service_id: serviceId,
      start_at: startAt.toISOString(), // Almacenar como ISO string
      end_at: endAt.toISOString(),
      holder_type: holderType,
      holder_id: holderId,
      created_by: createdBy,
      created_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    // Guardar en Redis con TTL
    const key = `hold:${holdId}`;
    await this.redis.setex(key, ttlSeconds, JSON.stringify(holdPayload));

    this.logger.log(`Hold creado: ${holdId} (TTL: ${ttlSeconds}s)`);

    return {
      hold_id: holdId,
      branch_id: branchId,
      service_id: serviceId,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    };
  }

  /**
   * Obtiene un hold por ID
   */
  async getHold(holdId: string): Promise<any | null> {
    const key = `hold:${holdId}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  /**
   * Valida que un hold sea válido y corresponda a un horario
   */
  async validateHold(
    holdId: string,
    branchId: string,
    serviceId: string,
    startAt: Date,
    endAt: Date
  ): Promise<boolean> {
    const hold = await this.getHold(holdId);

    if (!hold) {
      throw new BadRequestException("Hold no encontrado o expirado");
    }

    // Validar que los datos coincidan exactamente
    const holdStartAt = new Date(hold.start_at);
    const holdEndAt = new Date(hold.end_at);

    // Comparar con tolerancia de 1 segundo para evitar problemas de precisión
    const timeDiffStart = Math.abs(holdStartAt.getTime() - startAt.getTime());
    const timeDiffEnd = Math.abs(holdEndAt.getTime() - endAt.getTime());
    const tolerance = 1000; // 1 segundo

    if (hold.branch_id !== branchId) {
      throw new BadRequestException(
        `Hold corresponde a otra sede. Hold: ${hold.branch_id}, Enviado: ${branchId}`
      );
    }

    if (hold.service_id !== serviceId) {
      throw new BadRequestException(
        `Hold corresponde a otro servicio. Hold: ${hold.service_id}, Enviado: ${serviceId}`
      );
    }

    if (timeDiffStart > tolerance) {
      throw new BadRequestException(
        `Hold no corresponde a este horario. Hold: ${hold.start_at}, Enviado: ${startAt.toISOString()}`
      );
    }

    if (timeDiffEnd > tolerance) {
      throw new BadRequestException(
        `Hold no corresponde a este horario. Hold: ${hold.end_at}, Enviado: ${endAt.toISOString()}`
      );
    }

    return true;
  }

  /**
   * Renueva un hold (extiende TTL)
   * Máximo 180 segundos (3 minutos) desde creación
   */
  async renewHold(holdId: string): Promise<any> {
    const hold = await this.getHold(holdId);

    if (!hold) {
      throw new BadRequestException("Hold no encontrado o expirado");
    }

    // Validar que no supere 180 segundos total
    const createdAt = new Date(hold.created_at);
    const now = new Date();
    const elapsedSeconds = (now.getTime() - createdAt.getTime()) / 1000;
    const maxTotalSeconds = 180;

    if (elapsedSeconds > maxTotalSeconds - 90) {
      throw new BadRequestException(
        `Hold ha excedido el tiempo máximo permitido (3 minutos). Intenta de nuevo.`
      );
    }

    // Renovar TTL
    const ttlSeconds = 90;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    hold.expires_at = expiresAt.toISOString();

    const key = `hold:${holdId}`;
    await this.redis.setex(key, ttlSeconds, JSON.stringify(hold));

    this.logger.log(`Hold renovado: ${holdId}`);

    return {
      hold_id: holdId,
      expires_at: expiresAt.toISOString(),
    };
  }

  /**
   * Libera un hold (lo elimina de Redis)
   */
  async releaseHold(holdId: string): Promise<void> {
    const key = `hold:${holdId}`;
    await this.redis.del(key);
    this.logger.log(`Hold liberado: ${holdId}`);
  }

  /**
   * Obtiene holds activos en un rango de fechas
   */
  async getHoldsForRange(
    branchId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<any[]> {
    // Obtener todas las claves de hold
    const keys = await this.redis.keys("hold:*");

    const holds: any[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const hold = JSON.parse(data);

        // Filtrar por rama y rango de fechas
        if (hold.branch_id === branchId) {
          const holdStart = new Date(hold.start_at);
          const holdEnd = new Date(hold.end_at);

          // Verificar si el hold se superpone con el rango
          if (holdStart <= toDate && holdEnd >= fromDate) {
            holds.push(hold);
          }
        }
      }
    }

    return holds;
  }

  /**
   * Helper: obtener duración de servicio
   */
  async getServiceDuration(serviceId: string): Promise<any> {
    return this.prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        durationMinutes: true,
        bufferMinutes: true,
      },
    });
  }
}

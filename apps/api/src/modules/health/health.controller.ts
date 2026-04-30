import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { PrismaHealthIndicator } from "./indicators/prisma.health";
import { RedisHealthIndicator } from "./indicators/redis.health";

/**
 * Health endpoints — sin autenticación, usados por load balancers y orquestadores.
 *
 * GET /health      → Readiness check (DB + Redis). El load balancer envía tráfico
 *                    solo cuando este endpoint devuelve 200.
 * GET /health/live → Liveness check (solo verifica que el proceso responde).
 *                    Si falla, el orquestador reinicia el contenedor.
 */
@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator
  ) {}

  @ApiOperation({ summary: "Readiness check: verifica DB y Redis" })
  @ApiResponse({ status: 200, description: "API operativa" })
  @ApiResponse({ status: 503, description: "Servicio no disponible (DB o Redis caídos)" })
  @Get()
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.prismaIndicator.isHealthy("database"),
      () => this.redisIndicator.isHealthy("redis"),
    ]);
  }

  @ApiOperation({ summary: "Liveness check: verifica que el proceso responde" })
  @ApiResponse({ status: 200, description: "API operativa" })
  @Get("live")
  live() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}

import { Injectable } from "@nestjs/common";
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from "@nestjs/terminus";
import { InjectRedis } from "@nestjs-modules/ioredis";
import { Redis } from "ioredis";

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@InjectRedis() private readonly redis: Redis) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const reply = await this.redis.ping();
      const isHealthy = reply === "PONG";
      if (!isHealthy) {
        throw new Error(`Unexpected PING reply: ${reply}`);
      }
      return this.getStatus(key, true);
    } catch (error: any) {
      throw new HealthCheckError(
        "Redis health check failed",
        this.getStatus(key, false, { error: error.message })
      );
    }
  }
}

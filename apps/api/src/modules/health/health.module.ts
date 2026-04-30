import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./health.controller";
import { PrismaHealthIndicator } from "./indicators/prisma.health";
import { RedisHealthIndicator } from "./indicators/redis.health";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [
    TerminusModule,
    PrismaModule, // provides PrismaService for PrismaHealthIndicator
    // RedisModule is global (registered in AppModule via @nestjs-modules/ioredis)
    // so @InjectRedis() works in RedisHealthIndicator without importing it here
  ],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}

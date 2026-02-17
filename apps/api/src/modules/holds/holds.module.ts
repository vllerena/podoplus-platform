import { Module } from "@nestjs/common";
import { RedisModule } from "@nestjs-modules/ioredis";
import { HoldsService } from "./holds.service";
import { HoldsController } from "./holds.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [RedisModule, PrismaModule, AuthModule, RealtimeModule],
  providers: [HoldsService],
  exports: [HoldsService],
  controllers: [HoldsController],
})
export class HoldsModule {}

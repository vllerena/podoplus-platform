import { Module } from "@nestjs/common";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeService } from "./realtime.service";
import { RealtimeController } from "./realtime.controller";

@Module({
  imports: [],
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeService],
  controllers: [RealtimeController],
})
export class RealtimeModule {}

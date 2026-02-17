import { Controller, Get, UseGuards, Logger } from "@nestjs/common";
import { RealtimeService } from "./realtime.service";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { Public } from "../auth/decorators/public.decorator";

@Controller("v1/realtime")
export class RealtimeController {
  private readonly logger = new Logger("RealtimeController");

  constructor(private realtimeService: RealtimeService) {}

  @Get("stats")
  @Public()
  getStats() {
    return this.realtimeService.getConnectionStats();
  }
}

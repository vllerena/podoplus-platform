import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeService } from "./realtime.service";
import { RealtimeController } from "./realtime.controller";
import { RbacModule } from "../rbac/rbac.module";

@Module({
  imports: [
    RbacModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) =>
        ({
          secret: configService.get<string>("JWT_SECRET"),
          signOptions: {
            expiresIn: configService.get<string>("JWT_EXPIRATION") || "24h",
          },
        }) as any,
      inject: [ConfigService],
    }),
  ],
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeService],
  controllers: [RealtimeController],
})
export class RealtimeModule {}

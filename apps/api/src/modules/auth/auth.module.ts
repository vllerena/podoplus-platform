import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { RefreshTokenStrategy } from "./strategies/refresh-token.strategy";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { EmailModule } from "../email/email.module";
import { RbacModule } from "../rbac/rbac.module";
import { ExtractUserMiddleware } from "./middleware/extract-user.middleware";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    EmailModule,
    RbacModule,
    PassportModule,
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
  providers: [AuthService, JwtStrategy, RefreshTokenStrategy],
  controllers: [AuthController],
  exports: [
    AuthService,
    JwtModule,
    PassportModule,
    JwtStrategy,
    RefreshTokenStrategy,
  ],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ExtractUserMiddleware).forRoutes("*"); // Aplicar a todas las rutas
  }
}

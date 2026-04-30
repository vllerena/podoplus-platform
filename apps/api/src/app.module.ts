import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { RedisModule } from "@nestjs-modules/ioredis";
import { LoggerModule } from "nestjs-pino";
import { randomUUID } from "crypto";
import * as Joi from "joi";

import { PrismaModule } from "./modules/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { BusinessUnitsModule } from "./modules/business-units/business-units.module";
import { BranchesModule } from "./modules/branches/branches.module";
import { ServicesModule } from "./modules/services/services.module";
import { ScheduleModule } from "./modules/schedule/schedule.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { AvailabilityModule } from "./modules/availability/availability.module";
import { HoldsModule } from "./modules/holds/holds.module";
import { AppointmentsModule } from "./modules/appointments/appointments.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { SalesModule } from "./modules/sales/sales.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { PlansModule } from "./modules/plans/plans.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { AuditModule } from "./modules/audit/audit.module";
import { CashRegisterModule } from "./modules/cash-register/cash-register.module";
import { UsersModule } from "./modules/users/users.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { HealthModule } from "./modules/health/health.module";
import { CacheModule } from "./modules/cache/cache.module";
import { QueueModule } from "./modules/queue/queue.module";
import { WhatsappModule } from "./modules/whatsapp/whatsapp.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";
import { LookupModule } from "./modules/lookup/lookup.module";
// Rate limiting eliminado: sistema multi-sede con 20+ usuarios concurrentes
// — el throttling por IP no aplica a paneles de administración internos.

@Module({
  imports: [
    // ── Configuration ────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid("development", "staging", "production")
          .default("development"),
        API_PORT: Joi.number().default(3000),
        API_HOST: Joi.string().default("localhost"),
        TIMEZONE: Joi.string().default("America/Lima"),
        CORS_ORIGIN: Joi.string().default("http://localhost:5173"),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRATION: Joi.string().default("24h"),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_EXPIRATION: Joi.string().default("7d"),
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().optional(),
        REDIS_HOST: Joi.string().default("localhost"),
        REDIS_PORT: Joi.number().default(6379),
        FRONTEND_URL: Joi.string().optional().allow(""),
        // ── Email: proveedor genérico SMTP ─────────────────────────────────
        MAIL_PROVIDER: Joi.string().valid("smtp", "mailtrap").default("smtp"),
        MAIL_HOST:     Joi.string().optional().allow(""),
        MAIL_PORT:     Joi.number().optional(),
        MAIL_USER:     Joi.string().optional().allow(""),
        MAIL_PASS:     Joi.string().optional().allow(""),
        MAIL_FROM:     Joi.string().email().optional().default("no-reply@podoplus.pe"),
        MAIL_SECURE:   Joi.boolean().default(false),
        MAIL_TLS:      Joi.boolean().default(false),
        // ── Email: Mailtrap Sandbox (MAIL_PROVIDER=mailtrap) ───────────────
        MAILTRAP_USER: Joi.string().optional().allow(""),
        MAILTRAP_PASS: Joi.string().optional().allow(""),
        LOG_LEVEL: Joi.string()
          .valid("fatal", "error", "warn", "info", "debug", "trace")
          .default("info"),
        WHATSAPP_BUSINESS_ACCOUNT_ID: Joi.string().optional().allow(""),
        WHATSAPP_PHONE_NUMBER_ID: Joi.string().optional().allow(""),
        WHATSAPP_ACCESS_TOKEN: Joi.string().optional().allow(""),
        WHATSAPP_WEBHOOK_TOKEN: Joi.string().optional().allow(""),
      }),
      validationOptions: { abortEarly: false },
    }),

    // ── Structured logging (Pino) ─────────────────────────────────────────────
    //
    // • En development: pino-pretty con colores y timestamps legibles.
    // • En production: JSON puro — ingestable por Datadog / CloudWatch / Loki.
    // • Correlation ID: genera o propaga X-Request-ID en cada request y lo
    //   incluye automáticamente en todos los logs del ciclo de vida del request.
    // • Redacta campos sensibles antes de escribir el log.
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>("NODE_ENV", "development");
        const logLevel = configService.get<string>(
          "LOG_LEVEL",
          nodeEnv === "production" ? "info" : "debug",
        );
        const isProd = nodeEnv === "production";

        return {
          pinoHttp: {
            // ── Correlation ID ──────────────────────────────────────────────
            genReqId: (req: any, res: any) => {
              const incoming = req.headers["x-request-id"];
              if (incoming) {
                res.setHeader("X-Request-ID", incoming);
                return incoming;
              }
              const id = randomUUID();
              res.setHeader("X-Request-ID", id);
              return id;
            },

            // ── Log level ───────────────────────────────────────────────────
            level: logLevel,

            // ── Redact sensitive fields ─────────────────────────────────────
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "req.body.password",
                "req.body.confirmPassword",
                "req.body.refresh_token",
                "req.body.currentPassword",
                "req.body.newPassword",
              ],
              remove: true,
            },

            // ── Serializers ─────────────────────────────────────────────────
            serializers: {
              req: (req: any) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                remoteAddress: req.remoteAddress,
              }),
              res: (res: any) => ({
                statusCode: res.statusCode,
              }),
            },

            // ── Development: pretty-print ───────────────────────────────────
            ...(isProd
              ? {}
              : {
                  transport: {
                    target: "pino-pretty",
                    options: {
                      colorize: true,
                      singleLine: false,
                      translateTime: "SYS:HH:MM:ss.l",
                      ignore: "pid,hostname",
                      messageKey: "msg",
                    },
                  },
                }),
          },
        };
      },
    }),

    // ── Redis ────────────────────────────────────────────────────────────────
    // forRootAsync garantiza que la configuración se resuelve después de que
    // Joi valide las variables de entorno (en lugar de leer process.env directo).
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        config: {
          host: configService.get<string>("REDIS_HOST", "localhost"),
          port: configService.get<number>("REDIS_PORT", 6379),
          db: 0,
        },
      }),
    }),

    // ── Infrastructure: cache + queue (global — disponibles en todos los módulos) ─
    CacheModule,
    QueueModule,

    // ── Feature modules ──────────────────────────────────────────────────────
    PrismaModule,
    AuthModule,
    RbacModule,
    BusinessUnitsModule,
    BranchesModule,
    ScheduleModule,
    ServicesModule,
    CustomersModule,
    AvailabilityModule,
    HoldsModule,
    AppointmentsModule,
    RealtimeModule,
    SalesModule,
    InventoryModule,
    PlansModule,
    ReportsModule,
    AuditModule,
    CashRegisterModule,
    UsersModule,
    NotificationsModule,
    HealthModule,
    WhatsappModule,
    IntegrationsModule,
    LookupModule,
  ],
  providers: [],
})
export class AppModule {}

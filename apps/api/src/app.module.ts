import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RedisModule } from "@nestjs-modules/ioredis";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { BranchesModule } from "./modules/branches/branches.module";
import { ServicesModule } from "./modules/services/services.module";
import { ScheduleModule } from "./modules/schedule/schedule.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { AvailabilityModule } from "./modules/availability/availability.module";
import { HoldsModule } from "./modules/holds/holds.module";
import { AppointmentsModule } from "./modules/appointments/appointments.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import * as Joi from "joi";

@Module({
  imports: [
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
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION: Joi.string().default("24h"),
        JWT_REFRESH_SECRET: Joi.string().required(),
        JWT_REFRESH_EXPIRATION: Joi.string().default("7d"),
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().optional(),
        REDIS_HOST: Joi.string().default("localhost"),
        REDIS_PORT: Joi.number().default(6379),
        WHATSAPP_BUSINESS_ACCOUNT_ID: Joi.string().optional().allow(""),
        WHATSAPP_PHONE_NUMBER_ID: Joi.string().optional().allow(""),
        WHATSAPP_ACCESS_TOKEN: Joi.string().optional().allow(""),
        WHATSAPP_WEBHOOK_TOKEN: Joi.string().optional().allow(""),
      }),
      validationOptions: {
        abortEarly: false,
      },
    }),
    RedisModule.forRoot({
      config: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
        db: 0,
      },
    }),
    PrismaModule,
    AuthModule,
    RbacModule,
    BranchesModule,
    ScheduleModule,
    ServicesModule,
    CustomersModule,
    AvailabilityModule,
    HoldsModule,
    AppointmentsModule,
    RealtimeModule,
  ],
})
export class AppModule {}

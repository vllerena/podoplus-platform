import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'staging', 'production')
          .default('development'),
        API_PORT: Joi.number().default(3000),
        API_HOST: Joi.string().default('localhost'),
        TIMEZONE: Joi.string().default('America/Lima'),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION: Joi.string().default('24h'),
        JWT_REFRESH_SECRET: Joi.string().required(),
        JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        WHATSAPP_BUSINESS_ACCOUNT_ID: Joi.string().optional().allow(''),
        WHATSAPP_PHONE_NUMBER_ID: Joi.string().optional().allow(''),
        WHATSAPP_ACCESS_TOKEN: Joi.string().optional().allow(''),
        WHATSAPP_WEBHOOK_TOKEN: Joi.string().optional().allow(''),
      }),
      validationOptions: {
        abortEarly: false,
      },
    }),
  ],
})
export class ConfigModule {}
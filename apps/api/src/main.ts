import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe, Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import { IoAdapter } from "@nestjs/platform-socket.io";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");

  // Habilitar CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Configurar Socket.IO adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // Validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  const configService = app.get<ConfigService>(ConfigService);

  const port = configService.get<number>("API_PORT") || 3000;
  const host = configService.get<string>("API_HOST") || "localhost";
  const nodeEnv = configService.get<string>("NODE_ENV") || "development";

  // ESCUCHAR EN EL PUERTO
  await app.listen(port, host);

  logger.log(`
╔════════════════════════════════════════════════════════════╗
║  🚀 Podoplus API Running                                   ║
╠════════════════════════════════════════════════════════════╣
║  Environment: ${nodeEnv.toUpperCase().padEnd(42)}║
║  Host: http://${host}:${port.toString().padEnd(45)}║
║  API: http://${host}:${port}/v1/auth/login${" ".padEnd(26)}║
║  WebSocket: ws://${host}:${port}/realtime${" ".padEnd(23)}║
╚════════════════════════════════════════════════════════════╝
  `);
}

bootstrap().catch((error: Error) => {
  console.error("❌ Error iniciando aplicación:", error);
  process.exit(1);
});

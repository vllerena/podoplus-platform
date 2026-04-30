import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import helmet from "helmet";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { writeFileSync } from "fs";
import { join } from "path";
import { AppModule } from "./app.module";
import { RedisIoAdapter } from "./redis-io.adapter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const configService = app.get<ConfigService>(ConfigService);
  const port       = configService.get<number>("API_PORT", 3000);
  const host       = configService.get<string>("API_HOST", "localhost");
  const corsOrigin = configService.get<string>("CORS_ORIGIN", "http://localhost:5173");
  const isProd     = configService.get<string>("NODE_ENV") === "production";

  // ── Helmet — HTTP security headers ──────────────────────────────────────────
  //
  // En development: CSP desactivado para que Swagger UI pueda cargar sus assets.
  // En production:  CSP completo activado.
  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? {
            directives: {
              defaultSrc:     ["'self'"],
              scriptSrc:      ["'self'"],
              styleSrc:       ["'self'", "'unsafe-inline'"],
              imgSrc:         ["'self'", "data:", "https:"],
              connectSrc:     ["'self'"],
              fontSrc:        ["'self'"],
              objectSrc:      ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false, // Necesario para Socket.IO y Swagger UI
    })
  );

  // ── CORS ────────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    exposedHeaders: ["X-Request-ID"],
  });

  // ── Socket.IO adapter (Redis pub/sub for multi-process support) ─────────────
  const redisHost = configService.get<string>("REDIS_HOST", "localhost");
  const redisPort = configService.get<number>("REDIS_PORT", 6379);
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(redisHost, redisPort);
  app.useWebSocketAdapter(redisIoAdapter);

  // ── Validación global de DTOs ────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  // ── Swagger / OpenAPI ────────────────────────────────────────────────────────
  //
  // Disponible en /api/docs (UI interactiva) y /api/docs-json (spec JSON).
  // En producción se desactiva la UI pero el JSON spec sigue disponible
  // para generación de clientes type-safe en el frontend.
  if (!isProd) {
    const config = new DocumentBuilder()
      .setTitle("Podoplus Platform API")
      .setDescription(
        "API REST del sistema de gestión Podoplus.\n\n" +
        "## Autenticación\n" +
        "La mayoría de endpoints requieren un **Bearer Token** JWT.\n" +
        "Obtén el token con `POST /v1/auth/login` y úsalo en el header:\n" +
        "`Authorization: Bearer <token>`\n\n" +
        "## Fechas\n" +
        "Todas las fechas se almacenan y devuelven en **UTC**.\n" +
        "El offset de Lima (UTC-5) se aplica internamente para el día actual.\n\n" +
        "## Paginación\n" +
        "Los listados grandes usan **cursor-based pagination**: pasa `cursor` con el " +
        "valor de `nextCursor` de la respuesta anterior para obtener la siguiente página."
      )
      .setVersion("1.0.0")
      .setContact("Podoplus Team", "https://podoplus.pe", "dev@podoplus.pe")
      .setLicense("Proprietary", "")
      .addBearerAuth(
        { type: "http", scheme: "bearer", bearerFormat: "JWT", in: "header" },
        "access-token"
      )
      .addTag("Auth",          "Autenticación, sesiones y gestión de contraseñas")
      .addTag("Users",         "Gestión de usuarios del sistema")
      .addTag("Branches",      "Sedes — configuración, horarios y bloques")
      .addTag("Services",      "Servicios ofrecidos y categorías")
      .addTag("Availability",  "Disponibilidad de slots por sede y servicio")
      .addTag("Appointments",  "Citas — creación, confirmación y ciclo de vida")
      .addTag("Holds",         "Reservas temporales de slots (Redis)")
      .addTag("Schedule",      "Horarios, bloques y excepciones de calendario")
      .addTag("Customers",     "Clientes — CRUD, familia, notas y etiquetas")
      .addTag("Sales",         "Ventas, anulaciones y reembolsos")
      .addTag("Plans",         "Planes y suscripciones de clientes")
      .addTag("Inventory",     "Stock, movimientos y productos")
      .addTag("Cash Register", "Cajas registradoras y movimientos de efectivo")
      .addTag("Reports",       "Reportes operacionales, financieros y de clientes")
      .addTag("Notifications", "Notificaciones internas de usuario")
      .addTag("Audit",         "Log de auditoría de acciones del sistema")
      .addTag("RBAC",          "Roles, permisos y control de acceso")
      .addTag("Realtime",      "Estadísticas de conexiones WebSocket")
      .addTag("Health",        "Estado del servicio")
      .build();

    const document = SwaggerModule.createDocument(app, config);

    // UI interactiva en /api/docs
    SwaggerModule.setup("api/docs", app, document, {
      swaggerOptions: {
        persistAuthorization: true,       // mantiene el token entre recargas
        tagsSorter: "alpha",
        operationsSorter: "alpha",
        docExpansion: "none",             // colapsa todos los endpoints por defecto
        filter: true,                     // barra de búsqueda en la UI
        showRequestDuration: true,        // muestra tiempo de respuesta
      },
      customSiteTitle: "Podoplus API Docs",
    });

    // Exportar spec JSON para generación de cliente type-safe en el frontend
    // Archivo: apps/api/openapi.json — commiteable y usable con openapi-typescript
    const specPath = join(process.cwd(), "openapi.json");
    writeFileSync(specPath, JSON.stringify(document, null, 2), "utf8");
    console.log(`[Swagger] Spec exportada → ${specPath}`);
  }

  await app.listen(port, host);

  const logger = app.get(Logger);
  logger.log(
    {
      event:     "api.started",
      host,
      port,
      env:       configService.get("NODE_ENV"),
      url:       `http://${host}:${port}`,
      docs:      isProd ? "disabled in production" : `http://${host}:${port}/api/docs`,
      websocket: `ws://${host}:${port}/realtime`,
      health:    `http://${host}:${port}/health`,
    },
    "Bootstrap"
  );
}

bootstrap().catch((error: Error) => {
  console.error("Fatal error during bootstrap:", error);
  process.exit(1);
});

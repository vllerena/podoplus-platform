/**
 * E2E Test Suite — Podoplus API
 *
 * Estos tests se ejecutan contra una instancia real de la API con base de datos de test.
 *
 * Pre-requisitos:
 *   1. Base de datos de test corriendo (Postgres)
 *   2. Variable de entorno DATABASE_URL_TEST apuntando a la DB de test
 *   3. Migraciones aplicadas: `DATABASE_URL=$DATABASE_URL_TEST npx prisma migrate deploy`
 *
 * Para ejecutar:
 *   DATABASE_URL_TEST=postgresql://... pnpm test:e2e
 *
 * Si DATABASE_URL_TEST no está definida, todos los tests se omiten automáticamente.
 */

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

// Skip all E2E tests when no test database is configured
const SKIP = !process.env.DATABASE_URL_TEST;
const describe_ = SKIP ? describe.skip : describe;

// ─── Shared state across tests ────────────────────────────────────────────────

let app: INestApplication;
let httpServer: any;

// These are populated as tests run in order
let authToken: string;
let branchId: string;
let customerId: string;
let serviceId: string;
let appointmentId: string;
let saleId: string;

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeAll(async () => {
  if (SKIP) return;

  const module: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
  );
  await app.init();
  httpServer = app.getHttpServer();
});

afterAll(async () => {
  if (app) await app.close();
});

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe_("Full Clinic Flow (E2E)", () => {
  // ── 1. Authentication ────────────────────────────────────────────────────

  describe("POST /v1/auth/login", () => {
    it("returns a JWT token with valid credentials", async () => {
      const res = await request(httpServer)
        .post("/v1/auth/login")
        .send({ email: process.env.E2E_USER_EMAIL, password: process.env.E2E_USER_PASSWORD })
        .expect(200);

      expect(res.body).toHaveProperty("access_token");
      authToken = res.body.access_token;
    });
  });

  // ── 2. Branch ────────────────────────────────────────────────────────────

  describe("GET /v1/branches", () => {
    it("returns the list of branches for the authenticated user", async () => {
      const res = await request(httpServer)
        .get("/v1/branches")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      branchId = res.body[0].id;
    });
  });

  // ── 3. Customer — Create ──────────────────────────────────────────────────

  describe("POST /v1/customers", () => {
    it("creates a new customer", async () => {
      const res = await request(httpServer)
        .post("/v1/customers")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          first_name: "Test",
          last_name: "E2E",
          email: `e2e-${Date.now()}@test.com`,
          phone: "999000111",
        })
        .expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.first_name).toBe("Test");
      customerId = res.body.id;
    });
  });

  // ── 4. Service — Get list ────────────────────────────────────────────────

  describe("GET /v1/services", () => {
    it("returns the list of services", async () => {
      const res = await request(httpServer)
        .get("/v1/services")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      serviceId = res.body[0].id;
    });
  });

  // ── 5. Appointment — Create directly (without hold) ──────────────────────

  describe("POST /v1/appointments", () => {
    it("creates an appointment in CONFIRMED status", async () => {
      const startAt = new Date();
      startAt.setHours(startAt.getHours() + 1, 0, 0, 0); // 1 hour from now, on the hour

      const res = await request(httpServer)
        .post("/v1/appointments")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          branch_id: branchId,
          customer_id: customerId,
          service_id: serviceId,
          start_at: startAt.toISOString(),
          source: "RECEPTION",
        })
        .expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.status).toBe("CONFIRMED");
      appointmentId = res.body.id;
    });
  });

  // ── 6. Appointment — State machine ───────────────────────────────────────

  describe("PATCH /v1/appointments/:id/check-in", () => {
    it("transitions appointment from CONFIRMED to CHECKED_IN", async () => {
      const res = await request(httpServer)
        .patch(`/v1/appointments/${appointmentId}/check-in`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.status).toBe("CHECKED_IN");
    });
  });

  describe("PATCH /v1/appointments/:id/start-service", () => {
    it("transitions appointment from CHECKED_IN to IN_SERVICE", async () => {
      const res = await request(httpServer)
        .patch(`/v1/appointments/${appointmentId}/start-service`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.status).toBe("IN_SERVICE");
    });
  });

  describe("PATCH /v1/appointments/:id/complete", () => {
    it("transitions appointment from IN_SERVICE to COMPLETED", async () => {
      const res = await request(httpServer)
        .patch(`/v1/appointments/${appointmentId}/complete`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.status).toBe("COMPLETED");
    });
  });

  // ── 7. Sale — Create ─────────────────────────────────────────────────────

  describe("POST /v1/sales", () => {
    it("creates a sale linked to the completed appointment", async () => {
      const res = await request(httpServer)
        .post("/v1/sales")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          branch_id: branchId,
          customer_id: customerId,
          appointment_id: appointmentId,
          payment_method: "CASH",
          items: [
            {
              item_type: "SERVICE",
              service_id: serviceId,
              quantity: 1,
              unit_price: 80,
            },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.status).toBe("PAID");
      expect(res.body.payment_method).toBe("CASH");
      saleId = res.body.id;
    });
  });

  // ── 8. Sale — Void ───────────────────────────────────────────────────────

  describe("POST /v1/sales/:id/void", () => {
    it("voids a PAID sale", async () => {
      const res = await request(httpServer)
        .post(`/v1/sales/${saleId}/void`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ reason: "Error en el registro" })
        .expect(200);

      expect(res.body.status).toBe("VOIDED");
      expect(res.body.void_reason).toBe("Error en el registro");
    });
  });

  // ── 9. Guard checks ──────────────────────────────────────────────────────

  describe("Authorization guards", () => {
    it("returns 401 when no token is provided", async () => {
      await request(httpServer).get("/v1/appointments").expect(401);
    });

    it("returns 401 when an invalid token is provided", async () => {
      await request(httpServer)
        .get("/v1/appointments")
        .set("Authorization", "Bearer invalid.token.here")
        .expect(401);
    });
  });
});

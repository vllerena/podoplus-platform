import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaService } from "./modules/prisma/prisma.service";
import { AuthService } from "./modules/auth/auth.service";

async function createTestUser() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const authService = app.get(AuthService);

  try {
    console.log("\n👤 Creando usuario de prueba adicional...\n");

    // Crear usuario TEST
    const testUser = await prisma.user.upsert({
      where: { email: "test@podoplus.com" },
      update: {},
      create: {
        email: "test@podoplus.com",
        firstName: "Test",
        lastName: "User",
        phone: "987654399",
        isActive: true,
        passwordHash: authService.hashPassword("Test123456"),
      },
    });

    console.log(`✅ Usuario Test creado: ${testUser.id}`);

    // Obtener rol SUPER_ADMIN
    const superAdminRole = await prisma.role.findUnique({
      where: { code: "SUPER_ADMIN" },
    });

    if (!superAdminRole) {
      throw new Error("Rol SUPER_ADMIN no encontrado. Ejecuta seed primero.");
    }

    // Asignar rol al usuario
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: testUser.id,
          roleId: superAdminRole.id,
        },
      },
      update: {},
      create: {
        userId: testUser.id,
        roleId: superAdminRole.id,
      },
    });

    console.log("✅ Rol SUPER_ADMIN asignado");

    // Obtener primera rama para asignar
    const firstBranch = await prisma.branch.findFirst();

    if (firstBranch) {
      await prisma.userBranch.upsert({
        where: {
          userId_branchId: {
            userId: testUser.id,
            branchId: firstBranch.id,
          },
        },
        update: {},
        create: {
          userId: testUser.id,
          branchId: firstBranch.id,
        },
      });

      console.log(`✅ Usuario asignado a rama: ${firstBranch.name}`);
    }

    console.log("\n📝 Credenciales de usuario test:");
    console.log(`  Email: test@podoplus.com`);
    console.log(`  Password: Test123456`);
    console.log(`  UserId: ${testUser.id}\n`);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

createTestUser();

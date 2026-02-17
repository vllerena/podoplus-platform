import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { RbacService } from "./modules/rbac/rbac.service";
import { PrismaService } from "./modules/prisma/prisma.service";
import { AuthService } from "./modules/auth/auth.service";

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const rbacService = app.get(RbacService);
  const prisma = app.get(PrismaService);
  const authService = app.get(AuthService);

  try {
    console.log("\n🌱 === INICIANDO SEED COMPLETO DE PODOPLUS === 🌱\n");

    // ============================================================
    // 1. SEED ROLES Y PERMISOS
    // ============================================================
    console.log("📋 Creando roles y permisos...");
    await rbacService.seedRolesAndPermissions();
    console.log("✅ Roles y permisos creados\n");

    // ============================================================
    // 2. OBTENER TODOS LOS PERMISOS
    // ============================================================
    console.log("🔑 Obteniendo permisos...");
    const allPermissions = await prisma.permission.findMany();
    const permissionMap = new Map(allPermissions.map((p) => [p.code, p.id]));
    console.log(`✅ ${allPermissions.length} permisos obtenidos\n`);

    // ============================================================
    // 3. DEFINIR PERMISOS POR ROL
    // ============================================================
    console.log("🎭 Asignando permisos a roles...");

    const rolePermissions = {
      SUPER_ADMIN: allPermissions.map((p) => p.code), // Todos los permisos
      GENERAL_MANAGER: [
        "appointment.read",
        "customer.read",
        "sale.read",
        "cash.read",
        "inventory.read",
        "plan.read",
        "report.read",
        "report.export",
      ],
      OPS_MANAGER: [
        "appointment.create",
        "appointment.read",
        "appointment.update",
        "appointment.delete",
        "appointment.checkin",
        "appointment.no_show",
        "customer.create",
        "customer.read",
        "customer.update",
        "customer.delete",
        "customer.dedup",
        "sale.create",
        "sale.read",
        "sale.void",
        "sale.refund",
        "cash.open",
        "cash.close",
        "cash.read",
        "cash.adjust",
        "inventory.read",
        "plan.create",
        "plan.read",
        "plan.assign",
        "plan.consume",
        "report.read",
        "report.export",
      ],
      SUPERVISOR: [
        "appointment.create",
        "appointment.read",
        "appointment.update",
        "appointment.checkin",
        "appointment.no_show",
        "customer.create",
        "customer.read",
        "customer.update",
        "customer.dedup",
        "sale.create",
        "sale.read",
        "sale.void",
        "cash.open",
        "cash.close",
        "cash.read",
        "inventory.read",
        "plan.assign",
        "plan.consume",
        "report.read",
      ],
      SUPERVISOR_ASSISTANT: [
        "appointment.create",
        "appointment.read",
        "appointment.update",
        "appointment.checkin",
        "customer.create",
        "customer.read",
        "customer.update",
        "sale.create",
        "sale.read",
        "cash.open",
        "cash.close",
        "cash.read",
        "inventory.read",
        "plan.assign",
        "plan.consume",
        "report.read",
      ],
      LOGISTICS: [
        "inventory.read",
        "inventory.adjust",
        "inventory.transfer",
        "sale.read",
      ],
      QUALITY: [
        "appointment.read",
        "customer.read",
        "sale.read",
        "cash.read",
        "inventory.read",
        "report.read",
      ],
      ACCOUNTING_HR: [
        "sale.read",
        "cash.read",
        "plan.read",
        "report.read",
        "report.export",
      ],
      RECEPTIONIST: [
        "appointment.create",
        "appointment.read",
        "appointment.update",
        "appointment.checkin",
        "appointment.no_show",
        "customer.create",
        "customer.read",
        "customer.update",
        "customer.dedup",
        "sale.create",
        "sale.read",
        "sale.void",
        "cash.open",
        "cash.close",
        "cash.read",
        "inventory.read",
        "plan.assign",
        "plan.consume",
        "whatsapp.read",
      ],
    };

    // Obtener roles
    const roles = await prisma.role.findMany();
    const roleMap = new Map(roles.map((r) => [r.code, r.id]));

    // Asignar permisos a cada rol
    for (const [roleCode, permissionCodes] of Object.entries(rolePermissions)) {
      const roleId = roleMap.get(roleCode);
      if (!roleId) continue;

      for (const permCode of permissionCodes) {
        const permId = permissionMap.get(permCode);
        if (!permId) continue;

        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId,
              permissionId: permId,
            },
          },
          update: {},
          create: {
            roleId,
            permissionId: permId,
          },
        });
      }
      console.log(`  ✓ Permisos asignados a ${roleCode}`);
    }

    console.log("✅ Permisos asignados\n");

    // ============================================================
    // 4. CREAR SEDES
    // ============================================================
    console.log("🏢 Creando sedes...");
    const branches = [];
    const branchData = [
      { code: "LIMA-001", name: "Clínica Lima Centro" },
      { code: "LIMA-002", name: "Clínica Lima Miraflores" },
      { code: "AREQUIPA-001", name: "Clínica Arequipa" },
      { code: "CUSCO-001", name: "Clínica Cusco" },
    ];

    for (const data of branchData) {
      const branch = await prisma.branch.upsert({
        where: { code: data.code },
        update: {},
        create: {
          code: data.code,
          name: data.name,
          isActive: true,
          defaultCapacity: 6,
          timezone: "America/Lima",
        },
      });
      branches.push(branch);
      console.log(`  ✓ Sede creada: ${data.name}`);
    }
    console.log("✅ Sedes creadas\n");

    // ============================================================
    // 5. CREAR USUARIOS CON ROLES Y SEDES
    // ============================================================
    console.log("👥 Creando usuarios de prueba...");

    // 5.1 SUPER_ADMIN
    const superAdmin = await prisma.user.upsert({
      where: { email: "victor@podoplus.com" },
      update: {
        passwordHash: authService.hashPassword("SuperAdmin123"),
      },
      create: {
        email: "victor@podoplus.com",
        firstName: "Víctor",
        lastName: "García",
        phone: "987100001",
        isActive: true,
        passwordHash: authService.hashPassword("SuperAdmin123"),
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: superAdmin.id,
          roleId: roleMap.get("SUPER_ADMIN"),
        },
      },
      update: {},
      create: {
        userId: superAdmin.id,
        roleId: roleMap.get("SUPER_ADMIN"),
      },
    });

    // Asignar a todas las sedes
    for (const branch of branches) {
      await prisma.userBranch.upsert({
        where: {
          userId_branchId: {
            userId: superAdmin.id,
            branchId: branch.id,
          },
        },
        update: {},
        create: {
          userId: superAdmin.id,
          branchId: branch.id,
        },
      });
    }

    console.log(`  ✓ SUPER_ADMIN: victor@podoplus.com / SuperAdmin123`);

    // 5.2 GENERAL_MANAGER
    const generalManager = await prisma.user.upsert({
      where: { email: "diana@podoplus.com" },
      update: {
        passwordHash: authService.hashPassword("GenManager123"),
      },
      create: {
        email: "diana@podoplus.com",
        firstName: "Diana",
        lastName: "López",
        phone: "987100002",
        isActive: true,
        passwordHash: authService.hashPassword("GenManager123"),
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: generalManager.id,
          roleId: roleMap.get("GENERAL_MANAGER"),
        },
      },
      update: {},
      create: {
        userId: generalManager.id,
        roleId: roleMap.get("GENERAL_MANAGER"),
      },
    });

    for (const branch of branches) {
      await prisma.userBranch.upsert({
        where: {
          userId_branchId: {
            userId: generalManager.id,
            branchId: branch.id,
          },
        },
        update: {},
        create: {
          userId: generalManager.id,
          branchId: branch.id,
        },
      });
    }

    console.log(`  ✓ GENERAL_MANAGER: diana@podoplus.com / GenManager123`);

    // 5.3 OPS_MANAGER
    const opsManager = await prisma.user.upsert({
      where: { email: "carmen@podoplus.com" },
      update: {
        passwordHash: authService.hashPassword("OpsManager123"),
      },
      create: {
        email: "carmen@podoplus.com",
        firstName: "Carmen",
        lastName: "Rodríguez",
        phone: "987100003",
        isActive: true,
        passwordHash: authService.hashPassword("OpsManager123"),
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: opsManager.id,
          roleId: roleMap.get("OPS_MANAGER"),
        },
      },
      update: {},
      create: {
        userId: opsManager.id,
        roleId: roleMap.get("OPS_MANAGER"),
      },
    });

    for (const branch of branches) {
      await prisma.userBranch.upsert({
        where: {
          userId_branchId: {
            userId: opsManager.id,
            branchId: branch.id,
          },
        },
        update: {},
        create: {
          userId: opsManager.id,
          branchId: branch.id,
        },
      });
    }

    console.log(`  ✓ OPS_MANAGER: carmen@podoplus.com / OpsManager123`);

    // 5.4 SUPERVISOR
    const supervisor = await prisma.user.upsert({
      where: { email: "grethel@podoplus.com" },
      update: {
        passwordHash: authService.hashPassword("Supervisor123"),
      },
      create: {
        email: "grethel@podoplus.com",
        firstName: "Grethel",
        lastName: "Martínez",
        phone: "987100004",
        isActive: true,
        passwordHash: authService.hashPassword("Supervisor123"),
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: supervisor.id,
          roleId: roleMap.get("SUPERVISOR"),
        },
      },
      update: {},
      create: {
        userId: supervisor.id,
        roleId: roleMap.get("SUPERVISOR"),
      },
    });

    for (const branch of branches) {
      await prisma.userBranch.upsert({
        where: {
          userId_branchId: {
            userId: supervisor.id,
            branchId: branch.id,
          },
        },
        update: {},
        create: {
          userId: supervisor.id,
          branchId: branch.id,
        },
      });
    }

    console.log(`  ✓ SUPERVISOR: grethel@podoplus.com / Supervisor123`);

    // 5.5 SUPERVISOR_ASSISTANT
    const supAssistant = await prisma.user.upsert({
      where: { email: "carolina@podoplus.com" },
      update: {
        passwordHash: authService.hashPassword("SupAssist123"),
      },
      create: {
        email: "carolina@podoplus.com",
        firstName: "Carolina",
        lastName: "Pérez",
        phone: "987100005",
        isActive: true,
        passwordHash: authService.hashPassword("SupAssist123"),
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: supAssistant.id,
          roleId: roleMap.get("SUPERVISOR_ASSISTANT"),
        },
      },
      update: {},
      create: {
        userId: supAssistant.id,
        roleId: roleMap.get("SUPERVISOR_ASSISTANT"),
      },
    });

    await prisma.userBranch.upsert({
      where: {
        userId_branchId: {
          userId: supAssistant.id,
          branchId: branches[0].id,
        },
      },
      update: {},
      create: {
        userId: supAssistant.id,
        branchId: branches[0].id,
      },
    });

    console.log(
      `  ✓ SUPERVISOR_ASSISTANT: carolina@podoplus.com / SupAssist123`
    );

    // 5.6 LOGISTICS
    const logistics = await prisma.user.upsert({
      where: { email: "leila@podoplus.com" },
      update: {
        passwordHash: authService.hashPassword("Logistics123"),
      },
      create: {
        email: "leila@podoplus.com",
        firstName: "Leila",
        lastName: "Sánchez",
        phone: "987100006",
        isActive: true,
        passwordHash: authService.hashPassword("Logistics123"),
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: logistics.id,
          roleId: roleMap.get("LOGISTICS"),
        },
      },
      update: {},
      create: {
        userId: logistics.id,
        roleId: roleMap.get("LOGISTICS"),
      },
    });

    for (const branch of branches) {
      await prisma.userBranch.upsert({
        where: {
          userId_branchId: {
            userId: logistics.id,
            branchId: branch.id,
          },
        },
        update: {},
        create: {
          userId: logistics.id,
          branchId: branch.id,
        },
      });
    }

    console.log(`  ✓ LOGISTICS: leila@podoplus.com / Logistics123`);

    // 5.7 QUALITY
    const quality = await prisma.user.upsert({
      where: { email: "dina@podoplus.com" },
      update: {
        passwordHash: authService.hashPassword("Quality123"),
      },
      create: {
        email: "dina@podoplus.com",
        firstName: "Dina",
        lastName: "González",
        phone: "987100007",
        isActive: true,
        passwordHash: authService.hashPassword("Quality123"),
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: quality.id,
          roleId: roleMap.get("QUALITY"),
        },
      },
      update: {},
      create: {
        userId: quality.id,
        roleId: roleMap.get("QUALITY"),
      },
    });

    for (const branch of branches) {
      await prisma.userBranch.upsert({
        where: {
          userId_branchId: {
            userId: quality.id,
            branchId: branch.id,
          },
        },
        update: {},
        create: {
          userId: quality.id,
          branchId: branch.id,
        },
      });
    }

    console.log(`  ✓ QUALITY: dina@podoplus.com / Quality123`);

    // 5.8 ACCOUNTING_HR
    const accounting = await prisma.user.upsert({
      where: { email: "contabilidad@podoplus.com" },
      update: {
        passwordHash: authService.hashPassword("Accounting123"),
      },
      create: {
        email: "contabilidad@podoplus.com",
        firstName: "Contador",
        lastName: "Finanzas",
        phone: "987100008",
        isActive: true,
        passwordHash: authService.hashPassword("Accounting123"),
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: accounting.id,
          roleId: roleMap.get("ACCOUNTING_HR"),
        },
      },
      update: {},
      create: {
        userId: accounting.id,
        roleId: roleMap.get("ACCOUNTING_HR"),
      },
    });

    for (const branch of branches) {
      await prisma.userBranch.upsert({
        where: {
          userId_branchId: {
            userId: accounting.id,
            branchId: branch.id,
          },
        },
        update: {},
        create: {
          userId: accounting.id,
          branchId: branch.id,
        },
      });
    }

    console.log(`  ✓ ACCOUNTING_HR: contabilidad@podoplus.com / Accounting123`);

    // 5.9 RECEPCIONISTAS (por sede)
    const receptionists = [
      {
        email: "recepcion.lima1@podoplus.com",
        name: "Juan",
        phone: "987100010",
        branch: 0,
      },
      {
        email: "recepcion.lima2@podoplus.com",
        name: "María",
        phone: "987100011",
        branch: 1,
      },
      {
        email: "recepcion.arequipa@podoplus.com",
        name: "Pedro",
        phone: "987100012",
        branch: 2,
      },
      {
        email: "recepcion.cusco@podoplus.com",
        name: "Ana",
        phone: "987100013",
        branch: 3,
      },
    ];

    for (const recData of receptionists) {
      const receptionist = await prisma.user.upsert({
        where: { email: recData.email },
        update: {
          passwordHash: authService.hashPassword("Receptionist123"),
        },
        create: {
          email: recData.email,
          firstName: recData.name,
          lastName: "Recepción",
          phone: recData.phone,
          isActive: true,
          passwordHash: authService.hashPassword("Receptionist123"),
        },
      });

      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: receptionist.id,
            roleId: roleMap.get("RECEPTIONIST"),
          },
        },
        update: {},
        create: {
          userId: receptionist.id,
          roleId: roleMap.get("RECEPTIONIST"),
        },
      });

      await prisma.userBranch.upsert({
        where: {
          userId_branchId: {
            userId: receptionist.id,
            branchId: branches[recData.branch].id,
          },
        },
        update: {},
        create: {
          userId: receptionist.id,
          branchId: branches[recData.branch].id,
        },
      });

      console.log(`  ✓ RECEPTIONIST: ${recData.email} / Receptionist123`);
    }

    console.log("✅ Usuarios creados\n");

    // ============================================================
    // 6. RESUMEN FINAL
    // ============================================================
    console.log("📊 === RESUMEN DE SEED ===");
    console.log(`\n✓ Sedes creadas: ${branches.length}`);
    console.log(`✓ Usuarios creados: 13`);
    console.log(`✓ Roles configurados: ${roleMap.size}`);
    console.log(`✓ Permisos configurados: ${allPermissions.length}`);
    console.log(`\n🔐 Credenciales de prueba:\n`);
    console.log(`
  SUPER_ADMIN (Acceso total):
    Email: victor@podoplus.com
    Pass: SuperAdmin123

  GENERAL_MANAGER (Reportes):
    Email: diana@podoplus.com
    Pass: GenManager123

  OPS_MANAGER (Operaciones):
    Email: carmen@podoplus.com
    Pass: OpsManager123

  SUPERVISOR (Multi-sede):
    Email: grethel@podoplus.com
    Pass: Supervisor123

  SUPERVISOR_ASSISTANT (Una sede):
    Email: carolina@podoplus.com
    Pass: SupAssist123

  LOGISTICS (Inventario):
    Email: leila@podoplus.com
    Pass: Logistics123

  QUALITY (Lectura):
    Email: dina@podoplus.com
    Pass: Quality123

  ACCOUNTING_HR (Finanzas):
    Email: contabilidad@podoplus.com
    Pass: Accounting123

  RECEPTIONIST - Lima Centro:
    Email: recepcion.lima1@podoplus.com
    Pass: Receptionist123

  RECEPTIONIST - Lima Miraflores:
    Email: recepcion.lima2@podoplus.com
    Pass: Receptionist123

  RECEPTIONIST - Arequipa:
    Email: recepcion.arequipa@podoplus.com
    Pass: Receptionist123

  RECEPTIONIST - Cusco:
    Email: recepcion.cusco@podoplus.com
    Pass: Receptionist123
    `);

    console.log("\n✅ === SEED COMPLETADO EXITOSAMENTE ===\n");
  } catch (error) {
    console.error("❌ Error en seed:", error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

seed();

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
        "cash_register.read",
        "inventory.read",
        "product.read",
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
        "cash_register.read",
        "cash_register.manage",
        "inventory.read",
        "inventory.adjust",
        "inventory.manage",
        "product.read",
        "product.manage",
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
        "cash_register.read",
        "cash_register.manage",
        "inventory.read",
        "product.read",
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
        "cash_register.read",
        "cash_register.manage",
        "inventory.read",
        "product.read",
        "plan.assign",
        "plan.consume",
        "report.read",
      ],
      LOGISTICS: [
        "inventory.read",
        "inventory.adjust",
        "inventory.transfer",
        "inventory.manage",
        "product.read",
        "product.manage",
        "sale.read",
      ],
      QUALITY: [
        "appointment.read",
        "customer.read",
        "sale.read",
        "cash.read",
        "cash_register.read",
        "inventory.read",
        "product.read",
        "report.read",
      ],
      ACCOUNTING_HR: [
        "sale.read",
        "cash.read",
        "cash_register.read",
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
        "cash_register.read",
        "cash_register.manage",
        "inventory.read",
        "product.read",
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

    // BusinessUnits
    const buSac = await prisma.businessUnit.upsert({
      where: { ruc: "20605267395" },
      update: { name: "PODOPLUS S.A.C.", address: "AV. GRAL TRINIDAD MORAN NRO. 772 LIMA - LIMA - LINCE" },
      create: { name: "PODOPLUS S.A.C.", ruc: "20605267395", address: "AV. GRAL TRINIDAD MORAN NRO. 772 LIMA - LIMA - LINCE", isActive: true },
    });
    console.log(`  ✓ BusinessUnit creada: PODOPLUS S.A.C. (RUC: 20605267395)`);

    const buEirl = await prisma.businessUnit.upsert({
      where: { ruc: "20611739304" },
      update: { name: "PODOPLUS PERU E.I.R.L.", address: "AV. UNIVERSITARIA NRO. 708 INT. 101 LIMA - LIMA - SAN MIGUEL" },
      create: { name: "PODOPLUS PERU E.I.R.L.", ruc: "20611739304", address: "AV. UNIVERSITARIA NRO. 708 INT. 101 LIMA - LIMA - SAN MIGUEL", isActive: true },
    });
    console.log(`  ✓ BusinessUnit creada: PODOPLUS PERU E.I.R.L. (RUC: 20611739304)`);

    const branches = [];
    const branchData = [
      // PODOPLUS S.A.C. branches
      { code: "SURQUILLO-0002", name: "SEDE SURQUILLO", address: "AV. AVIACIÓN NRO. 4036 LIMA - LIMA - SURQUILLO", attachedCode: "0002", businessUnitId: buSac.id },
      { code: "SAN-MIGUEL-1-0003", name: "SEDE SAN MIGUEL 1", address: "AV. UNIVERSITARIA NRO. 708 INT. 101 LIMA - LIMA - SAN MIGUEL", attachedCode: "0003", businessUnitId: buSac.id },
      { code: "LOS-OLIVOS-2-0008", name: "SEDE LOS OLIVOS 2", address: "AV. ANGELICA GAMARRA NRO. 653 LIMA - LIMA - LOS OLIVOS", attachedCode: "0008", businessUnitId: buSac.id },
      { code: "CHORRILLOS-0010", name: "SEDE CHORRILLOS", address: "PRO.PASEO DE LA REPUBLICA NRO. 410 LIMA - LIMA - CHORRILLOS", attachedCode: "0010", businessUnitId: buSac.id },
      { code: "BARRANCO-0011", name: "SEDE BARRANCO", address: "AV. EL SOL ESTE NRO. 303 LIMA - LIMA - BARRANCO", attachedCode: "0011", businessUnitId: buSac.id },
      { code: "MAGDALENA-0012", name: "SEDE MAGDALENA", address: "AV. SUCRE NRO. 1080 LIMA - LIMA - MAGDALENA DEL MAR", attachedCode: "0012", businessUnitId: buSac.id },
      { code: "PUEBLO-LIBRE-0007", name: "SEDE PUEBLO LIBRE", address: "AV. MARIANO CORNEJO NRO. 1159 LIMA - LIMA - PUEBLO LIBRE", attachedCode: "0007", businessUnitId: buSac.id },
      { code: "LA-VICTORIA-0013", name: "SEDE LA VICTORIA", address: "AV. SOLIDARIDAD NRO. 105 URB. SANTA CATALINA LIMA - LIMA - LA VICTORIA", attachedCode: "0013", businessUnitId: buSac.id },
      { code: "SAN-MARTIN-0014", name: "SEDE SAN MARTIN DE PORRES", address: "AV. PERÚ NRO. 3630 (2DO PISO) LIMA - LIMA - SAN MARTIN DE PORRES", attachedCode: "0014", businessUnitId: buSac.id },
      { code: "LA-MOLINA-SAC-0015", name: "SEDE LA MOLINA", address: "AV. FLORA TRISTÁN NRO. 240 LIMA - LIMA - LA MOLINA", attachedCode: "0015", businessUnitId: buSac.id },
      // PODOPLUS PERU E.I.R.L. branches
      { code: "LOS-OLIVOS-1-0013", name: "SEDE LOS OLIVOS 1", address: "AV. CARLOS IZAGUIRRE NRO. 949 LIMA - LIMA - LOS OLIVOS", attachedCode: "0013", businessUnitId: buEirl.id },
      { code: "JESUS-MARIA-0019", name: "SEDE JESUS MARIA", address: "AV. GREGORIO ESCOBEDO NRO. 987 INT. 101 RES. SAN FELIPE LIMA - LIMA - JESUS MARIA", attachedCode: "0019", businessUnitId: buEirl.id },
      { code: "SURCO-0022", name: "SEDE SURCO", address: "AV. ALFREDO BENAVIDES NRO. 4247 LIMA - LIMA - SANTIAGO DE SURCO", attachedCode: "0022", businessUnitId: buEirl.id },
      { code: "SAN-JUAN-MF-0025", name: "SEDE SAN JUAN DE MIRAFLORES", address: "JR. JOSE CHARIARSE NRO. 409 LIMA - LIMA - SAN JUAN DE MIRAFLORES", attachedCode: "0025", businessUnitId: buEirl.id },
      { code: "LA-MOLINA-EIRL-0028", name: "SEDE LA MOLINA", address: "AV. FLORA TRISTÁN NRO. 240 LIMA - LIMA - LA MOLINA", attachedCode: "0028", businessUnitId: buEirl.id },
      { code: "LINCE-0029", name: "SEDE LINCE", address: "AV. GRAL TRINIDAD MORAN NRO. 772 LIMA - LIMA - LINCE", attachedCode: "0029", businessUnitId: buEirl.id },
      { code: "SAN-MIGUEL-2-0021", name: "SEDE SAN MIGUEL 2", address: "AV. PARQUE DE LAS LEYENDAS NRO. 121 LIMA - LIMA - SAN MIGUEL", attachedCode: "0021", businessUnitId: buEirl.id },
      { code: "CANTA-CALLAO-0030", name: "SEDE CANTA CALLAO", address: "AV. CANTA CALLAO NRO. 396 (LOCAL 109) CALLAO", attachedCode: "0030", businessUnitId: buEirl.id },
    ];

    for (const data of branchData) {
      const branch = await prisma.branch.upsert({
        where: { code: data.code },
        update: {
          name: data.name,
          address: data.address,
          attachedCode: data.attachedCode,
          businessUnitId: data.businessUnitId,
        },
        create: {
          code: data.code,
          name: data.name,
          address: data.address,
          attachedCode: data.attachedCode,
          businessUnitId: data.businessUnitId,
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
    // 6. CATÁLOGO DE PRODUCTOS DE PRODUCCIÓN
    // ============================================================
    console.log("📦 Creando catálogo de productos de producción...");

    // Obtener super admin (necesario para secciones posteriores)
    const adminUser = await prisma.user.findUnique({
      where: { email: "victor@podoplus.com" },
    });

    // SKU = internalCode cuando existe; de lo contrario se genera uno descriptivo.
    // costPrice = 0 (a actualizar con datos reales de costo).
    // Todos: unitType="unit", unitTypeCode="NIU", igvAffectationCode="10", hasIgv=true.
    const productData: Array<{
      sku: string;
      name: string;
      salePrice: number;
      internalCode?: string;
    }> = [
      // ── Sin código interno ──────────────────────────────────────────────────
      { sku: "PACK-CF-OZO",      name: "PACK CICLOFORT + OZONODERM",                                                  salePrice: 150 },
      // ── Códigos de barras Podoplus / Tubo Gel ───────────────────────────────
      { sku: "05929900262",      name: "Tubo Gel RECORTABLE",                                                          salePrice: 38,  internalCode: "05929900262" },
      { sku: "759299000262",     name: "FOOT WORKS®",                                                                  salePrice: 38,  internalCode: "759299000262" },
      // ── Productos internos P00xx ────────────────────────────────────────────
      { sku: "P0079",            name: "UREA AL 40%",                                                                  salePrice: 40,  internalCode: "P0079" },
      { sku: "P0078",            name: "TERB GOTAS",                                                                   salePrice: 40,  internalCode: "P0078" },
      { sku: "P0077",            name: "TERB EN CREMA",                                                                salePrice: 40,  internalCode: "P0077" },
      { sku: "P0076",            name: "TALCO EN SPRAY",                                                               salePrice: 40,  internalCode: "P0076" },
      { sku: "P0075",            name: "TALCO EN CREMA",                                                               salePrice: 40,  internalCode: "P0075" },
      { sku: "P0074",            name: "OZONODERM",                                                                    salePrice: 60,  internalCode: "P0074" },
      { sku: "P0073",            name: "JABÓN ANTIMICÓTICO",                                                           salePrice: 40,  internalCode: "P0073" },
      { sku: "P0072",            name: "HUMECREM",                                                                     salePrice: 45,  internalCode: "P0072" },
      { sku: "P0071",            name: "HIDRATER",                                                                     salePrice: 50,  internalCode: "P0071" },
      { sku: "P0070",            name: "FORTALECEDOR DE UÑAS",                                                         salePrice: 50,  internalCode: "P0070" },
      // ── FOOT WORKS® — códigos de barras EAN ────────────────────────────────
      { sku: "7759299000286",    name: "FOOT WORKS® - TUBO GEL RECUBIERTO",                                            salePrice: 38,  internalCode: "7759299000286" },
      { sku: "7759299000170",    name: "FOOT WORKS® - TALONERA MASSAGING GEL",                                         salePrice: 43,  internalCode: "7759299000170" },
      { sku: "7759299000002",    name: "FOOT WORKS® - TALONERA FLEX CONFORT",                                          salePrice: 40,  internalCode: "7759299000002" },
      { sku: "7759299000088",    name: "FOOT WORKS® - TALONERA DE GEL INVISIBLE",                                      salePrice: 27,  internalCode: "7759299000088" },
      { sku: "7759299000309",    name: "FOOT WORKS® - TALONERA CONFORT PLUS",                                          salePrice: 47,  internalCode: "7759299000309" },
      { sku: "7759299000057",    name: "FOOT WORKS® - SEPARADOR DEDOS MENORES",                                        salePrice: 29,  internalCode: "7759299000057" },
      { sku: "7759299000187",    name: "FOOT WORKS® - SEPARADOR DE DEDOS DE SILICONA PARA TODOS LOS DEDOS",            salePrice: 45,  internalCode: "7759299000187" },
      { sku: "7759299000064",    name: "FOOT WORKS® - SEPARADOR CON DOBLE ANILLO",                                     salePrice: 37,  internalCode: "7759299000064" },
      { sku: "7759299000101",    name: "FOOT WORKS® - SEPARADOR CON ANILLO",                                           salePrice: 36,  internalCode: "7759299000101" },
      { sku: "7759299000118",    name: "FOOT WORKS® - PROTECTOR PARA DEDO MEÑIQUE",                                    salePrice: 28,  internalCode: "7759299000118" },
      { sku: "7759299000026",    name: "FOOT WORKS® - PROTECTOR JUANETE TIPO MEDIA CON SEPARADOR",                     salePrice: 65,  internalCode: "7759299000026" },
      { sku: "7759299000019",    name: "FOOT WORKS® - PROTECTOR JUANETE TIPO MEDIA",                                   salePrice: 50,  internalCode: "7759299000019" },
      { sku: "7759299000033",    name: "FOOT WORKS® - PROTECTOR JUANETE DE SILICONA CON SEPARADOR",                    salePrice: 40,  internalCode: "7759299000033" },
      { sku: "7759299000224",    name: "FOOT WORKS® - PROTECTOR GEL PARA TALÓN",                                       salePrice: 25,  internalCode: "7759299000224" },
      { sku: "7759299000156",    name: "FOOT WORKS® - PROTECTOR DE TALÓN DE SILICONA",                                 salePrice: 67,  internalCode: "7759299000156" },
      { sku: "P0054",            name: "FOOT WORKS® - PLANTILLA RUNFLEX PRO",                                          salePrice: 80,  internalCode: "P0054" },
      { sku: "7759299000316",    name: "FOOT WORKS® - PLANTILLA EXTRA CONFORT",                                        salePrice: 75,  internalCode: "7759299000316" },
      { sku: "7759299000347",    name: "FOOT WORKS® - PLANTILLA BALANCE FEET",                                         salePrice: 80,  internalCode: "7759299000347" },
      { sku: "7759299000330",    name: "FOOT WORKS® - PLANTILLA ARCH CONFORT",                                         salePrice: 80,  internalCode: "7759299000330" },
      { sku: "7759299000361",    name: "FOOT WORKS® - PLANTILLA ACTIVE SPORT",                                         salePrice: 80,  internalCode: "7759299000361" },
      { sku: "7759299000378",    name: "FOOT WORKS® - PLANTAR RELIEF",                                                 salePrice: 75,  internalCode: "7759299000378" },
      { sku: "7759299000279",    name: "FOOT WORKS® - MOLESKIN",                                                       salePrice: 39,  internalCode: "7759299000279" },
      { sku: "7759299000293",    name: "FOOT WORKS® - MEDIAS TENDÓN DE AQUILES",                                       salePrice: 52,  internalCode: "7759299000293" },
      { sku: "7759299000194",    name: "FOOT WORKS® - MEDIAS GEL SPA",                                                 salePrice: 51,  internalCode: "7759299000194" },
      { sku: "7759299000385",    name: "FOOT WORKS® - CUSHION HEEL",                                                   salePrice: 65,  internalCode: "7759299000385" },
      { sku: "7759299000217",    name: "FOOT WORKS® - CORRECTOR PILATES",                                              salePrice: 35,  internalCode: "7759299000217" },
      { sku: "7759299000231",    name: "FOOT WORKS® - ALMOHADILLA PARA DEDOS EN GARRA",                                salePrice: 42,  internalCode: "7759299000231" },
      { sku: "7759299000149",    name: "FOOT WORKS® - ALMOHADILLA METATARSAL",                                         salePrice: 66,  internalCode: "7759299000149" },
      { sku: "7759299000071",    name: "FOOT WORKS® - ALMOHADILLA DE GEL INVISIBLE",                                   salePrice: 26,  internalCode: "7759299000071" },
      // ── Productos internos P00xx (continuación) ─────────────────────────────
      { sku: "P0040",            name: "DESINFECTANTE DE CALZADO",                                                     salePrice: 40,  internalCode: "P0040" },
      { sku: "P0039",            name: "CREMA ANTIMICÓTICA FORTE 60GR",                                                salePrice: 70,  internalCode: "P0039" },
      { sku: "P0038",            name: "CREMA ANTIMICÓTICA FORTE 30GR",                                                salePrice: 45,  internalCode: "P0038" },
      { sku: "P0037",            name: "CREMA 3A",                                                                     salePrice: 40,  internalCode: "P0037" },
      { sku: "P0036",            name: "CICLOPIROX",                                                                   salePrice: 60,  internalCode: "P0036" },
      { sku: "P0035",            name: "CICLOFORT",                                                                    salePrice: 110, internalCode: "P0035" },
      { sku: "P0034",            name: "BIFONAZOL",                                                                    salePrice: 50,  internalCode: "P0034" },
      { sku: "P0033",            name: "AMOROL",                                                                       salePrice: 70,  internalCode: "P0033" },
    ];

    for (const data of productData) {
      await prisma.product.upsert({
        where: { sku: data.sku },
        update: {
          name:               data.name,
          salePrice:          data.salePrice,
          internalCode:       data.internalCode ?? null,
        },
        create: {
          sku:                data.sku,
          name:               data.name,
          unitType:           "unit",
          costPrice:          0,
          salePrice:          data.salePrice,
          internalCode:       data.internalCode ?? null,
          unitTypeCode:       "NIU",
          igvAffectationCode: "10",
          hasIgv:             true,
          isActive:           true,
        },
      });
      console.log(`  ✓ ${data.name} — S/ ${data.salePrice}${data.internalCode ? ` (${data.internalCode})` : ""}`);
    }

    console.log(`✅ ${productData.length} productos de producción creados\n`);

    // ============================================================
    // 7. CATÁLOGO DE SERVICIOS DE PRODUCCIÓN
    // ============================================================
    console.log("✂️  Creando catálogo de servicios de producción...");

    // Paleta de colores para asignar rotacionalmente
    const serviceColors = [
      "#3B82F6", // blue-500
      "#10B981", // emerald-500
      "#8B5CF6", // violet-500
      "#F59E0B", // amber-500
      "#EF4444", // red-500
      "#06B6D4", // cyan-500
      "#EC4899", // pink-500
      "#F97316", // orange-500
      "#14B8A6", // teal-500
      "#6366F1", // indigo-500
      "#84CC16", // lime-500
      "#A855F7", // purple-500
    ];

    const serviceData: Array<{
      name: string;
      durationMinutes: number;
      basePrice: number;
      bufferMinutes?: number;
    }> = [
      // ── Servicios regulares (con cita) ────────────────────────────────────
      { name: "PODOLOGÍA 2DA VISITA",             durationMinutes: 30, basePrice: 35 },
      { name: "SESIÓN LÁSER",                     durationMinutes: 30, basePrice: 50 },
      { name: "SESIÓN DE OZONO",                  durationMinutes: 30, basePrice: 60 },
      { name: "RETIRO DE ESMALTE EN GEL",         durationMinutes: 30, basePrice: 15 },
      { name: "PROFILAXIS DE UÑAS",               durationMinutes: 30, basePrice: 20 },
      { name: "PODOLOGÍA PLAN ANUAL I",           durationMinutes: 30, basePrice: 25 },
      { name: "PODOLOGÍA INFANTIL",               durationMinutes: 30, basePrice: 25 },
      { name: "PODOLOGÍA DE PLAN SEMESTRAL",      durationMinutes: 30, basePrice: 30 },
      { name: "PODOLOGÍA COMPLETA",               durationMinutes: 60, basePrice: 50 },
      { name: "PODOLOGÍA ADULTO MAYOR",           durationMinutes: 30, basePrice: 50 },
      { name: "ONICOPLASTÍA",                     durationMinutes: 30, basePrice: 20 },
      { name: "MASAJES",                          durationMinutes: 30, basePrice: 20 },
      { name: "FLUORIZACIÓN",                     durationMinutes: 30, basePrice: 15 },
      { name: "EXTRACCIÓN DE UÑERO",              durationMinutes: 30, basePrice: 35 },
      { name: "ENCARRILADOS",                     durationMinutes: 30, basePrice: 15 },
      { name: "UÑA ACRÍLICA",                     durationMinutes: 30, basePrice: 15 },
      { name: "EXFOLIACIÓN",                      durationMinutes: 30, basePrice: 15 },
      // ── Servicios instantáneos (sin cita) ─────────────────────────────────
      { name: "BRACKETS (4 UNIDADES)",            durationMinutes: 0,  basePrice: 70 },
      { name: "BRACKETS (2 UNIDADES)",            durationMinutes: 0,  basePrice: 40 },
      { name: "GIFT CARD 50",                     durationMinutes: 0,  basePrice: 50 },
      { name: "GIFT CARD 100",                    durationMinutes: 0,  basePrice: 100 },
      { name: "GIFT CARD 200",                    durationMinutes: 0,  basePrice: 200 },
      { name: "SEPARACIÓN DE CITA",               durationMinutes: 0,  basePrice: 20 },
    ];

    for (let i = 0; i < serviceData.length; i++) {
      const data = serviceData[i];
      const color = serviceColors[i % serviceColors.length];

      // Service has no unique constraint on name, so use findFirst + create/update
      const existing = await prisma.service.findFirst({ where: { name: data.name } });
      if (existing) {
        await prisma.service.update({
          where: { id: existing.id },
          data: {
            durationMinutes:    data.durationMinutes,
            basePrice:          data.basePrice,
            bufferMinutes:      data.bufferMinutes ?? 0,
            color,
            unitTypeCode:       "ZZ",
            igvAffectationCode: "10",
            hasIgv:             true,
            isActive:           true,
          },
        });
      } else {
        await prisma.service.create({
          data: {
            name:               data.name,
            durationMinutes:    data.durationMinutes,
            basePrice:          data.basePrice,
            bufferMinutes:      data.bufferMinutes ?? 0,
            color,
            unitTypeCode:       "ZZ",
            igvAffectationCode: "10",
            hasIgv:             true,
            allowSelfService:   false,
            isActive:           true,
          },
        });
      }

      const typeLabel = data.durationMinutes === 0 ? "Sin cita" : `${data.durationMinutes}min`;
      console.log(`  ✓ ${data.name} — S/ ${data.basePrice} (${typeLabel})`);
    }

    console.log(`✅ ${serviceData.length} servicios de producción creados\n`);

    // ============================================================
    // 8. PLANES DE PRODUCCIÓN Y SUSCRIPCIONES DE EJEMPLO
    // ============================================================
    console.log("💳 Creando planes de producción...");

    // Todos los planes de Podoplus son HYBRID:
    // - Expiran por fecha (vigencia) O por sesiones, lo que ocurra primero.
    // - Planes anuales: N sesiones con 1 año de vigencia.
    // - Plan semestral: 1 sesión con 6 meses de vigencia.
    // - Paquetes: N sesiones con 1 año de vigencia (pueden tomarse cuando quieran).

    const planData = [
      // ── Planes semestrales ──────────────────────────────────────────────
      {
        key: "plan-semestral",
        name: "PLAN SEMESTRAL",
        description: "1 atención podológica con vigencia de 6 meses desde la fecha de asignación.",
        planType: "HYBRID",
        price: 80.0,
        durationDays: 180,
        includedSessions: 1,
        color: "#8b5cf6",
      },
      // ── Planes anuales ──────────────────────────────────────────────────
      {
        key: "plan-anual-x1",
        name: "PLAN ANUAL X 1",
        description: "1 atención podológica con vigencia de 1 año desde la fecha de asignación.",
        planType: "HYBRID",
        price: 150.0,
        durationDays: 365,
        includedSessions: 1,
        color: "#3b82f6",
      },
      {
        key: "plan-anual-x2",
        name: "PLAN ANUAL X 2",
        description: "2 atenciones podológicas con vigencia de 1 año desde la fecha de asignación.",
        planType: "HYBRID",
        price: 250.0,
        durationDays: 365,
        includedSessions: 2,
        color: "#0ea5e9",
      },
      {
        key: "plan-anual-x3",
        name: "PLAN ANUAL X 3",
        description: "3 atenciones podológicas con vigencia de 1 año desde la fecha de asignación.",
        planType: "HYBRID",
        price: 350.0,
        durationDays: 365,
        includedSessions: 3,
        color: "#06b6d4",
      },
      {
        key: "plan-anual-x4",
        name: "PLAN ANUAL X 4",
        description: "4 atenciones podológicas con vigencia de 1 año desde la fecha de asignación.",
        planType: "HYBRID",
        price: 450.0,
        durationDays: 365,
        includedSessions: 4,
        color: "#14b8a6",
      },
      {
        key: "plan-anual-x5",
        name: "PLAN ANUAL X 5",
        description: "5 atenciones podológicas con vigencia de 1 año desde la fecha de asignación.",
        planType: "HYBRID",
        price: 550.0,
        durationDays: 365,
        includedSessions: 5,
        color: "#22c55e",
      },
      // ── Paquetes de sesiones ─────────────────────────────────────────────
      {
        key: "paquete-6-sesiones",
        name: "PAQUETE DE 6 SESIONES",
        description: "Paquete de 6 atenciones podológicas. Vigencia de 1 año — las sesiones se pueden usar cuando quiera.",
        planType: "HYBRID",
        price: 265.0,
        durationDays: 365,
        includedSessions: 6,
        color: "#f97316",
      },
      {
        key: "paquete-12-sesiones",
        name: "PAQUETE DE 12 SESIONES",
        description: "Paquete de 12 atenciones podológicas. Vigencia de 1 año — las sesiones se pueden usar cuando quiera.",
        planType: "HYBRID",
        price: 450.0,
        durationDays: 365,
        includedSessions: 12,
        color: "#ec4899",
      },
      {
        key: "paquete-10-sesiones-ozono",
        name: "PAQUETE DE 10 SESIONES DE OZONO",
        description: "Paquete de 10 sesiones de tratamiento de ozono podológico. Vigencia de 1 año — las sesiones se pueden usar cuando quiera.",
        planType: "HYBRID",
        price: 500.0,
        durationDays: 365,
        includedSessions: 10,
        color: "#6366f1",
      },
    ];

    const plans = [];
    for (const data of planData) {
      const plan = await prisma.plan.upsert({
        where: { id: data.key },
        update: {
          name: data.name,
          description: data.description,
          planType: data.planType,
          price: data.price,
          durationDays: data.durationDays,
          includedSessions: data.includedSessions,
          color: data.color,
          isActive: true,
        },
        create: {
          id: data.key,
          name: data.name,
          description: data.description,
          planType: data.planType,
          price: data.price,
          durationDays: data.durationDays,
          includedSessions: data.includedSessions,
          color: data.color,
          isActive: true,
        },
      });
      plans.push(plan);
      console.log(`  ✓ ${data.name} — S/ ${data.price} (${data.includedSessions} sesión${data.includedSessions !== 1 ? "es" : ""}, ${data.durationDays} días)`);
    }

    // ── Clientes de prueba ───────────────────────────────────────────────
    const testCustomers = [
      {
        firstName: "María",
        lastName: "Torres",
        documentType: "DNI",
        documentNumber: "99000001",
        phone: "999000001",
      },
      {
        firstName: "Carlos",
        lastName: "Ríos",
        documentType: "DNI",
        documentNumber: "99000002",
        phone: "999000002",
      },
    ];

    const customers = [];
    for (const c of testCustomers) {
      const customer = await prisma.customer.upsert({
        where: { documentNumber: c.documentNumber },
        update: {},
        create: {
          firstName: c.firstName,
          lastName: c.lastName,
          documentType: c.documentType,
          documentNumber: c.documentNumber,
          phone: c.phone,
          whatsappOptIn: true,
        },
      });
      customers.push(customer);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // planAnualX5 = plans[5], planAnualX2 = plans[2]
    const planAnualX5 = plans.find((p) => p.id === "plan-anual-x5")!;
    const planAnualX2 = plans.find((p) => p.id === "plan-anual-x2")!;

    // Suscripción 1: María Torres → PLAN ANUAL X 5 — 3 sesiones consumidas, quedan 2
    const subAnualX5 = await prisma.customerSubscription.upsert({
      where: { id: "seed-sub-001" },
      update: {},
      create: {
        id: "seed-sub-001",
        customerId: customers[0].id,
        planId: planAnualX5.id,
        branchId: branches[0].id,
        status: "ACTIVE",
        startDate: today,
        endDate: new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000),
        remainingSessions: 2, // consumió 3 de 5
        createdById: adminUser.id,
      },
    });

    for (let i = 0; i < 3; i++) {
      await prisma.subscriptionConsumption.create({
        data: {
          subscriptionId: subAnualX5.id,
          consumedSessions: 1,
          consumedAt: new Date(today.getTime() - (3 - i) * 30 * 24 * 60 * 60 * 1000),
          createdById: adminUser.id,
        },
      }).catch(() => {});
    }

    console.log(`  ✓ Suscripción: María Torres → PLAN ANUAL X 5 (2 sesiones restantes)`);

    // Suscripción 2: Carlos Ríos → PLAN ANUAL X 2 — vigente, 1 sesión consumida
    const startAnual = new Date();
    startAnual.setMonth(startAnual.getMonth() - 2);
    startAnual.setHours(0, 0, 0, 0);
    const endAnual = new Date(startAnual.getTime() + 365 * 24 * 60 * 60 * 1000);

    const subAnualX2 = await prisma.customerSubscription.upsert({
      where: { id: "seed-sub-002" },
      update: {},
      create: {
        id: "seed-sub-002",
        customerId: customers[1].id,
        planId: planAnualX2.id,
        branchId: branches[0].id,
        status: "ACTIVE",
        startDate: startAnual,
        endDate: endAnual,
        remainingSessions: 1, // consumió 1 de 2
        createdById: adminUser.id,
      },
    });

    await prisma.subscriptionConsumption.create({
      data: {
        subscriptionId: subAnualX2.id,
        consumedSessions: 1,
        consumedAt: new Date(startAnual.getTime() + 45 * 24 * 60 * 60 * 1000),
        createdById: adminUser.id,
      },
    }).catch(() => {});

    console.log(`  ✓ Suscripción: Carlos Ríos → PLAN ANUAL X 2 (1 sesión restante)`);

    console.log("✅ Planes y suscripciones creados\n");

    // ============================================================
    // 9. CAJA REGISTRADORA DE EJEMPLO
    // ============================================================
    console.log("🏧 Creando caja registradora de ejemplo...");

    // Caja abierta en Lima Centro (sede principal)
    const seedCashRegister = await prisma.cashRegister.upsert({
      where: { id: "seed-cash-register-001" },
      update: {},
      create: {
        id: "seed-cash-register-001",
        branch: { connect: { id: branches[0].id } },
        openedBy: { connect: { id: adminUser.id } },
        openingBalance: 200.0,
        status: "OPEN",
        notes: "Caja de apertura para pruebas",
      },
    });

    // Movimientos de ejemplo
    await prisma.cashMovement.upsert({
      where: { id: "seed-movement-001" },
      update: {},
      create: {
        id: "seed-movement-001",
        cashRegister: { connect: { id: seedCashRegister.id } },
        type: "IN",
        amount: 150.0,
        reason: "Venta servicio podología básica",
        createdBy: { connect: { id: adminUser.id } },
      },
    });

    await prisma.cashMovement.upsert({
      where: { id: "seed-movement-002" },
      update: {},
      create: {
        id: "seed-movement-002",
        cashRegister: { connect: { id: seedCashRegister.id } },
        type: "IN",
        amount: 80.0,
        reason: "Venta producto crema especializada",
        createdBy: { connect: { id: adminUser.id } },
      },
    });

    await prisma.cashMovement.upsert({
      where: { id: "seed-movement-003" },
      update: {},
      create: {
        id: "seed-movement-003",
        cashRegister: { connect: { id: seedCashRegister.id } },
        type: "OUT",
        amount: 30.0,
        reason: "Compra insumos limpieza",
        createdBy: { connect: { id: adminUser.id } },
      },
    });

    console.log(`  ✓ Caja abierta: ${seedCashRegister.id} (saldo inicial S/ 200.00)`);
    console.log(`  ✓ Movimientos de ejemplo: 2 entradas, 1 salida`);
    console.log(`  ✓ Balance actual: S/ ${(200 + 150 + 80 - 30).toFixed(2)}`);
    console.log("✅ Caja registradora creada\n");

    // ============================================================
    // 10. RESUMEN FINAL
    // ============================================================
    console.log("📊 === RESUMEN DE SEED ===");
    console.log(`\n✓ Sedes creadas: ${branches.length}`);
    console.log(`✓ Usuarios creados: 13`);
    console.log(`✓ Roles configurados: ${roleMap.size}`);
    console.log(`✓ Permisos configurados: ${allPermissions.length}`);
    console.log(`✓ Productos de producción: ${productData.length} (catálogo real — sin stock inicial)`);
    console.log(`✓ Servicios de producción: ${serviceData.length} (17 con cita + 6 sin cita)`);
    console.log(`✓ Planes de producción: ${planData.length} (1 semestral + 5 anuales + 3 paquetes, todos HYBRID)`);
    console.log(`✓ Suscripciones de ejemplo: 2`);
    console.log(`✓ Caja abierta: 1 (Lima Centro, S/ 400 balance)`);
    console.log(`✓ Movimientos de caja: 3 (2 IN, 1 OUT)`);
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

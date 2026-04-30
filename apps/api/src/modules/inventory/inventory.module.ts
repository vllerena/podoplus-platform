import { Module } from "@nestjs/common";
import { InventoryService }      from "./inventory.service";
import { PurchasesService }      from "./purchases.service";
import { ProductsController }    from "./products.controller";
import { InventoryController }   from "./inventory.controller";
import { SuppliersController }   from "./suppliers.controller";
import { PurchasesController }   from "./purchases.controller";
import { PrismaModule }          from "../prisma/prisma.module";
import { RbacModule }            from "../rbac/rbac.module";
import { AuditModule }           from "../audit/audit.module";

@Module({
  imports:     [PrismaModule, RbacModule, AuditModule],
  providers:   [InventoryService, PurchasesService],
  exports:     [InventoryService, PurchasesService],
  controllers: [
    ProductsController,
    InventoryController,
    SuppliersController,
    PurchasesController,
  ],
})
export class InventoryModule {}

import { Module } from "@nestjs/common";
import { CustomersService } from "./customers.service";
import { CustomersController } from "./customers.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { RbacModule } from "../rbac/rbac.module";

@Module({
  imports: [PrismaModule, RbacModule],
  providers: [CustomersService],
  controllers: [CustomersController],
  exports: [CustomersService],
})
export class CustomersModule {}

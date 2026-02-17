import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { RbacService } from "./rbac.service";
import { RbacController } from "./rbac.controller";

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [RbacService],
  controllers: [RbacController],
  exports: [RbacService],
})
export class RbacModule {}

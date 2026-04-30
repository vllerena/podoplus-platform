import { Module } from "@nestjs/common";
import { WhatsappLogService }  from "./whatsapp-log.service";
import { WhatsappController }  from "./whatsapp.controller";
import { PrismaModule }        from "../prisma/prisma.module";
import { RbacModule }          from "../rbac/rbac.module";

@Module({
  imports:     [PrismaModule, RbacModule],
  providers:   [WhatsappLogService],
  controllers: [WhatsappController],
  exports:     [WhatsappLogService],
})
export class WhatsappModule {}

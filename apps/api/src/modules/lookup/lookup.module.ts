import { Module } from "@nestjs/common";
import { LookupController } from "./lookup.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports:     [AuthModule],
  controllers: [LookupController],
})
export class LookupModule {}

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger("PrismaService");

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log("✅ Base de datos conectada correctamente");
    } catch (error) {
      this.logger.error("❌ Error conectando a la base de datos:", error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log("🔌 Base de datos desconectada");
    } catch (error) {
      this.logger.error("Error desconectando base de datos:", error);
    }
  }
}

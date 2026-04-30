import { Global, Module } from "@nestjs/common";
import { CacheService } from "./cache.service";

/**
 * Global: cualquier módulo puede inyectar CacheService sin importar CacheModule.
 * El RedisModule (global, registrado en AppModule) provee el @InjectRedis().
 */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}

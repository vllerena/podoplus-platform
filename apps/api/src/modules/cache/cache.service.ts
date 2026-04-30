import { Injectable, Logger } from "@nestjs/common";
import { InjectRedis } from "@nestjs-modules/ioredis";
import { Redis } from "ioredis";

/**
 * CacheService — wrapper ligero sobre ioredis para caché con TTL.
 *
 * Principios:
 * - Cache-aside: el servicio lee de Redis; si no hay hit, llama al callback
 *   y guarda el resultado.
 * - Fail-open: si Redis no responde, el error se logea y se devuelve el
 *   valor de la fuente directamente (la DB). Nunca rompe el flujo principal.
 * - Namespace: todas las keys tienen el prefijo "podo:" para evitar
 *   colisiones con otras apps que compartan la misma instancia de Redis.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger("CacheService");
  private readonly PREFIX = "podo:";

  constructor(@InjectRedis() private readonly redis: Redis) {}

  // ─────────────────────────────────────────────────────────────────────────
  // get / set / del
  // ─────────────────────────────────────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(this.k(key));
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (err: any) {
      this.logger.warn(`Cache GET error [${key}]: ${err.message}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(this.k(key), JSON.stringify(value), "EX", ttlSeconds);
    } catch (err: any) {
      this.logger.warn(`Cache SET error [${key}]: ${err.message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(this.k(key));
    } catch (err: any) {
      this.logger.warn(`Cache DEL error [${key}]: ${err.message}`);
    }
  }

  /**
   * Elimina todas las keys que coincidan con el patrón dado.
   * Usa SCAN para no bloquear Redis con KEYS en producción.
   *
   * @param pattern — patrón glob SIN el prefijo, ej. "services:*"
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      const fullPattern = this.k(pattern);
      let cursor = "0";
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          "MATCH",
          fullPattern,
          "COUNT",
          100
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } while (cursor !== "0");
    } catch (err: any) {
      this.logger.warn(`Cache DEL PATTERN error [${pattern}]: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // wrap — cache-aside helper
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Cache-aside: devuelve el valor cacheado o llama a `fn()`, guarda
   * el resultado y lo devuelve.
   *
   * Si Redis falla en cualquier punto, llama directamente a `fn()`.
   */
  async wrap<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      this.logger.debug(`Cache HIT: ${key}`);
      return cached;
    }

    this.logger.debug(`Cache MISS: ${key}`);
    const value = await fn();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Set operations — para índices de sesiones activas
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Agrega un miembro a un Set Redis y opcionalmente establece/renueva el TTL.
   */
  async sAdd(key: string, member: string, ttlSeconds?: number): Promise<void> {
    try {
      await this.redis.sadd(this.k(key), member);
      if (ttlSeconds !== undefined) {
        await this.redis.expire(this.k(key), ttlSeconds);
      }
    } catch (err: any) {
      this.logger.warn(`Cache SADD error [${key}]: ${err.message}`);
    }
  }

  /**
   * Devuelve todos los miembros de un Set Redis.
   */
  async sMembers(key: string): Promise<string[]> {
    try {
      return await this.redis.smembers(this.k(key));
    } catch (err: any) {
      this.logger.warn(`Cache SMEMBERS error [${key}]: ${err.message}`);
      return [];
    }
  }

  /**
   * Elimina un miembro de un Set Redis.
   */
  async sRem(key: string, member: string): Promise<void> {
    try {
      await this.redis.srem(this.k(key), member);
    } catch (err: any) {
      this.logger.warn(`Cache SREM error [${key}]: ${err.message}`);
    }
  }

  /**
   * Renueva el TTL de una key existente (sin cambiar el valor).
   */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.expire(this.k(key), ttlSeconds);
    } catch (err: any) {
      this.logger.warn(`Cache EXPIRE error [${key}]: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Atomic increment — para contadores de intentos fallidos
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Incrementa atómicamente un contador y fija el TTL solo al crearlo.
   * Usa INCR (atómico en Redis) + EXPIRE condicional para evitar
   * race conditions en contadores de brute-force / rate limiting.
   * Devuelve el valor tras el incremento.
   */
  async incr(key: string, ttlSeconds: number): Promise<number> {
    try {
      const fullKey = this.k(key);
      const value = await this.redis.incr(fullKey);
      // Solo fijar TTL en la primera escritura para no resetear el timer
      if (value === 1) {
        await this.redis.expire(fullKey, ttlSeconds);
      }
      return value;
    } catch (err: any) {
      this.logger.warn(`Cache INCR error [${key}]: ${err.message}`);
      return 1;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Batch operations — para sesiones y revocaciones masivas
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Obtiene múltiples keys en una sola llamada a Redis (MGET).
   * Devuelve array de valores (null si la key no existe).
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    try {
      const fullKeys = keys.map((k) => this.k(k));
      const values = await this.redis.mget(...fullKeys);
      return values.map((raw) => {
        if (raw === null) return null;
        try { return JSON.parse(raw) as T; } catch { return null; }
      });
    } catch (err: any) {
      this.logger.warn(`Cache MGET error: ${err.message}`);
      return keys.map(() => null);
    }
  }

  /**
   * Elimina múltiples keys en una sola llamada a Redis (DEL key1 key2 …).
   */
  async delMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      const fullKeys = keys.map((k) => this.k(k));
      await this.redis.del(...fullKeys);
    } catch (err: any) {
      this.logger.warn(`Cache DEL MANY error: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private k(key: string): string {
    return `${this.PREFIX}${key}`;
  }
}

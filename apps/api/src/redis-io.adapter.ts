import { IoAdapter } from "@nestjs/platform-socket.io";
import { INestApplication, Logger } from "@nestjs/common";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { ServerOptions } from "socket.io";

/**
 * RedisIoAdapter
 *
 * Wraps the standard NestJS IoAdapter and attaches the @socket.io/redis-adapter
 * so that Socket.IO events are broadcast across all Node.js processes (e.g. PM2
 * cluster, multiple Docker replicas) via Redis pub/sub.
 *
 * Usage in main.ts:
 *   const adapter = new RedisIoAdapter(app);
 *   await adapter.connectToRedis(redisHost, redisPort);
 *   app.useWebSocketAdapter(adapter);
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger("RedisIoAdapter");
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(app: INestApplication) {
    super(app);
  }

  /**
   * Creates a pub/sub pair of ioredis clients and wires up the Redis adapter.
   * Falls back to the default in-memory adapter if Redis is unreachable so that
   * the application can still start in environments without Redis.
   */
  async connectToRedis(host: string, port: number): Promise<void> {
    const redisOptions = { host, port, lazyConnect: true };

    const pubClient = new Redis(redisOptions);
    const subClient = new Redis(redisOptions);

    // Attach error handlers BEFORE connecting so errors don't crash the process.
    const onError = (role: "pub" | "sub") => (err: Error) => {
      this.logger.warn(
        `Redis ${role} client error — WebSocket events will NOT propagate ` +
          `across multiple processes. Error: ${err.message}`,
      );
    };
    pubClient.on("error", onError("pub"));
    subClient.on("error", onError("sub"));

    try {
      await Promise.all([pubClient.connect(), subClient.connect()]);
      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log(
        `Redis adapter connected — pub/sub ready on ${host}:${port}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Could not connect to Redis (${host}:${port}): ${message}. ` +
          "Falling back to in-memory adapter — multi-process WebSocket sync is DISABLED.",
      );
      // Clean up clients that failed to connect so they don't linger.
      pubClient.disconnect();
      subClient.disconnect();
      // adapterConstructor intentionally left undefined; createIOServer will
      // use the Socket.IO default in-memory adapter.
    }
  }

  /**
   * Called by NestJS when creating the underlying Socket.IO server.
   * Attaches the Redis adapter if connectToRedis() succeeded.
   */
  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
      this.logger.log("Socket.IO server using Redis adapter");
    } else {
      this.logger.warn(
        "Socket.IO server using in-memory adapter (Redis adapter not available)",
      );
    }

    return server;
  }
}

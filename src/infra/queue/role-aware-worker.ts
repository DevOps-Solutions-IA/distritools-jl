import { Processor, RedisConnection, Worker, WorkerOptions } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import { createWorkerRedisOptionsFromConnection } from 'src/infra/queue/redis-role-connection-options';

export class RoleAwareWorker<DataType = unknown, ResultType = unknown, NameType extends string = string>
  extends Worker<DataType, ResultType, NameType> {
  constructor(
    name: string,
    processor?: string | URL | Processor<DataType, ResultType, NameType>,
    options?: WorkerOptions,
    Connection?: typeof RedisConnection,
  ) {
    const connection = options?.connection as RedisOptions | undefined;
    if (!connection || typeof connection.host !== 'string' || typeof connection.port !== 'number' || 'connect' in connection) {
      throw new Error('Queue worker requires configured Redis connection options');
    }
    // Nest supplies the registered producer queue options even when a processor has a configKey.
    // Keep its configured target/identity and apply the persistent worker policy at construction.
    super(name, processor, {
      ...options,
      connection: createWorkerRedisOptionsFromConnection(connection),
    }, Connection);
  }

  override async close(force = false): Promise<void> {
    if (this.closing) return super.close(force);
    let timer: NodeJS.Timeout | undefined;
    try {
      // Worker.waitUntilReady settles both command and blocking connection initialization.
      // Closing either connection before this handshake settles can leave a late SDK rejection.
      await Promise.race([
        this.waitUntilReady(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Worker connection initialization deadline exceeded')), force ? 250 : 5_000);
        }),
      ]);
    } catch (error) {
      await super.close(true);
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
    await super.close(force);
  }
}

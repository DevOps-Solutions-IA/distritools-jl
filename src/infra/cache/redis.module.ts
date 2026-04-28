import { Global, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS = Symbol('REDIS');

@Injectable()
class RedisProvider implements OnModuleDestroy {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }
}

@Global()
@Module({
  providers: [
    RedisProvider,
    {
      provide: REDIS,
      useFactory: (provider: RedisProvider) => provider.getClient(),
      inject: [RedisProvider],
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}

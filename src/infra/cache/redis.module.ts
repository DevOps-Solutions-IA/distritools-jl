import { Global, Inject, Injectable, Module, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS = Symbol('REDIS');

@Injectable()
class RedisProvider implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(@Optional() configService?: ConfigService) {
    const url = configService?.get<string>('REDIS_URL') || process.env.REDIS_URL || 'redis://localhost:6379';

    this.client = new Redis(url, {
      connectTimeout: 5_000,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt) => attempt >= 5 ? null : Math.min(1_000, attempt * 200),
    });
  }

  getClient(): Redis {
    return this.client;
  }

  onModuleDestroy(): void {
    if (this.client.status !== 'end') {
      this.client.disconnect();
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

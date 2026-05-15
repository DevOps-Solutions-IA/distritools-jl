import { Global, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS = Symbol('REDIS');

@Injectable()
class RedisProvider implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(configService: ConfigService) {
    const url = configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';

    this.client = new Redis(url);
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

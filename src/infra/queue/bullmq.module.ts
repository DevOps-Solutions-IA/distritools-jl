import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { AUTH_QUEUE_NAME } from 'src/common/constants/auth.constants';

const DOMAIN_EVENTS_QUEUE = 'domain-events';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: AUTH_QUEUE_NAME }),
    BullModule.registerQueue({ name: DOMAIN_EVENTS_QUEUE }),
  ],
  exports: [BullModule],
})
export class BullQueueModule {}

export { DOMAIN_EVENTS_QUEUE };

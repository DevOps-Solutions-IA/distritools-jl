import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AUTH_QUEUE_NAME } from 'src/common/constants/auth.constants';

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      },
    }),
    BullModule.registerQueue({
      name: AUTH_QUEUE_NAME,
    }),
  ],
  exports: [BullModule],
})
export class BullQueueModule {}

import { Global, Module } from '@nestjs/common';
import { RequestContextService } from 'src/common/request/request-context.service';

@Global()
@Module({
  providers: [RequestContextService],
  exports: [RequestContextService],
})
export class RequestContextModule {}

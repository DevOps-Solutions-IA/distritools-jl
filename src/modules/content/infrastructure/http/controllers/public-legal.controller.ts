import { Controller, Get, Header, Inject, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { GetPublishedLegalUseCase } from 'src/modules/content/application/use-cases/get-published-legal.use-case';

@ApiTags('content')
@Controller('content/legal')
export class PublicLegalController {
  constructor(@Inject(GetPublishedLegalUseCase) private readonly getPublishedLegal: GetPublishedLegalUseCase) {}

  @Public()
  @Get(':pageKey')
  @Header('Cache-Control', 'no-store')
  get(@Param('pageKey') pageKey: string) {
    return this.getPublishedLegal.execute(pageKey);
  }
}

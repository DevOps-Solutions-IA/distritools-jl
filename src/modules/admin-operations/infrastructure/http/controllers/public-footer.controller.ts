import { Controller, Get, Header, Inject } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { PublicFooterService } from 'src/modules/admin-operations/application/public-footer.service';

@Controller('content/footer')
export class PublicFooterController {
  constructor(
    @Inject(PublicFooterService) private readonly footer: PublicFooterService,
  ) {}

  @Public()
  @Get()
  @Header('Cache-Control', 'no-store')
  getPublished() {
    return this.footer.getPublished();
  }
}

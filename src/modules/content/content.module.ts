import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { CreateContentBlockUseCase } from 'src/modules/content/application/use-cases/create-content-block.use-case';
import { ListAdminContentUseCase } from 'src/modules/content/application/use-cases/list-admin-content.use-case';
import { ListPublicContentUseCase } from 'src/modules/content/application/use-cases/list-public-content.use-case';
import { SetContentPublishedUseCase } from 'src/modules/content/application/use-cases/set-content-published.use-case';
import { UpdateContentBlockUseCase } from 'src/modules/content/application/use-cases/update-content-block.use-case';
import {
  CONTENT_REPOSITORY,
} from 'src/modules/content/domain/repositories/content.repository';
import { ContentPublicationService } from 'src/modules/content/domain/services/content-publication.service';
import { ContentController } from 'src/modules/content/infrastructure/http/controllers/content.controller';
import { PrismaContentRepository } from 'src/modules/content/infrastructure/repositories/prisma-content.repository';

@Module({
  imports: [AuthModule],
  controllers: [ContentController],
  providers: [
    ContentPublicationService,
    CreateContentBlockUseCase,
    UpdateContentBlockUseCase,
    SetContentPublishedUseCase,
    ListAdminContentUseCase,
    ListPublicContentUseCase,
    PrismaContentRepository,
    {
      provide: CONTENT_REPOSITORY,
      useExisting: PrismaContentRepository,
    },
  ],
  exports: [CONTENT_REPOSITORY],
})
export class ContentModule {}

import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { CreateContentBlockUseCase } from 'src/modules/content/application/use-cases/create-content-block.use-case';
import { ListAdminContentUseCase } from 'src/modules/content/application/use-cases/list-admin-content.use-case';
import { ListPublicContentUseCase } from 'src/modules/content/application/use-cases/list-public-content.use-case';
import { SetContentPublishedUseCase } from 'src/modules/content/application/use-cases/set-content-published.use-case';
import { UpdateContentBlockUseCase } from 'src/modules/content/application/use-cases/update-content-block.use-case';
import { CreateContentBlockRequestDto } from 'src/modules/content/infrastructure/http/dto/create-content-block.request.dto';
import { UpdateContentBlockRequestDto } from 'src/modules/content/infrastructure/http/dto/update-content-block.request.dto';

@ApiTags('content')
@Controller()
export class ContentController {
  constructor(
    @Inject(CreateContentBlockUseCase)
    private readonly createContentBlockUseCase: CreateContentBlockUseCase,
    @Inject(UpdateContentBlockUseCase)
    private readonly updateContentBlockUseCase: UpdateContentBlockUseCase,
    @Inject(SetContentPublishedUseCase)
    private readonly setContentPublishedUseCase: SetContentPublishedUseCase,
    @Inject(ListAdminContentUseCase)
    private readonly listAdminContentUseCase: ListAdminContentUseCase,
    @Inject(ListPublicContentUseCase)
    private readonly listPublicContentUseCase: ListPublicContentUseCase,
  ) {}

  @Public()
  @Get('content')
  publicList(@Query('placementKey') placementKey?: string) {
    return this.listPublicContentUseCase.execute(placementKey);
  }

  @ApiBearerAuth()
  @Permissions('content.manage')
  @Get('admin/content')
  adminList(@CurrentUserDecorator() actor: CurrentUser) {
    return this.listAdminContentUseCase.execute(actor);
  }

  @ApiBearerAuth()
  @Permissions('content.manage')
  @Post('admin/content')
  create(
    @Body() body: CreateContentBlockRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
  ) {
    return this.createContentBlockUseCase.execute(actor, {
      ...body,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
    });
  }

  @ApiBearerAuth()
  @Permissions('content.manage')
  @Patch('admin/content/:contentBlockId')
  update(
    @Param('contentBlockId') contentBlockId: string,
    @Body() body: UpdateContentBlockRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
  ) {
    return this.updateContentBlockUseCase.execute(actor, contentBlockId, {
      ...body,
      startsAt: body.startsAt ? new Date(body.startsAt) : body.startsAt === null ? null : undefined,
      endsAt: body.endsAt ? new Date(body.endsAt) : body.endsAt === null ? null : undefined,
    });
  }

  @ApiBearerAuth()
  @Permissions('content.manage')
  @Patch('admin/content/:contentBlockId/publish')
  publish(
    @Param('contentBlockId') contentBlockId: string,
    @CurrentUserDecorator() actor: CurrentUser,
  ) {
    return this.setContentPublishedUseCase.execute(actor, contentBlockId, true);
  }

  @ApiBearerAuth()
  @Permissions('content.manage')
  @Patch('admin/content/:contentBlockId/unpublish')
  unpublish(
    @Param('contentBlockId') contentBlockId: string,
    @CurrentUserDecorator() actor: CurrentUser,
  ) {
    return this.setContentPublishedUseCase.execute(actor, contentBlockId, false);
  }
}

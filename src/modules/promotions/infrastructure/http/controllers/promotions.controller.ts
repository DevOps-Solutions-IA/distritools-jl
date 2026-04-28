import { Body, Controller, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { CreatePromotionUseCase } from 'src/modules/promotions/application/use-cases/create-promotion.use-case';
import { ListPromotionsUseCase } from 'src/modules/promotions/application/use-cases/list-promotions.use-case';
import { SetPromotionActiveUseCase } from 'src/modules/promotions/application/use-cases/set-promotion-active.use-case';
import { UpdatePromotionUseCase } from 'src/modules/promotions/application/use-cases/update-promotion.use-case';
import { CreatePromotionRequestDto } from 'src/modules/promotions/infrastructure/http/dto/create-promotion.request.dto';
import { UpdatePromotionRequestDto } from 'src/modules/promotions/infrastructure/http/dto/update-promotion.request.dto';

@ApiTags('promotions')
@ApiBearerAuth()
@Controller('admin/promotions')
export class PromotionsController {
  constructor(
    @Inject(CreatePromotionUseCase)
    private readonly createPromotionUseCase: CreatePromotionUseCase,
    @Inject(UpdatePromotionUseCase)
    private readonly updatePromotionUseCase: UpdatePromotionUseCase,
    @Inject(SetPromotionActiveUseCase)
    private readonly setPromotionActiveUseCase: SetPromotionActiveUseCase,
    @Inject(ListPromotionsUseCase)
    private readonly listPromotionsUseCase: ListPromotionsUseCase,
  ) {}

  @Permissions('promotions.manage')
  @Post()
  create(
    @Body() body: CreatePromotionRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
  ) {
    return this.createPromotionUseCase.execute({
      actor,
      ...body,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
    });
  }

  @Permissions('promotions.manage')
  @Patch(':promotionId')
  update(
    @Param('promotionId') promotionId: string,
    @Body() body: UpdatePromotionRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
  ) {
    return this.updatePromotionUseCase.execute({
      actor,
      promotionId,
      ...body,
      startsAt: body.startsAt ? new Date(body.startsAt) : body.startsAt === null ? null : undefined,
      endsAt: body.endsAt ? new Date(body.endsAt) : body.endsAt === null ? null : undefined,
    });
  }

  @Permissions('promotions.manage')
  @Patch(':promotionId/activate')
  activate(
    @Param('promotionId') promotionId: string,
    @CurrentUserDecorator() actor: CurrentUser,
  ) {
    return this.setPromotionActiveUseCase.execute(actor, promotionId, true);
  }

  @Permissions('promotions.manage')
  @Patch(':promotionId/deactivate')
  deactivate(
    @Param('promotionId') promotionId: string,
    @CurrentUserDecorator() actor: CurrentUser,
  ) {
    return this.setPromotionActiveUseCase.execute(actor, promotionId, false);
  }

  @Permissions('promotions.manage')
  @Get()
  list(@CurrentUserDecorator() actor: CurrentUser) {
    return this.listPromotionsUseCase.execute(actor);
  }
}

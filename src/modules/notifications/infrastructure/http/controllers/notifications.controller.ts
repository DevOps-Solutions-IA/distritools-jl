import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { ListNotificationsUseCase } from 'src/modules/notifications/application/use-cases/list-notifications.use-case';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('admin/notifications')
export class NotificationsController {
  constructor(
    @Inject(ListNotificationsUseCase)
    private readonly listNotificationsUseCase: ListNotificationsUseCase,
  ) {}

  @Permissions('notifications.read')
  @Get()
  list(
    @CurrentUserDecorator() actor: CurrentUser,
    @Query('limit') limit?: string,
  ) {
    return this.listNotificationsUseCase.execute(
      actor,
      limit ? Number(limit) : undefined,
    );
  }
}

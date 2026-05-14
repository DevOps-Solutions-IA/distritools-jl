import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { GetAdminDashboardUseCase } from 'src/modules/analytics/application/use-cases/get-admin-dashboard.use-case';

@ApiTags('admin-dashboard')
@ApiBearerAuth()
@Controller('admin')
export class AdminDashboardController {
  constructor(
    @Inject(GetAdminDashboardUseCase)
    private readonly getAdminDashboardUseCase: GetAdminDashboardUseCase,
  ) {}

  @Permissions('dashboard.read')
  @Get('dashboard')
  dashboard(
    @CurrentUserDecorator() actor: CurrentUser,
    @Query('range') range?: string,
  ): Promise<unknown> {
    return this.getAdminDashboardUseCase.execute(actor, range);
  }
}

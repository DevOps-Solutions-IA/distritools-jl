import { Body, Controller, Get, Headers, Ip, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { AssignPermissionsToRoleUseCase } from 'src/modules/permissions/application/use-cases/assign-permissions-to-role.use-case';
import { GetPermissionsMatrixUseCase } from 'src/modules/permissions/application/use-cases/get-permissions-matrix.use-case';
import { AssignPermissionsToRoleRequestDto } from 'src/modules/permissions/infrastructure/http/dto/assign-permissions-to-role.request.dto';

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('admin')
export class PermissionsController {
  constructor(
    private readonly assignPermissionsToRoleUseCase: AssignPermissionsToRoleUseCase,
    private readonly getPermissionsMatrixUseCase: GetPermissionsMatrixUseCase,
  ) {}

  @Permissions('permissions.assign')
  @Put('roles/:roleId/permissions')
  assignToRole(
    @Param('roleId') roleId: string,
    @Body() body: AssignPermissionsToRoleRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.assignPermissionsToRoleUseCase.execute({
      actor,
      roleId,
      permissionSlugs: body.permissionSlugs,
      ipAddress,
      userAgent,
    });
  }

  @Permissions('permissions.read')
  @Get('permissions/matrix')
  getMatrix(@CurrentUserDecorator() actor: CurrentUser) {
    return this.getPermissionsMatrixUseCase.execute({ actor });
  }
}

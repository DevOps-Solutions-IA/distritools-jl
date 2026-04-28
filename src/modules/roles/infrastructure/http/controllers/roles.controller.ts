import {
  Body,
  Controller,
  Headers,
  Ip,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { AssignRoleToUserUseCase } from 'src/modules/roles/application/use-cases/assign-role-to-user.use-case';
import { CreateRoleUseCase } from 'src/modules/roles/application/use-cases/create-role.use-case';
import { UpdateRoleUseCase } from 'src/modules/roles/application/use-cases/update-role.use-case';
import { AssignRoleToUserRequestDto } from 'src/modules/roles/infrastructure/http/dto/assign-role-to-user.request.dto';
import { CreateRoleRequestDto } from 'src/modules/roles/infrastructure/http/dto/create-role.request.dto';
import { UpdateRoleRequestDto } from 'src/modules/roles/infrastructure/http/dto/update-role.request.dto';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('admin/roles')
export class RolesController {
  constructor(
    private readonly createRoleUseCase: CreateRoleUseCase,
    private readonly updateRoleUseCase: UpdateRoleUseCase,
    private readonly assignRoleToUserUseCase: AssignRoleToUserUseCase,
  ) {}

  @Permissions('roles.create')
  @Post()
  create(
    @Body() body: CreateRoleRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.createRoleUseCase.execute({
      actor,
      ...body,
      ipAddress,
      userAgent,
    });
  }

  @Permissions('roles.update')
  @Patch(':id')
  update(
    @Param('id') roleId: string,
    @Body() body: UpdateRoleRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.updateRoleUseCase.execute({
      actor,
      roleId,
      ...body,
      ipAddress,
      userAgent,
    });
  }

  @Permissions('roles.assign')
  @Post(':id/assign-user')
  assignToUser(
    @Param('id') roleId: string,
    @Body() body: AssignRoleToUserRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.assignRoleToUserUseCase.execute({
      actor,
      roleId,
      userId: body.userId,
      ipAddress,
      userAgent,
    });
  }
}

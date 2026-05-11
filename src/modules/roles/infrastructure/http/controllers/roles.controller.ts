import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
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
    @Inject(CreateRoleUseCase)
    private readonly createRoleUseCase: CreateRoleUseCase,
    @Inject(UpdateRoleUseCase)
    private readonly updateRoleUseCase: UpdateRoleUseCase,
    @Inject(AssignRoleToUserUseCase)
    private readonly assignRoleToUserUseCase: AssignRoleToUserUseCase,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  @Permissions('permissions.read')
  @Get()
  async list(@CurrentUserDecorator() _actor: CurrentUser) {
    const roles = await this.prisma.role.findMany({
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        users: true,
      },
      orderBy: { name: 'asc' },
    });

    return {
      data: roles.map((role) => ({
        id: role.id,
        name: role.name,
        slug: role.slug,
        description: role.description,
        usersCount: role.users.length,
        permissions: role.rolePermissions.map((rolePermission) => ({
          id: rolePermission.permission.id,
          slug: rolePermission.permission.slug,
          module: rolePermission.permission.module,
        })),
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      })),
    };
  }

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

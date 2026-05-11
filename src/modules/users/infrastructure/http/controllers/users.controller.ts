import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Ip,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { CreateAdminUserUseCase } from 'src/modules/users/application/use-cases/create-admin-user.use-case';
import { DeactivateAdminUserUseCase } from 'src/modules/users/application/use-cases/deactivate-admin-user.use-case';
import { GetAdminUserUseCase } from 'src/modules/users/application/use-cases/get-admin-user.use-case';
import { UpdateAdminUserUseCase } from 'src/modules/users/application/use-cases/update-admin-user.use-case';
import { CreateAdminUserRequestDto } from 'src/modules/users/infrastructure/http/dto/create-admin-user.request.dto';
import { UpdateAdminUserRequestDto } from 'src/modules/users/infrastructure/http/dto/update-admin-user.request.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('admin/users')
export class UsersController {
  constructor(
    @Inject(CreateAdminUserUseCase)
    private readonly createAdminUserUseCase: CreateAdminUserUseCase,
    @Inject(UpdateAdminUserUseCase)
    private readonly updateAdminUserUseCase: UpdateAdminUserUseCase,
    @Inject(DeactivateAdminUserUseCase)
    private readonly deactivateAdminUserUseCase: DeactivateAdminUserUseCase,
    @Inject(GetAdminUserUseCase)
    private readonly getAdminUserUseCase: GetAdminUserUseCase,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  @Permissions('users.read')
  @Get()
  async list(@CurrentUserDecorator() _actor: CurrentUser) {
    const users = await this.prisma.user.findMany({
      include: { role: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      data: users.map((user) => ({
        id: user.id,
        fullName: user.fullName,
        email: user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2'),
        phone: user.phone ? `${user.phone.slice(0, 3)}***${user.phone.slice(-2)}` : null,
        role: user.role ? { id: user.role.id, name: user.role.name, slug: user.role.slug } : null,
        isActive: user.isActive,
        twoFactorEnabled: Boolean(user.twoFactorSecret),
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      })),
    };
  }

  @Permissions('users.create')
  @Post()
  create(
    @Body() body: CreateAdminUserRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.createAdminUserUseCase.execute({
      actor,
      ...body,
      ipAddress,
      userAgent,
    });
  }

  @Permissions('users.read')
  @Get(':id')
  getOne(@Param('id') userId: string, @CurrentUserDecorator() actor: CurrentUser) {
    return this.getAdminUserUseCase.execute({ actor, userId });
  }

  @Permissions('users.update')
  @Patch(':id')
  update(
    @Param('id') userId: string,
    @Body() body: UpdateAdminUserRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.updateAdminUserUseCase.execute({
      actor,
      userId,
      ...body,
      ipAddress,
      userAgent,
    });
  }

  @Permissions('users.deactivate')
  @Patch(':id/deactivate')
  deactivate(
    @Param('id') userId: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.deactivateAdminUserUseCase.execute({
      actor,
      userId,
      ipAddress,
      userAgent,
    });
  }
}

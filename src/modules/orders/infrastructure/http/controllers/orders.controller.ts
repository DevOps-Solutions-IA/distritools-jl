import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Query,
  Ip,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { CancelOrderUseCase } from 'src/modules/orders/application/use-cases/cancel-order.use-case';
import { CreateOrderUseCase } from 'src/modules/orders/application/use-cases/create-order.use-case';
import { GetOrderUseCase } from 'src/modules/orders/application/use-cases/get-order.use-case';
import { TrackOrderUseCase } from 'src/modules/orders/application/use-cases/track-order.use-case';
import { CancelOrderRequestDto } from 'src/modules/orders/infrastructure/http/dto/cancel-order.request.dto';
import { CreateOrderRequestDto } from 'src/modules/orders/infrastructure/http/dto/create-order.request.dto';

@ApiTags('orders')
@Controller()
export class OrdersController {
  constructor(
    @Inject(CreateOrderUseCase)
    private readonly createOrderUseCase: CreateOrderUseCase,
    @Inject(CancelOrderUseCase)
    private readonly cancelOrderUseCase: CancelOrderUseCase,
    @Inject(GetOrderUseCase)
    private readonly getOrderUseCase: GetOrderUseCase,
    @Inject(TrackOrderUseCase)
    private readonly trackOrderUseCase: TrackOrderUseCase,
  ) {}

  @Public()
  @Post('orders')
  create(
    @Body() body: CreateOrderRequestDto,
    @Ip() ipAddress: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.createOrderUseCase.execute({
      ...body,
      idempotencyKey,
      ipAddress,
      userAgent,
    });
  }

  @Public()
  @Get('orders/track')
  track(@Query('query') query = '') {
    return this.trackOrderUseCase.execute(query);
  }

  @Public()
  @Get('orders/:orderNumber')
  getPublic(@Param('orderNumber') orderNumber: string) {
    return this.getOrderUseCase.execute({
      orderNumber,
      adminView: false,
    });
  }

  @Public()
  @Post('orders/:orderNumber/cancel')
  cancelPublic(
    @Param('orderNumber') orderNumber: string,
    @Body() body: CancelOrderRequestDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.cancelOrderUseCase.execute({
      orderNumber,
      reason: body.reason,
      ipAddress,
      userAgent,
    });
  }

  @ApiBearerAuth()
  @Permissions('orders.read')
  @Get('admin/orders/:orderId')
  getAdmin(
    @Param('orderId') orderId: string,
    @CurrentUserDecorator() actor: CurrentUser,
  ) {
    return this.getOrderUseCase.execute({
      actor,
      orderId,
      adminView: true,
    });
  }

  @ApiBearerAuth()
  @Permissions('orders.cancel')
  @Post('admin/orders/:orderNumber/cancel')
  cancelAdmin(
    @Param('orderNumber') orderNumber: string,
    @Body() body: CancelOrderRequestDto,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.cancelOrderUseCase.execute({
      actor,
      orderNumber,
      reason: body.reason,
      ipAddress,
      userAgent,
    });
  }
}

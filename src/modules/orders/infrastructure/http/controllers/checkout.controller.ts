import { Body, Controller, Headers, Inject, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { CreateGuestCheckoutOrderUseCase } from 'src/modules/orders/application/use-cases/create-guest-checkout-order.use-case';
import { CreateGuestCheckoutOrderRequestDto } from 'src/modules/orders/infrastructure/http/dto/create-guest-checkout-order.request.dto';

@ApiTags('checkout')
@Controller()
export class CheckoutController {
  constructor(
    @Inject(CreateGuestCheckoutOrderUseCase)
    private readonly createGuestCheckoutOrderUseCase: CreateGuestCheckoutOrderUseCase,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('checkout/guest-order')
  createGuestOrder(
    @Body() body: CreateGuestCheckoutOrderRequestDto,
    @Ip() ipAddress: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.createGuestCheckoutOrderUseCase.execute({
      ...body,
      idempotencyKey,
      ipAddress,
      userAgent,
    });
  }
}

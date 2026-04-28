import { Inject, Injectable } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import {
  PAYMENT_REPOSITORY,
  PaymentRepository,
} from 'src/modules/payments/domain/repositories/payment.repository';
import { PaymentEntity } from 'src/modules/payments/domain/entities/payment.entity';
import { PaymentPolicyService } from 'src/modules/payments/domain/services/payment-policy.service';

export interface GetPaymentStatusInput {
  actor?: CurrentUser;
  paymentId: string;
}

@Injectable()
export class GetPaymentStatusUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepository,
    @Inject(PaymentPolicyService)
    private readonly paymentPolicyService: PaymentPolicyService,
  ) {}

  async execute(input: GetPaymentStatusInput) {
    if (input.actor) {
      assertHasPermissions(input.actor.permissions, ['payments.read']);
    }

    const paymentRecord = await this.paymentRepository.findById(input.paymentId);
    const payment = paymentRecord ? PaymentEntity.fromState(paymentRecord) : null;
    this.paymentPolicyService.ensurePaymentExists(payment);

    return payment.toResponse();
  }
}

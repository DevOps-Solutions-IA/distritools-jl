import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConflictException } from '@nestjs/common';
import { PAYMENT_METHODS } from 'src/modules/payments/domain/payment-methods';
import { NullPaymentAdapter } from 'src/modules/payments/infrastructure/gateways/null-payment.adapter';
import { NullShippingAdapter } from 'src/modules/shipping/infrastructure/providers/null-shipping.adapter';

describe('Checkout provider contracts', async () => {
  await it('modela pago contra entrega sin marcar pago como cobrado', () => {
    const method = PAYMENT_METHODS.cash_on_delivery;

    assert.equal(method.enabled, true);
    assert.equal(method.requiresGateway, false);
    assert.equal(method.requiresManualConfirmation, true);
    assert.equal(method.allowedForQuoteOnly, false);
    assert.equal(method.allowedForMixedCart, true);
  });

  await it('PSE queda preparado pero cerrado cuando no hay proveedor configurado', async () => {
    const method = PAYMENT_METHODS.pse;
    const provider = new NullPaymentAdapter();

    assert.equal(method.requiresGateway, true);
    assert.equal(method.requiresOnlineRedirect, true);

    await assert.rejects(
      () =>
        provider.createPaymentIntent({
          orderId: 'ord-1',
          orderNumber: 'DTJL-001',
          amount: '100000.00',
          currency: 'COP',
          method: 'pse',
          idempotencyKey: 'idem-1',
        }),
      ConflictException,
    );
  });

  await it('shipping local no inventa guia, ruta ni label', async () => {
    const provider = new NullShippingAdapter();
    const shipment = await provider.createShipment({
      orderId: 'ord-1',
      idempotencyKey: 'ship-1',
      destination: {
        country: 'CO',
        department: 'Valle del Cauca',
        city: 'Cali',
        addressLine1: 'Calle 10 # 1-20',
        recipientName: 'Cliente DistriTools',
        recipientPhone: '3000000000',
      },
      packages: [
        {
          weightKg: 1,
          lengthCm: 20,
          widthCm: 20,
          heightCm: 10,
          declaredValue: '100000.00',
          contentDescription: 'Herramientas',
        },
      ],
    });

    assert.equal(shipment.provider, 'internal');
    assert.equal(shipment.trackingNumber, null);
    assert.equal(shipment.routeNumber, null);
    assert.equal(shipment.labelUrl, null);
    assert.equal(shipment.status, 'pending_dispatch');
  });
});

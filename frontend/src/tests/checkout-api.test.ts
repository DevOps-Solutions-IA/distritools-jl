import { createGuestOrder } from '@/lib/api/orders';
import { ApiError } from '@/lib/api/errors';

describe('checkout api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('API de creación de orden maneja success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            orderId: 'ord-1',
            orderNumber: 'DTJL-0001',
            trackingCode: 'DTJL-TRK-20260511-000001',
            status: 'pending_payment',
            total: '1190.00',
            currency: 'COP',
            notification: {
              status: 'queued',
              channel: 'email',
            },
            payment: {
              canInitiate: true,
              initiateUrl: '/api/v1/payments/DTJL-0001/initiate',
            },
          }),
          {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );

    const response = await createGuestOrder({
      customer: {
        fullName: 'Juan',
        email: 'juan@mail.com',
        phone: '300',
        document: '123',
      },
      shippingAddress: {
        city: 'Cali',
        addressLine1: 'Calle 1',
      },
      items: [
        {
          productId: 'prod-1',
          variantId: 'var-1',
          quantity: 1,
        },
      ],
      paymentMethod: 'cash_on_delivery',
    });

    expect(response.orderNumber).toBe('DTJL-0001');
    expect(response.trackingCode).toBe('DTJL-TRK-20260511-000001');
  });

  it('API de creación de orden maneja error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Stock insuficiente' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(
      createGuestOrder({
        customer: {
          fullName: 'Juan',
          email: 'juan@mail.com',
          phone: '300',
          document: '123',
        },
        shippingAddress: {
          city: 'Cali',
          addressLine1: 'Calle 1',
        },
        items: [
          {
            productId: 'prod-1',
            variantId: 'var-1',
            quantity: 1,
          },
        ],
        paymentMethod: 'cash_on_delivery',
      }),
    ).rejects.toMatchObject({
      message: 'Stock insuficiente',
      status: 409,
    } satisfies Partial<ApiError>);
  });

  it('sends the stable idempotency key with guest checkout requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ orderId: 'ord-1' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await createGuestOrder({
      customer: { fullName: 'Buyer', email: 'buyer@example.com', phone: '300' },
      shippingAddress: { city: 'Cali', addressLine1: 'Street 1' },
      items: [{ productId: 'prod-1', variantId: 'variant-1', quantity: 1 }],
    }, 'ex062-frontend-key-0001');

    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(options.headers).get('Idempotency-Key')).toBe('ex062-frontend-key-0001');
  });
});

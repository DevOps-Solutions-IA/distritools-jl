import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CartProvider } from '@/features/cart/context';
import { CART_STORAGE_KEY } from '@/features/cart/storage';
import { CheckoutPageContent } from '@/components/checkout/CheckoutPageContent';
import * as checkoutApi from '@/lib/api/checkout';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function seedCart(warehouseId: string | null = null) {
  window.localStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify([
      {
        id: 'cart-var-1',
        product: {
          id: 'prod-1',
          slug: 'taladro-demo',
          name: 'Taladro demo',
          brandName: 'Makita',
          categoryName: 'Perforación',
        },
        variant: {
          id: 'var-1',
          productId: 'prod-1',
          name: 'Taladro demo',
          sku: 'SKU-100',
          price: 259900,
          priceLabel: '$ 259.900',
          taxRate: '19.00',
          warehouseId,
        },
        quantity: 1,
        availabilityLabel: 'Validación backend',
        availabilityDescription: 'El stock final se valida en checkout.',
        addedAt: new Date().toISOString(),
      },
    ]),
  );
}

describe('checkout storefront', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('validación de checkout inválido', async () => {
    seedCart('wh-1');

    render(
      <CartProvider>
        <CheckoutPageContent />
      </CartProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /crear orden invitada/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /crear orden invitada/i }));

    await waitFor(() => {
      expect(screen.getByText(/ingresa un nombre completo válido/i)).toBeInTheDocument();
    });
  });

  it('submit checkout bloqueado si carrito vacío', () => {
    render(
      <CartProvider>
        <CheckoutPageContent />
      </CartProvider>,
    );

    expect(screen.getByText(/tu carrito está vacío/i)).toBeInTheDocument();
  });

  it('submit checkout crea orden y no confirma pago por frontend', async () => {
    seedCart();
    vi.spyOn(checkoutApi, 'submitGuestCheckout').mockResolvedValue({
      kind: 'success',
      order: {
        orderId: 'ord-1',
        orderNumber: 'DTJL-001',
        status: 'pending_payment',
        total: '259900.00',
        currency: 'COP',
        payment: {
          canInitiate: true,
          initiateUrl: '/api/v1/payments/DTJL-001/initiate',
        },
      },
      message: 'La confirmación final del pago depende del backend y sus webhooks.',
    });

    render(
      <CartProvider>
        <CheckoutPageContent />
      </CartProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/nombre completo/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/nombre completo/i), {
      target: { value: 'Cliente Demo' },
    });
    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: 'cliente@demo.com' },
    });
    fireEvent.change(screen.getByLabelText(/teléfono/i), {
      target: { value: '3000000000' },
    });
    fireEvent.change(screen.getByLabelText(/ciudad/i), {
      target: { value: 'Cali' },
    });
    fireEvent.change(screen.getByLabelText(/dirección principal/i), {
      target: { value: 'Calle 10 # 1-20' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /crear orden invitada/i }));

    await waitFor(() => {
      expect(screen.getByText(/orden creada correctamente/i)).toBeInTheDocument();
      expect(screen.getByText(/DTJL-001/i)).toBeInTheDocument();
    });
  });

  it('pago retorno no confirma pago por frontend', async () => {
    const PaymentReturnPage = (await import('@/app/storefront/pago/retorno/page')).default;

    render(
      <CartProvider>
        {await PaymentReturnPage({
          searchParams: Promise.resolve({
            orderNumber: 'DTJL-001',
            gateway: 'mock',
            status: 'pending',
          }),
        })}
      </CartProvider>,
    );

    expect(screen.getByText(/backend \+ webhook/i)).toBeInTheDocument();
    expect(screen.getByText(/el pago no se confirma desde frontend/i)).toBeInTheDocument();
  });
});

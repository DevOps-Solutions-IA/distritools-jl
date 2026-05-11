import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CartProvider } from '@/features/cart/context';
import { CART_STORAGE_KEY } from '@/features/cart/storage';
import { CheckoutPageContent } from '@/components/checkout/CheckoutPageContent';
import * as checkoutApi from '@/lib/api/checkout';

const pushMock = vi.fn();

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

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

function seedCart(warehouseId: string | null = null) {
  window.localStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify([
      {
        id: 'cart-var-1',
        product: {
          id: 'prod-1',
          slug: 'taladro-percutor-1-2-total',
          name: 'Taladro percutor 1/2 TOTAL',
          brandName: 'Makita',
          categoryName: 'Perforación',
        },
        variant: {
          id: 'var-1',
          productId: 'prod-1',
          name: 'Taladro percutor 1/2 TOTAL',
          sku: 'TOTAL-TG109136',
          price: 259900,
          priceLabel: '$ 259.900',
          taxRate: '19.00',
          warehouseId,
        },
        quantity: 1,
        availabilityLabel: 'Consultar',
        availabilityDescription: 'Confirmamos disponibilidad antes de finalizar la compra.',
        addedAt: new Date().toISOString(),
      },
    ]),
  );
}

describe('checkout storefront', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    pushMock.mockClear();
  });

  it('validación de checkout inválido', async () => {
    seedCart('wh-1');

    render(
      <CartProvider>
        <CheckoutPageContent />
      </CartProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /finalizar compra/i })).toBeInTheDocument();
    });

    expect(screen.queryByText(/^1$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Carrito$/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /finalizar compra/i }));

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
        trackingCode: 'DTJL-TRK-001',
        status: 'pending_payment',
        total: '259900.00',
        currency: 'COP',
        notification: {
          status: 'queued',
          channel: 'email',
        },
        payment: {
          canInitiate: true,
          initiateUrl: '/api/v1/payments/DTJL-001/initiate',
        },
      },
      message: 'Recibirás confirmación cuando tu pedido sea validado.',
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
      target: { value: 'Cliente DistriTools' },
    });
    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: 'cliente@distritools.local' },
    });
    fireEvent.change(screen.getByLabelText(/teléfono/i), {
      target: { value: '3000000000' },
    });
    fireEvent.change(screen.getByLabelText(/departamento/i), {
      target: { value: 'Valle del Cauca' },
    });
    fireEvent.change(screen.getByLabelText(/ciudad/i), {
      target: { value: 'Cali' },
    });
    fireEvent.change(screen.getByLabelText(/dirección principal/i), {
      target: { value: 'Calle 10 # 1-20' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByTestId('data-treatment-consent')).toHaveTextContent(/acepto el tratamiento de datos/i);
    expect(screen.getByLabelText(/pse/i)).toBeDisabled();
    expect(screen.getAllByTestId('payment-method-option').length).toBeGreaterThanOrEqual(3);
    fireEvent.click(screen.getByRole('button', { name: /finalizar compra/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        '/checkout/confirmacion?order=DTJL-001&tracking=DTJL-TRK-001&method=cash_on_delivery',
      );
    });
  });

  it('oculta errores técnicos de variantes faltantes al cliente', async () => {
    seedCart();
    vi.spyOn(checkoutApi, 'submitGuestCheckout').mockRejectedValue(
      new Error(
        'Missing variants for order: 019ddc5b-210e-771a-91b9-3a7b13ecf6a7',
      ),
    );

    render(
      <CartProvider>
        <CheckoutPageContent />
      </CartProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/nombre completo/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/nombre completo/i), {
      target: { value: 'Cliente DistriTools' },
    });
    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: 'cliente@distritools.local' },
    });
    fireEvent.change(screen.getByLabelText(/teléfono/i), {
      target: { value: '3000000000' },
    });
    fireEvent.change(screen.getByLabelText(/departamento/i), {
      target: { value: 'Valle del Cauca' },
    });
    fireEvent.change(screen.getByLabelText(/ciudad/i), {
      target: { value: 'Cali' },
    });
    fireEvent.change(screen.getByLabelText(/dirección principal/i), {
      target: { value: 'Calle 10 # 1-20' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /finalizar compra/i }));

    await waitFor(() => {
      expect(screen.getByText(/actualiza tu carrito/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/missing variants/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/019ddc5b/i)).not.toBeInTheDocument();
  });

  it('checkout por cotización redirige a confirmación comercial', async () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'cart-quote-prod-1',
          product: {
            id: 'prod-1',
            slug: 'taladro-percutor-1-2-total',
            name: 'Taladro percutor 1/2 TOTAL',
            brandName: 'TOTAL',
            categoryName: 'Perforación',
          },
          variant: {
            id: 'quote-prod-1',
            productId: 'prod-1',
            name: 'Cotización',
            sku: 'COTIZAR',
            price: 0,
            priceLabel: 'Por cotizar',
            taxRate: '0.00',
            warehouseId: null,
            mode: 'quote',
          },
          quantity: 1,
          availabilityLabel: 'Cotizar',
          availabilityDescription: 'Confirmaremos precio y disponibilidad antes de finalizar.',
          addedAt: new Date().toISOString(),
        },
      ]),
    );

    render(
      <CartProvider>
        <CheckoutPageContent />
      </CartProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /finalizar compra/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/nombre completo/i), {
      target: { value: 'Cliente DistriTools' },
    });
    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: 'cliente@distritools.local' },
    });
    fireEvent.change(screen.getByLabelText(/teléfono/i), {
      target: { value: '3000000000' },
    });
    fireEvent.change(screen.getByLabelText(/departamento/i), {
      target: { value: 'Valle del Cauca' },
    });
    fireEvent.change(screen.getByLabelText(/ciudad/i), {
      target: { value: 'Cali' },
    });
    fireEvent.change(screen.getByLabelText(/dirección principal/i), {
      target: { value: 'Calle 10 # 1-20' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /finalizar compra/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        '/checkout/confirmacion?type=quote&method=commercial_confirmation',
      );
    });
  });
});

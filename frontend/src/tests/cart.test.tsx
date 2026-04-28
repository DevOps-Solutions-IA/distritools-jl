import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CartProvider } from '@/features/cart/context';
import { useCart } from '@/features/cart/hooks';
import { CART_STORAGE_KEY } from '@/features/cart/storage';
import { AddToCartButton } from '@/components/cart/AddToCartButton';
import { CartPageContent } from '@/components/cart/CartPageContent';
import type { CatalogProduct, CatalogVariant } from '@/features/catalog/types';

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

const product: CatalogProduct = {
  id: 'prod-1',
  name: 'Taladro demo',
  slug: 'taladro-demo',
  description: 'Herramienta industrial para perforación.',
  brand: null,
  category: null,
  primaryVariantId: 'var-1',
  primarySku: 'SKU-100',
  primaryPrice: 259900,
  primaryPriceLabel: '$ 259.900',
  availability: {
    status: 'check-backend',
    label: 'Validación backend',
    description: 'El stock final se valida en checkout.',
    source: 'catalog-gap',
  },
};

const variant: CatalogVariant = {
  id: 'var-1',
  productId: 'prod-1',
  name: 'Taladro demo',
  sku: 'SKU-100',
  price: 259900,
  priceLabel: '$ 259.900',
  taxRate: '19.00',
  warehouseId: null,
};

function CartInspector() {
  const { items, summary, setQuantity, removeItem } = useCart();

  return (
    <div>
      <span data-testid="count">{summary.itemCount}</span>
      <span data-testid="subtotal">{summary.subtotalLabel}</span>
      {items.map((item) => (
        <div key={item.id}>
          <span>{item.product.name}</span>
          <span data-testid={`qty-${item.variant.id}`}>{item.quantity}</span>
          <button onClick={() => setQuantity(item.variant.id, item.quantity + 1)}>inc</button>
          <button
            onClick={() => setQuantity(item.variant.id, Math.max(1, item.quantity - 1))}
          >
            dec
          </button>
          <button onClick={() => removeItem(item.variant.id)}>remove</button>
        </div>
      ))}
    </div>
  );
}

describe('cart storefront', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('agrega producto al carrito y persiste', async () => {
    render(
      <CartProvider>
        <AddToCartButton product={product} variants={[variant]} />
        <CartInspector />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /agregar al carrito/i }));

    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(screen.getByText('Taladro demo')).toBeInTheDocument();

    await waitFor(() => {
      const persisted = window.localStorage.getItem(CART_STORAGE_KEY);
      expect(persisted).toContain('Taladro demo');
    });
  });

  it('incrementa, disminuye y elimina items', async () => {
    render(
      <CartProvider>
        <AddToCartButton product={product} variants={[variant]} />
        <CartInspector />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /agregar al carrito/i }));
    fireEvent.click(screen.getByText('inc'));
    expect(screen.getByTestId('qty-var-1')).toHaveTextContent('2');

    fireEvent.click(screen.getByText('dec'));
    expect(screen.getByTestId('qty-var-1')).toHaveTextContent('1');

    fireEvent.click(screen.getByText('remove'));
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('hidrata persistencia básica al recargar', async () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'cart-var-1',
          product: {
            id: 'prod-1',
            slug: 'taladro-demo',
            name: 'Taladro demo',
            brandName: null,
            categoryName: null,
          },
          variant: {
            id: 'var-1',
            productId: 'prod-1',
            name: 'Taladro demo',
            sku: 'SKU-100',
            price: 259900,
            priceLabel: '$ 259.900',
            taxRate: '19.00',
            warehouseId: null,
          },
          quantity: 2,
          availabilityLabel: 'Validación backend',
          availabilityDescription: 'El stock final se valida en checkout.',
          addedAt: new Date().toISOString(),
        },
      ]),
    );

    render(
      <CartProvider>
        <CartInspector />
      </CartProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('2');
    });
  });

  it('muestra estado vacío en la página de carrito', () => {
    render(
      <CartProvider>
        <CartPageContent />
      </CartProvider>,
    );

    expect(screen.getByText(/tu carrito está vacío/i)).toBeInTheDocument();
  });
});

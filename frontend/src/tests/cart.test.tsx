import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CartProvider } from '@/features/cart/context';
import { useCart } from '@/features/cart/hooks';
import { CART_STORAGE_KEY } from '@/features/cart/storage';
import { AddToCartButton } from '@/components/cart/AddToCartButton';
import { CartDrawer } from '@/components/cart/CartDrawer';
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
  name: 'Taladro percutor 1/2 TOTAL',
  slug: 'taladro-percutor-1-2-total',
  description: 'Herramienta industrial para perforación.',
  longDescription: 'Taladro TOTAL para perforación, montaje y mantenimiento.',
  presentation: '1/2 pulg',
  brand: null,
  category: null,
  primaryVariantId: 'var-1',
  primarySku: 'TOTAL-TG109136',
  primaryPrice: 259900,
  primaryPriceLabel: '$ 259.900',
  availability: {
    status: 'check-backend',
    label: 'Consultar',
    description: 'Confirmamos disponibilidad antes de finalizar la compra.',
    source: 'catalog-gap',
  },
  image: {
    status: 'pending',
    assetPath: null,
    notes: 'Imagen pendiente.',
  },
  attributes: [{ label: 'Tipo', value: 'Taladro percutor' }],
  tags: ['taladro', 'total'],
  seo: {
    title: 'Taladro percutor TOTAL',
    description: 'Taladro percutor TOTAL para obra y taller.',
    keywords: ['taladro', 'total'],
    ogTitle: 'Taladro percutor TOTAL',
    ogDescription: 'Herramienta TOTAL para perforación.',
    ogImage: null,
  },
  source: {
    name: 'TOTAL Tools catálogo oficial',
    url: 'https://www.totalbusiness.com/',
    retrievedAt: '2026-04-28',
    confidence: 'medium',
  },
};

const variant: CatalogVariant = {
  id: 'var-1',
  productId: 'prod-1',
  name: 'Taladro percutor 1/2 TOTAL',
  sku: 'TOTAL-TG109136',
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

    fireEvent.click(screen.getByRole('button', { name: /comprar/i }));

    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(screen.getByText('Taladro percutor 1/2 TOTAL')).toBeInTheDocument();

    await waitFor(() => {
      const persisted = window.localStorage.getItem(CART_STORAGE_KEY);
      expect(persisted).toContain('Taladro percutor 1/2 TOTAL');
    });
  });

  it('incrementa, disminuye y elimina items', async () => {
    render(
      <CartProvider>
        <AddToCartButton product={product} variants={[variant]} />
        <CartInspector />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /comprar/i }));
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
            slug: 'taladro-percutor-1-2-total',
            name: 'Taladro percutor 1/2 TOTAL',
            brandName: null,
            categoryName: null,
          },
          variant: {
            id: 'var-1',
            productId: 'prod-1',
            name: 'Taladro percutor 1/2 TOTAL',
            sku: 'TOTAL-TG109136',
            price: 259900,
            priceLabel: '$ 259.900',
            taxRate: '19.00',
            warehouseId: null,
          },
          quantity: 2,
          availabilityLabel: 'Consultar',
          availabilityDescription: 'Confirmamos disponibilidad antes de finalizar la compra.',
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

  it('mini carrito muestra producto, subtotal y cierra con Escape', async () => {
    render(
      <CartProvider>
        <AddToCartButton product={product} variants={[variant]} />
        <CartDrawer />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /comprar/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /tu selección/i })).toBeInTheDocument();
    });
    expect(screen.getByText('Carrito')).toBeInTheDocument();
    expect(screen.getByText(/1 producto/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /finalizar compra/i })).toBeInTheDocument();
    expect(screen.getAllByText(/\$[\s\u00a0]259\.900/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('link', { name: /ver carrito/i })).toHaveAttribute(
      'href',
      '/carrito',
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /tu selección/i })).not.toBeInTheDocument();
    });
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StorefrontFooter } from '@/components/layout/StorefrontFooter';
import { getPublicFooter } from '@/lib/api/footer';
vi.mock('@/lib/api/footer', () => ({ getPublicFooter: vi.fn() }));
it('renders only links from fresh validated public projection', async () => {
  vi.mocked(getPublicFooter).mockResolvedValue({
    version: 8,
    groups: [
      { title: 'Publicados', items: [{ label: 'Inicio aprobado', href: '/' }] },
    ],
  });
  render(<StorefrontFooter />);
  expect(
    await screen.findByRole('link', { name: 'Inicio aprobado' }),
  ).toHaveAttribute('href', '/');
  expect(
    screen.queryByRole('link', { name: 'Compresores y aire' }),
  ).not.toBeInTheDocument();
});
it('fails closed with no unchecked links when backend cannot validate', async () => {
  vi.mocked(getPublicFooter).mockRejectedValue(new Error('audit unavailable'));
  render(<StorefrontFooter />);
  await waitFor(() => expect(getPublicFooter).toHaveBeenCalled());
  expect(screen.queryAllByRole('link')).toHaveLength(0);
  expect(
    screen.getByText('Herramientas que construyen resultados'),
  ).toBeInTheDocument();
});

it('refreshes on focus and removes a destination invalidated after publication', async () => {
  vi.mocked(getPublicFooter)
    .mockResolvedValueOnce({
      version: 8,
      groups: [
        {
          title: 'Publicados',
          items: [{ label: 'Detalle publicado', href: '/productos/dynamic' }],
        },
      ],
    })
    .mockResolvedValueOnce({ version: 8, groups: [] });
  render(<StorefrontFooter />);
  expect(
    await screen.findByRole('link', { name: 'Detalle publicado' }),
  ).toBeInTheDocument();
  fireEvent.focus(window);
  await waitFor(() =>
    expect(
      screen.queryByRole('link', { name: 'Detalle publicado' }),
    ).not.toBeInTheDocument(),
  );
});

it('renders the exact validated catalog filter without deleting its query', async () => {
  vi.mocked(getPublicFooter).mockResolvedValue({
    version: 3,
    groups: [
      {
        title: 'Catálogo',
        items: [
          {
            label: 'Compresores publicados',
            href: '/productos?category=compresores',
          },
        ],
      },
    ],
  });
  render(<StorefrontFooter />);
  expect(
    await screen.findByRole('link', { name: 'Compresores publicados' }),
  ).toHaveAttribute('href', '/productos?category=compresores');
});

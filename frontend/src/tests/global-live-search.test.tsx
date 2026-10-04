import { act, fireEvent, render, screen } from '@testing-library/react';
import { GlobalLiveSearch } from '@/components/storefront/GlobalLiveSearch';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe('GlobalLiveSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [{ id: 'p-1', name: 'Taladro industrial', slug: 'taladro-industrial' }],
        brands: [],
        categories: [],
      }),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not show previous suggestions as results for a query still in debounce', async () => {
    render(<GlobalLiveSearch />);
    const search = screen.getByRole('searchbox');

    fireEvent.change(search, { target: { value: 'taladro' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180);
    });
    expect(screen.getByRole('option')).toHaveTextContent('Taladro industrial');

    fireEvent.change(search, { target: { value: 'taladro percutor' } });

    expect(screen.getByText('Buscando...')).toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });
});

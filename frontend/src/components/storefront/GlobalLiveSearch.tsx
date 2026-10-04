'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { StorefrontButton } from '@/components/storefront/StorefrontButton';
import { cn } from '@/lib/utils/cn';

interface SearchResult {
  id: string;
  name: string;
  slug: string;
  brand?: string | null;
  priceLabel?: string | null;
}

interface SearchGroups {
  products: SearchResult[];
  brands: SearchResult[];
  categories: SearchResult[];
}

const EMPTY_SEARCH_GROUPS: SearchGroups = { products: [], brands: [], categories: [] };

interface GlobalLiveSearchProps {
  action?: string;
  placeholder?: string;
  compact?: boolean;
  name?: string;
  buttonLabel?: string;
  onNavigate?: () => void;
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}

export function GlobalLiveSearch({
  action = '/buscar',
  placeholder = 'Buscar productos',
  compact = false,
  name = 'global-product-search',
  buttonLabel = 'Buscar',
  onNavigate,
}: GlobalLiveSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchGroups>({ products: [], brands: [], categories: [] });
  const debouncedQuery = useDebouncedValue(query, 180);
  const isDebouncing = query.trim() !== debouncedQuery.trim();
  const [previousDebouncedQuery, setPreviousDebouncedQuery] = useState(debouncedQuery);
  if (previousDebouncedQuery !== debouncedQuery) {
    setPreviousDebouncedQuery(debouncedQuery);
    setLoading(debouncedQuery.trim().length >= 2);
    if (debouncedQuery.trim().length < 2) {
      setResults({ products: [], brands: [], categories: [] });
    }
  }
  const inputId = useId();
  const wrapperRef = useRef<HTMLFormElement>(null);
  const canSearch = query.trim().length >= 2;

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) return;

    const controller = new AbortController();

    fetch(`/api/storefront/live-search?q=${encodeURIComponent(debouncedQuery.trim())}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Search failed'))))
      .then((payload: SearchGroups) => {
        setResults(payload);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setResults({ products: [], brands: [], categories: [] });
        setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery]);

  const visibleResults = isDebouncing || loading
    ? EMPTY_SEARCH_GROUPS
    : results;
  const totalResults = useMemo(
    () => visibleResults.products.length + visibleResults.brands.length + visibleResults.categories.length,
    [visibleResults],
  );

  return (
    <form
      ref={wrapperRef}
      action={action}
      role="search"
      className={cn('relative grid min-w-0 gap-2', !compact && 'sm:grid-cols-[1fr_auto]')}
    >
      <label htmlFor={inputId} className="sr-only">
        Buscar productos, marcas o líneas
      </label>
      <div className="relative min-w-0">
        <input
          id={inputId}
          name={name}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              event.currentTarget.blur();
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoCapitalize="none"
          inputMode="search"
          type="search"
          className={cn(
            'focus-ring h-11 w-full rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 pr-10 text-base text-[var(--color-off-white)] placeholder:text-[var(--color-text-secondary)]',
            !compact && 'sm:h-12',
          )}
        />
        <input type="hidden" name="q" value={query} />
        {query ? (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-lg text-[var(--color-text-secondary)] hover:bg-white/8 hover:text-[var(--color-off-white)]"
            onClick={() => {
              setQuery('');
              setOpen(false);
            }}
          >
            ×
          </button>
        ) : null}
      </div>
      <StorefrontButton type="submit" storefrontSize={compact ? 'compact' : 'large'}>
        {buttonLabel}
      </StorefrontButton>

      {open && canSearch ? (
        <div
          role="listbox"
          aria-label="Sugerencias de búsqueda"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(68vh,32rem)] overflow-y-auto rounded-[1.2rem] border border-[var(--color-border)] bg-[linear-gradient(180deg,#111_0%,#070707_100%)] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        >
          <div className="mb-3 flex items-center justify-between gap-3 text-xs text-[var(--color-text-secondary)]">
            <span>{isDebouncing || loading ? 'Buscando...' : `${totalResults} coincidencias`}</span>
            <Link
              href={`/buscar?q=${encodeURIComponent(query.trim())}`}
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              className="font-semibold text-[var(--color-industrial-yellow)]"
            >
              Ver todos
            </Link>
          </div>

          {visibleResults.products.length ? (
            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-industrial-yellow)]">
                Productos
              </h3>
              {visibleResults.products.map((product) => (
                <Link
                  key={product.id}
                  href={`/productos/${product.slug}`}
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    setOpen(false);
                    onNavigate?.();
                  }}
                  className="grid gap-1 rounded-xl border border-white/8 bg-white/[0.025] p-3"
                >
                  <span className="line-clamp-2 text-sm font-semibold text-[var(--color-off-white)]">
                    {product.name}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {[product.brand, product.priceLabel].filter(Boolean).join(' · ')}
                  </span>
                </Link>
              ))}
            </section>
          ) : null}

          {visibleResults.brands.length || visibleResults.categories.length ? (
            <section className="mt-3 flex flex-wrap gap-2">
              {visibleResults.brands.map((brand) => (
                <Link
                  key={brand.id}
                  href={`/marcas/${brand.slug}`}
                  onClick={() => {
                    setOpen(false);
                    onNavigate?.();
                  }}
                  className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-[var(--color-off-white)]"
                >
                  Marca: {brand.name}
                </Link>
              ))}
              {visibleResults.categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/categorias/${category.slug}`}
                  onClick={() => {
                    setOpen(false);
                    onNavigate?.();
                  }}
                  className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-[var(--color-off-white)]"
                >
                  Línea: {category.name}
                </Link>
              ))}
            </section>
          ) : null}

          {!totalResults && !isDebouncing && !loading ? (
            <p className="rounded-xl border border-dashed border-white/12 p-3 text-sm text-[var(--color-text-secondary)]">
              Sin resultados con precio y stock. Prueba con otra palabra.
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

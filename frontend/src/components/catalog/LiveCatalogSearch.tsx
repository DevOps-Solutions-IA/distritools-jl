'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { AddToCartButton } from '@/components/cart/AddToCartButton';
import { StorefrontButton } from '@/components/storefront/StorefrontButton';
import { Button } from '@/components/ui/Button';
import {
  getLiveSearchResults,
  isPubliclyPurchasable,
} from '@/features/catalog/live-search';
import type { CatalogBrand, CatalogCategory, CatalogProduct } from '@/features/catalog/types';
import { cn } from '@/lib/utils/cn';

interface LiveCatalogSearchProps {
  products: CatalogProduct[];
  brands: CatalogBrand[];
  categories: CatalogCategory[];
  action?: string;
  defaultValue?: string;
  placeholder?: string;
  compact?: boolean;
  autoFocus?: boolean;
  onSubmit?: () => void;
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}

function getProductVariant(product: CatalogProduct) {
  if (!isPubliclyPurchasable(product)) {
    return [];
  }

  return [
    {
      id: product.primaryVariantId!,
      productId: product.id,
      name: product.name,
      sku: product.primarySku!,
      price: product.primaryPrice!,
      priceLabel: product.primaryPriceLabel ?? `$ ${product.primaryPrice!.toLocaleString('es-CO')}`,
      taxRate: '0.00',
      warehouseId: null,
    },
  ];
}

export function LiveCatalogSearch({
  products,
  brands,
  categories,
  action = '/buscar',
  defaultValue = '',
  placeholder = 'Buscar productos en stock',
  compact = false,
  autoFocus = false,
  onSubmit,
}: LiveCatalogSearchProps) {
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const inputId = useId();
  const debouncedQuery = useDebouncedValue(query, 180);
  const canSearch = query.trim().length >= 2;

  const loading = canSearch && query !== debouncedQuery;

  const results = useMemo(() => {
    return getLiveSearchResults({
      query: debouncedQuery,
      products,
      brands,
      categories,
    });
  }, [brands, categories, debouncedQuery, products]);

  const totalResults =
    results.products.length + results.brands.length + results.categories.length;
  const showPanel = open && canSearch;

  return (
    <form
      action={action}
      role="search"
      className="relative grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_auto]"
      onSubmit={onSubmit}
    >
      <label htmlFor={inputId} className="sr-only">
        Buscar productos
      </label>
      <div className="relative">
        <input
          id={inputId}
          name="catalog-search-query"
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
          autoFocus={autoFocus}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoCapitalize="none"
          inputMode="search"
          type="search"
          placeholder={placeholder}
          className={cn(
            'focus-ring h-12 w-full rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 pr-12 text-base text-[var(--color-off-white)] placeholder:text-[var(--color-text-secondary)]',
            compact && 'h-11',
          )}
        />
        <input type="hidden" name="q" value={query} />
        {query ? (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-lg text-[var(--color-text-secondary)] hover:bg-white/8 hover:text-[var(--color-off-white)]"
            onClick={() => {
              setQuery('');
              setOpen(false);
            }}
          >
            ×
          </button>
        ) : null}
      </div>
      <StorefrontButton type="submit" storefrontSize={compact ? 'default' : 'large'}>
        Buscar
      </StorefrontButton>

      {showPanel ? (
        <div
          role="listbox"
          aria-label="Resultados de búsqueda en caliente"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 max-h-[min(68vh,34rem)] overflow-y-auto rounded-[1.2rem] border border-[var(--color-border)] bg-[linear-gradient(180deg,#111_0%,#070707_100%)] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        >
          <div className="mb-3 flex items-center justify-between gap-3 text-xs text-[var(--color-text-secondary)]">
            <span>{loading ? 'Buscando...' : `${totalResults} coincidencias`}</span>
            <Link
              href={`/buscar?q=${encodeURIComponent(query.trim())}`}
              onClick={() => setOpen(false)}
              className="font-semibold text-[var(--color-industrial-yellow)]"
            >
              Ver todos
            </Link>
          </div>

          {results.products.length ? (
            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-industrial-yellow)]">
                Productos en stock
              </h3>
              {results.products.slice(0, 6).map((product) => (
                <div
                  key={product.id}
                  role="option"
                  aria-selected={false}
                  className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-[0.95rem] border border-white/8 bg-white/[0.025] p-2"
                >
                  <Link
                    href={`/productos/${product.slug}`}
                    onClick={() => setOpen(false)}
                    className="min-w-0"
                  >
                    <p className="truncate text-sm font-semibold text-[var(--color-off-white)]">
                      {product.name}
                    </p>
                    <p className="truncate text-xs text-[var(--color-text-secondary)]">
                      {product.brand?.name ?? 'Marca'} · {product.primaryPriceLabel}
                    </p>
                  </Link>
                  <AddToCartButton
                    product={product}
                    variants={getProductVariant(product)}
                    label="Comprar"
                    className="h-9 rounded-full px-3 text-xs"
                  />
                </div>
              ))}
            </section>
          ) : null}

          {results.brands.length ? (
            <section className="mt-3 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-industrial-yellow)]">
                Marcas
              </h3>
              <div className="flex flex-wrap gap-2">
                {results.brands.map((brand) => (
                  <Link
                    key={brand.id}
                    href={`/marcas/${brand.slug}`}
                    onClick={() => setOpen(false)}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-off-white)]"
                  >
                    {brand.name}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {results.categories.length ? (
            <section className="mt-3 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-industrial-yellow)]">
                Categorías
              </h3>
              <div className="flex flex-wrap gap-2">
                {results.categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/categorias/${category.slug}`}
                    onClick={() => setOpen(false)}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-off-white)]"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {!totalResults && !loading ? (
            <p className="rounded-xl border border-dashed border-white/12 p-3 text-sm text-[var(--color-text-secondary)]">
              Sin coincidencias con precio y stock. Prueba con otra referencia.
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

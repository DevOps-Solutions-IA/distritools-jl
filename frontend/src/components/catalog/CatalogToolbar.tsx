'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LiveCatalogSearch } from '@/components/catalog/LiveCatalogSearch';
import { StorefrontButton, StorefrontLinkButton } from '@/components/storefront/StorefrontButton';
import { Button } from '@/components/ui/Button';
import type { CatalogBrand, CatalogCategory, CatalogProduct } from '@/features/catalog/types';
import { cn } from '@/lib/utils/cn';

interface CatalogToolbarProps {
  brands: CatalogBrand[];
  categories: CatalogCategory[];
  products?: CatalogProduct[];
  action?: string;
  resultCount?: number;
  query?: string;
  selectedBrandSlug?: string;
  selectedCategorySlug?: string;
  selectedStatus?: string;
  selectedSort?: string;
  hideBrandFilter?: boolean;
  hideCategoryFilter?: boolean;
  clearHref?: string;
  searchPlaceholder?: string;
}

export function CatalogToolbar({
  brands,
  categories,
  products = [],
  action = '/productos',
  resultCount,
  query,
  selectedBrandSlug,
  selectedCategorySlug,
  selectedStatus,
  selectedSort,
  hideBrandFilter = false,
  hideCategoryFilter = false,
  clearHref = action,
  searchPlaceholder = 'Buscar en estos productos',
}: CatalogToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!filtersOpen) {
      return;
    }

    firstFocusableRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFiltersOpen(false);
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled])',
      );

      if (!focusable?.length) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filtersOpen]);

  const searchField = (
      <label className="flex min-w-0 flex-col gap-2 text-sm font-medium text-[var(--color-off-white)]">
        Buscar
        <input
          ref={firstFocusableRef}
          name="q"
          defaultValue={query ?? ''}
          placeholder={searchPlaceholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoCapitalize="none"
          inputMode="search"
          type="search"
          className="focus-ring h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-base text-[var(--color-off-white)] placeholder:text-[var(--color-text-secondary)]"
        />
      </label>
  );

  const filterFields = (
    <>
      {!hideCategoryFilter ? (
        <label className="flex min-w-0 flex-col gap-2 text-sm font-medium text-[var(--color-off-white)]">
          Categoría
          <select
            name="category"
            defaultValue={selectedCategorySlug ?? ''}
            className="focus-ring h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-base text-[var(--color-off-white)]"
          >
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {!hideBrandFilter ? (
        <label className="flex min-w-0 flex-col gap-2 text-sm font-medium text-[var(--color-off-white)]">
          Marca
          <select
            name="brand"
            defaultValue={selectedBrandSlug ?? ''}
            className="focus-ring h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-base text-[var(--color-off-white)]"
          >
            <option value="">Todas</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.slug}>
                {brand.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="flex min-w-0 flex-col gap-2 text-sm font-medium text-[var(--color-off-white)]">
        Estado
        <select
          name="status"
          defaultValue={selectedStatus ?? 'all'}
          className="focus-ring h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-base text-[var(--color-off-white)]"
        >
          <option value="all">Todos</option>
          <option value="available">En stock</option>
          <option value="low-stock">Bajo stock</option>
        </select>
      </label>

      <label className="flex min-w-0 flex-col gap-2 text-sm font-medium text-[var(--color-off-white)]">
        Orden
        <select
          name="sort"
          defaultValue={selectedSort ?? 'featured'}
          className="focus-ring h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-base text-[var(--color-off-white)]"
        >
          <option value="featured">Destacados</option>
          <option value="name-asc">Nombre A-Z</option>
          <option value="name-desc">Nombre Z-A</option>
          <option value="price-asc">Menor precio</option>
          <option value="price-desc">Mayor precio</option>
        </select>
      </label>
    </>
  );

  const actionRow = (
    <div className="flex flex-wrap items-end gap-3">
      <StorefrontButton type="submit" storefrontSize="compact" className="min-w-28">
        Aplicar
      </StorefrontButton>
      <StorefrontLinkButton
        href={clearHref}
        storefrontVariant="ghost"
        storefrontSize="compact"
        className="text-[var(--color-text-secondary)] hover:text-[var(--color-off-white)]"
      >
        Limpiar
      </StorefrontLinkButton>
    </div>
  );

  return (
    <div className="rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-soft sm:rounded-[1.5rem] sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--color-off-white)]">
            {typeof resultCount === 'number'
              ? `${resultCount} ${resultCount === 1 ? 'resultado' : 'resultados'}`
              : 'Filtros'}
          </p>
          <p className="hidden text-xs text-[var(--color-text-secondary)] sm:block">
            Encuentra rápido productos con precio y stock.
          </p>
        </div>
        <StorefrontButton
          type="button"
          storefrontVariant="secondary"
          storefrontSize="compact"
          className="lg:hidden"
          onClick={() => setFiltersOpen(true)}
          aria-label="Abrir filtros del catálogo"
        >
          Filtrar
        </StorefrontButton>
      </div>

      <form
        action={action}
        className="mt-4 hidden gap-3 lg:grid lg:grid-cols-[minmax(13rem,1.15fr)_repeat(4,minmax(10rem,0.85fr))_auto]"
      >
        {searchField}
        {filterFields}
        {actionRow}
      </form>

      {filtersOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setFiltersOpen(false)}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Filtros del catálogo"
            className={cn(
              'absolute inset-x-3 bottom-4 top-4 overflow-y-auto rounded-[1.75rem] border border-[var(--color-border)]',
              'bg-[linear-gradient(180deg,#111_0%,#050505_100%)] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.62)]',
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-5 flex items-start justify-between gap-4 border-b border-white/8 bg-[#111] px-4 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
                  Filtros
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-[var(--color-off-white)]">
                  Catálogo
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-10 rounded-full p-0 text-xl"
                onClick={() => setFiltersOpen(false)}
                aria-label="Cerrar filtros"
              >
                ×
              </Button>
            </div>
            <div className="mb-4">
              {products.length ? (
                <LiveCatalogSearch
                  products={products}
                  brands={brands}
                  categories={categories}
                  action="/buscar"
                  defaultValue={query}
                  placeholder={searchPlaceholder}
                  compact
                  autoFocus
                />
              ) : (
                searchField
              )}
            </div>
            <form action={action} className="grid gap-4 pb-20">
              {query ? <input type="hidden" name="q" value={query} /> : null}
              {filterFields}
              <div className="sticky bottom-0 -mx-4 -mb-4 border-t border-white/8 bg-[#050505] px-4 py-4">
                {actionRow}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

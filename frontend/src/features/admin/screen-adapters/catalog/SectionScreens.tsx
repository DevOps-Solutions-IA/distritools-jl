import Link from 'next/link';
import { AdminTable } from '../shared/AdminTable';
import type { SectionScreenAdapter, SectionScreenProps } from '../shared/types';

export function ProductosScreen({ snapshot }: SectionScreenProps<never>) {
  const productRows = snapshot.productRows.slice(0, 80);
  return (
    <AdminTable
      title="Productos"
      description="Listado real del catálogo público, con acciones seguras hacia edición y preview."
      rows={productRows}
      columns={[
        {
          key: 'product',
          label: 'Producto',
          render: (product) => (
            <div>
              <p className="font-semibold text-[var(--color-off-white)]">
                {product.name}
              </p>
              <p className="mt-1 text-xs">{product.slug}</p>
            </div>
          ),
        },
        {
          key: 'brand',
          label: 'Marca',
          render: (product) => product.brand?.name ?? 'Sin marca',
        },
        {
          key: 'category',
          label: 'Categoría',
          render: (product) => product.category?.name ?? 'Sin categoría',
        },
        {
          key: 'price',
          label: 'Precio',
          render: (product) => product.primaryPriceLabel ?? 'Cotizar',
        },
        {
          key: 'actions',
          label: 'Acciones',
          render: (product) => (
            <div className="flex flex-wrap gap-2">
              <Link
                className="text-[var(--color-industrial-yellow)] hover:underline"
                href={`/admin/productos/${product.id}`}
              >
                Editar
              </Link>
              <Link
                className="text-[var(--color-industrial-yellow)] hover:underline"
                href={`/productos/${product.slug}`}
              >
                Preview
              </Link>
            </div>
          ),
        },
      ]}
    />
  );
}

export function MarcasScreen({ snapshot }: SectionScreenProps<never>) {
  const productRows = snapshot.productRows.slice(0, 80);
  const brandRows = snapshot.brandRows.slice(0, 80);
  return (
    <AdminTable
      title="Marcas"
      description="Marcas reales detectadas y administrables con slug, estado y asociación de productos."
      rows={brandRows}
      columns={[
        {
          key: 'name',
          label: 'Marca',
          render: (brand) => (
            <span className="font-semibold text-[var(--color-off-white)]">
              {brand.name}
            </span>
          ),
        },
        { key: 'slug', label: 'Slug', render: (brand) => brand.slug },
        {
          key: 'products',
          label: 'Productos',
          render: (brand) =>
            productRows.filter((product) => product.brand?.id === brand.id)
              .length,
        },
        {
          key: 'action',
          label: 'Acciones',
          render: (brand) => (
            <Link
              className="text-[var(--color-industrial-yellow)] hover:underline"
              href={`/marcas/${brand.slug}`}
            >
              Preview
            </Link>
          ),
        },
      ]}
    />
  );
}

export function CategoriasScreen({ snapshot }: SectionScreenProps<never>) {
  const productRows = snapshot.productRows.slice(0, 80);
  const categoryRows = snapshot.categoryRows.slice(0, 80);
  return (
    <AdminTable
      title="Categorías"
      description="Taxonomía real del catálogo; no se muestran familias como contenido principal."
      rows={categoryRows}
      columns={[
        {
          key: 'name',
          label: 'Categoría',
          render: (category) => (
            <span className="font-semibold text-[var(--color-off-white)]">
              {category.name}
            </span>
          ),
        },
        { key: 'slug', label: 'Slug', render: (category) => category.slug },
        {
          key: 'products',
          label: 'Productos',
          render: (category) =>
            productRows.filter(
              (product) => product.category?.id === category.id,
            ).length,
        },
        {
          key: 'action',
          label: 'Acciones',
          render: (category) => (
            <Link
              className="text-[var(--color-industrial-yellow)] hover:underline"
              href={`/categorias/${category.slug}`}
            >
              Preview
            </Link>
          ),
        },
      ]}
    />
  );
}

export const catalogSectionAdapters = {
  productos: {
    Screen: ProductosScreen,
    actions: [
      { label: 'Nuevo producto', href: '/admin/productos/nuevo' },
      { label: 'Ver storefront', href: '/productos' },
    ],
  },
  marcas: {
    Screen: MarcasScreen,
    actions: [
      { label: 'Nueva marca', href: '/admin/marcas/nuevo' },
      { label: 'Ver marcas', href: '/marcas' },
    ],
  },
  categorias: {
    Screen: CategoriasScreen,
    actions: [
      { label: 'Nueva categoría', href: '/admin/categorias/nuevo' },
      { label: 'Ver categorías', href: '/categorias' },
    ],
  },
} satisfies Record<'productos' | 'marcas' | 'categorias', SectionScreenAdapter>;

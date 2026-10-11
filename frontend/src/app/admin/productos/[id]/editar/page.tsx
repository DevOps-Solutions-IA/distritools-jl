import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductMediaPanel } from '@/features/admin/catalog/ProductMediaPanel';
import { parseMediaProduct } from '@/features/admin/catalog/media-contract';
import { AdminProductCompleteForm } from '@/components/admin/forms/AdminProductCompleteForm';
import { AdminShell } from '@/components/layout/AdminShell';
import { Button } from '@/components/ui/Button';
import { mapProduct } from '@/features/catalog/mappers';
import { catalogOptions, catalogRead, catalogCollection, type CatalogProductRecord, type CatalogVariantRecord } from '@/features/admin/catalog/server';


export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Editar producto completo admin | DistriTools JL',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ variant?: string }>;
}

export default async function AdminProductEditPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const selectedVariant = (await searchParams)?.variant;
  const [options, rawProduct] = await Promise.all([catalogOptions(), catalogRead<CatalogProductRecord>(`/admin/products/${id}`)]);
  const variants = options.permissions.includes('variants.read') ? await catalogCollection<CatalogVariantRecord>(`/admin/variants?productId=${encodeURIComponent(id)}`) : [];
  const primaryVariant = selectedVariant === 'new' ? null : selectedVariant ? variants.find((item) => item.id === selectedVariant) ?? null : variants[0] ?? null;
  const product = mapProduct(rawProduct, variants);
  const mediaProduct = parseMediaProduct(rawProduct);

  return (
    <AdminShell>
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-elevated sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">products.write</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">
            {product ? `Editar ${product.name}` : 'Producto no encontrado'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
            Edita datos comerciales, variante principal, precio, costo y reglas logísticas. La activación vuelve a validar vendibilidad en backend.
          </p>
        </section>

        {product && mediaProduct && options.permissions.includes('products.read') && !options.permissions.includes('variants.read') ? <ProductMediaPanel initialProduct={mediaProduct} /> : null}

        {selectedVariant && selectedVariant !== 'new' && !primaryVariant ? <p role="alert">La variante no pertenece a este producto o no tienes permiso para consultarla.</p> : !options.permissions.includes('variants.read') ? <p role="alert">Necesitas permiso de lectura de variantes para editar SKU y precio de este producto.</p> : product ? (
          <AdminProductCompleteForm
            mode="edit"
            product={{ ...product, isActive: rawProduct.isActive }}
            originalMetadata={rawProduct.metadata ?? {}}
            primaryVariant={primaryVariant}
            brands={options.brands.length ? options.brands : rawProduct.brand ? [rawProduct.brand] : []}
            categories={options.categories.length ? options.categories : rawProduct.category ? [rawProduct.category] : []}
            warehouses={options.warehouses}
          />
        ) : (
          <div className="rounded-[1.5rem] border border-[var(--color-border)] bg-[#0d0d0d] p-6">
            <p className="text-sm text-[var(--color-text-secondary)]">No existe un producto con este identificador.</p>
            <div className="mt-4"><Link href="/admin/productos"><Button variant="outline">Volver</Button></Link></div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

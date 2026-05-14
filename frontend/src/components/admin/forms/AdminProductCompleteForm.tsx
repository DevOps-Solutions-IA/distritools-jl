'use client';

import { useMemo, useState } from 'react';
import type React from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type {
  BackendBrandRecord,
  BackendCategoryRecord,
  BackendVariantRecord,
  CatalogProduct,
} from '@/features/catalog/types';

const fullProductSchema = z.object({
  name: z.string().min(3).max(180),
  slug: z.string().min(3).max(180),
  brandId: z.string().uuid(),
  categoryId: z.string().uuid(),
  shortDescription: z.string().min(8).max(280),
  longDescription: z.string().min(10).max(3000),
  mainImage: z.string().optional(),
  variantName: z.string().min(2).max(180),
  sku: z.string().min(2).max(120),
  price: z.coerce.number().positive(),
  costPrice: z.coerce.number().nonnegative().optional(),
  stock: z.coerce.number().int().nonnegative(),
  warehouseId: z.string().uuid().optional(),
  weightKg: z.coerce.number().positive(),
  lengthCm: z.coerce.number().positive(),
  widthCm: z.coerce.number().positive(),
  heightCm: z.coerce.number().positive(),
  publishAction: z.enum(['draft', 'validate', 'activate']),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function metadataFrom(input: z.infer<typeof fullProductSchema>) {
  return {
    shortDescription: input.shortDescription,
    longDescription: input.longDescription,
    image: input.mainImage
      ? { status: 'approved', assetPath: input.mainImage.trim(), source: 'admin' }
      : { status: 'pending', assetPath: null, source: 'admin' },
    shipping: {
      weightKg: input.weightKg,
      lengthCm: input.lengthCm,
      widthCm: input.widthCm,
      heightCm: input.heightCm,
    },
    dimensions: {
      weightKg: input.weightKg,
      lengthCm: input.lengthCm,
      widthCm: input.widthCm,
      heightCm: input.heightCm,
    },
  };
}

export function AdminProductCompleteForm({
  mode = 'create',
  product,
  primaryVariant,
  brands,
  categories,
  warehouses,
}: {
  mode?: 'create' | 'edit';
  product?: (CatalogProduct & { isActive?: boolean }) | null;
  primaryVariant?: BackendVariantRecord | null;
  brands: BackendBrandRecord[];
  categories: BackendCategoryRecord[];
  warehouses: Array<{ id: string; name?: string; code?: string }>;
}) {
  const router = useRouter();
  const shipping: Record<string, unknown> = {};
  const [name, setName] = useState(product?.name ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [brandId, setBrandId] = useState(product?.brand?.id ?? '');
  const [categoryId, setCategoryId] = useState(product?.category?.id ?? '');
  const [shortDescription, setShortDescription] = useState(product?.description ?? '');
  const [longDescription, setLongDescription] = useState(product?.longDescription ?? product?.description ?? '');
  const [mainImage, setMainImage] = useState(product?.image.assetPath ?? '');
  const [variantName, setVariantName] = useState(primaryVariant?.name ?? product?.name ?? '');
  const [sku, setSku] = useState(primaryVariant?.sku ?? '');
  const [price, setPrice] = useState(primaryVariant?.price ? String(Number(primaryVariant.price)) : '');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [weightKg, setWeightKg] = useState(String(shipping.weightKg ?? shipping.weight ?? ''));
  const [lengthCm, setLengthCm] = useState(String(shipping.lengthCm ?? shipping.length ?? ''));
  const [widthCm, setWidthCm] = useState(String(shipping.widthCm ?? shipping.width ?? ''));
  const [heightCm, setHeightCm] = useState(String(shipping.heightCm ?? shipping.height ?? ''));
  const [publishAction, setPublishAction] = useState<'draft' | 'validate' | 'activate'>('draft');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => Boolean(name.trim() && slug.trim()), [name, slug]);

  async function jsonFetch(path: string, options: RequestInit) {
    const response = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message ?? `Error ${response.status}`);
    }
    return payload;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const parsed = fullProductSchema.safeParse({
      name,
      slug,
      brandId,
      categoryId,
      shortDescription,
      longDescription,
      mainImage,
      variantName,
      sku,
      price,
      costPrice: costPrice === '' ? undefined : costPrice,
      stock,
      warehouseId: warehouseId || undefined,
      weightKg,
      lengthCm,
      widthCm,
      heightCm,
      publishAction,
    });

    if (!parsed.success) {
      setError('Completa todos los campos críticos: marca, categoría, SKU, precio, dimensiones, peso y descripción.');
      return;
    }

    setIsSubmitting(true);
    try {
      const input = parsed.data;
      const productPayload = {
        name: input.name,
        slug: input.slug,
        brandId: input.brandId,
        categoryId: input.categoryId,
        description: input.shortDescription,
        isActive: false,
        metadata: metadataFrom(input),
      };
      const savedProduct = mode === 'edit' && product
        ? await jsonFetch(`/api/admin/products/${product.id}`, { method: 'PATCH', body: JSON.stringify(productPayload) })
        : await jsonFetch('/api/admin/products', { method: 'POST', body: JSON.stringify(productPayload) });
      const productId = savedProduct.id ?? product?.id;

      const variantPayload = {
        productId,
        sku: input.sku,
        name: input.variantName,
        price: String(input.price),
        taxRate: '0',
        isActive: true,
      };
      const savedVariant = mode === 'edit' && primaryVariant
        ? await jsonFetch(`/api/admin/variants/${primaryVariant.id}`, { method: 'PATCH', body: JSON.stringify(variantPayload) })
        : await jsonFetch('/api/admin/variants', { method: 'POST', body: JSON.stringify(variantPayload) });
      const variantId = savedVariant.id ?? primaryVariant?.id;

      if (variantId && input.warehouseId && input.stock > 0 && mode === 'create') {
        await jsonFetch('/api/admin/inventory/adjust', {
          method: 'PATCH',
          body: JSON.stringify({
            variantId,
            warehouseId: input.warehouseId,
            quantityDelta: input.stock,
            reason: 'Inventario inicial desde creación de producto completo',
            referenceId: `product-create-${productId}`,
          }),
        });
      }

      if (variantId && input.warehouseId && input.costPrice !== undefined) {
        await jsonFetch(`/api/admin/inventory/settings/${variantId}/${input.warehouseId}`, {
          method: 'PATCH',
          body: JSON.stringify({ costPrice: input.costPrice }),
        });
      }

      const validation = await jsonFetch(`/api/admin/products/${productId}/validate-sellability`, { method: 'POST', body: '{}' });
      if (input.publishAction === 'activate') {
        const blockers = (validation.blockers ?? []).filter((blocker: string) => blocker !== 'INACTIVE');
        if (blockers.length || validation.warnings?.length) {
          throw new Error(`No se activó: ${[...blockers, ...(validation.warnings ?? [])].join(', ')}`);
        }
        await jsonFetch(`/api/admin/products/${productId}/activate`, { method: 'PATCH', body: '{}' });
      }

      setSuccess(input.publishAction === 'activate' ? 'Producto completo creado y activado.' : 'Producto guardado y validado.');
      router.refresh();
      router.push(`/admin/productos/${productId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible guardar el producto completo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 rounded-[1.75rem] border border-[var(--color-border)] bg-[#0d0d0d] p-5 sm:p-7">
      <section className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">Datos generales</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--color-off-white)]">Identidad comercial</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Input label="Nombre" value={name} onChange={(event) => { setName(event.target.value); if (!slug) setSlug(slugify(event.target.value)); }} required />
          <Input label="Slug" value={slug} onChange={(event) => setSlug(slugify(event.target.value))} required />
          <label className="grid gap-2 text-sm font-semibold text-[var(--color-off-white)]">
            Marca
            <select className="focus-ring h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-sm text-[var(--color-off-white)]" value={brandId} onChange={(event) => setBrandId(event.target.value)} required>
              <option value="">Selecciona marca</option>
              {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[var(--color-off-white)]">
            Categoría
            <select className="focus-ring h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-sm text-[var(--color-off-white)]" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
              <option value="">Selecciona categoría</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
        </div>
        <Input label="Descripción corta" value={shortDescription} onChange={(event) => setShortDescription(event.target.value)} required maxLength={280} />
        <label className="grid gap-2 text-sm font-semibold text-[var(--color-off-white)]">
          Descripción larga
          <textarea className="focus-ring min-h-36 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3 text-sm text-[var(--color-off-white)]" value={longDescription} onChange={(event) => setLongDescription(event.target.value)} required />
        </label>
        <Input label="Imagen principal (ruta o URL segura)" value={mainImage} onChange={(event) => setMainImage(event.target.value)} placeholder="/products/taladro.jpg" />
      </section>

      <section className="grid gap-4 rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">Variante inicial</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--color-off-white)]">SKU, precio, costo y stock</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Input label="Nombre variante" value={variantName} onChange={(event) => setVariantName(event.target.value)} required />
          <Input label="SKU" value={sku} onChange={(event) => setSku(event.target.value.toUpperCase())} required />
          <Input label="Precio COP" type="number" min="1" value={price} onChange={(event) => setPrice(event.target.value)} required />
          <Input label="Costo COP (opcional)" type="number" min="0" value={costPrice} onChange={(event) => setCostPrice(event.target.value)} />
          <Input label="Stock inicial" type="number" min="0" value={stock} onChange={(event) => setStock(event.target.value)} />
          <label className="grid gap-2 text-sm font-semibold text-[var(--color-off-white)]">
            Bodega
            <select className="focus-ring h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-sm text-[var(--color-off-white)]" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
              <option value="">Sin stock inicial</option>
              {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name ?? warehouse.code ?? warehouse.id}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-4 rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">Logística</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--color-off-white)]">Peso y dimensiones</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-4">
          <Input label="Peso kg" type="number" min="0.01" step="0.01" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} required />
          <Input label="Largo cm" type="number" min="0.01" step="0.01" value={lengthCm} onChange={(event) => setLengthCm(event.target.value)} required />
          <Input label="Ancho cm" type="number" min="0.01" step="0.01" value={widthCm} onChange={(event) => setWidthCm(event.target.value)} required />
          <Input label="Alto cm" type="number" min="0.01" step="0.01" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} required />
        </div>
      </section>

      <section className="grid gap-3 rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-semibold text-[var(--color-off-white)]">Acción de guardado</p>
        <div className="grid gap-2 md:grid-cols-3">
          {[
            ['draft', 'Guardar borrador'],
            ['validate', 'Guardar y validar'],
            ['activate', 'Guardar y activar'],
          ].map(([value, text]) => (
            <label key={value} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-[var(--color-text-secondary)]">
              <input type="radio" name="publishAction" checked={publishAction === value} onChange={() => setPublishAction(value as typeof publishAction)} />
              {text}
            </label>
          ))}
        </div>
      </section>

      {error ? <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
      {success ? <p className="rounded-xl border border-green-400/20 bg-green-500/10 px-4 py-3 text-sm text-green-200">{success}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={isSubmitting} disabled={!canSubmit}>{mode === 'edit' ? 'Guardar producto completo' : 'Crear producto completo'}</Button>
        <Button type="button" variant="outline" onClick={() => router.push('/admin/productos')}>Cancelar</Button>
      </div>
    </form>
  );
}

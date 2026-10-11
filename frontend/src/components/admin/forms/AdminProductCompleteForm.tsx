'use client';

import { useEffect, useMemo, useState } from 'react';
import { MediaApproval } from '@/features/admin/catalog/MediaApproval';
import { parseMediaProduct, type MediaProduct } from '@/features/admin/catalog/media-contract';
import type React from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';
import { useCatalogPermissions } from '@/features/admin/catalog/useCatalogPermissions';
import { catalogRequest, CatalogRequestError } from '@/features/admin/catalog/request';
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

function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function metadataFrom(input: z.infer<typeof fullProductSchema>, original: Record<string, unknown>, originalImage: string) {
  return {
    ...original,
    shortDescription: input.shortDescription,
    longDescription: input.longDescription,
    image: input.mainImage
      ? { ...record(original.image), status: input.mainImage.trim() === originalImage ? record(original.image).status ?? 'pending' : 'pending', assetPath: input.mainImage.trim() }
      : { ...record(original.image), status: 'pending', assetPath: null },
    shipping: {
      ...record(original.shipping),
      weightKg: input.weightKg,
      lengthCm: input.lengthCm,
      widthCm: input.widthCm,
      heightCm: input.heightCm,
    },
    dimensions: {
      ...record(original.dimensions),
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
  originalMetadata = {},
}: {
  mode?: 'create' | 'edit';
  originalMetadata?: Record<string, unknown>;
  product?: (CatalogProduct & { isActive?: boolean }) | null;
  primaryVariant?: BackendVariantRecord | null;
  brands: Array<Pick<BackendBrandRecord, 'id' | 'name'>>;
  categories: Array<Pick<BackendCategoryRecord, 'id' | 'name'>>;
  warehouses: Array<{ id: string; name?: string; code?: string }>;
}) {
  const router = useRouter();
  const shipping = Object.keys(record(originalMetadata.shipping)).length ? record(originalMetadata.shipping) : record(originalMetadata.dimensions);
  const permissions = useCatalogPermissions('product-form');
  const [mediaProduct, setMediaProduct] = useState<MediaProduct | null>(mode === 'edit' ? parseMediaProduct(product ? { ...product, metadata: originalMetadata } : null) : null);
  const [receipt, setReceipt] = useState<string[]>([]);
  const [persistedId, setPersistedId] = useState<string | null>(null);
  const [reconcile, setReconcile] = useState(false);
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

  const mediaProductId = product?.id;
  const canReadMedia = permissions.can('products.read');
  useEffect(() => {
    if (mode !== 'edit' || !mediaProductId || !canReadMedia) return;
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    async function loadSavedImage() {
      try {
        const response = await fetch(`/api/admin/products/${mediaProductId}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('No se pudo consultar la imagen guardada. Recarga el producto para aprobar.');
        const current = parseMediaProduct(await response.json());
        if (!current || current.id !== mediaProductId) throw new Error('No se pudo verificar el estado guardado de la imagen.');
        if (active) setMediaProduct(current);
      } catch (caught) { if (active) setError(controller.signal.aborted ? 'La consulta de la imagen guardada tardó demasiado. Recarga para aprobar.' : caught instanceof Error ? caught.message : 'No se pudo consultar la imagen.'); }
      finally { window.clearTimeout(timeout); }
    }
    void loadSavedImage();
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [mode, mediaProductId, canReadMedia]);

  const canSubmit = useMemo(() => Boolean(name.trim() && slug.trim()), [name, slug]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!permissions.can('products.write') || isSubmitting || reconcile) return;
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
    let productSaved = false;
    try {
      const input = parsed.data;
      if (input.publishAction !== 'draft' && !permissions.can('products.read')) throw new Error('No tienes permiso para validar vendibilidad.');
      if (input.publishAction === 'activate' && !permissions.can('products.publish')) throw new Error('No tienes permiso para activar productos.');
      if ((input.stock > 0 || input.costPrice !== undefined) && !input.warehouseId) throw new Error('Selecciona una bodega autorizada para guardar stock o costo.');
      if (input.stock > 0 && !permissions.can('inventory.adjust')) throw new Error('No tienes permiso para ajustar inventario.');
      if (input.costPrice !== undefined && !(permissions.can('inventory.settings.write') && permissions.can('inventory.cost.write'))) throw new Error('No tienes permiso para guardar costos.');
      const productPayload = {
        name: input.name,
        slug: input.slug,
        brandId: input.brandId,
        categoryId: input.categoryId,
        description: input.shortDescription,
        ...(mode === 'create' ? { isActive: false } : {}),
        metadata: metadataFrom(input, { ...originalMetadata, ...(mediaProduct?.metadata.image ? { image: mediaProduct.metadata.image } : {}) }, product?.image.assetPath ?? ''),
      };
      const savedProduct = mode === 'edit' && product
        ? await catalogRequest(`/api/admin/products/${product.id}`, 'PATCH', productPayload)
        : await catalogRequest('/api/admin/products', 'POST', productPayload);
      if (typeof savedProduct.id !== 'string') throw new CatalogRequestError('No se pudo confirmar el producto guardado.', true);
      const productId = savedProduct.id;
      setMediaProduct(parseMediaProduct(savedProduct));
      productSaved = true;
      setPersistedId(productId);
      setReceipt(['Producto guardado']);
      let completed = 'Producto guardado';

      const variantPayload = {
        productId,
        sku: input.sku,
        name: input.variantName,
        price: String(input.price),
        ...(mode === 'create' || !primaryVariant ? { taxRate: '0', isActive: true } : {}),
      };
      const savedVariant = mode === 'edit' && primaryVariant
        ? await catalogRequest(`/api/admin/variants/${primaryVariant.id}`, 'PATCH', variantPayload)
        : await catalogRequest('/api/admin/variants', 'POST', variantPayload);
      if (typeof savedVariant.id !== 'string') throw new CatalogRequestError('No se pudo confirmar la variante guardada.', true);
      const variantId = savedVariant.id;
      completed += ' · Variante guardada'; setReceipt((steps) => [...steps, 'Variante guardada']);

      if (variantId && input.warehouseId && input.stock > 0 && mode === 'create') {
        await catalogRequest('/api/admin/inventory/adjust', 'PATCH', {
            variantId,
            warehouseId: input.warehouseId,
            quantityDelta: input.stock,
            reason: 'Inventario inicial desde creación de producto completo',
            referenceId: `product-create-${productId}`,
        });
        completed += ' · Stock inicial guardado'; setReceipt((steps) => [...steps, 'Stock inicial guardado']);
      }

      if (variantId && input.warehouseId && input.costPrice !== undefined) {
        await catalogRequest(`/api/admin/inventory/settings/${variantId}/${input.warehouseId}`, 'PATCH', { costPrice: input.costPrice });
        completed += ' · Costo guardado'; setReceipt((steps) => [...steps, 'Costo guardado']);
      }

      if (input.publishAction !== 'draft') {
        const validation = await catalogRequest(`/api/admin/products/${productId}/validate-sellability`, 'POST');
        if (typeof validation.status !== 'string' || !Array.isArray(validation.blockers) || !Array.isArray(validation.warnings)) throw new CatalogRequestError('No se pudo confirmar la validación de vendibilidad.', true);
        completed += ` · Vendibilidad: ${validation.status}`; setReceipt((steps) => [...steps, `Vendibilidad: ${validation.status}`]);
        if (input.publishAction === 'activate') {
          await catalogRequest(`/api/admin/products/${productId}/activate`, 'PATCH');
          completed += ' · Producto activado'; setReceipt((steps) => [...steps, 'Producto activado']);
        }
      }
      setSuccess(completed);
      router.refresh();
      router.push(`/admin/productos/${productId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible confirmar el resultado.');
      if (caught instanceof CatalogRequestError && caught.status === 401) permissions.retry();
      // Earlier requests may already be durable. Do not repeat creation or invent compensation.
      setReconcile(productSaved || (caught instanceof CatalogRequestError && caught.uncertain));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-6 rounded-[1.75rem] border border-[var(--color-border)] bg-[#0d0d0d] p-5 sm:p-7">
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
        <MediaApproval value={mainImage} onChange={setMainImage} product={mediaProduct} canRead={permissions.can('products.read')} canApprove={permissions.can('products.write') && !isSubmitting} onApproved={(confirmed) => { setMediaProduct(confirmed); router.refresh(); }} />
      </section>

      <section className="grid gap-4 rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">{mode === 'edit' && primaryVariant ? 'Variante seleccionada' : 'Nueva variante'}</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--color-off-white)]">SKU, precio, costo y stock</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Input label="Nombre variante" value={variantName} onChange={(event) => setVariantName(event.target.value)} required />
          <Input label="SKU" value={sku} onChange={(event) => setSku(event.target.value.toUpperCase())} required />
          <Input label="Precio COP" type="number" min="1" value={price} onChange={(event) => setPrice(event.target.value)} required />
          <Input disabled={!(permissions.can('inventory.settings.write') && permissions.can('inventory.cost.write'))} label="Costo COP (opcional)" type="number" min="0" value={costPrice} onChange={(event) => setCostPrice(event.target.value)} />
          <Input disabled={mode === 'edit' || !permissions.can('inventory.adjust')} label="Stock inicial" type="number" min="0" value={stock} onChange={(event) => setStock(event.target.value)} />
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
              <input type="radio" name="publishAction" disabled={value !== 'draft' && (!permissions.can('products.read') || (value === 'activate' && !permissions.can('products.publish')))} checked={publishAction === value} onChange={() => setPublishAction(value as typeof publishAction)} />
              {text}
            </label>
          ))}
        </div>
      </section>

      {error ? <p role="alert" className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{receipt.length ? `${receipt.join(' · ')}. Flujo incompleto: ` : ''}{error}</p> : null}
      {success ? <p role="status" className="rounded-xl border border-green-400/20 bg-green-500/10 px-4 py-3 text-sm text-green-200">{success}</p> : null}

      {persistedId && reconcile ? <Link className="text-[var(--color-industrial-yellow)] underline" href={`/admin/productos/${persistedId}/editar`}>Revisar producto guardado y continuar desde su estado real</Link> : null}
      {reconcile && !persistedId ? <Link className="text-[var(--color-industrial-yellow)] underline" href="/admin/productos">Revisar catálogo antes de repetir la creación</Link> : null}
      {!permissions.pending && !permissions.can('products.write') ? <p role="status">Sin permiso para guardar productos.</p> : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={isSubmitting} disabled={!canSubmit || !permissions.can('products.write') || reconcile}>{mode === 'edit' ? 'Guardar producto completo' : 'Crear producto completo'}</Button>
        <Button type="button" variant="outline" onClick={() => router.push('/admin/productos')}>Cancelar</Button>
      </div>
    </form>
  );
}

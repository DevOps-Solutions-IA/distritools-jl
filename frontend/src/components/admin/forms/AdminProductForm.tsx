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
  CatalogProduct,
} from '@/features/catalog/types';

const productSchema = z.object({
  name: z.string().min(3, 'Nombre requerido.').max(180),
  slug: z.string().min(3, 'Slug requerido.').max(180),
  brandId: z.string().uuid().nullable(),
  categoryId: z.string().uuid().nullable(),
  description: z.string().max(2000).optional(),
  isActive: z.boolean(),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

interface AdminProductFormProps {
  mode: 'create' | 'edit';
  product?: (CatalogProduct & { isActive?: boolean }) | null;
  brands: BackendBrandRecord[];
  categories: BackendCategoryRecord[];
}

export function AdminProductForm({ mode, product, brands, categories }: AdminProductFormProps) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [brandId, setBrandId] = useState(product?.brand?.id ?? '');
  const [categoryId, setCategoryId] = useState(product?.category?.id ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitLabel = mode === 'create' ? 'Crear producto' : 'Guardar cambios';
  const endpoint = mode === 'create' ? '/api/admin/products' : `/api/admin/products/${product?.id}`;

  const canSubmit = useMemo(() => Boolean(name.trim() && slug.trim()), [name, slug]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const parsed = productSchema.safeParse({
      name,
      slug,
      brandId: brandId || null,
      categoryId: categoryId || null,
      description,
      isActive,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisa los campos.');
      return;
    }

    setIsSubmitting(true);
    const response = await fetch(endpoint, {
      method: mode === 'create' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });
    const payload = await response.json().catch(() => ({}));
    setIsSubmitting(false);

    if (!response.ok) {
      setError(payload.message ?? 'No fue posible guardar el producto.');
      return;
    }

    setSuccess('Producto guardado con trazabilidad del backend.');
    router.refresh();
    if (mode === 'create') {
      router.push('/admin/productos');
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 rounded-[1.5rem] border border-[var(--color-border)] bg-[#0d0d0d] p-5 sm:p-7">
      <div className="grid gap-5 lg:grid-cols-2">
        <Input
          label="Nombre"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!slug) {
              setSlug(slugify(event.target.value));
            }
          }}
          required
          maxLength={180}
        />
        <Input
          label="Slug"
          value={slug}
          onChange={(event) => setSlug(slugify(event.target.value))}
          required
          maxLength={180}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-[var(--color-off-white)]">
          Marca
          <select
            className="focus-ring h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-sm text-[var(--color-off-white)]"
            value={brandId}
            onChange={(event) => setBrandId(event.target.value)}
          >
            <option value="">Sin marca</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[var(--color-off-white)]">
          Categoría
          <select
            className="focus-ring h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-sm text-[var(--color-off-white)]"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Sin categoría</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-[var(--color-off-white)]">
        Descripción comercial
        <textarea
          className="focus-ring min-h-32 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3 text-sm text-[var(--color-off-white)]"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={2000}
        />
      </label>

      <label className="flex items-center gap-3 text-sm font-semibold text-[var(--color-off-white)]">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          className="h-5 w-5 rounded border-[var(--color-border)]"
        />
        Producto activo
      </label>

      {error ? <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
      {success ? <p className="rounded-xl border border-green-400/20 bg-green-500/10 px-4 py-3 text-sm text-green-200">{success}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={isSubmitting} disabled={!canSubmit}>
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/admin/productos')}>
          Volver
        </Button>
      </div>
    </form>
  );
}

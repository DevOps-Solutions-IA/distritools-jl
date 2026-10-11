'use client';

import { useState } from 'react';
import type React from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCatalogPermissions } from '@/features/admin/catalog/useCatalogPermissions';
import { catalogRequest, CatalogRequestError } from '@/features/admin/catalog/request';

const taxonomySchema = z.object({
  name: z.string().min(2, 'Nombre requerido.').max(120),
  slug: z.string().min(2, 'Slug requerido.').max(140),
  description: z.string().max(500).optional(),
  isActive: z.boolean(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.coerce.number().int().nonnegative(),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function AdminTaxonomyForm({
  kind,
  mode = 'create',
  initial,
  categories = [],
}: {
  kind: 'brand' | 'category';
  mode?: 'create' | 'edit';
  initial?: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    isActive?: boolean;
    parentId?: string | null;
    sortOrder?: number;
  } | null;
  categories?: Array<{ id: string; name: string; parentId?: string | null }>;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [parentId, setParentId] = useState(initial?.parentId ?? '');
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [status, setStatus] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const { can, pending, retry } = useCatalogPermissions('taxonomy-' + kind);
  const allowed = can(kind === 'brand' ? 'brands.write' : 'categories.write');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const endpoint = kind === 'brand'
    ? mode === 'edit' && initial ? `/api/admin/brands/${initial.id}` : '/api/admin/brands'
    : mode === 'edit' && initial ? `/api/admin/categories/${initial.id}` : '/api/admin/categories';
  const label = kind === 'brand' ? 'marca' : 'categoría';

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const parsed = taxonomySchema.safeParse({
      name,
      slug,
      description,
      isActive,
      sortOrder,
    parentId: kind === 'category' ? parentId || null : undefined,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisa los campos.');
      return;
    }

    if (!allowed || isSubmitting || uncertain) return;
    const { parentId: parsedParent, sortOrder: parsedOrder, isActive: parsedActivity, ...identity } = parsed.data;
    const body = mode === 'create'
      ? { ...identity, isActive: parsedActivity, ...(kind === 'category' ? { parentId: parsedParent, sortOrder: parsedOrder } : {}) }
      : { ...identity, ...(kind === 'category' ? { isActive: parsedActivity } : {}) };
    await run(endpoint, body, mode === 'edit' ? 'PATCH' : 'POST', mode === 'edit' ? `Datos de ${label} guardados.` : `${label === 'marca' ? 'Marca' : 'Categoría'} creada.`);
  }

  async function run(path: string, body: unknown, method: 'PATCH' | 'POST', message: string) {
    if (!allowed || isSubmitting || uncertain) return;
    setError(null); setStatus(null); setIsSubmitting(true);
    try {
      const payload = await catalogRequest(path, method, body);
      if (typeof payload.id !== 'string') throw new CatalogRequestError('No fue posible confirmar el registro guardado. Recarga antes de repetir.', true);
      setStatus(message);
      if (mode === 'create') router.push(`/admin/${kind === 'brand' ? 'marcas' : 'categorias'}/${payload.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible confirmar la operación.');
      if (caught instanceof CatalogRequestError && caught.status === 401) retry();
      if (caught instanceof CatalogRequestError && caught.uncertain) setUncertain(true);
    } finally { setIsSubmitting(false); }
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
          maxLength={120}
        />
        <Input
          label="Slug"
          value={slug}
          onChange={(event) => setSlug(slugify(event.target.value))}
          required
          maxLength={140}
        />
      </div>
      <label className="grid gap-2 text-sm font-semibold text-[var(--color-off-white)]">
        Descripción
        <textarea
          className="focus-ring min-h-28 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3 text-sm text-[var(--color-off-white)]"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
        />
      </label>
      {kind === 'category' ? (
        <label className="grid gap-2 text-sm font-semibold text-[var(--color-off-white)]">
          Categoría padre
          <select
            className="focus-ring h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-sm text-[var(--color-off-white)]"
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
          >
            <option value="">Sin padre</option>
            {categories.filter((category) => category.id !== initial?.id).map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
      ) : null}
      {kind === 'category' ? <Input label="Orden en la jerarquía" type="number" min="0" step="1" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} /> : null}
      {kind !== 'brand' || mode === 'create' ? <label className="flex items-center gap-3 text-sm font-semibold text-[var(--color-off-white)]">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          className="h-5 w-5 rounded border-[var(--color-border)]"
        />
        Activa
      </label> : <p className="text-sm text-[var(--color-text-secondary)]">Estado actual: {initial?.isActive ? 'activa' : 'inactiva'}</p>}
      {error ? <p role="alert" className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-green-200">{status}</p> : null}
      {!pending && !allowed ? <p role="status">Sin permiso para modificar esta {label}.</p> : null}
      {uncertain ? <Button type="button" variant="outline" onClick={() => { router.refresh(); router.push(`/admin/${kind === 'brand' ? 'marcas' : 'categorias'}/${initial?.id ?? ''}`); }}>Revisar estado persistido</Button> : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={isSubmitting} disabled={!allowed || uncertain}>
          {mode === 'edit' ? 'Guardar' : 'Crear'} {label}
        </Button>
        {kind === 'brand' && mode === 'edit' && initial ? <Button type="button" variant="outline" disabled={!allowed || isSubmitting || uncertain} onClick={() => run(`${endpoint}/${initial.isActive ? 'deactivate' : 'activate'}`, undefined, 'PATCH', 'Estado de marca guardado.')}>{initial.isActive ? 'Desactivar marca' : 'Activar marca'}</Button> : null}
        {kind === 'category' && mode === 'edit' && initial ? <Button type="button" variant="outline" disabled={!allowed || isSubmitting || uncertain} onClick={() => {
          const order = Number(sortOrder);
          if (!Number.isInteger(order) || order < 0) { setError('El orden debe ser un entero no negativo.'); return; }
          void run(`${endpoint}/tree`, { parentId: parentId || null, sortOrder: order }, 'PATCH', 'Jerarquía guardada.');
        }}>Guardar jerarquía</Button> : null}
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Volver
        </Button>
      </div>
    </form>
  );
}

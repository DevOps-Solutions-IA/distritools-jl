'use client';

import { useState } from 'react';
import type React from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const taxonomySchema = z.object({
  name: z.string().min(2, 'Nombre requerido.').max(120),
  slug: z.string().min(2, 'Slug requerido.').max(140),
  description: z.string().max(500).optional(),
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

export function AdminTaxonomyForm({ kind }: { kind: 'brand' | 'category' }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const endpoint = kind === 'brand' ? '/api/admin/brands' : '/api/admin/categories';
  const label = kind === 'brand' ? 'marca' : 'categoría';

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const parsed = taxonomySchema.safeParse({ name, slug, description, isActive });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisa los campos.');
      return;
    }

    setIsSubmitting(true);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });
    const payload = await response.json().catch(() => ({}));
    setIsSubmitting(false);

    if (!response.ok) {
      setError(payload.message ?? `No fue posible crear la ${label}.`);
      return;
    }

    router.push(kind === 'brand' ? '/admin/marcas' : '/admin/categorias');
    router.refresh();
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
      <label className="flex items-center gap-3 text-sm font-semibold text-[var(--color-off-white)]">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          className="h-5 w-5 rounded border-[var(--color-border)]"
        />
        Activa
      </label>
      {error ? <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={isSubmitting}>
          Crear {label}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Volver
        </Button>
      </div>
    </form>
  );
}

'use client';

import { z } from 'zod';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  saveFooterGroups,
  validateFooterGroups,
  type FooterGroup,
  type FooterRevisionInput,
} from '@/lib/api/footer';

export function FooterRouteEditor({
  revision,
}: {
  revision?: FooterRevisionInput;
}) {
  const router = useRouter();
  const parsed = z
    .array(
      z.object({
        title: z.string(),
        links: z.array(
          z.object({
            label: z.string(),
            href: z.string(),
            isVisible: z.boolean().optional(),
          }),
        ),
      }),
    )
    .safeParse(revision?.groupsJson);
  const initial =
    parsed.success && parsed.data.length > 0
      ? parsed.data
      : [{ title: '', links: [{ label: '', href: '', isVisible: true }] }];
  const [groups, setGroups] = useState<FooterGroup[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const draftId = revision?.status === 'draft' ? revision.id : undefined;
  function update(
    group: number,
    link: number | null,
    key: 'title' | 'label' | 'href',
    value: string,
  ) {
    setError(null);
    setNotice(null);
    setGroups((current) =>
      current.map((entry, index) =>
        index !== group
          ? entry
          : link === null
            ? { ...entry, title: value }
            : {
                ...entry,
                links: entry.links.map((item, pos) =>
                  pos === link ? { ...item, [key]: value } : item,
                ),
              },
      ),
    );
  }
  async function validate() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await validateFooterGroups(groups);
      setNotice(
        'Los destinos están disponibles. Se validarán nuevamente al guardar y publicar.',
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'No fue posible validar los destinos.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await validateFooterGroups(groups);
      await saveFooterGroups(groups, draftId);
      setNotice(
        'Borrador guardado. Requiere revisión y aprobación antes de publicarse.',
      );
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'No fue posible guardar el borrador.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={save}
      className="mt-5 grid gap-4"
      aria-label="Editar destinos del footer"
    >
      <p className="text-sm text-[var(--color-text-secondary)]">
        {draftId ? 'Editar borrador' : 'Crear una nueva revisión'} · Los cambios
        requieren permiso de edición y la publicación conserva su aprobación
        independiente.
      </p>
      {groups.map((group, groupIndex) => (
        <fieldset
          key={groupIndex}
          className="grid gap-3 rounded-xl border border-white/10 p-4"
          disabled={busy}
        >
          <legend>Grupo {groupIndex + 1}</legend>
          <label>
            Título del grupo
            <input
              className="block w-full rounded bg-black p-2"
              required
              maxLength={120}
              value={group.title}
              onChange={(event) =>
                update(groupIndex, null, 'title', event.target.value)
              }
            />
          </label>
          {group.links.map((link, linkIndex) => (
            <div key={linkIndex} className="grid gap-2 sm:grid-cols-2">
              <label>
                Texto del enlace
                <input
                  className="block w-full rounded bg-black p-2"
                  required
                  maxLength={120}
                  value={link.label}
                  onChange={(event) =>
                    update(groupIndex, linkIndex, 'label', event.target.value)
                  }
                />
              </label>
              <label>
                Ruta interna
                <input
                  className="block w-full rounded bg-black p-2"
                  required
                  maxLength={2048}
                  value={link.href}
                  onChange={(event) =>
                    update(groupIndex, linkIndex, 'href', event.target.value)
                  }
                  onBlur={() => {
                    if (link.href) void validate();
                  }}
                  aria-describedby="footer-route-feedback"
                />
              </label>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setGroups((current) =>
                current.map((entry, index) =>
                  index === groupIndex
                    ? {
                        ...entry,
                        links: [
                          ...entry.links,
                          { label: '', href: '', isVisible: true },
                        ],
                      }
                    : entry,
                ),
              )
            }
          >
            Añadir enlace
          </button>
        </fieldset>
      ))}
      <div id="footer-route-feedback" aria-live="polite">
        {error ? <p role="alert">{error}</p> : null}
        {notice ? <p role="status">{notice}</p> : null}
      </div>
      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            setGroups((current) => [
              ...current,
              { title: '', links: [{ label: '', href: '', isVisible: true }] },
            ])
          }
        >
          Añadir grupo
        </button>
        <button type="button" disabled={busy} onClick={() => void validate()}>
          Validar destinos
        </button>
        <button type="submit" disabled={busy}>
          {busy ? 'Validando…' : 'Guardar borrador'}
        </button>
      </div>
    </form>
  );
}

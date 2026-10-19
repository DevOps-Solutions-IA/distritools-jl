'use client';

import { z } from 'zod';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  saveFooterGroups,
  validateFooterGroups,
  type FooterGroup,
  type FooterRevisionInput,
} from '@/lib/api/footer';

export function FooterRouteEditor({
  revision,
  disabled = false,
  onSaved,
  onDirtyChange,
  onBusyChange,
  validateGroups = validateFooterGroups,
  saveGroups = saveFooterGroups,
}: {
  revision?: FooterRevisionInput;
  disabled?: boolean;
  onSaved?: (value: unknown) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  validateGroups?: (groups: FooterGroup[]) => Promise<unknown>;
  saveGroups?: (groups: FooterGroup[], id?: string) => Promise<unknown>;
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
  const [errorKind, setErrorKind] = useState('validation_error');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const validationSequence = useRef(0);
  const draftId =
    revision?.status === 'draft' || revision?.status === 'pending_legal_review'
      ? revision.id
      : undefined;
  function changeGroups(change: (current: FooterGroup[]) => FooterGroup[]) {
    validationSequence.current += 1;
    setError(null);
    setNotice(null);
    onDirtyChange?.(true);
    setGroups(change);
  }
  function update(
    group: number,
    link: number | null,
    key: 'title' | 'label' | 'href',
    value: string,
  ) {
    setError(null);
    setNotice(null);
    changeGroups((current) =>
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
  async function validate(blocking = true) {
    const sequence = ++validationSequence.current;
    if (blocking) {
      setBusy(true);
      onBusyChange?.(true);
    }
    setError(null);
    setNotice(null);
    try {
      await validateGroups(groups);
      if (sequence !== validationSequence.current) return;
      setNotice(
        'Los destinos están disponibles. Se validarán nuevamente al guardar y publicar.',
      );
    } catch (failure) {
      if (sequence !== validationSequence.current) return;
      setErrorKind(
        failure &&
          typeof failure === 'object' &&
          'kind' in failure &&
          typeof failure.kind === 'string'
          ? failure.kind
          : 'validation_error',
      );
      setError(
        failure instanceof Error
          ? failure.message
          : 'No fue posible validar los destinos.',
      );
    } finally {
      if (blocking) {
        setBusy(false);
        onBusyChange?.(false);
      }
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    validationSequence.current += 1;
    setBusy(true);
    onBusyChange?.(true);
    setError(null);
    setNotice(null);
    try {
      await validateGroups(groups);
      const result = await saveGroups(groups, draftId);
      await onSaved?.(result);
      onDirtyChange?.(false);
      if (!onSaved)
        setNotice(
          'Borrador guardado. Requiere revisión y aprobación antes de publicarse.',
        );
      router.refresh();
    } catch (failure) {
      setErrorKind(
        failure &&
          typeof failure === 'object' &&
          'kind' in failure &&
          typeof failure.kind === 'string'
          ? failure.kind
          : 'validation_error',
      );
      setError(
        failure instanceof Error
          ? failure.message
          : 'No fue posible guardar el borrador.',
      );
    } finally {
      setBusy(false);
      onBusyChange?.(false);
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
          disabled={busy || disabled}
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
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={link.isVisible !== false}
                  onChange={(event) =>
                    changeGroups((current) =>
                      current.map((entry, index) =>
                        index === groupIndex
                          ? {
                              ...entry,
                              links: entry.links.map((item, pos) =>
                                pos === linkIndex
                                  ? { ...item, isVisible: event.target.checked }
                                  : item,
                              ),
                            }
                          : entry,
                      ),
                    )
                  }
                />
                Enlace visible
              </label>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  changeGroups((current) =>
                    current.map((entry, index) =>
                      index === groupIndex
                        ? {
                            ...entry,
                            links: entry.links.filter(
                              (_, pos) => pos !== linkIndex,
                            ),
                          }
                        : entry,
                    ),
                  )
                }
              >
                Quitar enlace {linkIndex + 1}
              </Button>
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
                    if (link.href) void validate(false);
                  }}
                  aria-describedby="footer-route-feedback"
                />
              </label>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              changeGroups((current) =>
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
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={groups.length === 1}
            onClick={() =>
              changeGroups((current) =>
                current.filter((_, index) => index !== groupIndex),
              )
            }
          >
            Quitar grupo {groupIndex + 1}
          </Button>
        </fieldset>
      ))}
      <div id="footer-route-feedback" aria-live="polite">
        {error ? (
          <div role="alert" data-state={errorKind}>
            <p>{error}</p>
            {errorKind === 'auth_required' ? (
              <a href="/admin/login" className="underline">
                Iniciar sesión
              </a>
            ) : null}
          </div>
        ) : null}
        {notice ? <p role="status">{notice}</p> : null}
      </div>
      <div className="flex flex-wrap gap-4">
        <Button
          type="button"
          variant="outline"
          disabled={busy || disabled}
          onClick={() =>
            changeGroups((current) => [
              ...current,
              { title: '', links: [{ label: '', href: '', isVisible: true }] },
            ])
          }
        >
          Añadir grupo
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || disabled}
          onClick={() => void validate()}
        >
          Validar destinos
        </Button>
        <Button type="submit" disabled={busy || disabled}>
          {busy ? 'Validando…' : 'Guardar borrador'}
        </Button>
      </div>
    </form>
  );
}

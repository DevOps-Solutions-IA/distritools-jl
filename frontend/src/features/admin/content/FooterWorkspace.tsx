'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FooterRouteEditor } from '@/components/admin/FooterRouteEditor';
import { contentRequest, ContentRequestError } from './api';
import {
  footerSnapshotSchema,
  footerRevisionSchema,
  footerValidationSchema,
  statusLabel,
  type FooterSnapshot,
  type Step,
} from './contracts';
import { WorkflowControls } from './WorkflowControls';

export function FooterWorkspace({
  initial,
  permissions,
}: {
  initial: FooterSnapshot;
  permissions: string[];
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [selected, setSelected] = useState(initial.data?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [notice, setNotice] = useState('');
  const [restore, setRestore] = useState(false);
  const revision =
    snapshot.history.find((row) => row.id === selected) ?? snapshot.data;
  const canWrite = permissions.includes('footer.write');
  async function reload(id = selected) {
    const next = await contentRequest('footer', footerSnapshotSchema);
    setSnapshot(next);
    setSelected(
      next.history.some((row) => row.id === id) ? id : (next.data?.id ?? ''),
    );
    setDirty(false);
    setRestore(false);
  }
  async function step(step: Step) {
    if (!revision) return;
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      const result = await contentRequest(
        `footer/${encodeURIComponent(revision.id)}/${step}`,
        footerRevisionSchema,
        'POST',
      );
      await reload(result.id);
      setNotice('Estado guardado y consultado nuevamente en el servicio.');
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure
          : new Error('No se pudo cambiar el estado.'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6 space-y-5"
      aria-busy={busy}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Versión publicada en la tienda
          </p>
          <p className="text-xl font-semibold">
            {snapshot.published ? `v${snapshot.published.version}` : 'Ninguna'}
          </p>
          <p className="text-sm break-words">
            {snapshot.published?.publishedAt ?? 'Sin publicación'}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Revisión consultada
          </p>
          <p className="text-xl font-semibold">
            {revision
              ? `v${revision.version} · ${statusLabel[revision.status]}`
              : 'Ninguna'}
          </p>
        </div>
      </div>
      {error ? (
        <div
          role="alert"
          data-state={
            error instanceof ContentRequestError ? error.kind : 'server_error'
          }
          className="border border-red-400/30 rounded-lg p-3"
        >
          {error.message}
          {error instanceof ContentRequestError && error.status === 401 ? (
            <a className="block underline" href="/admin/login">
              Iniciar sesión
            </a>
          ) : null}
        </div>
      ) : null}
      {notice ? (
        <p role="status" className="text-green-200">
          {notice}
        </p>
      ) : null}
      {snapshot.requiresReview ? (
        <div role="alert" className="rounded-lg border border-amber-300/30 p-4">
          <p>
            Hay destinos publicados que dejaron de estar disponibles. La tienda
            oculta los enlaces afectados. Cree una nueva revisión para
            corregirlos.
          </p>
          {snapshot.routeAlerts.map((alert) => (
            <details key={alert.id}>
              <summary>
                v{alert.version} · {alert.createdAt}
              </summary>
              <ul className="list-disc pl-5">
                {alert.invalidLinks.map((link) => (
                  <li key={link.linkId} className="break-words">
                    {snapshot.published?.links.find(
                      (item) => item.id === link.linkId,
                    )?.label ?? link.linkId}
                    : {link.reason}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      ) : null}
      {revision ? (
        <>
          <label className="block">
            Versión del footer
            <select
              value={revision.id}
              className="focus-ring mt-1 w-full rounded-lg border border-[var(--color-border)] bg-black p-3"
              disabled={busy || dirty}
              onChange={(event) => {
                setSelected(event.target.value);
                setNotice('');
                setError(null);
                setRestore(false);
              }}
            >
              {snapshot.history.map((row) => (
                <option key={row.id} value={row.id}>
                  v{row.version} · {statusLabel[row.status]}
                </option>
              ))}
            </select>
          </label>
          {canWrite ? (
            <FooterRouteEditor
              key={`editor/${revision.id}/${revision.status}`}
              revision={revision}
              disabled={busy}
              validateGroups={(groups) =>
                contentRequest(
                  'footer/validate',
                  footerValidationSchema,
                  'POST',
                  { groups },
                )
              }
              saveGroups={(groups, id) =>
                contentRequest(
                  id ? `footer/${encodeURIComponent(id)}` : 'footer',
                  footerRevisionSchema,
                  id ? 'PATCH' : 'POST',
                  { groups },
                )
              }
              onBusyChange={setBusy}
              onDirtyChange={(value) => {
                setDirty(value);
                if (value) setNotice('');
              }}
              onSaved={async (value) => {
                const parsed = footerRevisionSchema.safeParse(value);
                if (!parsed.success)
                  throw new Error(
                    'El servicio devolvió una revisión inválida. Recargue antes de continuar.',
                  );
                await reload(parsed.data.id);
                setNotice(
                  'Borrador guardado. Requiere revisión y aprobación antes de publicarse.',
                );
              }}
            />
          ) : (
            <p>
              Acceso de lectura. La edición y validación requieren footer.write.
            </p>
          )}
          <WorkflowControls
            key={`workflow/${revision.id}/${revision.status}`}
            domain="footer"
            status={revision.status}
            version={revision.version}
            permissions={permissions}
            busy={busy}
            dirty={dirty}
            onStep={step}
          />
          {canWrite &&
          (revision.status === 'archived' ||
            revision.status === 'published') ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy || dirty}
              onClick={() => setRestore(true)}
            >
              Restaurar versión como borrador
            </Button>
          ) : null}
          {restore && canWrite ? (
            <div
              role="group"
              aria-label="Confirmar restauración del footer"
              className="rounded-lg border border-amber-300/30 p-4 space-y-3"
            >
              <p>
                Copiar v{revision.version} a una revisión nueva. La versión
                publicada se conserva hasta que apruebe y publique el nuevo
                borrador. Los destinos se validarán nuevamente.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  disabled={busy || dirty}
                  onClick={async () => {
                    if (busy || dirty || !canWrite) return;
                    setBusy(true);
                    setError(null);
                    setNotice('');
                    try {
                      const created = await contentRequest(
                        'footer',
                        footerRevisionSchema,
                        'POST',
                        { groups: revision.groupsJson },
                      );
                      await reload(created.id);
                      setNotice(
                        'Versión restaurada como borrador. Requiere revisión, aprobación y publicación.',
                      );
                    } catch (failure) {
                      setError(
                        failure instanceof Error
                          ? failure
                          : new Error('No se pudo restaurar.'),
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Confirmar restauración del footer
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setRestore(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}
          <div
            className="rounded-xl border border-white/10 p-4 space-y-4"
            aria-label="Vista previa guardada del footer"
          >
            <h2 className="font-semibold">
              Enlaces guardados · v{revision.version}
            </h2>
            {revision.groupsJson.map((group, index) => (
              <section key={index}>
                <h3 className="font-medium">{group.title}</h3>
                <ul className="space-y-1">
                  {group.links.map((link, pos) => (
                    <li key={pos} className="break-words text-sm">
                      {link.label} · {link.href}{' '}
                      {link.isVisible === false ? '· Oculto' : ''}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      ) : (
        <p>No hay revisiones registradas.</p>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={busy || dirty}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await reload();
          } catch (failure) {
            setError(
              failure instanceof Error
                ? failure
                : new Error('No se pudo actualizar.'),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Actualizar desde el servicio
      </Button>
    </section>
  );
}

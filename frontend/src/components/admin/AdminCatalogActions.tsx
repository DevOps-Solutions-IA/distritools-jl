'use client';

import type React from 'react';
import { useState, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { CatalogPermissionContext, useCatalogPermissions } from '@/features/admin/catalog/useCatalogPermissions';
import { catalogRequest, CatalogRequestError } from '@/features/admin/catalog/request';

async function request(path: string, method: 'PATCH' | 'POST', body?: unknown) {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message ?? 'Acción no completada.');
  }
  return payload;
}

export function AdminProductActions({ productId, isActive }: { productId: string; isActive: boolean }) {
  const shared = useContext(CatalogPermissionContext);
  return shared ? <ProductActionControls productId={productId} isActive={isActive} permissions={shared} /> : <StandaloneProductActions productId={productId} isActive={isActive} />;
}
function StandaloneProductActions({ productId, isActive }: { productId: string; isActive: boolean }) {
  const permissions = useCatalogPermissions(`actions:${productId}`);
  return <ProductActionControls productId={productId} isActive={isActive} permissions={permissions} />;
}
function ProductActionControls({ productId, isActive, permissions }: { productId: string; isActive: boolean; permissions: ReturnType<typeof useCatalogPermissions> }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const allowed = (action: 'activate' | 'deactivate' | 'archive' | 'validate') => permissions.can({ activate: 'products.publish', deactivate: 'products.write', archive: 'products.archive', validate: 'products.read' }[action]);
  async function run(action: 'activate' | 'deactivate' | 'archive' | 'validate') {
    if (busy || uncertain || !allowed(action) || (action === 'archive' && !reason.trim())) return;
    setMessage(null); setError(null); setBusy(action);
    try {
      const result = await catalogRequest(`/api/admin/products/${productId}/${action === 'validate' ? 'validate-sellability' : action}`, action === 'activate' || action === 'deactivate' ? 'PATCH' : 'POST', action === 'archive' ? { reason: reason.trim() } : undefined);
      if (action === 'validate') {
        if (typeof result.status !== 'string' || !Array.isArray(result.blockers) || !Array.isArray(result.warnings)) throw new CatalogRequestError('No se pudo confirmar la validación.', true);
        setMessage(`Vendibilidad: ${result.status}. Bloqueadores: ${result.blockers.join(', ') || 'ninguno'}. Advertencias: ${result.warnings.join(', ') || 'ninguna'}.`);
      } else {
        if (result.id !== productId) throw new CatalogRequestError('No se pudo confirmar el producto actualizado. Revisa el estado persistido.', true);
        setMessage(action === 'archive' ? 'Producto archivado.' : action === 'activate' ? 'Producto activado.' : 'Producto desactivado.');
        setArchiveOpen(false); setReason('');
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo confirmar el resultado.');
      if (caught instanceof CatalogRequestError && caught.status === 401) permissions.retry();
      if (caught instanceof CatalogRequestError && caught.uncertain) setUncertain(true);
    } finally { setBusy(null); }
  }
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={Boolean(busy) || uncertain || !allowed('validate')} loading={busy === 'validate'} onClick={() => run('validate')}>Validar</Button>
        <Button type="button" size="sm" variant="outline" disabled={Boolean(busy) || uncertain || !allowed(isActive ? 'deactivate' : 'activate')} loading={busy === (isActive ? 'deactivate' : 'activate')} onClick={() => run(isActive ? 'deactivate' : 'activate')}>{isActive ? 'Desactivar' : 'Activar'}</Button>
        <Button type="button" size="sm" variant="danger" disabled={Boolean(busy) || uncertain || !allowed('archive')} onClick={() => setArchiveOpen(true)}>Archivar</Button>
      </div>
      {archiveOpen ? <fieldset className="grid gap-2 rounded-lg border border-red-400/30 p-3"><legend>Archivar producto</legend><p className="text-sm">Se desactivará y marcará como archivado. No se eliminará su historial.</p><label className="grid gap-1">Motivo del archivo<input className="focus-ring rounded border border-white/20 bg-black p-2" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} /></label><div className="flex flex-wrap gap-2"><Button type="button" variant="danger" size="sm" disabled={!reason.trim() || Boolean(busy) || uncertain || !allowed('archive')} loading={busy === 'archive'} onClick={() => run('archive')}>Confirmar archivo</Button><Button type="button" variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => setArchiveOpen(false)}>Cancelar archivo</Button></div></fieldset> : null}
      {message ? <p role="status" className="text-xs text-[var(--color-text-secondary)]">{message}</p> : null}
      {error ? <p role="alert" className="text-xs text-red-200">{error}{permissions.state.status === 'auth_required' ? <a className="underline" href="/admin/login"> Iniciar sesión</a> : null}</p> : null}
      {uncertain ? <a className="text-sm text-[var(--color-industrial-yellow)] underline" href={`/admin/productos/${productId}`}>Revisar estado del producto antes de repetir</a> : null}
    </div>
  );
}

export function AdminPriceUpdateForm({ variantId, currentPrice }: { variantId: string; currentPrice: string }) {
  const router = useRouter();
  const [price, setPrice] = useState(currentPrice);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      await request(`/api/admin/prices/${variantId}`, 'PATCH', { price, reason });
      setMessage('Precio actualizado y auditado.');
      setReason('');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar el precio.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid min-w-[18rem] gap-2">
      <input
        className="focus-ring h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-sm text-[var(--color-off-white)]"
        value={price}
        inputMode="numeric"
        onChange={(event) => setPrice(event.target.value)}
        aria-label="Nuevo precio"
      />
      <input
        className="focus-ring h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-sm text-[var(--color-off-white)]"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Motivo obligatorio"
        aria-label="Motivo del cambio"
      />
      <Button type="submit" size="sm" loading={busy} disabled={!reason.trim()}>
        Guardar precio
      </Button>
      {message ? <p className="text-xs text-[var(--color-text-secondary)]">{message}</p> : null}
    </form>
  );
}

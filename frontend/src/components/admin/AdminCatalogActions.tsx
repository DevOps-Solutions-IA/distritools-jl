'use client';

import type React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

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
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(action: 'activate' | 'deactivate' | 'archive' | 'validate') {
    setMessage(null);
    setBusy(action);
    try {
      if (action === 'archive') {
        const reason = window.prompt('Motivo obligatorio para archivar el producto');
        if (!reason?.trim()) {
          setMessage('Archivo cancelado: motivo requerido.');
          return;
        }
        await request(`/api/admin/products/${productId}/archive`, 'POST', { reason });
        setMessage('Producto archivado con auditoría.');
      } else if (action === 'validate') {
        const result = await request(`/api/admin/products/${productId}/validate-sellability`, 'POST');
        setMessage(`Vendibilidad: ${result.status}`);
      } else {
        await request(`/api/admin/products/${productId}/${action}`, 'PATCH');
        setMessage(action === 'activate' ? 'Producto activado.' : 'Producto desactivado.');
      }
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Acción no completada.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" loading={busy === 'validate'} onClick={() => run('validate')}>
          Validar
        </Button>
        <Button type="button" size="sm" variant="outline" loading={busy === (isActive ? 'deactivate' : 'activate')} onClick={() => run(isActive ? 'deactivate' : 'activate')}>
          {isActive ? 'Desactivar' : 'Activar'}
        </Button>
        <Button type="button" size="sm" variant="danger" loading={busy === 'archive'} onClick={() => run('archive')}>
          Archivar
        </Button>
      </div>
      {message ? <p className="text-xs text-[var(--color-text-secondary)]">{message}</p> : null}
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

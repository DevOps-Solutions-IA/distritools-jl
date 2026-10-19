'use client';
import { useState, type MouseEvent } from 'react';
import { adminFailure } from '@/lib/admin/transport/result';
export function ExportLink({ href, format }: { href: string; format: 'csv' | 'pdf' }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function download(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(href, { cache: 'no-store' });
      if (!response.ok) { const body: unknown = await response.json().catch(() => null); setError(adminFailure(response.status, body).error); return; }
      if (!response.headers.get('content-type')?.startsWith(format === 'pdf' ? 'application/pdf' : 'text/csv')) throw new Error('contract');
      const blob = await response.blob(); if (!blob.size) throw new Error('contract');
      const filename = response.headers.get('content-disposition')?.match(/filename="?([A-Za-z0-9._-]+)"?/)?.[1];
      if (!filename || !filename.endsWith(`.${format}`)) throw new Error('contract');
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('No se pudo descargar el reporte. Intente de nuevo.'); }
    finally { setBusy(false); }
  }
  return <span className="max-w-full"><a href={href} onClick={download} aria-disabled={busy} className="inline-flex rounded-full border border-[var(--color-industrial-yellow)] px-3 py-2 text-sm font-semibold text-[var(--color-industrial-yellow)]">{busy ? 'Descargando…' : `Export ${format.toUpperCase()}`}</a>{error ? <span role="alert" className="mt-2 block max-w-64 text-sm text-red-200">{error}</span> : null}</span>;
}

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { env } from '@/config/env';
import { isDevAdminAuthDisabled } from '@/lib/admin/dev-auth-bypass';
import { adminFailure } from '@/lib/admin/transport/result';
import { ranges, reportTypes } from '@/features/admin/control/presentation';

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  const failure = (status: number, body?: unknown) => NextResponse.json(adminFailure(status, body), { status: status === 0 ? 502 : status, headers });
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== url.origin)) return failure(403);
  const token = (await cookies()).get('dt_admin_access')?.value;
  if (!token && !isDevAdminAuthDisabled()) return failure(401);
  const format = url.searchParams.get('format') ?? 'csv';
  const type = url.searchParams.get('type') ?? 'summary';
  const range = url.searchParams.get('range') ?? '30d';
  if (!['csv', 'pdf'].includes(format) || !reportTypes.includes(type) || !ranges.includes(range)) return failure(400);
  const payload = { type, range, format,
    status: url.searchParams.get('status') ?? undefined, module: url.searchParams.get('module') ?? undefined,
    paymentStatus: url.searchParams.get('paymentStatus') ?? undefined, shippingStatus: url.searchParams.get('shippingStatus') ?? undefined };
  let response: Response;
  try { response = await fetch(`${env.apiBaseUrl}/api/v1/admin/reports/export`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload), cache: 'no-store',
  }); } catch { return failure(0); }
  if (!response.ok) return failure(response.status, await response.json().catch(() => null));
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.split(';')[0].trim().toLowerCase() !== (format === 'pdf' ? 'application/pdf' : 'text/csv')) return failure(502);
  const maxBytes = 10 * 1024 * 1024;
  const declaredSize = response.headers.get('content-length');
  if (declaredSize && (!/^\d+$/.test(declaredSize) || Number(declaredSize) > maxBytes)) return failure(502);
  let body: ArrayBuffer;
  try {
    if (!response.body) return failure(502);
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const next = await reader.read(); if (next.done) break;
        size += next.value.byteLength;
        if (size > maxBytes) { await reader.cancel(); return failure(502); }
        chunks.push(next.value);
      }
    } finally { reader.releaseLock(); }
    if (!size) return failure(502);
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    body = bytes.buffer;
  } catch { return failure(502); }
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(body); } catch { return failure(502); }
  if (format === 'pdf' ? !text.startsWith('%PDF-') || !text.trimEnd().endsWith('%%EOF') : !text.startsWith('title,') || !text.includes('\n')) return failure(502);
  return new Response(body, { status: response.status, headers: {
    'Content-Type': contentType, 'Content-Disposition': `attachment; filename="distritools-report-${type}.${format}"`, ...headers,
  } });
}

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { env } from '@/config/env';

async function getAdminAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get('dt_admin_access')?.value ?? null;
}

function isAdminAuthDisabled() {
  return process.env.APP_ENV !== 'production' && process.env.ADMIN_AUTH_DISABLED === 'true';
}

export async function GET(request: Request) {
  const token = await getAdminAccessToken();
  if (!token && !isAdminAuthDisabled()) {
    return NextResponse.json({ message: 'Sesión administrativa requerida.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const payload = {
    type: url.searchParams.get('type') ?? 'summary',
    range: url.searchParams.get('range') ?? '30d',
    status: url.searchParams.get('status') ?? undefined,
    module: url.searchParams.get('module') ?? undefined,
    paymentStatus: url.searchParams.get('paymentStatus') ?? undefined,
    shippingStatus: url.searchParams.get('shippingStatus') ?? undefined,
    format: url.searchParams.get('format') === 'pdf' ? 'pdf' : 'csv',
  };

  const response = await fetch(`${env.apiBaseUrl}/api/v1/admin/reports/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const contentType = response.headers.get('content-type') ?? 'text/csv; charset=utf-8';
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'No se pudo exportar reporte.' }));
    return NextResponse.json(body, { status: response.status });
  }

  const body = payload.format === 'pdf' ? await response.arrayBuffer() : await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': response.headers.get('content-disposition') ?? 'attachment; filename="distritools-report.csv"',
    },
  });
}

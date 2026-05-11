import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { env } from '@/config/env';

async function getAdminAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get('dt_admin_access')?.value ?? null;
}

async function parsePayload(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined;
  }
  return request.json().catch(() => null);
}

export async function proxyAdminRequest(
  request: Request,
  backendPath: string,
  method: 'GET' | 'POST' | 'PATCH',
) {
  const token = await getAdminAccessToken();

  if (!token) {
    return NextResponse.json({ message: 'Sesión administrativa requerida.' }, { status: 401 });
  }

  const payload = method === 'GET' ? undefined : await parsePayload(request);
  const response = await fetch(`${env.apiBaseUrl}/api/v1${backendPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    cache: 'no-store',
  });

  const responsePayload = await response.json().catch(() => ({}));

  return NextResponse.json(responsePayload, { status: response.status });
}

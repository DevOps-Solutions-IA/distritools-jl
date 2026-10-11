import { NextResponse } from 'next/server';
import { proxyAdminRequest } from '@/lib/admin/proxy';

export async function POST(request: Request) {
  const upstream = await proxyAdminRequest(request, '/auth/logout', 'POST');
  const payload = await upstream.json().catch(() => null);
  const confirmed = upstream.status === 201 && payload?.success === true;
  if (upstream.ok && !confirmed) {
    return NextResponse.json(
      {
        success: false,
        revocationConfirmed: false,
        kind: 'contract_error',
        message: 'El servicio no confirmó el cierre de sesión.',
      },
      { status: 502, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  const localSessionCleared = confirmed || upstream.status === 401;
  const response = NextResponse.json(
    confirmed
      ? { success: true, revocationConfirmed: true }
      : {
          ...payload,
          success: false,
          revocationConfirmed: false,
          localSessionCleared,
        },
    {
      status: upstream.status,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
  if (localSessionCleared) {
    response.cookies.delete('dt_admin_access');
    response.cookies.delete('dt_admin_refresh');
  }
  return response;
}

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { env } from '@/config/env';
import { isDevAdminAuthDisabled } from '@/lib/admin/dev-auth-bypass';
import { parseAdminSessionContext } from '@/lib/admin/transport/session-contract';
import {
  adminFailure,
  adminContractFailure,
} from '@/lib/admin/transport/result';

function failure(status: number, payload?: unknown) {
  const result = adminFailure(status, payload);
  return NextResponse.json(
    { message: result.error, error: result.error, kind: result.kind },
    {
      status: status || 502,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}

export async function proxyAdminRequest(
  request: Request,
  backendPath: string,
  method: 'GET' | 'POST' | 'PATCH',
) {
  const cookieStore = await cookies();
  const token = cookieStore.get('dt_admin_access')?.value ?? null;
  if (!token && !isDevAdminAuthDisabled()) return failure(401);
  const origin = request.headers.get('origin');
  if (
    method !== 'GET' &&
    (request.headers.get('sec-fetch-site') === 'cross-site' ||
      (origin && origin !== new URL(env.siteUrl ?? request.url).origin))
  )
    return failure(403);
  let payload: unknown;
  if (method !== 'GET') {
    let text: string;
    try {
      text = await request.text();
    } catch {
      return failure(400);
    }
    if (text.trim()) {
      if (!request.headers.get('content-type')?.includes('application/json'))
        return failure(400);
      try {
        payload = JSON.parse(text);
      } catch {
        return failure(400);
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload))
        return failure(400);
    }
  }
  const target = new URL(`${env.apiBaseUrl}/api/v1${backendPath}`);
  const query = new URL(request.url).search;
  if (query) target.search = query;
  let response: Response;
  try {
    response = await fetch(target.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      cache: 'no-store',
    });
  } catch {
    return failure(0);
  }
  if (
    method === 'GET' &&
    backendPath === '/admin/session' &&
    response.status === 401
  ) {
    const rejected = failure(401);
    rejected.cookies.delete('dt_admin_access');
    rejected.cookies.delete('dt_admin_refresh');
    return rejected;
  }
  if (response.status === 204)
    return new NextResponse(null, {
      status: 204,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  let responsePayload: unknown;
  try {
    responsePayload = await response.json();
  } catch {
    if (!response.ok) return failure(response.status);
    const invalid = adminContractFailure(502);
    return NextResponse.json(
      { message: invalid.error, kind: invalid.kind },
      { status: 502, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  if (!response.ok) return failure(response.status, responsePayload);
  if (method === 'GET' && backendPath === '/admin/session') {
    const session = parseAdminSessionContext(responsePayload);
    if (!session) {
      const invalid = adminContractFailure(502);
      return NextResponse.json(
        { message: invalid.error, kind: invalid.kind },
        { status: 502, headers: { 'Cache-Control': 'private, no-store' } },
      );
    }
    responsePayload = session;
  }
  return NextResponse.json(responsePayload, {
    status: response.status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

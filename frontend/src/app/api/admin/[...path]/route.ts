import { NextResponse } from 'next/server';
import { proxyAdminRequest } from '@/lib/admin/proxy';

function backendPath(params: { path: string[] }) {
  if (
    !params.path.length ||
    params.path.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        /[\\/]/.test(segment) ||
        [...segment].some((character) => character.charCodeAt(0) < 32),
    )
  )
    return null;
  return `/admin/${params.path.join('/')}`;
}
async function forward(
  request: Request,
  params: Promise<{ path: string[] }>,
  method: 'GET' | 'POST' | 'PATCH',
) {
  const path = backendPath(await params);
  if (!path)
    return NextResponse.json(
      { message: 'Ruta administrativa inválida.', kind: 'validation_error' },
      { status: 400, headers: { 'Cache-Control': 'private, no-store' } },
    );
  return proxyAdminRequest(request, path, method);
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return forward(request, params, 'GET');
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return forward(request, params, 'POST');
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return forward(request, params, 'PATCH');
}

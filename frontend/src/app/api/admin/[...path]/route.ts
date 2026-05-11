import { proxyAdminRequest } from '@/lib/admin/proxy';

function backendPath(params: { path: string[] }) {
  return `/admin/${params.path.join('/')}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyAdminRequest(request, backendPath(await params), 'GET');
}

export async function POST(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyAdminRequest(request, backendPath(await params), 'POST');
}

export async function PATCH(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyAdminRequest(request, backendPath(await params), 'PATCH');
}

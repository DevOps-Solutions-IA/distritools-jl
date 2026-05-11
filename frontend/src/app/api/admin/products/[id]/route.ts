import { proxyAdminRequest } from '@/lib/admin/proxy';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  return proxyAdminRequest(request, `/admin/products/${id}`, 'GET');
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  return proxyAdminRequest(request, `/admin/products/${id}`, 'PATCH');
}

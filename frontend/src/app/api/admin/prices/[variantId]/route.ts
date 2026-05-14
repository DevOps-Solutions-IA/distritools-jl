import { proxyAdminRequest } from '@/lib/admin/proxy';

interface RouteParams {
  params: Promise<{ variantId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { variantId } = await params;
  return proxyAdminRequest(request, `/admin/prices/${variantId}`, 'PATCH');
}

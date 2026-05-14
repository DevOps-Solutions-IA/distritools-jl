import { proxyAdminRequest } from '@/lib/admin/proxy';

interface RouteParams {
  params: Promise<{ variantId: string; warehouseId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { variantId, warehouseId } = await params;
  return proxyAdminRequest(request, `/admin/inventory/settings/${variantId}/${warehouseId}`, 'PATCH');
}

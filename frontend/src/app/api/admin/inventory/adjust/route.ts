import { proxyAdminRequest } from '@/lib/admin/proxy';

export function PATCH(request: Request) {
  return proxyAdminRequest(request, '/admin/inventory/adjust', 'PATCH');
}

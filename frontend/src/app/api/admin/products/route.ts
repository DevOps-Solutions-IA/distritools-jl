import { proxyAdminRequest } from '@/lib/admin/proxy';

export function GET(request: Request) {
  return proxyAdminRequest(request, '/admin/products', 'GET');
}

export function POST(request: Request) {
  return proxyAdminRequest(request, '/admin/products', 'POST');
}

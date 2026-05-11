import { proxyAdminRequest } from '@/lib/admin/proxy';

export function GET(request: Request) {
  return proxyAdminRequest(request, '/admin/brands', 'GET');
}

export function POST(request: Request) {
  return proxyAdminRequest(request, '/admin/brands', 'POST');
}

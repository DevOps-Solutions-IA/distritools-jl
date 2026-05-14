import { proxyAdminRequest } from '@/lib/admin/proxy';

export function GET(request: Request) {
  return proxyAdminRequest(request, '/admin/variants', 'GET');
}

export function POST(request: Request) {
  return proxyAdminRequest(request, '/admin/variants', 'POST');
}

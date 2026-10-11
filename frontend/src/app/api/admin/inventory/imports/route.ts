import {proxyAdminRequest} from '@/lib/admin/proxy';
export function GET(request:Request){return proxyAdminRequest(request,'/admin/inventory/imports','GET');}

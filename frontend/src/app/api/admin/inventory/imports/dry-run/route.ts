import {proxyAdminRequest} from '@/lib/admin/proxy';
export async function POST(request:Request){return proxyAdminRequest(request,'/admin/inventory/imports'+'/dry-run','POST');}

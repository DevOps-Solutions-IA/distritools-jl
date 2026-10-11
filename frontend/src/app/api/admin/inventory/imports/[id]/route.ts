import {proxyAdminRequest} from '@/lib/admin/proxy';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){const {id}=await context.params;return proxyAdminRequest(request,'/admin/inventory/imports'+'/'+encodeURIComponent(id),'GET');}

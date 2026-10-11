import {proxyAdminRequest} from '@/lib/admin/proxy';
export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){const {id}=await context.params;return proxyAdminRequest(request,'/admin/inventory/count-sessions'+'/'+encodeURIComponent(id)+'/lines','PATCH');}

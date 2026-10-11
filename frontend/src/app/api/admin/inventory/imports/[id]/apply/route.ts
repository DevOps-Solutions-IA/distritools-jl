import {proxyAdminRequest} from '@/lib/admin/proxy';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){const {id}=await context.params;return proxyAdminRequest(request,'/admin/inventory/imports'+'/'+encodeURIComponent(id)+'/apply','POST');}

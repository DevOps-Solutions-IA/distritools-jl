import {proxyAdminRequest} from '@/lib/admin/proxy';
export async function POST(request:Request){return proxyAdminRequest(request,'/admin/inventory/count-sessions','POST');}
export function GET(request:Request){return proxyAdminRequest(request,'/admin/inventory/count-sessions','GET');}

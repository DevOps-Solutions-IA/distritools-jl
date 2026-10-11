import {cookies} from 'next/headers';import {NextResponse} from 'next/server';import {env} from '@/config/env';import {adminFailure} from '@/lib/admin/transport/result';import {safeInventoryCsv} from '@/features/admin/inventory/csv';
export async function GET(){const token=(await cookies()).get('dt_admin_access')?.value;
 const failure=(status:number)=>NextResponse.json(adminFailure(status),{status:status||502,headers:{'Cache-Control':'private, no-store'}});
 if(!token)return failure(401);
 let response:Response;try{response=await fetch(env.apiBaseUrl+'/api/v1/admin/inventory/export',{headers:{Authorization:'Bearer '+token},cache:'no-store'});}catch{return failure(0);}
 if(!response.ok)return failure(response.status);
 if(!response.headers.get('content-type')?.toLowerCase().startsWith('text/csv'))return failure(502);
 try{const csv=safeInventoryCsv(await response.text());return new NextResponse(csv,{status:200,headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="inventory-export.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch{return failure(502);}
}

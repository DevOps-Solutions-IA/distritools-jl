import {parseOperationPage,parseCount,parseImport,type OperationPage,type CountSession,type ImportBatch} from './operations-contracts';
import { adminFetch, getAdminOperationalSnapshot } from '@/lib/admin/server-data';
import { AdminReadError, adminFailure, adminContractFailure, type AdminApiResult } from '@/lib/admin/transport/result';
import { parseAdminSessionContext } from '@/lib/admin/transport/session-contract';
import { parseStock, parseRows, parsePrices, record, type RecordRow, type PriceRow } from './contracts';
export type ReadResult<T> = AdminApiResult<T>;
async function checked<T>(path:string,parse:(v:unknown)=>T|null):Promise<ReadResult<T>> {
 const response=await adminFetch<unknown>(path);if(!response.ok)return response;
 const data=parse(response.data);return data===null?adminContractFailure(response.status):{...response,data};
}
export async function inventorySession(){return checked('/admin/session',parseAdminSessionContext);}
function allowed<T>(permissions:string[],permission:string,path:string,parse:(v:unknown)=>T|null){return permissions.includes(permission)?checked(path,parse):Promise.resolve(adminFailure(403));}
export async function loadInventory(query:{search?:string}) {
 const session=await inventorySession();const permissions=session.ok?session.data.user.permissions:[];
 if(!session.ok)return {session,permissions,stock:session,warehouses:session,reservations:session,valuation:session,alerts:session};
 const search=new URLSearchParams();if(query.search?.trim())search.set('search',query.search.trim());
 const [stock,warehouses,reservations,valuation,alerts]=await Promise.all([
 allowed(permissions,'inventory.read','/admin/inventory/overview'+(search.size?'?'+search:''),parseStock),
 allowed(permissions,'inventory.read','/admin/inventory/warehouses',parseRows),
 allowed(permissions,'inventory.read','/admin/inventory/reservations',parseRows),
 allowed(permissions,'inventory.cost.read','/admin/inventory/valuation',v=>{const rows=parseRows(v);return rows&&record(v)&&typeof v.totalValue==='number'&&Number.isFinite(v.totalValue)&&typeof v.missingCost==='number'?{...rows,totalValue:v.totalValue,missingCost:v.missingCost}:null;}),
 allowed(permissions,'inventory.alerts.read','/admin/inventory/alerts',parseRows)]);
 return {session,permissions,stock,warehouses,reservations,valuation,alerts};
}
export async function loadHistory(query:Record<string,string|undefined>):Promise<ReadResult<{data:RecordRow[]}>>{
 try {
 const selected=Object.fromEntries(Object.entries(query).filter(([key,value])=>['variantId','sku','warehouseId','movementType','referenceType','referenceId'].includes(key)&&value?.trim()));
 const response=Object.keys(selected).length?await getAdminOperationalSnapshot(['inventoryHistory'],selected):await getAdminOperationalSnapshot(['inventoryHistory']);
 const data=parseRows(response.inventoryHistory);return data?{ok:true,kind:'success',status:200,data,error:null}:adminContractFailure(200);
 }catch(error){if(error instanceof AdminReadError)return error.result;throw error;}
}
export async function loadPrices(){
 const session=await inventorySession();const permissions=session.ok?session.data.user.permissions:[];
 const prices:ReadResult<{prices:PriceRow[]}>=session.ok?await allowed(permissions,'catalog.read','/admin/catalog/overview?range=30d',parsePrices):session;
 return {session,permissions,prices};
}
export async function loadPriceDetail(variantId:string){
 const data=await loadPrices();
 const history:ReadResult<{data:RecordRow[]}>=data.session.ok?await allowed(data.permissions,'prices.history.read','/admin/prices/history?variantId='+encodeURIComponent(variantId),parseRows):data.session;
 return {...data,price:data.prices.ok?data.prices.data.prices.find(row=>row.id===variantId)??null:null,history};
}

export async function loadOperations(kind:'count-sessions'|'imports',query:{page?:string;limit?:string},id?:string){
 const session=await inventorySession();const permissions=session.ok?session.data.user.permissions:[];
 const permission=kind==='count-sessions'?'inventory.count.read':'inventory.import';
 const qs=new URLSearchParams();for(const key of ['page','limit'] as const)if(query[key])qs.set(key,query[key]!);
 const list:ReadResult<OperationPage>=session.ok?await allowed(permissions,permission,'/admin/inventory/'+kind+(qs.size?'?'+qs:''),parseOperationPage):session;
 const detail:ReadResult<CountSession|ImportBatch>|null=id?(session.ok?await allowed(permissions,permission,'/admin/inventory/'+kind+'/'+encodeURIComponent(id),v=>kind==='count-sessions'?parseCount(v):parseImport(v)):session):null;
 const warehouses:ReadResult<{data:RecordRow[]}>=kind==='count-sessions'&&session.ok?await allowed(permissions,'inventory.read','/admin/inventory/warehouses',parseRows):adminFailure(403);
 return {session,permissions,list,detail,warehouses};
}

import {record, type RecordRow} from './contracts';
export interface OperationSummary {id:string;status:string;createdAt:string;updatedAt:string;}
export interface OperationPage {data:OperationSummary[];meta:{page:number;limit:number;total:number;totalPages:number};}
export interface CountLine {id:string;variantId:string;sku:string;systemQuantity:number;countedQuantity:number|null;difference:number|null;adjustmentMovementId:string|null;}
export interface CountSession extends OperationSummary {warehouseId:string;notes?:string|null;warehouse:{id:string;code:string;name:string;isActive:boolean};lines:CountLine[];}
export interface ImportRow {id:string;rowNumber:number;sku:string;warehouseCode:string;quantity:number;mode:string;reason:string;valid:boolean;errors:string[]|null;movementId?:string|null;}
export interface ImportBatch extends OperationSummary {filename:string|null;totalRows:number;validRows:number;errorRows:number;rows:ImportRow[];}
const integer=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v);
const nonnegative=(v:unknown):v is number=>integer(v)&&v>=0;
const string=(v:unknown):v is string=>typeof v==='string';
function summary(v:unknown):v is OperationSummary{return record(v)&&['id','status','createdAt','updatedAt'].every(k=>string(v[k]))&&!!v.id&&Number.isFinite(Date.parse(String(v.createdAt)))&&Number.isFinite(Date.parse(String(v.updatedAt)));}
export function parseOperationPage(v:unknown):OperationPage|null {
 if(!record(v)||!Array.isArray(v.data)||!v.data.every(summary)||!record(v.meta))return null;
 const m=v.meta;if(!integer(m.page)||m.page<1||!integer(m.limit)||m.limit<1||m.limit>100||!nonnegative(m.total)||!nonnegative(m.totalPages)||m.totalPages!==Math.ceil(m.total/m.limit)||v.data.length>m.limit||v.data.length>m.total)return null;
 return v as unknown as OperationPage;
}
export function parseCount(v:unknown):CountSession|null {
 if(!summary(v))return null;const r=v as unknown as RecordRow;
 if(!string(r.warehouseId)||!record(r.warehouse)||r.warehouse.id!==r.warehouseId||!string(r.warehouse.code)||!string(r.warehouse.name)||typeof r.warehouse.isActive!=='boolean'||!Array.isArray(r.lines))return null;
 if(!r.lines.every(l=>record(l)&&['id','variantId','sku'].every(k=>string(l[k]))&&nonnegative(l.systemQuantity)&&(l.countedQuantity===null||nonnegative(l.countedQuantity))&&(l.difference===null||integer(l.difference))&&(l.countedQuantity===null?l.difference===null:l.difference===Number(l.countedQuantity)-Number(l.systemQuantity))&&(l.adjustmentMovementId===null||string(l.adjustmentMovementId))))return null;
 return v as CountSession;
}
export function parseImport(v:unknown):ImportBatch|null {
 if(!summary(v))return null;const r=v as unknown as RecordRow;
 if(!(r.filename===null||string(r.filename))||!nonnegative(r.totalRows)||!nonnegative(r.validRows)||!nonnegative(r.errorRows)||r.validRows+r.errorRows!==r.totalRows||!Array.isArray(r.rows)||r.rows.length!==r.totalRows)return null;
 if(!r.rows.every(l=>record(l)&&string(l.id)&&nonnegative(l.rowNumber)&&['sku','warehouseCode','mode','reason'].every(k=>string(l[k]))&&integer(l.quantity)&&typeof l.valid==='boolean'&&(l.errors===null||(Array.isArray(l.errors)&&l.errors.every(string)))))return null;
 if(r.rows.filter(l=>l.valid).length!==r.validRows)return null;
 return v as ImportBatch;
}
export function parseClosedCount(v:unknown,id:string):boolean {return record(v)&&summary(v.session)&&v.session.id===id&&record(v.session)&&v.session.status==='closed'&&Array.isArray(v.movements)&&v.movements.every(m=>record(m)&&string(m.id));}
export function parseAppliedImport(v:unknown,id:string):boolean {return record(v)&&summary(v.batch)&&v.batch.id===id&&record(v.batch)&&v.batch.status==='applied'&&nonnegative(v.batch.totalRows)&&nonnegative(v.batch.validRows)&&v.batch.validRows===v.batch.totalRows&&v.batch.errorRows===0&&Array.isArray(v.movements)&&v.movements.every(m=>record(m)&&string(m.id));}

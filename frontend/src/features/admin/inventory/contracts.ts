export type RecordRow = Record<string, unknown>;
export function record(value: unknown): value is RecordRow { return !!value && typeof value === 'object' && !Array.isArray(value); }
export interface StockRow extends RecordRow { id:string; variantId:string; warehouseId:string; sku:string; warehouse:string; warehouseCode:string; physicalStock:number; reservedStock:number; committedStock:number; availableStock:number; costPrice:number|null|'NO_PERMISSION'; inventoryValue:number|null|'NO_PERMISSION'; }
const finite = (v:unknown):v is number=>typeof v==='number' && Number.isFinite(v);
export function parseStock(value:unknown):{data:StockRow[]}|null {
 if(!record(value)||!Array.isArray(value.data))return null;
 const valid=value.data.every(r=>record(r)&&['id','variantId','warehouseId','sku','warehouse','warehouseCode'].every(k=>typeof r[k]==='string')&&['physicalStock','reservedStock','committedStock','availableStock'].every(k=>finite(r[k])&&Number.isInteger(r[k])&&r[k]>=0)&&r.availableStock===Number(r.physicalStock)-Number(r.reservedStock)-Number(r.committedStock)&&((r.costPrice==='NO_PERMISSION'&&r.inventoryValue==='NO_PERMISSION')||((r.costPrice===null||finite(r.costPrice))&&(r.inventoryValue===null||finite(r.inventoryValue)))));
 return valid?{data:value.data as StockRow[]}:null;
}
export function parseRows(value:unknown):{data:RecordRow[]}|null {return record(value)&&Array.isArray(value.data)&&value.data.every(record)?{data:value.data}:null;}
export interface PriceRow extends RecordRow {id:string;productId:string;sku:string;product:string;variant:string;currentPrice:string;currency:string;status:string;availableStock:number;missingCost:boolean;}
export function parsePrices(value:unknown):{prices:PriceRow[]}|null {
 if(!record(value)||!Array.isArray(value.prices)||!value.prices.every(r=>record(r)&&['id','productId','sku','product','variant','currency','status'].every(k=>typeof r[k]==='string')&&typeof r.currentPrice==='string'&&r.currentPrice.trim()!==''&&Number.isFinite(Number(r.currentPrice))&&finite(r.availableStock)&&typeof r.missingCost==='boolean'))return null;
 return {prices:value.prices as PriceRow[]};
}
export function validateAdjustment(value:{variantId:string;warehouseId:string;quantityDelta:number;reason:string;referenceId:string}):string|null {
 if(!value.variantId||!value.warehouseId)return 'Seleccione una variante y una bodega.';
 if(!Number.isSafeInteger(value.quantityDelta)||value.quantityDelta===0)return 'El ajuste debe ser un entero distinto de cero.';
 if(!value.reason.trim())return 'Indique el motivo del ajuste.';
 if(!value.referenceId.trim())return 'La referencia del ajuste es obligatoria.';
 return null;
}
export function validatePrice(value:string,reason:string):string|null {
 if(!value.trim()||!Number.isFinite(Number(value))||Number(value)<=0)return 'El precio debe ser un número mayor a cero.';
 if(!reason.trim())return 'Indique el motivo del cambio.';
 return null;
}
export function parseMutation(kind:'adjust'|'price'|'count'|'batch',value:unknown,expectedId?:string):boolean {
 if(!record(value))return false;
 if(kind==='adjust')return record(value.item)&&typeof value.item.variantId==='string'&&(!expectedId||value.item.variantId===expectedId)&&finite(value.item.onHandQty)&&finite(value.item.availableQty)&&record(value.movement)&&typeof value.movement.id==='string';
 if(kind==='price')return value.id===expectedId&&typeof value.sku==='string'&&typeof value.price==='string'&&Number.isFinite(Number(value.price))&&Number(value.price)>0;
 return typeof value.id==='string'&&typeof value.status==='string'&&(kind==='count'?Array.isArray(value.lines):typeof value.totalRows==='number');
}

export type AdjustmentOption=Pick<StockRow,'id'|'variantId'|'warehouseId'|'sku'|'warehouseCode'|'availableStock'>;
export function adjustmentOptions(rows:StockRow[]):AdjustmentOption[]{return rows.map(({id,variantId,warehouseId,sku,warehouseCode,availableStock})=>({id,variantId,warehouseId,sku,warehouseCode,availableStock}));}

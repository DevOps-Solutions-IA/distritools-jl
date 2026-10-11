import {describe,it,expect} from 'vitest';
import {parseOperationPage,parseCount,parseImport,parseClosedCount,parseAppliedImport} from '@/features/admin/inventory/operations-contracts';
const base={id:'s',status:'in_progress',createdAt:'2026-10-10T00:00:00Z',updatedAt:'2026-10-10T00:00:00Z'};
const count={...base,warehouseId:'w',warehouse:{id:'w',code:'W',name:'Warehouse',isActive:true},lines:[{id:'l',variantId:'v',sku:'SKU',systemQuantity:10,countedQuantity:12,difference:2,adjustmentMovementId:null}]};
const batch={...base,status:'dry_run_valid',totalRows:1,validRows:1,errorRows:0,filename:null,rows:[{id:'r',rowNumber:2,sku:'SKU',warehouseCode:'W',quantity:2,mode:'delta',reason:'Count',valid:true,errors:[],movementId:null}]};
describe('persisted inventory operation contracts',()=>{
 it('accepts actual bounded metadata, preserving total rather than row count',()=>expect(parseOperationPage({data:[base],meta:{page:2,limit:1,total:4,totalPages:4}})?.meta.total).toBe(4));
 it('rejects missing, inconsistent, excessive and fractional metadata',()=>{for(const meta of [null,{page:1,limit:0,total:4,totalPages:4},{page:1,limit:101,total:4,totalPages:1},{page:1.5,limit:1,total:4,totalPages:4},{page:1,limit:1,total:4,totalPages:1}])expect(parseOperationPage({data:[base],meta})).toBeNull();});
 it('rejects foreign count warehouse and invented differences',()=>{expect(parseCount({...count,warehouse:{...count.warehouse,id:'other'}})).toBeNull();expect(parseCount({...count,lines:[{...count.lines[0],difference:0}]})).toBeNull();});
 it('retains uncounted state instead of converting it to zero',()=>expect(parseCount({...count,lines:[{...count.lines[0],countedQuantity:null,difference:null}]})?.lines[0].countedQuantity).toBeNull());
 it('requires a durable closed session with the expected identity',()=>{expect(parseClosedCount({session:{...count,status:'closed'},movements:[]},'s')).toBe(true);expect(parseClosedCount({session:{...count,status:'in_progress'},movements:[]},'s')).toBe(false);expect(parseClosedCount({session:{...count,status:'closed'},movements:[]},'other')).toBe(false);});
 it('requires consistent import row counts and errors',()=>{expect(parseImport(batch)?.status).toBe('dry_run_valid');expect(parseImport({...batch,errorRows:1})).toBeNull();expect(parseImport({...batch,rows:[{...batch.rows[0],quantity:NaN}]})).toBeNull();});
 it('does not certify a dry run or foreign import as applied',()=>{expect(parseAppliedImport({batch:{...batch,status:'applied'},movements:[]},'s')).toBe(true);expect(parseAppliedImport({batch,movements:[]},'s')).toBe(false);expect(parseAppliedImport({batch:{...batch,status:'applied'},movements:[]},'other')).toBe(false);});
});

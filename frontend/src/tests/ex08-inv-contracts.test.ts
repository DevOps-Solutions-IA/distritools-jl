import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/lib/admin/server-data',()=>({adminFetch:vi.fn()}));
import { adminFetch } from '@/lib/admin/server-data';
import { loadInventory, loadPriceDetail } from '@/features/admin/inventory/readers';
import { parseStock, parseMutation, validateAdjustment, validatePrice } from '@/features/admin/inventory/contracts';
const user={user:{id:'actor',email:'qa@example.invalid',role:'inventory',permissions:['inventory.read']}};
const success=(data:unknown)=>({ok:true,kind:'success',status:200,data,error:null});
const row={id:'item',variantId:'v',warehouseId:'w',sku:'QA',warehouse:'QA warehouse',warehouseCode:'QA',physicalStock:10,reservedStock:2,committedStock:1,availableStock:7,costPrice:null,inventoryValue:null};
beforeEach(()=>vi.resetAllMocks());
describe('INV live contract boundaries',()=>{
 it('does not turn missing stock quantities into zero',()=>expect(parseStock({data:[{...row,physicalStock:undefined}]})).toBeNull());
 it('preserves committed stock and null cost',()=>expect(parseStock({data:[row]})?.data[0]).toMatchObject({committedStock:1,availableStock:7,costPrice:null}));
 it('keeps an explicit cost permission sentinel without inventing zero or missing cost',()=>expect(parseStock({data:[{...row,costPrice:'NO_PERMISSION',inventoryValue:'NO_PERMISSION'}]})?.data[0].costPrice).toBe('NO_PERMISSION'));
 it('rejects inconsistent stock balance',()=>expect(parseStock({data:[{...row,availableStock:10}]})).toBeNull());
 it('rejects negative and nonfinite stock contracts',()=>expect(parseStock({data:[{...row,reservedStock:-1}]})).toBeNull());
 it('rejects zero delta and blank reason before submission',()=>{expect(validateAdjustment({quantityDelta:0,reason:'',referenceId:'r',variantId:'v',warehouseId:'w'})).toBeTruthy();});
 it('requires positive finite price and a reason',()=>{expect(validatePrice('Infinity','reason')).toBeTruthy();expect(validatePrice('1',' ')).toBeTruthy();expect(validatePrice('0','r')).toBeTruthy();expect(validatePrice('12.50','Audited change')).toBeNull();});
 it('never labels a malformed success as adjusted',()=>expect(parseMutation('adjust',{})).toBe(false));
 it('does not confirm an adjustment returned for another variant',()=>expect(parseMutation('adjust',{item:{variantId:'foreign',onHandQty:10,availableQty:3},movement:{id:'m'}},'v')).toBe(false));
 it('verifies the price response identity',()=>{expect(parseMutation('price',{id:'different',sku:'QA',price:'15'},'v')).toBe(false);expect(parseMutation('price',{id:'v',sku:'QA',price:'15'},'v')).toBe(true);});
 it('does not require optional cost/alerts permissions to read stock',async()=>{
  vi.mocked(adminFetch).mockImplementation(async(path)=>success(path==='/admin/session'?user:path.includes('/overview')?{data:[row]}:{data:[]}) as never);
  const result=await loadInventory({search:'QA'});expect(result.stock.ok).toBe(true);expect(result.valuation.kind).toBe('forbidden');expect(result.alerts.kind).toBe('forbidden');
  expect(vi.mocked(adminFetch).mock.calls.map(c=>c[0])).toEqual(['/admin/session','/admin/inventory/overview?search=QA','/admin/inventory/warehouses','/admin/inventory/reservations']);
 });
 it('does not make domain reads before a verified session',async()=>{
  vi.mocked(adminFetch).mockResolvedValue({ok:false,kind:'auth_required',status:401,data:null,error:'Session required'});
  const result=await loadInventory({});expect(result.stock.kind).toBe('auth_required');expect(adminFetch).toHaveBeenCalledTimes(1);
 });
 it('reports optional service failure independently of core stock',async()=>{
  const privileged={user:{...user.user,permissions:['inventory.read','inventory.cost.read']}};
  vi.mocked(adminFetch).mockImplementation(async(path)=>path==='/admin/session'?success(privileged) as never:path==='/admin/inventory/valuation'?{ok:false,kind:'server_error',status:500,data:null,error:'Unavailable'}:success(path.includes('overview')?{data:[row]}:{data:[]}) as never);
  const result=await loadInventory({});expect(result.stock.ok).toBe(true);expect(result.valuation.kind).toBe('server_error');
 });
 it('reads scoped price history independently from catalog read permission',async()=>{
  vi.mocked(adminFetch).mockImplementation(async(path)=>success(path==='/admin/session'?{user:{...user.user,permissions:['catalog.read','prices.history.read']}}:path.includes('prices/history')?{data:[]}: {prices:[{id:'v',productId:'p',sku:'QA',product:'QA',variant:'QA',currentPrice:'1.00',currency:'COP',status:'READY',availableStock:7,missingCost:true}]}) as never);
  const result=await loadPriceDetail('v');expect(result.history.ok).toBe(true);expect(vi.mocked(adminFetch).mock.calls.some(c=>c[0]==='/admin/prices/history?variantId=v')).toBe(true);
 });
});

import {describe,it,expect,vi} from 'vitest';
import {render,screen} from '@testing-library/react';
vi.mock('@/features/admin/inventory/readers',()=>({loadOperations:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({})}));
import {loadOperations} from '@/features/admin/inventory/readers';
import {OperationsScreen} from '@/features/admin/inventory/OperationsScreen';
const result=(page:number)=>({permissions:['inventory.count.read'],list:{ok:true,kind:'success',status:200,error:null,data:{data:[],meta:{page,limit:1,total:2,totalPages:2}}},detail:null,warehouses:{ok:false,kind:'forbidden',status:403,data:null,error:'Denied'},session:{ok:true,kind:'success',status:200,data:{user:{id:'u',email:'u@example.invalid',role:'reader',permissions:['inventory.count.read']}},error:null}});
describe('operation page controls reflect durable server navigation',()=>{
 it('updates the form page on navigation and does not resubmit the previous page',async()=>{vi.mocked(loadOperations).mockResolvedValue(result(1) as never);const view=render(await OperationsScreen({kind:'count-sessions',query:{page:'1',limit:'1'}}));expect(screen.getByLabelText('Página',{exact:true})).toHaveValue(1);vi.mocked(loadOperations).mockResolvedValue(result(2) as never);view.rerender(await OperationsScreen({kind:'count-sessions',query:{page:'2',limit:'1'}}));expect(screen.getByLabelText('Página',{exact:true})).toHaveValue(2);});
});

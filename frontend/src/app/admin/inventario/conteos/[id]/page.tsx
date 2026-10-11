import {AdminShell} from '@/components/layout/AdminShell';
import {OperationsScreen} from '@/features/admin/inventory/OperationsScreen';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <AdminShell>{await OperationsScreen({kind:'count-sessions',id})}</AdminShell>;}

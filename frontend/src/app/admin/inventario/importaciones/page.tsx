import {AdminShell} from '@/components/layout/AdminShell';
import {OperationsScreen} from '@/features/admin/inventory/OperationsScreen';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams?:Promise<{page?:string;limit?:string}>}={}){const query=await searchParams??{};return <AdminShell>{await OperationsScreen({kind:'imports',query})}</AdminShell>;}

import {AdminShell} from '@/components/layout/AdminShell';import {HistoryScreen} from '@/features/admin/inventory/HistoryScreen';
export const dynamic='force-dynamic';export const metadata={title:'Kardex admin | DistriTools JL',robots:{index:false,follow:false}};
export default async function AdminInventoryHistoryPage({searchParams}:{searchParams?:Promise<Record<string,string|undefined>>}={}){const screen=await HistoryScreen({query:await searchParams??{}});return <AdminShell>{screen}</AdminShell>;}

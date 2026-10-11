import {AdminShell} from '@/components/layout/AdminShell';import {InventoryScreen} from '@/features/admin/inventory/InventoryScreen';
export const dynamic='force-dynamic';export const metadata={title:'Inventario admin | DistriTools JL',robots:{index:false,follow:false}};
export default async function AdminInventoryPage({searchParams}: {searchParams?:Promise<{search?:string}>}={}){const query=await searchParams??{};return <AdminShell><InventoryScreen search={query.search}/></AdminShell>;}

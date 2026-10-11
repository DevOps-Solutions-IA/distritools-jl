import {AdminShell} from '@/components/layout/AdminShell';import {PricesScreen} from '@/features/admin/prices/PricesScreen';
export const dynamic='force-dynamic';export const metadata={title:'Precios admin | DistriTools JL',robots:{index:false,follow:false}};
export default async function AdminPricesPage({searchParams}:{searchParams?:Promise<{search?:string;status?:string}>}={}){const query=await searchParams??{};return <AdminShell><PricesScreen search={query.search} status={query.status}/></AdminShell>;}

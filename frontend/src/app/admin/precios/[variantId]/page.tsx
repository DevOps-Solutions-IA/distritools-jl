import {AdminShell} from '@/components/layout/AdminShell';import {PriceDetailScreen} from '@/features/admin/prices/PricesScreen';
export const dynamic='force-dynamic';export const metadata={title:'Historial precio admin | DistriTools JL',robots:{index:false,follow:false}};
export default async function AdminPriceDetailPage({params}:{params:Promise<{variantId:string}>}){const {variantId}=await params;return <AdminShell><PriceDetailScreen variantId={variantId}/></AdminShell>;}

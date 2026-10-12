import { OrderPage } from "@/features/admin/orders/DetailPage";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Detalle pedidos | DistriTools JL",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderPage id={id} />;
}

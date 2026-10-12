import { PaymentPage } from "@/features/admin/payments/DetailPage";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Detalle pagos | DistriTools JL",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PaymentPage id={id} />;
}

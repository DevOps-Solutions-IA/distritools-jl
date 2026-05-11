import { redirect } from 'next/navigation';

export default async function LegacyOrderRedirectPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  redirect(`/checkout/confirmacion?order=${encodeURIComponent(orderNumber)}`);
}

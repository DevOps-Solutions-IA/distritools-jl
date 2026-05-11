import { redirect } from 'next/navigation';

export default function LegacyPaymentReturnRedirectPage() {
  redirect('/checkout/confirmacion');
}

import { redirect } from 'next/navigation';

export default function LegacyCheckoutRedirectPage() {
  redirect('/checkout');
}

import { redirect } from 'next/navigation';

export default function LegacyCartRedirectPage() {
  redirect('/carrito');
}

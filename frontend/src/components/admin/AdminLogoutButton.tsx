'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export function AdminLogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch('/api/admin/session/logout', { method: 'POST' });
    router.replace('/admin/login');
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={logout}>
      Salir
    </Button>
  );
}

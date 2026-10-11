'use client';

import { startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AdminShell } from '@/components/layout/AdminShell';
import { Button } from '@/components/ui/Button';

type AdminErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AdminError({ reset }: AdminErrorProps) {
  const router = useRouter();

  function retry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <AdminShell>
      <section
        role="alert"
        data-state="read_unavailable"
        className="space-y-4 rounded-xl border border-[var(--color-border)] p-5"
      >
        <h2 className="text-xl font-semibold">
          Lectura administrativa no disponible
        </h2>
        <p>
          No pudimos cargar esta vista administrativa. Puedes volver a
          intentarlo.
        </p>
        <Button type="button" onClick={retry}>
          Reintentar
        </Button>
      </section>
    </AdminShell>
  );
}

import Link from 'next/link';
import type { AdminModuleConfig } from '@/lib/admin/transport/navigation';
import type { SectionActionLink } from '../screen-adapters/shared/types';

export function SectionContextHeader({
  adminModule,
  actions,
}: {
  adminModule: AdminModuleConfig;
  actions?: SectionActionLink[];
}) {
  return (
    <section className="rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-8">
      <p className="text-xs text-[var(--color-text-secondary)]">
        Permiso de lectura: {adminModule.permission}
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-[var(--color-off-white)]">
        {adminModule.title}
      </h1>
      <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
        {adminModule.description}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        {(
          actions ?? [
            { label: 'Volver al dashboard', href: '/admin/dashboard' },
          ]
        ).map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-[var(--color-off-white)]"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

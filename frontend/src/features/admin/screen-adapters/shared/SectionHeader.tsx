import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  adminStatusLabel,
  adminStatusVariant,
  type AdminModuleConfig,
  type AdminReadinessStatus,
} from '@/lib/admin/operations';
import type { SectionActionLink } from './types';

function StatusBadge({ status }: { status: AdminReadinessStatus }) {
  return (
    <Badge variant={adminStatusVariant(status)}>
      {adminStatusLabel(status)}
    </Badge>
  );
}

function ModuleActionLinks({ actions }: { actions?: SectionActionLink[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {(
        actions ?? [{ label: 'Volver al dashboard', href: '/admin/dashboard' }]
      ).map((action) => (
        <Link key={action.href} href={action.href}>
          <Button variant="outline">{action.label}</Button>
        </Link>
      ))}
    </div>
  );
}

export function SectionHeader({
  adminModule,
  actions,
}: {
  adminModule: AdminModuleConfig;
  actions?: SectionActionLink[];
}) {
  return (
    <section className="rounded-[2rem] border border-[var(--color-border)] bg-[linear-gradient(135deg,#121212_0%,#0b0b0b_62%,rgba(245,183,0,0.09)_100%)] p-5 shadow-elevated sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
            {adminModule.permission}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">
            {adminModule.title}
          </h1>
          <p className="text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base sm:leading-7">
            {adminModule.description}
          </p>
        </div>
        <StatusBadge status={adminModule.status} />
      </div>
      <div className="mt-6">
        <ModuleActionLinks actions={actions} />
      </div>
    </section>
  );
}

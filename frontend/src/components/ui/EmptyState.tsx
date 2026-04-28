import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <Card className="rounded-lg border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] p-6 text-center">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4">
        <div className="rounded-full bg-[rgba(249,115,22,0.14)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-industrial-orange)]">
          Estado vacío
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-[var(--color-off-white)]">
            {title}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
        </div>
        {actionLabel ? (
          actionHref ? (
            <Link href={actionHref}>
              <Button variant="outline">{actionLabel}</Button>
            </Link>
          ) : (
            <Button variant="outline">{actionLabel}</Button>
          )
        ) : null}
      </div>
    </Card>
  );
}

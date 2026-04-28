import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface ErrorStateProps {
  title: string;
  description: string;
  retryLabel?: string;
}

export function ErrorState({
  title,
  description,
  retryLabel,
}: ErrorStateProps) {
  return (
    <Card className="rounded-lg border-[rgba(220,38,38,0.2)] bg-[rgba(220,38,38,0.04)] p-6 text-center">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4">
        <div className="rounded-full bg-[rgba(220,38,38,0.14)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-error-red)]">
          Error operativo
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-[var(--color-graphite-black)]">
            {title}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
        </div>
        {retryLabel ? <Button variant="danger">{retryLabel}</Button> : null}
      </div>
    </Card>
  );
}

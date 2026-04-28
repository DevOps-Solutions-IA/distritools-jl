import { Badge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { cn } from '@/lib/utils/cn';

interface KpiCardProps {
  title: string;
  value: string;
  context?: string;
  trend?: string;
  className?: string;
}

export function KpiCard({
  title,
  value,
  context,
  trend,
  className,
}: KpiCardProps) {
  return (
    <Card
      variant="elevated"
      className={cn(
        'overflow-hidden border-[var(--color-border)] bg-[linear-gradient(180deg,#111111_0%,#0c0c0c_100%)]',
        className,
      )}
    >
      <CardBody className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{title}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-graphite-black)]">
              {value}
            </p>
          </div>
          {trend ? <Badge variant="info">{trend}</Badge> : null}
        </div>
        {context ? (
          <p className="text-sm text-[var(--color-text-secondary)]">{context}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}

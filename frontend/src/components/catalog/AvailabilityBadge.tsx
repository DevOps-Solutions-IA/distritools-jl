import { Badge } from '@/components/ui/Badge';
import type { CatalogAvailability } from '@/features/catalog/types';

interface AvailabilityBadgeProps {
  availability: CatalogAvailability;
}

export function AvailabilityBadge({ availability }: AvailabilityBadgeProps) {
  const resolvedLabel =
    availability.status === 'check-backend' ? 'Consultar' : availability.label;
  const resolvedDescription =
    availability.status === 'check-backend'
      ? 'Te ayudamos a confirmar existencia y tiempos de entrega.'
      : availability.description;
  const variant =
    availability.status === 'in-stock'
      ? 'success'
      : availability.status === 'low-stock'
        ? 'warning'
        : availability.status === 'out-of-stock'
          ? 'danger'
          : availability.status === 'check-backend'
            ? 'info'
            : 'neutral';

  return (
    <div className="flex flex-col gap-2">
      <Badge variant={variant}>{resolvedLabel}</Badge>
      <p className="text-xs leading-5 text-[var(--color-text-secondary)]">{resolvedDescription}</p>
    </div>
  );
}

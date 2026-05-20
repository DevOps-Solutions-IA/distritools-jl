import { Badge } from '@/components/ui/Badge';
import type { ProductCommerceState } from '@/features/catalog/commerce';

interface ProductCommerceBadgeProps {
  commerce: ProductCommerceState;
  className?: string;
}

export function ProductCommerceBadge({ commerce, className }: ProductCommerceBadgeProps) {
  return <Badge variant={commerce.badgeVariant} className={className}>{commerce.label}</Badge>;
}

import { Badge } from '@/components/ui/Badge';
import type { ProductCommerceState } from '@/features/catalog/commerce';

interface ProductCommerceBadgeProps {
  commerce: ProductCommerceState;
}

export function ProductCommerceBadge({ commerce }: ProductCommerceBadgeProps) {
  return <Badge variant={commerce.badgeVariant}>{commerce.label}</Badge>;
}

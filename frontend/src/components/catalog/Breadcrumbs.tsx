import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav className={cn('text-sm text-[var(--color-steel-gray)]', className)} aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <Link href={item.href} className="transition hover:text-[var(--color-off-white)]">
                {item.label}
              </Link>
            ) : (
              <span className="font-semibold text-[var(--color-off-white)]">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

import { cn } from '@/lib/utils/cn';

interface BrandFamilyListProps {
  families: string[];
  className?: string;
}

export function BrandFamilyList({ families, className }: BrandFamilyListProps) {
  if (!families.length) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {families.slice(0, 6).map((family) => (
        <span
          key={family}
          className="rounded-full border border-[var(--color-border)] bg-[rgba(255,255,255,0.04)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-off-white)]"
        >
          {family}
        </span>
      ))}
    </div>
  );
}

import { Badge } from '@/components/ui/Badge';
import { StorefrontLinkButton } from '@/components/storefront/StorefrontButton';

interface CatalogHeaderProps {
  eyebrow: string;
  title: string;
  description?: string | null;
  stats?: string[];
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export function CatalogHeader({
  eyebrow,
  title,
  description,
  stats = [],
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: CatalogHeaderProps) {
  return (
    <section className="rounded-[1.15rem] border border-[var(--color-border)] bg-[linear-gradient(180deg,#111_0%,#090909_100%)] p-4 shadow-soft sm:p-6 lg:rounded-[2rem] lg:p-8 lg:shadow-elevated">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="space-y-2 sm:space-y-3">
          <Badge variant="default">{eyebrow}</Badge>
          <div className="space-y-2">
            <h1 className="max-w-4xl text-2xl font-semibold tracking-tight text-[var(--color-off-white)] sm:text-4xl lg:text-5xl">
              {title}
            </h1>
            {description ? (
              <p className="line-clamp-2 max-w-3xl text-sm leading-5 text-[var(--color-text-secondary)] sm:leading-6 md:text-base md:leading-7">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
          {primaryHref && primaryLabel ? (
            <StorefrontLinkButton href={primaryHref} storefrontVariant="primary" className="w-full sm:w-auto">
              {primaryLabel}
            </StorefrontLinkButton>
          ) : null}
          {secondaryHref && secondaryLabel ? (
            <StorefrontLinkButton href={secondaryHref} storefrontVariant="secondary" className="w-full sm:w-auto">
              {secondaryLabel}
            </StorefrontLinkButton>
          ) : null}
        </div>
      </div>
      {stats.length ? (
        <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mt-6 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible">
          {stats.map((item) => (
            <div
              key={item}
              className="min-w-max rounded-full border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] px-3 py-1.5 text-xs font-medium text-[var(--color-off-white)] sm:min-w-0 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
            >
              {item}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

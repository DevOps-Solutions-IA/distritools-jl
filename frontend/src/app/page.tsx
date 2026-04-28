import Image from 'next/image';
import Link from 'next/link';
import { DistriToolsLogo } from '@/components/brand/DistriToolsLogo';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { homeContent } from '@/config/content/home';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-transparent text-[var(--color-off-white)]">
      <section className="enterprise-grid py-8">
        <div className="flex items-center justify-between">
          <DistriToolsLogo size="lg" priority />
          <Badge variant="warning">Herramientas y soluciones industriales</Badge>
        </div>
      </section>

      <section className="enterprise-grid grid gap-10 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:py-16">
        <div className="space-y-8">
          <div className="space-y-5">
            <Badge variant="neutral">{homeContent.hero.badge}</Badge>
            <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight text-[var(--color-off-white)] sm:text-5xl">
              {homeContent.hero.title}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[var(--color-text-secondary)]">
              {homeContent.hero.subtitle}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/storefront">
              <Button size="lg" className="w-full sm:w-auto">
                {homeContent.hero.cta}
              </Button>
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {homeContent.features.map((item) => (
              <Card key={item.title} variant="elevated" className="bg-[var(--color-surface)]">
                <CardBody className="space-y-2">
                  <h2 className="text-lg font-semibold">{item.title}</h2>
                  <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                    {item.text}
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>

        <Card variant="elevated" className="overflow-hidden border-none bg-[var(--color-deep-charcoal)] text-[var(--color-off-white)] shadow-elevated">
          <CardBody className="space-y-8 p-8">
            <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]">
              <Image
                src="/brand/distritools-logo-brand-board.svg"
                alt="Brand board oficial de DistriTools JL"
                width={1600}
                height={900}
                priority
                className="h-auto w-full"
              />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-amber-highlight)]">
                {homeContent.brandSection.badge}
              </p>
              <h2 className="font-display text-3xl font-semibold leading-tight">
                {homeContent.brandSection.title}
              </h2>
              <p className="text-sm leading-7 text-[rgba(249,250,251,0.78)]">
                {homeContent.brandSection.subtitle}
              </p>
            </div>
            <div className="grid gap-3">
              {homeContent.brandSection.tags.map((item) => (
                <div
                  key={item}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm"
                >
                  {item}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </section>
    </main>
  );
}

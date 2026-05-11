import type { Metadata } from 'next';
import { StorefrontHome } from '@/components/storefront/StorefrontHome';
import { siteConfig } from '@/config/site';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `${siteConfig.name} | Herramientas que construyen resultados`,
  description:
    'Compra herramientas, equipos y soluciones para obra, taller, mantenimiento e industria en DistriTools JL.',
};

export default async function HomePage() {
  return StorefrontHome();
}

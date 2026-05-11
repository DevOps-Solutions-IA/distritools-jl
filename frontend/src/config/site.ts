import { getStorefrontWhatsappUrl, storefrontContactConfig } from '@/config/storefront-contact';

export const siteConfig = {
  name: 'DistriTools JL',
  shortName: 'DistriTools JL',
  description:
    'Herramientas, fijación, aire comprimido y soldadura para operación industrial con experiencia digital robusta y comercial.',
  defaultTitle: 'DistriTools JL | Herramientas que construyen resultados',
  storefrontPath: '/',
  adminPath: '/admin',
  whatsappLabel: 'Escribir por WhatsApp',
  whatsappUrl: getStorefrontWhatsappUrl(),
  contact: storefrontContactConfig,
} as const;

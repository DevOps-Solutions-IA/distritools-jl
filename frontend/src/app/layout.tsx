import type { Metadata } from 'next';
import type { Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import type { ReactNode } from 'react';
import { ClientProviders } from '@/components/providers/ClientProviders';
import { siteConfig } from '@/config/site';
import './globals.css';

const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const fontDisplay = Sora({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'),
  title: siteConfig.defaultTitle,
  description: siteConfig.description,
  icons: {
    icon: [
      {
        url: '/brand/favicon.svg',
        type: 'image/svg+xml',
      },
    ],
    shortcut: '/brand/favicon.svg',
    apple: '/brand/favicon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="es" className={`${fontSans.variable} ${fontDisplay.variable}`}>
      <body suppressHydrationWarning>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}

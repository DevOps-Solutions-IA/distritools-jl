import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(process.cwd()),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async rewrites() {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiBaseUrl}/api/v1/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/storefront/productos/:slug',
        destination: '/productos/:slug',
        permanent: true,
      },
      {
        source: '/storefront/productos',
        destination: '/productos',
        permanent: true,
      },
      {
        source: '/storefront/carrito',
        destination: '/carrito',
        permanent: true,
      },
      {
        source: '/storefront/checkout',
        destination: '/checkout',
        permanent: true,
      },
      {
        source: '/storefront/marcas/:slug',
        destination: '/marcas/:slug',
        permanent: true,
      },
      {
        source: '/storefront/marcas',
        destination: '/marcas',
        permanent: true,
      },
      {
        source: '/storefront/categorias/:slug',
        destination: '/categorias/:slug',
        permanent: true,
      },
      {
        source: '/storefront/buscar',
        destination: '/buscar',
        permanent: true,
      },
      {
        source: '/storefront/orden/:orderNumber',
        destination: '/checkout/confirmacion',
        permanent: true,
      },
      {
        source: '/storefront/pago/retorno',
        destination: '/checkout/confirmacion',
        permanent: true,
      },
      {
        source: '/storefront',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

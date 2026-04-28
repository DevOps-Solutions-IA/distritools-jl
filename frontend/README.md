# DistriTools JL Frontend

Base frontend enterprise de DistriTools JL construida con Next.js App Router, TypeScript estricto, Tailwind CSS y una fundación de sistema visual preparada para storefront y dashboard administrativo.

## Scripts
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm run test`

## Puertos
- Frontend local: `http://localhost:3001`
- Backend esperado por defecto: `http://localhost:3000`

## Variables de entorno
Copiar `.env.example` a `.env.local` si se requiere personalización.

## Alcance de esta fase
Esta fase implementa:
- layout base
- landing premium
- shell storefront
- shell admin
- componentes UI mínimos
- tokens de marca
- branding real integrado en `public/brand`
- cliente API base
- pruebas de humo

No implementa aún:
- catálogo real conectado
- checkout completo
- pago real
- login admin real
- CRUD admin completo

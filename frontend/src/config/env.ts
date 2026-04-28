import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_API_BASE_URL:
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000',
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001',
});

if (!parsed.success) {
  throw new Error(
    `Configuración frontend inválida: ${parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ')}`,
  );
}

export const env = {
  apiBaseUrl: parsed.data.NEXT_PUBLIC_API_BASE_URL,
  siteUrl: parsed.data.NEXT_PUBLIC_SITE_URL,
} as const;

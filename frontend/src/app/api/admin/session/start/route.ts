import { NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/config/env';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Revisa correo y contraseña.' },
      { status: 400 },
    );
  }

  const response = await fetch(`${env.apiBaseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed.data),
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return NextResponse.json(
      { message: 'No fue posible iniciar sesión con esos datos.' },
      { status: response.status },
    );
  }

  return NextResponse.json({ challengeToken: payload.challengeToken });
}

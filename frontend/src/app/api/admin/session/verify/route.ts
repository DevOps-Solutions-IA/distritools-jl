import { NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/config/env';

const verifySchema = z.object({
  challengeToken: z.string().min(20),
  code: z.string().regex(/^\d{6}$/),
});

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

export async function POST(request: Request) {
  const parsed = verifySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Código de verificación inválido.' },
      { status: 400 },
    );
  }

  const response = await fetch(`${env.apiBaseUrl}/api/v1/auth/verify-2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed.data),
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return NextResponse.json(
      { message: 'No fue posible verificar el código.' },
      { status: response.status },
    );
  }

  const nextResponse = NextResponse.json({
    user: payload.user,
  });

  nextResponse.cookies.set('dt_admin_access', payload.accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60,
  });
  nextResponse.cookies.set('dt_admin_refresh', payload.refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60,
  });

  return nextResponse;
}

'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => searchParams.get('next') ?? '/admin', [searchParams]);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function startSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const response = await fetch('/api/admin/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const payload = await response.json().catch(() => ({}));
    setIsSubmitting(false);

    if (!response.ok || !payload.challengeToken) {
      setError(payload.message ?? 'No fue posible iniciar sesión.');
      return;
    }

    setChallengeToken(payload.challengeToken);
  }

  async function verifySession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challengeToken) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const response = await fetch('/api/admin/session/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeToken, code }),
    });
    const payload = await response.json().catch(() => ({}));
    setIsSubmitting(false);

    if (!response.ok) {
      setError(payload.message ?? 'No fue posible verificar el código.');
      return;
    }

    router.replace(nextPath.startsWith('/admin') ? nextPath : '/admin');
    router.refresh();
  }

  if (challengeToken) {
    return (
      <form onSubmit={verifySession} className="grid gap-5">
        <div className="space-y-2">
          <label htmlFor="code" className="text-sm font-semibold text-[var(--color-off-white)]">
            Código 2FA
          </label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            maxLength={6}
            required
          />
        </div>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <Button type="submit" disabled={isSubmitting || code.length !== 6}>
          {isSubmitting ? 'Verificando' : 'Entrar al panel'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setChallengeToken(null)}>
          Cambiar credenciales
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={startSession} className="grid gap-5">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-semibold text-[var(--color-off-white)]">
          Correo administrativo
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-semibold text-[var(--color-off-white)]">
          Contraseña
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Validando' : 'Continuar'}
      </Button>
    </form>
  );
}

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

/** A success redirect requires the coordinated BFF's confirmed backend revocation. */
export function AdminSessionExit({ onSessionExpired }: { onSessionExpired?: () => void }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [expired, setExpired] = React.useState(false);
  const controllerRef = React.useRef<AbortController | null>(null);
  const timeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => () => {
    controllerRef.current?.abort();
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
  }, []);

  async function logout() {
    if (controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setPending(true);
    setFailed(false);
    timeoutRef.current = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('/api/admin/session/logout', { method: 'POST', cache: 'no-store', credentials: 'same-origin', signal: controller.signal, headers: { Accept: 'application/json' } });
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 401 && payload && typeof payload === 'object' && 'localSessionCleared' in payload && payload.localSessionCleared === true && 'kind' in payload && payload.kind === 'auth_required' && 'success' in payload && payload.success === false && 'revocationConfirmed' in payload && payload.revocationConfirmed === false) {
        setExpired(true);
        onSessionExpired?.();
        return;
      }
      if (response.status !== 201 || !payload || typeof payload !== 'object' || !('success' in payload) || payload.success !== true || !('revocationConfirmed' in payload) || payload.revocationConfirmed !== true) throw new Error('Logout not confirmed');
      router.replace('/admin/login');
      router.refresh();
    } catch { setFailed(true); }
    finally {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      controllerRef.current = null;
      setPending(false);
    }
  }

  return <div>
    {expired ? <><p role="alert" className="admin-session-exit-error">La sesión finalizó. Inicia sesión nuevamente.</p><Link href="/admin/login" className="admin-session-login">Iniciar sesión</Link></> : <Button type="button" variant="ghost" loading={pending} onClick={logout} className="w-full justify-start">{pending ? 'Saliendo…' : 'Salir'}</Button>}
    {failed ? <p role="alert" className="admin-session-exit-error">No fue posible cerrar la sesión. Vuelve a intentar.</p> : null}
  </div>;
}

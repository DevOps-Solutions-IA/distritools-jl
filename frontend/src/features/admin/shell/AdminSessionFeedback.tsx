'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import type { AdminSessionState } from './useAdminSession';

const messages = {
  loading: { title: 'Verificando sesión', description: 'Consultando identidad y permisos actuales.' },
  auth_required: { title: 'Sesión finalizada', description: 'Inicia sesión para continuar en el panel.' },
  forbidden: { title: 'Acceso denegado', description: 'Tu sesión no tiene permiso para acceder a este módulo.' },
  network_error: { title: 'Sin conexión al servidor', description: 'No pudimos verificar la sesión. Comprueba la conexión y vuelve a intentar.' },
  server_error: { title: 'No fue posible verificar la sesión', description: 'El servidor no pudo completar la consulta. Vuelve a intentar.' },
  invalid_response: { title: 'Respuesta de sesión no válida', description: 'No pudimos confirmar la identidad y los permisos. Vuelve a intentar.' },
};

export function AdminSessionFeedback({ status, onRetry }: { status: Exclude<AdminSessionState['status'], 'success'>; onRetry: () => void }) {
  const message = messages[status];
  return (
    <section className="admin-read-state" role={status === 'loading' ? 'status' : 'alert'} data-state={status === 'loading' ? 'loading' : 'error'} aria-busy={status === 'loading'}>
      <h2>{message.title}</h2>
      <p>{message.description}</p>
      {status !== 'loading' ? <div className="admin-state-actions">
        {status === 'auth_required' ? <Link href="/admin/login">Iniciar sesión</Link> : null}
        <Button type="button" variant="outline" onClick={onRetry}>Reintentar</Button>
      </div> : null}
    </section>
  );
}

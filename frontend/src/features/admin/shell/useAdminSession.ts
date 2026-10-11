'use client';

import * as React from 'react';

export interface AdminSessionUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
}
export type AdminSessionState =
  | { status: 'loading' }
  | { status: 'success'; user: AdminSessionUser }
  | { status: 'auth_required' | 'forbidden' | 'network_error' | 'server_error' | 'invalid_response' };

function parseUser(payload: unknown): AdminSessionUser | null {
  if (!payload || typeof payload !== 'object' || !('user' in payload)) return null;
  const user = payload.user;
  if (!user || typeof user !== 'object') return null;
  if (!('id' in user) || typeof user.id !== 'string' || !user.id.trim()) return null;
  if (!('email' in user) || typeof user.email !== 'string' || !user.email.trim()) return null;
  if (!('role' in user) || typeof user.role !== 'string' || !user.role.trim()) return null;
  if (!('permissions' in user) || !Array.isArray(user.permissions) || !user.permissions.every((permission: unknown) => typeof permission === 'string' && permission.trim().length > 0)) return null;
  return { id: user.id, email: user.email, role: user.role, permissions: user.permissions };
}

/** Self-context is authority only after HTTP success and schema validation. */
export function useAdminSession(route: string): { state: AdminSessionState; retry: React.DispatchWithoutAction } {
  const [attempt, retry] = React.useReducer((value: number) => value + 1, 0);
  const [result, setResult] = React.useState<{ route: string; attempt: number; state: AdminSessionState }>({ route, attempt, state: { status: 'loading' } });

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    async function load(): Promise<AdminSessionState> {
      try {
        const response = await fetch('/api/admin/session', { method: 'GET', cache: 'no-store', credentials: 'same-origin', signal: controller.signal, headers: { Accept: 'application/json' } });
        if (response.status === 401) return { status: 'auth_required' };
        if (response.status === 403) return { status: 'forbidden' };
        if (!response.ok) return { status: 'server_error' };
        const user = parseUser(await response.json().catch(() => null));
        return user ? { status: 'success', user } : { status: 'invalid_response' };
      } catch { return { status: 'network_error' }; }
    }
    void load().then((state) => {
      window.clearTimeout(timeout);
      if (active) setResult({ route, attempt, state });
    });
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [route, attempt]);

  return { state: result.route === route && result.attempt === attempt ? result.state : { status: 'loading' }, retry };
}

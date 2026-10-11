import Link from 'next/link';
import type { AdminApiResult } from '@/lib/admin/transport/result';
export function AdminReadFailure({
  result,
}: {
  result: Extract<AdminApiResult<never>, { ok: false }>;
}) {
  return (
    <section
      role="alert"
      data-state={result.kind}
      className="rounded-xl border border-red-400/30 p-5"
    >
      <p>{result.error}</p>
      {result.kind === 'auth_required' ? (
        <Link href="/admin/login" className="mt-3 inline-block underline">
          Iniciar sesión
        </Link>
      ) : null}
    </section>
  );
}

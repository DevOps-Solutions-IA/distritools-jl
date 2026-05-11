import type { Metadata } from 'next';
import Image from 'next/image';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import { DistriToolsLogo } from '@/components/brand/DistriToolsLogo';

export const metadata: Metadata = {
  title: 'Login administrativo | DistriTools JL',
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050505] text-[var(--color-off-white)]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(245,183,0,0.16),transparent_32%),radial-gradient(circle_at_86%_14%,rgba(255,255,255,0.08),transparent_28%),linear-gradient(135deg,#050505_0%,#111_48%,#050505_100%)]" />
      <div className="relative grid min-h-screen lg:grid-cols-[minmax(420px,0.86fr)_1.14fr]">
        <section className="flex items-center px-5 py-8 sm:px-8 lg:px-14">
          <div className="mx-auto w-full max-w-[31rem]">
            <div className="mb-8 flex items-center justify-between gap-4">
              <DistriToolsLogo variant="horizontal" tone="light" size="md" priority />
              <span className="rounded-full border border-[rgba(245,183,0,0.32)] bg-[rgba(245,183,0,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-industrial-yellow)]">
                Admin
              </span>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[rgba(17,17,17,0.86)] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur sm:p-8">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
                  Acceso interno autorizado
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-off-white)] sm:text-4xl">
                  Panel administrativo
                </h1>
                <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                  Ingresa con credenciales internas y código 2FA. La tienda pública no enlaza este panel.
                </p>
              </div>
              <div className="mt-7">
                <AdminLoginForm />
              </div>
            </div>

            <p className="mt-5 text-xs leading-5 text-[var(--color-text-secondary)]">
              Uso exclusivo para operación de catálogo, pedidos, contenido, pagos y auditoría.
            </p>
          </div>
        </section>

        <section className="relative hidden min-h-screen items-center overflow-hidden border-l border-white/10 bg-[#0b0b0b] p-10 lg:flex">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.3),transparent_44%,rgba(245,183,0,0.07))]" />
          <div className="relative mx-auto w-full max-w-3xl">
            <div className="mb-6 flex items-end justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
                  Operación DistriTools JL
                </p>
                <h2 className="mt-2 max-w-xl text-4xl font-semibold leading-tight tracking-tight">
                  Control de catálogo, inventario y despacho en un entorno protegido.
                </h2>
              </div>
            </div>
            <div className="overflow-hidden rounded-[2.5rem] border border-white/10 bg-black/40 shadow-[0_34px_120px_rgba(0,0,0,0.5)]">
              <Image
                src="/brand/admin-login-team.svg"
                alt="Equipo operativo DistriTools JL en inventario y despacho"
                width={1200}
                height={900}
                priority
                className="h-auto w-full"
              />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {['RBAC server-side', '2FA obligatorio', 'Auditoría crítica'].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

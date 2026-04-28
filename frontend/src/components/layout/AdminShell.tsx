import * as React from 'react';
import { DistriToolsLogo } from '@/components/brand/DistriToolsLogo';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-off-white)] lg:grid lg:grid-cols-[18rem_1fr]">
      <aside className="border-b border-[var(--color-border)] bg-[#090909] px-5 py-6 text-[var(--color-off-white)] lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between lg:block">
          <div className="space-y-3">
            <DistriToolsLogo variant="mark" tone="light" size="sm" priority />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
              Operación interna
            </p>
          </div>
          <Badge variant="info">Admin</Badge>
        </div>
        <nav className="mt-8 grid gap-2">
          {['Visión general', 'Productos', 'Inventario', 'Órdenes', 'Pagos', 'Promociones', 'Contenido', 'Analytics'].map((item) => (
            <Button
              key={item}
              variant="ghost"
              className="justify-start text-[var(--color-off-white)] hover:bg-white/10 hover:text-[var(--color-off-white)]"
            >
              {item}
            </Button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="enterprise-grid flex items-center justify-between py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
                Operación administrativa
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">Operación DistriTools JL</h1>
            </div>
            <Badge variant="neutral">Acceso interno</Badge>
          </div>
        </header>

        <main className="enterprise-grid py-8">{children}</main>
      </div>
    </div>
  );
}

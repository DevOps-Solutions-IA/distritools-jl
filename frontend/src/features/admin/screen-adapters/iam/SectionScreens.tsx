import { Badge } from '@/components/ui/Badge';
import { AdminTable } from '../shared/AdminTable';
import { asRecord, textValue, statusVariant } from '../shared/display-values';
import type { SectionScreenAdapter, SectionScreenProps } from '../shared/types';
function readinessFromSettings(settings: Record<string, unknown>) {
  return asRecord(settings.productionReadiness);
}

export function UsuariosScreen({ operations }: SectionScreenProps<'users'>) {
  return (
    <AdminTable
      title="Usuarios"
      description="Usuarios internos reales. Email y teléfono se muestran protegidos."
      rows={operations.users.data}
      columns={[
        {
          key: 'name',
          label: 'Usuario',
          render: (user) => (
            <span className="font-semibold text-[var(--color-off-white)]">
              {user.fullName}
            </span>
          ),
        },
        { key: 'email', label: 'Email', render: (user) => user.email },
        {
          key: 'role',
          label: 'Rol',
          render: (user) => user.role?.name ?? 'Sin rol',
        },
        {
          key: 'status',
          label: 'Estado',
          render: (user) => (
            <Badge variant={user.isActive ? 'success' : 'warning'}>
              {user.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
          ),
        },
        {
          key: 'mfa',
          label: '2FA',
          render: (user) => (user.twoFactorEnabled ? 'Activo' : 'Pendiente'),
        },
      ]}
    />
  );
}

export function RolesScreen({ operations }: SectionScreenProps<'roles'>) {
  return (
    <AdminTable
      title="Roles"
      description="Roles reales con conteo de permisos y usuarios asociados."
      rows={operations.roles.data}
      columns={[
        {
          key: 'name',
          label: 'Rol',
          render: (role) => (
            <span className="font-semibold text-[var(--color-off-white)]">
              {role.name}
            </span>
          ),
        },
        { key: 'slug', label: 'Slug', render: (role) => role.slug },
        { key: 'users', label: 'Usuarios', render: (role) => role.usersCount },
        {
          key: 'permissions',
          label: 'Permisos',
          render: (role) => role.permissions.length,
        },
        {
          key: 'modules',
          label: 'Módulos',
          render: (role) =>
            Array.from(
              new Set(role.permissions.map((permission) => permission.module)),
            )
              .slice(0, 4)
              .join(', '),
        },
      ]}
    />
  );
}

export function AuditoriaScreen({ operations }: SectionScreenProps<'audit'>) {
  return (
    <AdminTable
      title="Auditoría"
      description="Acciones críticas registradas por el backend. Payloads sensibles quedan redactados."
      rows={operations.audit.data}
      columns={[
        {
          key: 'action',
          label: 'Acción',
          render: (entry) => (
            <span className="font-semibold text-[var(--color-off-white)]">
              {entry.action}
            </span>
          ),
        },
        {
          key: 'entity',
          label: 'Entidad',
          render: (entry) => `${entry.entityType} / ${entry.entityId}`,
        },
        {
          key: 'actor',
          label: 'Actor',
          render: (entry) => entry.actorUserId ?? 'Sistema',
        },
        {
          key: 'date',
          label: 'Fecha',
          render: (entry) => new Date(entry.createdAt).toLocaleString('es-CO'),
        },
      ]}
    />
  );
}

export function ConfiguracionScreen({
  operations,
}: SectionScreenProps<'settings'>) {
  const settings = asRecord(operations.settings);
  const readiness = readinessFromSettings(settings);
  const readinessChecks = Array.isArray(readiness.checks)
    ? (readiness.checks as Array<Record<string, unknown>>)
    : [];
  const moduleReadiness = Array.isArray(settings.moduleReadiness)
    ? (settings.moduleReadiness as Array<Record<string, unknown>>)
    : [];
  const featureFlags = asRecord(settings.featureFlags);
  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="text-xl font-semibold text-[var(--color-off-white)]">
          Configuración de providers
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          Estado real sin exponer secretos. Los valores sensibles solo muestran
          si están configurados.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            [
              'Pagos',
              (
                operations.settings as {
                  payments?: {
                    pseProvider?: string;
                    wompiConfigured?: boolean;
                    payuConfigured?: boolean;
                  };
                }
              ).payments?.pseProvider ?? 'none',
            ],
            [
              'Shipping',
              (operations.settings as { shipping?: { provider?: string } })
                .shipping?.provider ?? 'none',
            ],
            [
              'Notificaciones',
              (
                operations.settings as {
                  notifications?: {
                    emailProvider?: string;
                    whatsappProvider?: string;
                  };
                }
              ).notifications?.emailProvider ?? 'none',
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                {label}
              </p>
              <p className="mt-2 text-xl font-semibold text-[var(--color-off-white)]">
                {String(value)}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-[1.5rem] border border-[var(--color-border)] bg-[#0d0d0d] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-off-white)]">
              Producción — Checklist de salida
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              PASS/FAIL explícito. No hay estado verde si faltan credenciales,
              dominio, email productivo o auth admin.
            </p>
          </div>
          <Badge variant={statusVariant(readiness.status)}>
            {textValue(readiness.status, 'BLOCKED_FOR_PRODUCTION')}
          </Badge>
        </div>
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {readinessChecks.map((check) => (
            <div
              key={String(check.key)}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--color-off-white)]">
                  {textValue(check.label)}
                </p>
                <Badge variant={statusVariant(check.status)}>
                  {String(check.status ?? 'fail').toUpperCase()}
                </Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                {textValue(check.message)}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-[1.5rem] border border-[var(--color-border)] bg-[#0d0d0d] p-5">
        <h2 className="text-xl font-semibold text-[var(--color-off-white)]">
          Readiness modular
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Estados permitidos por módulo. Los providers externos quedan
          bloqueados sin credenciales reales.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {moduleReadiness.map((module) => (
            <div
              key={String(module.module)}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-off-white)]">
                  {textValue(module.module)}
                </p>
                <Badge variant={statusVariant(module.status)}>
                  {textValue(module.status, 'PARTIAL')}
                </Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                Impacto: {textValue(module.productionImpact, 'operational')} ·
                Próximo paso: {textValue(module.nextAction)}
              </p>
              {Array.isArray(module.blockers) && module.blockers.length > 0 ? (
                <p className="mt-2 text-xs leading-5 text-[var(--color-error-red)]">
                  Bloquea: {(module.blockers as string[]).join(' | ')}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-[1.5rem] border border-[var(--color-border)] bg-[#0d0d0d] p-5">
        <h2 className="text-xl font-semibold text-[var(--color-off-white)]">
          Feature flags operativos
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Si una bandera está apagada o bloqueada por provider, el admin no debe
          ejecutar acción productiva.
        </p>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(featureFlags).map(([key, value]) => (
            <div
              key={key}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                {key}
              </span>
              <Badge variant={value === true ? 'success' : 'neutral'}>
                {value === true ? 'ON' : 'OFF'}
              </Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export const iamSectionAdapters = {
  usuarios: { Screen: UsuariosScreen },
  roles: { Screen: RolesScreen },
  auditoria: { Screen: AuditoriaScreen },
  configuracion: {
    Screen: ConfiguracionScreen,
    actions: [{ label: 'Revisar entorno', href: '/admin/reportes' }],
  },
} satisfies Record<
  'usuarios' | 'roles' | 'auditoria' | 'configuracion',
  SectionScreenAdapter
>;

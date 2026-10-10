import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { AdminTable } from '../shared/AdminTable';
import { OperationalNotice } from '../shared/OperationalNotice';
import { asRecord, textValue, statusVariant } from '../shared/display-values';
import type { SectionScreenAdapter, SectionScreenProps } from '../shared/types';
function guideSourceLabel(source: unknown) {
  const value = textValue(source, 'pending');
  const labels: Record<string, string> = {
    real_99envios: 'Guía real 99 Envíos',
    mock_99envios: 'Mock local/test',
    internal: 'Tracking interno',
    pending: 'Pendiente',
  };
  return labels[value] ?? value;
}

const pendingDocumentationItems = [
  'tracking directo 99 Envíos',
  'webhooks reales',
  'cancelación de guía',
  'recolecciones API',
  'wallet',
  'liquidaciones',
  'recaudo detallado',
  'devoluciones',
  'WhatsApp API',
  'envíos masivos',
  'consulta guía/preenvío',
  'ciudades DANE API',
  'sucursales API',
  'transportadoras disponibles API',
];

export function EnviosScreen({
  moduleKey,
  operations,
}: SectionScreenProps<'shipments' | 'shippingCapabilities'>) {
  const shippingCapabilities = asRecord(operations.shippingCapabilities);
  const providerConfig = asRecord(shippingCapabilities.providerConfig);
  return (
    <section className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-4">
        {[
          ['Provider', String(shippingCapabilities.provider ?? 'internal')],
          [
            'Modo',
            String(
              shippingCapabilities.mode ??
                providerConfig.status ??
                'pending_provider',
            ),
          ],
          [
            'Estado producción',
            String(
              providerConfig.status ??
                (shippingCapabilities.ready
                  ? 'sandbox_ready'
                  : 'pending_credentials'),
            ),
          ],
          [
            'COD',
            shippingCapabilities.supportsCashOnDelivery
              ? 'Disponible'
              : 'Pendiente',
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
              {label}
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--color-off-white)]">
              {value}
            </p>
          </div>
        ))}
      </div>
      {providerConfig.status === 'mock_local' ? (
        <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.08] p-4 text-sm leading-6 text-amber-100">
          <p className="font-semibold">Mock local/test activo</p>
          <p className="mt-1 text-amber-100/80">
            Las guías con prefijo MOCK99 son simuladas y no existen en el panel
            real de 99 Envíos.
          </p>
        </div>
      ) : null}
      {providerConfig.productionBlocked ? (
        <div className="rounded-2xl border border-red-400/25 bg-red-500/[0.08] p-4 text-sm leading-6 text-red-100">
          Producción bloqueada: la configuración actual no permite operar
          logística real con seguridad.
        </div>
      ) : null}
      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4 text-sm leading-6 text-amber-100">
        99 Envíos usa solo OpenAPI documentada: login JWT, cotización, preenvío,
        PDF y novedades. Tracking directo, webhooks, recolecciones, wallet y
        devoluciones quedan pending_documentation.
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {[
          ['Login JWT', '/api/v1/admin/shipping/login-test'],
          ['Cotizar', '/api/v1/admin/shipping/quote'],
          ['PDF guía', '/api/v1/admin/shipments/:shipmentId/label'],
          ['Novedades', '/api/v1/admin/shipping/branch-issues'],
          ['Rate limit', '/api/v1/admin/shipping/rate-limit'],
          ['Preenvío', '/api/v1/admin/orders/:orderId/shipment'],
        ].map(([label, endpoint]) => (
          <div
            key={label}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <p className="text-sm font-semibold text-[var(--color-off-white)]">
              {label}
            </p>
            <p className="mt-1 break-all text-xs text-[var(--color-text-secondary)]">
              {endpoint}
            </p>
          </div>
        ))}
      </div>
      <OperationalNotice
        status={operations.shipments.operationalState?.status}
        message={operations.shipments.operationalState?.message}
      />
      <AdminTable
        title={moduleKey === 'rastreo' ? 'Rastreo operativo' : 'Envíos'}
        description="Envíos persistentes con fuente explícita. Mock local/test nunca se presenta como guía real."
        rows={operations.shipments.data}
        columns={[
          {
            key: 'order',
            label: 'Pedido',
            render: (shipment) => (
              <span className="font-semibold text-[var(--color-off-white)]">
                {shipment.orderNumber}
              </span>
            ),
          },
          {
            key: 'provider',
            label: 'Provider',
            render: (shipment) => (
              <div className="grid gap-2">
                <Badge variant={statusVariant(shipment.productionState)}>
                  {shipment.provider}
                </Badge>
                <span className="text-xs">
                  {textValue(shipment.providerMode, 'pending_provider')}
                </span>
              </div>
            ),
          },
          {
            key: 'status',
            label: 'Estado',
            render: (shipment) => shipment.status,
          },
          {
            key: 'source',
            label: 'Fuente guía',
            render: (shipment) => (
              <div className="max-w-[18rem] space-y-2">
                <Badge variant={statusVariant(shipment.productionState)}>
                  {guideSourceLabel(shipment.guideSource)}
                </Badge>
                <p className="text-xs leading-5">
                  {shipment.guideNotice ?? 'Sin guía externa real.'}
                </p>
              </div>
            ),
          },
          {
            key: 'tracking',
            label: 'Guía',
            render: (shipment) => shipment.trackingNumber ?? 'Guía pendiente',
          },
          {
            key: 'reason',
            label: 'Selección',
            render: (shipment) =>
              shipment.selectedCarrierReason ?? 'Sin selección automática',
          },
          {
            key: 'actions',
            label: 'Acciones',
            render: (shipment) => (
              <Link
                className="text-[var(--color-industrial-yellow)] hover:underline"
                href={`/admin/envios/${shipment.id}`}
              >
                Detalle
              </Link>
            ),
          },
        ]}
      />
      <section className="rounded-[1.5rem] border border-[var(--color-border)] bg-[#0d0d0d] p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-off-white)]">
              Funciones no documentadas
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              No hay botón productivo activo para estas funciones hasta recibir
              endpoint oficial.
            </p>
          </div>
          <Badge variant="neutral">pending_documentation</Badge>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {pendingDocumentationItems.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-[var(--color-text-secondary)]"
            >
              <p className="font-semibold text-[var(--color-off-white)]">
                {item}
              </p>
              <p className="mt-1 text-xs leading-5">
                Función no documentada en la OpenAPI actual de 99 Envíos. No se
                activa en producción.
              </p>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

export function NotificacionesScreen({
  operations,
}: SectionScreenProps<'notifications'>) {
  return (
    <AdminTable
      title="Notificaciones local/test"
      description="Historial real de emails, WhatsApp interno y eventos de notificación sin exponer secretos."
      rows={operations.notifications.data}
      columns={[
        {
          key: 'event',
          label: 'Evento',
          render: (notification) => (
            <span className="font-semibold text-[var(--color-off-white)]">
              {notification.eventName}
            </span>
          ),
        },
        {
          key: 'channel',
          label: 'Canal',
          render: (notification) => (
            <Badge variant="info">{notification.channel}</Badge>
          ),
        },
        {
          key: 'status',
          label: 'Estado',
          render: (notification) => (
            <Badge
              variant={
                notification.status === 'sent'
                  ? 'success'
                  : notification.status === 'failed'
                    ? 'danger'
                    : 'warning'
              }
            >
              {notification.status}
            </Badge>
          ),
        },
        {
          key: 'provider',
          label: 'Provider',
          render: (notification) => notification.provider,
        },
        {
          key: 'subject',
          label: 'Asunto',
          render: (notification) => notification.subject ?? 'Sin asunto',
        },
        {
          key: 'attempts',
          label: 'Intentos',
          render: (notification) => notification.attempts,
        },
        {
          key: 'date',
          label: 'Fecha',
          render: (notification) =>
            new Date(notification.createdAt).toLocaleString('es-CO'),
        },
      ]}
    />
  );
}

export const logisticsSectionAdapters = {
  envios: { Screen: EnviosScreen },
  rastreo: { Screen: EnviosScreen },
  notificaciones: { Screen: NotificacionesScreen },
} satisfies Record<
  'envios' | 'rastreo' | 'notificaciones',
  SectionScreenAdapter
>;

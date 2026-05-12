import Link from 'next/link';
import type React from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AdminShell } from '@/components/layout/AdminShell';
import {
  getAdminCatalogSnapshot,
  getAdminModule,
  type AdminModuleKey,
} from '@/lib/admin/operations';
import { getAdminOperationalSnapshot } from '@/lib/admin/server-data';

interface AdminSectionPageProps {
  moduleKey: AdminModuleKey;
}

interface TableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
}

function AdminTable<T extends { id: string }>({
  title,
  description,
  columns,
  rows,
}: {
  title: string;
  description: string;
  columns: Array<TableColumn<T>>;
  rows: T[];
}) {
  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-[var(--color-border)] bg-[#0d0d0d]">
      <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-off-white)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p>
        </div>
        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
          {rows.length} registros
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="p-5">
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-sm text-[var(--color-text-secondary)]">
            Sin registros disponibles desde la fuente actual.
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} scope="col" className="px-5 py-3 font-semibold">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  {columns.map((column) => (
                    <td key={column.key} className="px-5 py-4 text-[var(--color-text-secondary)]">
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: 'operational' | 'api-ready' | 'needs-provider' | 'needs-backend-list' }) {
  const statusLabel = {
    operational: 'Operativo',
    'api-ready': 'API ready',
    'needs-provider': 'Provider pendiente',
    'needs-backend-list': 'Listado pendiente',
  }[status];

  return (
    <Badge variant={status === 'operational' ? 'success' : 'warning'}>
      {statusLabel}
    </Badge>
  );
}

function ModuleActionLinks({ moduleKey }: { moduleKey: AdminModuleKey }) {
  const actions: Partial<Record<AdminModuleKey, Array<{ label: string; href: string }>>> = {
    productos: [
      { label: 'Nuevo producto', href: '/admin/productos/nuevo' },
      { label: 'Ver storefront', href: '/productos' },
    ],
    marcas: [
      { label: 'Nueva marca', href: '/admin/marcas/nuevo' },
      { label: 'Ver marcas', href: '/marcas' },
    ],
    categorias: [
      { label: 'Nueva categoría', href: '/admin/categorias/nuevo' },
      { label: 'Ver categorías', href: '/categorias' },
    ],
    precios: [{ label: 'Revisar productos', href: '/admin/productos' }],
    inventario: [{ label: 'Revisar variantes', href: '/admin/precios' }],
    'contenido-legal': [{ label: 'Ver páginas legales', href: '/politica-de-privacidad' }],
    'contenido-footer': [{ label: 'Ver tienda', href: '/' }],
    configuracion: [{ label: 'Revisar entorno', href: '/admin/reportes' }],
    reportes: [{ label: 'Productos incompletos', href: '/admin/productos' }],
  };

  return (
    <div className="flex flex-wrap gap-3">
      {(actions[moduleKey] ?? [{ label: 'Volver al dashboard', href: '/admin/dashboard' }]).map((action) => (
        <Link key={action.href} href={action.href}>
          <Button variant="outline">{action.label}</Button>
        </Link>
      ))}
    </div>
  );
}

function OperationalNotice({
  status,
  message,
}: {
  status?: string;
  message?: string;
}) {
  if (!status && !message) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.08] p-4 text-sm text-amber-100">
      <p className="font-semibold">{status ?? 'Estado operativo'}</p>
      {message ? <p className="mt-1 text-amber-100/80">{message}</p> : null}
    </div>
  );
}

export async function AdminSectionPage({ moduleKey }: AdminSectionPageProps) {
  const adminModule = getAdminModule(moduleKey);
  const [snapshot, operations] = await Promise.all([
    getAdminCatalogSnapshot(),
    getAdminOperationalSnapshot(),
  ]);

  const productRows = snapshot.productRows.slice(0, 80);
  const variantRows = snapshot.variantRows.slice(0, 80);
  const brandRows = snapshot.brandRows.slice(0, 80);
  const categoryRows = snapshot.categoryRows.slice(0, 80);

  return (
    <AdminShell>
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-[var(--color-border)] bg-[linear-gradient(135deg,#121212_0%,#0b0b0b_62%,rgba(245,183,0,0.09)_100%)] p-5 shadow-elevated sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
                {adminModule.permission}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">
                {adminModule.title}
              </h1>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base sm:leading-7">
                {adminModule.description}
              </p>
            </div>
            <StatusBadge status={adminModule.status} />
          </div>
          <div className="mt-6">
            <ModuleActionLinks moduleKey={moduleKey} />
          </div>
        </section>

        {moduleKey === 'productos' ? (
          <AdminTable
            title="Productos"
            description="Listado real del catálogo público, con acciones seguras hacia edición y preview."
            rows={productRows}
            columns={[
              {
                key: 'product',
                label: 'Producto',
                render: (product) => (
                  <div>
                    <p className="font-semibold text-[var(--color-off-white)]">{product.name}</p>
                    <p className="mt-1 text-xs">{product.slug}</p>
                  </div>
                ),
              },
              {
                key: 'brand',
                label: 'Marca',
                render: (product) => product.brand?.name ?? 'Sin marca',
              },
              {
                key: 'category',
                label: 'Categoría',
                render: (product) => product.category?.name ?? 'Sin categoría',
              },
              {
                key: 'price',
                label: 'Precio',
                render: (product) => product.primaryPriceLabel ?? 'Cotizar',
              },
              {
                key: 'actions',
                label: 'Acciones',
                render: (product) => (
                  <div className="flex flex-wrap gap-2">
                    <Link className="text-[var(--color-industrial-yellow)] hover:underline" href={`/admin/productos/${product.id}`}>
                      Editar
                    </Link>
                    <Link className="text-[var(--color-industrial-yellow)] hover:underline" href={`/productos/${product.slug}`}>
                      Preview
                    </Link>
                  </div>
                ),
              },
            ]}
          />
        ) : null}

        {moduleKey === 'marcas' ? (
          <AdminTable
            title="Marcas"
            description="Marcas reales detectadas y administrables con slug, estado y asociación de productos."
            rows={brandRows}
            columns={[
              { key: 'name', label: 'Marca', render: (brand) => <span className="font-semibold text-[var(--color-off-white)]">{brand.name}</span> },
              { key: 'slug', label: 'Slug', render: (brand) => brand.slug },
              { key: 'products', label: 'Productos', render: (brand) => productRows.filter((product) => product.brand?.id === brand.id).length },
              { key: 'action', label: 'Acciones', render: (brand) => <Link className="text-[var(--color-industrial-yellow)] hover:underline" href={`/marcas/${brand.slug}`}>Preview</Link> },
            ]}
          />
        ) : null}

        {moduleKey === 'categorias' ? (
          <AdminTable
            title="Categorías"
            description="Taxonomía real del catálogo; no se muestran familias como contenido principal."
            rows={categoryRows}
            columns={[
              { key: 'name', label: 'Categoría', render: (category) => <span className="font-semibold text-[var(--color-off-white)]">{category.name}</span> },
              { key: 'slug', label: 'Slug', render: (category) => category.slug },
              { key: 'products', label: 'Productos', render: (category) => productRows.filter((product) => product.category?.id === category.id).length },
              { key: 'action', label: 'Acciones', render: (category) => <Link className="text-[var(--color-industrial-yellow)] hover:underline" href={`/categorias/${category.slug}`}>Preview</Link> },
            ]}
          />
        ) : null}

        {moduleKey === 'precios' || moduleKey === 'inventario' ? (
          <AdminTable
            title={moduleKey === 'precios' ? 'Precios y SKUs' : 'Inventario por variante'}
            description="Variantes reales del backend. Ajustes críticos deben ejecutarse con permiso y quedar auditados."
            rows={variantRows}
            columns={[
              { key: 'sku', label: 'SKU', render: (variant) => <span className="font-semibold text-[var(--color-off-white)]">{variant.sku}</span> },
              { key: 'name', label: 'Variante', render: (variant) => variant.name },
              { key: 'product', label: 'Producto', render: (variant) => variant.product?.name ?? 'Sin producto' },
              { key: 'price', label: 'Precio', render: (variant) => variant.price ? `$ ${Number(variant.price).toLocaleString('es-CO')}` : 'Cotizar' },
            ]}
          />
        ) : null}

        {moduleKey === 'pedidos' ? (
          <AdminTable
            title="Pedidos"
            description="Listado real de pedidos con cliente enmascarado, pago asociado y total confirmado."
            rows={operations.orders.data}
            columns={[
              { key: 'order', label: 'Pedido', render: (order) => <span className="font-semibold text-[var(--color-off-white)]">{order.orderNumber}</span> },
              { key: 'status', label: 'Estado', render: (order) => <Badge variant="info">{order.status}</Badge> },
              { key: 'customer', label: 'Cliente', render: (order) => <div><p>{order.customerName}</p><p className="text-xs">{order.customerEmail}</p></div> },
              { key: 'payment', label: 'Pago', render: (order) => order.paymentStatus ? <Badge variant="warning">{order.paymentStatus}</Badge> : 'Sin pago' },
              { key: 'total', label: 'Total', render: (order) => `$ ${Number(order.grandTotal).toLocaleString('es-CO')}` },
              { key: 'actions', label: 'Acciones', render: (order) => <Link className="text-[var(--color-industrial-yellow)] hover:underline" href={`/admin/pedidos/${order.id}`}>Detalle</Link> },
            ]}
          />
        ) : null}

        {moduleKey === 'cotizaciones' ? (
          <section className="space-y-4">
            <OperationalNotice
              status={operations.quotes.operationalState?.status}
              message={operations.quotes.operationalState?.message}
            />
            <AdminTable
              title="Cotizaciones"
              description="Cotizaciones persistentes con cliente enmascarado, items reales y estados auditables."
              rows={operations.quotes.data}
              columns={[
                { key: 'quote', label: 'Cotización', render: (quote) => <span className="font-semibold text-[var(--color-off-white)]">{quote.quoteNumber}</span> },
                { key: 'status', label: 'Estado', render: (quote) => <Badge variant={quote.status === 'converted_to_order' ? 'success' : 'warning'}>{quote.status}</Badge> },
                { key: 'customer', label: 'Cliente', render: (quote) => <div><p>{quote.customer.fullName}</p><p className="text-xs">{quote.customer.email}</p></div> },
                { key: 'items', label: 'Items', render: (quote) => quote.items.length },
                { key: 'total', label: 'Subtotal', render: (quote) => quote.subtotal ? `$ ${Number(quote.subtotal).toLocaleString('es-CO')}` : 'Sin precio' },
                { key: 'actions', label: 'Acciones', render: (quote) => <Link className="text-[var(--color-industrial-yellow)] hover:underline" href={`/admin/cotizaciones/${quote.id}`}>Detalle</Link> },
              ]}
            />
          </section>
        ) : null}

        {moduleKey === 'pagos' ? (
          <AdminTable
            title="Pagos"
            description="Pagos reales asociados a pedidos. PSE permanece cerrado si no hay provider configurado."
            rows={operations.payments.data}
            columns={[
              { key: 'order', label: 'Pedido', render: (payment) => payment.orderNumber },
              { key: 'gateway', label: 'Método', render: (payment) => <Badge variant="info">{payment.gateway}</Badge> },
              { key: 'status', label: 'Estado', render: (payment) => <Badge variant={payment.status === 'approved' ? 'success' : 'warning'}>{payment.status}</Badge> },
              { key: 'amount', label: 'Monto', render: (payment) => `$ ${Number(payment.amount).toLocaleString('es-CO')}` },
              { key: 'reference', label: 'Referencia', render: (payment) => payment.providerReference ?? 'Sin referencia externa' },
              { key: 'actions', label: 'Acciones', render: (payment) => <Link className="text-[var(--color-industrial-yellow)] hover:underline" href={`/admin/pagos/${payment.id}`}>Detalle</Link> },
            ]}
          />
        ) : null}

        {moduleKey === 'envios' || moduleKey === 'rastreo' ? (
          <section className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-4">
              {[
                ['Provider', String(operations.shippingCapabilities.provider ?? 'internal')],
                ['Modo', String(operations.shippingCapabilities.mode ?? 'pending_provider')],
                ['Listo', operations.shippingCapabilities.ready ? 'Sí' : 'No'],
                ['COD', operations.shippingCapabilities.supportsCashOnDelivery ? 'Disponible' : 'Pendiente'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">{label}</p>
                  <p className="mt-2 text-lg font-semibold text-[var(--color-off-white)]">{value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4 text-sm leading-6 text-amber-100">
              99 Envíos usa solo OpenAPI documentada: login JWT, cotización, preenvío, PDF y novedades. Tracking directo, webhooks, recolecciones, wallet y devoluciones quedan pending_documentation.
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
                <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-[var(--color-off-white)]">{label}</p>
                  <p className="mt-1 break-all text-xs text-[var(--color-text-secondary)]">{endpoint}</p>
                </div>
              ))}
            </div>
            <OperationalNotice
              status={operations.shipments.operationalState?.status}
              message={operations.shipments.operationalState?.message}
            />
            <AdminTable
              title={moduleKey === 'rastreo' ? 'Rastreo operativo' : 'Envíos'}
              description="Envíos persistentes. Guía, ruta y tracking solo aparecen si existen datos reales."
              rows={operations.shipments.data}
              columns={[
                { key: 'order', label: 'Pedido', render: (shipment) => <span className="font-semibold text-[var(--color-off-white)]">{shipment.orderNumber}</span> },
                { key: 'provider', label: 'Provider', render: (shipment) => <Badge variant={shipment.provider === 'none' ? 'warning' : 'info'}>{shipment.provider}</Badge> },
                { key: 'status', label: 'Estado', render: (shipment) => shipment.status },
                { key: 'tracking', label: 'Tracking', render: (shipment) => shipment.trackingNumber ?? 'Sin tracking real' },
                { key: 'route', label: 'Ruta', render: (shipment) => shipment.routeNumber ?? 'Sin ruta real' },
                { key: 'actions', label: 'Acciones', render: (shipment) => <Link className="text-[var(--color-industrial-yellow)] hover:underline" href={`/admin/envios/${shipment.id}`}>Detalle</Link> },
              ]}
            />
          </section>
        ) : null}

        {moduleKey === 'clientes' ? (
          <AdminTable
            title="Clientes"
            description="Clientes derivados de pedidos reales. PII enmascarada por defecto."
            rows={operations.customers.data}
            columns={[
              { key: 'name', label: 'Cliente', render: (customer) => <span className="font-semibold text-[var(--color-off-white)]">{customer.fullName}</span> },
              { key: 'email', label: 'Email', render: (customer) => customer.email ?? 'No disponible' },
              { key: 'phone', label: 'Teléfono', render: (customer) => customer.phone ?? 'No disponible' },
              { key: 'orders', label: 'Pedidos', render: (customer) => customer.ordersCount },
              { key: 'spent', label: 'Total', render: (customer) => `$ ${Number(customer.totalSpent).toLocaleString('es-CO')}` },
              { key: 'actions', label: 'Acciones', render: (customer) => <Link className="text-[var(--color-industrial-yellow)] hover:underline" href={`/admin/clientes/${encodeURIComponent(customer.id)}`}>Detalle</Link> },
            ]}
          />
        ) : null}

        {moduleKey === 'usuarios' ? (
          <AdminTable
            title="Usuarios"
            description="Usuarios internos reales. Email y teléfono se muestran protegidos."
            rows={operations.users.data}
            columns={[
              { key: 'name', label: 'Usuario', render: (user) => <span className="font-semibold text-[var(--color-off-white)]">{user.fullName}</span> },
              { key: 'email', label: 'Email', render: (user) => user.email },
              { key: 'role', label: 'Rol', render: (user) => user.role?.name ?? 'Sin rol' },
              { key: 'status', label: 'Estado', render: (user) => <Badge variant={user.isActive ? 'success' : 'warning'}>{user.isActive ? 'Activo' : 'Inactivo'}</Badge> },
              { key: 'mfa', label: '2FA', render: (user) => user.twoFactorEnabled ? 'Activo' : 'Pendiente' },
            ]}
          />
        ) : null}

        {moduleKey === 'roles' ? (
          <AdminTable
            title="Roles"
            description="Roles reales con conteo de permisos y usuarios asociados."
            rows={operations.roles.data}
            columns={[
              { key: 'name', label: 'Rol', render: (role) => <span className="font-semibold text-[var(--color-off-white)]">{role.name}</span> },
              { key: 'slug', label: 'Slug', render: (role) => role.slug },
              { key: 'users', label: 'Usuarios', render: (role) => role.usersCount },
              { key: 'permissions', label: 'Permisos', render: (role) => role.permissions.length },
              { key: 'modules', label: 'Módulos', render: (role) => Array.from(new Set(role.permissions.map((permission) => permission.module))).slice(0, 4).join(', ') },
            ]}
          />
        ) : null}

        {moduleKey === 'auditoria' ? (
          <AdminTable
            title="Auditoría"
            description="Acciones críticas registradas por el backend. Payloads sensibles quedan redactados."
            rows={operations.audit.data}
            columns={[
              { key: 'action', label: 'Acción', render: (entry) => <span className="font-semibold text-[var(--color-off-white)]">{entry.action}</span> },
              { key: 'entity', label: 'Entidad', render: (entry) => `${entry.entityType} / ${entry.entityId}` },
              { key: 'actor', label: 'Actor', render: (entry) => entry.actorUserId ?? 'Sistema' },
              { key: 'date', label: 'Fecha', render: (entry) => new Date(entry.createdAt).toLocaleString('es-CO') },
            ]}
          />
        ) : null}

        {moduleKey === 'notificaciones' ? (
          <AdminTable
            title="Notificaciones local/test"
            description="Historial real de emails, WhatsApp interno y eventos de notificación sin exponer secretos."
            rows={operations.notifications.data}
            columns={[
              { key: 'event', label: 'Evento', render: (notification) => <span className="font-semibold text-[var(--color-off-white)]">{notification.eventName}</span> },
              { key: 'channel', label: 'Canal', render: (notification) => <Badge variant="info">{notification.channel}</Badge> },
              { key: 'status', label: 'Estado', render: (notification) => <Badge variant={notification.status === 'sent' ? 'success' : notification.status === 'failed' ? 'danger' : 'warning'}>{notification.status}</Badge> },
              { key: 'provider', label: 'Provider', render: (notification) => notification.provider },
              { key: 'subject', label: 'Asunto', render: (notification) => notification.subject ?? 'Sin asunto' },
              { key: 'attempts', label: 'Intentos', render: (notification) => notification.attempts },
              { key: 'date', label: 'Fecha', render: (notification) => new Date(notification.createdAt).toLocaleString('es-CO') },
            ]}
          />
        ) : null}

        {moduleKey === 'contenido-legal' ? (
          <AdminTable<Record<string, unknown> & { id: string }>
            title="Workflow legal"
            description="Contenido legal existente con estado de revisión guardado en el backend."
            rows={operations.legal.data.map((row, index) => ({
              ...row,
              id: String(row.id ?? `legal-${index}`),
            }))}
            columns={[
              { key: 'title', label: 'Página', render: (row) => String(row.title ?? 'Sin título') },
              { key: 'status', label: 'Workflow', render: (row) => <Badge variant={row.workflowStatus === 'published' ? 'success' : 'warning'}>{String(row.workflowStatus ?? 'draft')}</Badge> },
              { key: 'published', label: 'Publicado', render: (row) => row.isPublished ? 'Sí' : 'No' },
              { key: 'updated', label: 'Actualizado', render: (row) => row.updatedAt ? new Date(String(row.updatedAt)).toLocaleString('es-CO') : 'Sin fecha' },
            ]}
          />
        ) : null}

        {moduleKey === 'contenido-footer' ? (
          <section className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="text-xl font-semibold text-[var(--color-off-white)]">Footer versionado</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              Footer editable con validación de links internos, revisión, aprobación y publicación auditada.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Versión actual</p>
                <p className="mt-2 text-xl font-semibold text-[var(--color-off-white)]">{String((operations.footer.data as { version?: number } | undefined)?.version ?? 'Pendiente')}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Estado</p>
                <p className="mt-2 text-xl font-semibold text-[var(--color-off-white)]">{String((operations.footer.data as { status?: string } | undefined)?.status ?? 'Sin revisión')}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Links</p>
                <p className="mt-2 text-xl font-semibold text-[var(--color-off-white)]">{((operations.footer.data as { links?: unknown[] } | undefined)?.links ?? []).length}</p>
              </div>
            </div>
          </section>
        ) : null}

        {moduleKey === 'configuracion' ? (
          <section className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="text-xl font-semibold text-[var(--color-off-white)]">Configuración de providers</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              Estado real sin exponer secretos. Los valores sensibles solo muestran si están configurados.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                ['Pagos', (operations.settings as { payments?: { pseProvider?: string; wompiConfigured?: boolean; payuConfigured?: boolean } }).payments?.pseProvider ?? 'none'],
                ['Shipping', (operations.settings as { shipping?: { provider?: string } }).shipping?.provider ?? 'none'],
                ['Notificaciones', (operations.settings as { notifications?: { emailProvider?: string; whatsappProvider?: string } }).notifications?.emailProvider ?? 'none'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">{label}</p>
                  <p className="mt-2 text-xl font-semibold text-[var(--color-off-white)]">{String(value)}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {moduleKey === 'reportes' ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ['Pedidos', operations.orders.meta?.total ?? 0, '/admin/pedidos'],
              ['Pagos', operations.payments.meta?.total ?? 0, '/admin/pagos'],
              ['Clientes', operations.customers.meta?.total ?? 0, '/admin/clientes'],
              ['Cotizaciones', operations.quotes.meta?.total ?? 0, '/admin/cotizaciones'],
            ].map(([label, value, href]) => (
              <Link key={label} href={String(href)} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-[var(--color-industrial-yellow)]">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">{label}</p>
                <p className="mt-3 text-3xl font-semibold text-[var(--color-off-white)]">{value}</p>
              </Link>
            ))}
          </section>
        ) : null}

        {moduleKey !== 'productos' &&
        moduleKey !== 'marcas' &&
        moduleKey !== 'categorias' &&
        moduleKey !== 'precios' &&
        moduleKey !== 'inventario' &&
        moduleKey !== 'pedidos' &&
        moduleKey !== 'cotizaciones' &&
        moduleKey !== 'pagos' &&
        moduleKey !== 'envios' &&
        moduleKey !== 'rastreo' &&
        moduleKey !== 'clientes' &&
        moduleKey !== 'usuarios' &&
        moduleKey !== 'roles' &&
        moduleKey !== 'auditoria' &&
        moduleKey !== 'notificaciones' &&
        moduleKey !== 'contenido-legal' &&
        moduleKey !== 'contenido-footer' &&
        moduleKey !== 'configuracion' &&
        moduleKey !== 'reportes' ? (
          <section className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="grid gap-5 lg:grid-cols-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-off-white)]">Estado operativo</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                  Este módulo tiene ruta protegida y contrato definido. No se inventan datos si falta provider, listado o flujo final.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-industrial-yellow)]">
                  Acciones permitidas
                </h3>
                <ul className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)]">
                  {adminModule.primaryActions.map((action) => (
                    <li key={action} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-industrial-yellow)]">
                  Bloqueos de producción
                </h3>
                <ul className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)]">
                  {adminModule.validations.map((validation) => (
                    <li key={validation} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      {validation}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        <section className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-off-white)]">Snapshot real</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Datos leídos del catálogo. Operación sin provider/listado se muestra como riesgo, no como dato simulado.
              </p>
            </div>
            <Link href="/admin/dashboard">
              <Button variant="outline">Dashboard</Button>
            </Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Productos', snapshot.products],
              ['Marcas', snapshot.brands],
              ['Categorías', snapshot.categories],
              ['Variantes', snapshot.variants],
              ['Sin precio', snapshot.productsWithoutPrice],
              ['Sin SKU', snapshot.productsWithoutSku],
              ['Sin imagen', snapshot.productsWithoutImage],
              ['Cotización', snapshot.quoteOnlyProducts],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--color-off-white)]">{value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

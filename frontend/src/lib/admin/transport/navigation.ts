export type AdminModuleKey =
  | 'dashboard'
  | 'productos'
  | 'marcas'
  | 'categorias'
  | 'inventario'
  | 'precios'
  | 'pedidos'
  | 'cotizaciones'
  | 'clientes'
  | 'pagos'
  | 'envios'
  | 'rastreo'
  | 'notificaciones'
  | 'contenido-legal'
  | 'contenido-footer'
  | 'configuracion'
  | 'usuarios'
  | 'roles'
  | 'auditoria'
  | 'reportes';

export interface AdminModuleConfig {
  key: AdminModuleKey;
  title: string;
  href: string;
  description: string;
  permission: string;
  status: AdminReadinessStatus;
  primaryActions: string[];
  validations: string[];
  endpoints: string[];
}

export type AdminReadinessStatus =
  | 'READY'
  | 'GO_WITH_RISKS'
  | 'PARTIAL'
  | 'BLOCKED_PROVIDER'
  | 'BLOCKED_CONFIGURATION'
  | 'MOCK_ONLY'
  | 'PENDING_DOCUMENTATION'
  | 'NO_GO';

export function adminStatusLabel(status: AdminReadinessStatus) {
  return {
    READY: 'READY',
    GO_WITH_RISKS: 'GO CON RIESGOS',
    PARTIAL: 'PARTIAL',
    BLOCKED_PROVIDER: 'BLOCKED_PROVIDER',
    BLOCKED_CONFIGURATION: 'BLOCKED_CONFIGURATION',
    MOCK_ONLY: 'MOCK_ONLY',
    PENDING_DOCUMENTATION: 'PENDING_DOCUMENTATION',
    NO_GO: 'NO_GO',
  }[status];
}

export function adminStatusVariant(status: AdminReadinessStatus) {
  if (status === 'READY') return 'success' as const;
  if (status === 'NO_GO' || status === 'BLOCKED_CONFIGURATION') return 'danger' as const;
  if (status === 'BLOCKED_PROVIDER' || status === 'MOCK_ONLY') return 'warning' as const;
  if (status === 'PENDING_DOCUMENTATION') return 'neutral' as const;
  return 'info' as const;
}

export function isAdminModuleReady(status: AdminReadinessStatus) {
  return status === 'READY';
}

export interface AdminNavigationGroup {
  title: string;
  items: AdminModuleConfig[];
}

export const adminModules: AdminModuleConfig[] = [
  {
    key: 'dashboard',
    title: 'Dashboard',
    href: '/admin/dashboard',
    description: 'KPIs reales disponibles y alertas de operación sin métricas inventadas.',
    permission: 'dashboard.read',
    status: 'READY',
    primaryActions: ['Revisar alertas', 'Abrir reportes', 'Auditar catálogo'],
    validations: ['Sin ventas falsas', 'Estados pendientes visibles', 'Lecturas desde catálogo real'],
    endpoints: ['/api/v1/admin/analytics/operational-metrics'],
  },
  {
    key: 'productos',
    title: 'Productos',
    href: '/admin/productos',
    description: 'Gestión real de producto, publicación, archivo y validación de vendibilidad.',
    permission: 'catalog.read',
    status: 'GO_WITH_RISKS',
    primaryActions: ['Crear producto', 'Editar producto', 'Activar/desactivar', 'Archivar', 'Validar vendibilidad'],
    validations: ['Slug único', 'SKU y precio requeridos para venta', 'Categoría requerida', 'Checkout bloquea no vendibles'],
    endpoints: ['/api/v1/admin/products', '/api/v1/admin/products/:id/archive', '/api/v1/admin/products/:id/validate-sellability', '/api/v1/admin/catalog/metrics'],
  },
  {
    key: 'marcas',
    title: 'Marcas',
    href: '/admin/marcas',
    description: 'Taxonomía real de marcas, estado y conteos de productos asociados.',
    permission: 'catalog.read',
    status: 'GO_WITH_RISKS',
    primaryActions: ['Crear marca', 'Editar marca', 'Activar/desactivar', 'Ver productos asociados'],
    validations: ['Slug único', 'No borrar con productos asociados', 'Cambios auditados'],
    endpoints: ['/api/v1/admin/brands', '/api/v1/admin/catalog/overview'],
  },
  {
    key: 'categorias',
    title: 'Categorías',
    href: '/admin/categorias',
    description: 'Jerarquía comercial real, slugs únicos y categorías activas.',
    permission: 'catalog.read',
    status: 'GO_WITH_RISKS',
    primaryActions: ['Crear categoría', 'Editar categoría', 'Ordenar jerarquía', 'Ver productos asociados'],
    validations: ['Slug único', 'Jerarquía sin ciclos', 'Cambios auditados'],
    endpoints: ['/api/v1/admin/categories', '/api/v1/admin/catalog/overview'],
  },
  {
    key: 'inventario',
    title: 'Inventario',
    href: '/admin/inventario',
    description: 'Stock, reservas, compromisos y ajustes auditados.',
    permission: 'inventory.read',
    status: 'READY',
    primaryActions: ['Ajustar stock', 'Ver kardex', 'Conteo físico', 'Import/export', 'Valorización'],
    validations: ['No stock negativo', 'Motivo requerido', 'Audit log obligatorio', 'Mutaciones sin inventory.read'],
    endpoints: ['/api/v1/admin/inventory/overview', '/api/v1/admin/inventory/history', '/api/v1/admin/inventory/imports/dry-run', '/api/v1/admin/inventory/export'],
  },
  {
    key: 'precios',
    title: 'Precios',
    href: '/admin/precios',
    description: 'Control real de precios por variante/SKU con historial auditado.',
    permission: 'catalog.read',
    status: 'GO_WITH_RISKS',
    primaryActions: ['Editar precio', 'Revisar sin precio', 'Ver historial', 'Validar impacto en venta'],
    validations: ['No precio negativo ni cero', 'Motivo requerido', 'Cambio auditado', 'Margen no disponible sin costo'],
    endpoints: ['/api/v1/admin/prices/:variantId', '/api/v1/admin/prices/history', '/api/v1/admin/catalog/overview'],
  },
  {
    key: 'pedidos',
    title: 'Pedidos',
    href: '/admin/pedidos',
    description: 'Detalle, cancelación y estados de pedidos protegidos por permiso.',
    permission: 'orders.read',
    status: 'READY',
    primaryActions: ['Ver detalle', 'Cancelar con permiso', 'Revisar pago/envío'],
    validations: ['No transición inválida', 'No marcar pagado sin permiso', 'PII mínima'],
    endpoints: ['/api/v1/admin/orders', '/api/v1/admin/orders/:orderId', '/api/v1/admin/orders/:orderId/status'],
  },
  {
    key: 'cotizaciones',
    title: 'Cotizaciones',
    href: '/admin/cotizaciones',
    description: 'Solicitudes por asesoría y productos sin precio confirmable.',
    permission: 'quotes.read',
    status: 'PARTIAL',
    primaryActions: ['Revisar solicitud', 'Asignar precio', 'Convertir a pedido'],
    validations: ['No precio automático', 'Usuario y fecha requeridos', 'Canal configurado para enviar'],
    endpoints: ['/api/v1/admin/quotes'],
  },
  {
    key: 'clientes',
    title: 'Clientes',
    href: '/admin/clientes',
    description: 'Consulta operativa con PII enmascarada por defecto.',
    permission: 'customers.read',
    status: 'READY',
    primaryActions: ['Buscar cliente', 'Ver pedidos', 'Exportar con permiso'],
    validations: ['PII enmascarada', 'Exportación auditada', 'Sin analytics con PII'],
    endpoints: ['/api/v1/admin/customers'],
  },
  {
    key: 'pagos',
    title: 'Pagos',
    href: '/admin/pagos',
    description: 'Estados de pago, PSE cerrado sin provider y COD conciliable.',
    permission: 'payments.read',
    status: 'BLOCKED_PROVIDER',
    primaryActions: ['Consultar pago', 'Reconciliar COD', 'Revisar errores provider'],
    validations: ['No fingir PSE', 'No providerReference inventado', 'Cash collected solo autorizado'],
    endpoints: ['/api/v1/admin/payments', '/api/v1/admin/payments/:paymentId/events'],
  },
  {
    key: 'envios',
    title: 'Envíos',
    href: '/admin/envios',
    description: '99 Envíos documentado: login JWT, cotización, preenvío, PDF y novedades. Lo no documentado queda bloqueado sin fingir producción.',
    permission: 'shipping.read',
    status: 'BLOCKED_PROVIDER',
    primaryActions: ['Probar login', 'Cotizar envío', 'Crear preenvío', 'Descargar PDF', 'Sincronizar novedades'],
    validations: ['Provider real bloqueado sin credenciales', 'DANE requerido para guía', 'Tracking directo/webhooks/recolecciones pending_documentation'],
    endpoints: ['/api/v1/admin/shipping/login-test', '/api/v1/admin/shipping/quote', '/api/v1/admin/orders/:orderId/shipment', '/api/v1/admin/shipments/:shipmentId/label', '/api/v1/admin/shipping/branch-issues'],
  },
  {
    key: 'rastreo',
    title: 'Rastreo',
    href: '/admin/rastreo',
    description: 'Control operativo de búsqueda de pedidos y estado logístico.',
    permission: 'shipping.read',
    status: 'GO_WITH_RISKS',
    primaryActions: ['Buscar pedido', 'Sincronizar provider', 'Ver eventos', 'Abrir rastreo público'],
    validations: ['No mostrar PII innecesaria', 'No inventar tracking', 'Estado desconocido no rompe'],
    endpoints: ['/api/v1/admin/shipments/:shipmentId/tracking', '/api/v1/orders/track?query='],
  },
  {
    key: 'notificaciones',
    title: 'Notificaciones',
    href: '/admin/notificaciones',
    description: 'Emails local/test, estados de entrega, preview seguro y provider productivo pendiente.',
    permission: 'notifications.read',
    status: 'BLOCKED_PROVIDER',
    primaryActions: ['Ver historial', 'Revisar fallos', 'Validar provider local/test'],
    validations: ['No fingir envío productivo', 'No exponer secretos', 'Preview sin tokens'],
    endpoints: ['/api/v1/admin/notifications'],
  },
  {
    key: 'contenido-legal',
    title: 'Legal',
    href: '/admin/legal',
    description: 'Administración de contenido legal con revisión obligatoria.',
    permission: 'legal.read',
    status: 'PARTIAL',
    primaryActions: ['Editar borrador', 'Previsualizar', 'Marcar revisión', 'Publicar'],
    validations: ['Sin lorem ipsum', 'Sin datos legales inventados', 'HTML sanitizado'],
    endpoints: ['/api/v1/admin/content/legal'],
  },
  {
    key: 'contenido-footer',
    title: 'Footer',
    href: '/admin/footer',
    description: 'Links, contacto y navegación pública sin enlaces muertos.',
    permission: 'footer.read',
    status: 'PARTIAL',
    primaryActions: ['Editar enlaces', 'Validar rutas', 'Publicar footer'],
    validations: ['No href #', 'Rutas 200', 'Mobile sin saturación'],
    endpoints: ['/api/v1/admin/content/footer'],
  },
  {
    key: 'configuracion',
    title: 'Configuración',
    href: '/admin/configuracion',
    description: 'Providers, datos generales, pagos, envíos, notificaciones y legal.',
    permission: 'settings.read',
    status: 'BLOCKED_CONFIGURATION',
    primaryActions: ['Revisar providers', 'Actualizar datos públicos', 'Validar secretos'],
    validations: ['No exponer secrets', 'Mostrar configurado/no configurado', 'Cambios auditados'],
    endpoints: ['/api/v1/admin/settings', 'ENV backend', 'provider ports'],
  },
  {
    key: 'usuarios',
    title: 'Usuarios',
    href: '/admin/usuarios',
    description: 'Usuarios internos, estado y acceso al panel.',
    permission: 'users.read',
    status: 'GO_WITH_RISKS',
    primaryActions: ['Crear usuario', 'Editar usuario', 'Desactivar usuario'],
    validations: ['No dejar sistema sin admin', '2FA requerido', 'Audit log'],
    endpoints: ['/api/v1/admin/users'],
  },
  {
    key: 'roles',
    title: 'Roles',
    href: '/admin/roles',
    description: 'Roles y permisos de operación interna.',
    permission: 'permissions.read',
    status: 'GO_WITH_RISKS',
    primaryActions: ['Crear rol', 'Asignar permisos', 'Asignar usuario'],
    validations: ['SUPER_ADMIN protegido', 'Permisos server-side', 'Audit log'],
    endpoints: ['/api/v1/admin/roles', '/api/v1/admin/permissions/matrix'],
  },
  {
    key: 'auditoria',
    title: 'Auditoría',
    href: '/admin/auditoria',
    description: 'Registro de acciones críticas y eventos de seguridad.',
    permission: 'audit.read',
    status: 'GO_WITH_RISKS',
    primaryActions: ['Filtrar eventos', 'Ver cambios', 'Revisar usuario/acción'],
    validations: ['Solo lectura', 'No secrets', 'PII mínima'],
    endpoints: ['/api/v1/admin/audit'],
  },
  {
    key: 'reportes',
    title: 'Reportes',
    href: '/admin/reportes',
    description: 'Reportes de catálogo y operación sin datos inventados.',
    permission: 'reports.read',
    status: 'READY',
    primaryActions: ['Productos incompletos', 'Pedidos por estado', 'Pagos/envíos por estado'],
    validations: ['Sin tracking falso', 'Sin ventas inventadas', 'Tablas antes que gráficas pesadas'],
    endpoints: ['/api/v1/admin/analytics/*'],
  },
];

const moduleGroups: Array<{ title: string; keys: AdminModuleKey[] }> = [
  { title: 'Control', keys: ['dashboard', 'reportes'] },
  {
    title: 'Catálogo',
    keys: ['productos', 'marcas', 'categorias', 'inventario', 'precios'],
  },
  {
    title: 'Operación',
    keys: ['pedidos', 'cotizaciones', 'clientes', 'pagos', 'envios', 'rastreo', 'notificaciones'],
  },
  { title: 'Contenido', keys: ['contenido-legal', 'contenido-footer'] },
  { title: 'Sistema', keys: ['configuracion', 'usuarios', 'roles', 'auditoria'] },
];

export const adminNavigationGroups: AdminNavigationGroup[] = moduleGroups.map((group) => ({
  title: group.title,
  items: group.keys
    .map((key) => adminModules.find((module) => module.key === key))
    .filter((module): module is AdminModuleConfig => Boolean(module)),
}));

export function getAdminModule(key: AdminModuleKey) {
  return adminModules.find((module) => module.key === key) ?? adminModules[0];
}

// Entry permissions mirror each current page's guarded GET, not write capabilities.
export function getAdminNavigationGroups(permissions: readonly string[]): AdminNavigationGroup[] {
  const allowed = new Set(permissions);
  return adminNavigationGroups
    .map(group => ({ ...group, items: group.items.filter(module => allowed.has(module.permission)) }))
    .filter(group => group.items.length > 0);
}

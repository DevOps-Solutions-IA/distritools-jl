import { listBrands } from '@/lib/api/brands';
import { listCategories } from '@/lib/api/categories';
import { listProducts, listVariants } from '@/lib/api/products';
import { mapProduct } from '@/features/catalog/mappers';

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
  status: 'operational' | 'api-ready' | 'needs-provider' | 'needs-backend-list';
  primaryActions: string[];
  validations: string[];
  endpoints: string[];
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
    permission: 'analytics.read',
    status: 'operational',
    primaryActions: ['Revisar alertas', 'Abrir reportes', 'Auditar catálogo'],
    validations: ['Sin ventas falsas', 'Estados pendientes visibles', 'Lecturas desde catálogo real'],
    endpoints: ['/api/v1/admin/analytics/operational-metrics'],
  },
  {
    key: 'productos',
    title: 'Productos',
    href: '/admin/productos',
    description: 'Gestión de producto, publicación, archivo y validación comercial.',
    permission: 'products.manage',
    status: 'operational',
    primaryActions: ['Crear producto', 'Editar producto', 'Publicar/archivar', 'Vista pública'],
    validations: ['Slug único', 'Marca requerida', 'Categoría requerida', 'Sellable exige precio y SKU'],
    endpoints: ['/api/v1/admin/products', '/api/v1/admin/variants'],
  },
  {
    key: 'marcas',
    title: 'Marcas',
    href: '/admin/marcas',
    description: 'Taxonomía de marcas, estado, assets autorizados y SEO.',
    permission: 'brands.manage',
    status: 'operational',
    primaryActions: ['Crear marca', 'Editar marca', 'Activar/desactivar', 'Validar assets'],
    validations: ['Slug único', 'No borrar con productos', 'No afirmar distribución oficial'],
    endpoints: ['/api/v1/admin/brands'],
  },
  {
    key: 'categorias',
    title: 'Categorías',
    href: '/admin/categorias',
    description: 'Jerarquía comercial, slugs, SEO y categorías activas.',
    permission: 'categories.manage',
    status: 'operational',
    primaryActions: ['Crear categoría', 'Editar categoría', 'Ordenar jerarquía'],
    validations: ['Slug único', 'Evitar duplicados', 'No romper productos asociados'],
    endpoints: ['/api/v1/admin/categories'],
  },
  {
    key: 'inventario',
    title: 'Inventario',
    href: '/admin/inventario',
    description: 'Stock, reservas, compromisos y ajustes auditados.',
    permission: 'inventory.adjust',
    status: 'operational',
    primaryActions: ['Ajustar stock', 'Ver movimientos', 'Detectar stock bajo'],
    validations: ['No stock negativo', 'Motivo requerido', 'Audit log obligatorio'],
    endpoints: ['/api/v1/admin/inventory', '/api/v1/admin/inventory/movements'],
  },
  {
    key: 'precios',
    title: 'Precios',
    href: '/admin/precios',
    description: 'Control de precios por variante y productos pendientes de precio.',
    permission: 'variants.manage',
    status: 'operational',
    primaryActions: ['Editar precio', 'Revisar sin precio', 'Validar SKU'],
    validations: ['No precio negativo', 'Sellable no puede quedar sin precio', 'Cambio auditado'],
    endpoints: ['/api/v1/admin/variants'],
  },
  {
    key: 'pedidos',
    title: 'Pedidos',
    href: '/admin/pedidos',
    description: 'Detalle, cancelación y estados de pedidos protegidos por permiso.',
    permission: 'orders.read',
    status: 'operational',
    primaryActions: ['Ver detalle', 'Cancelar con permiso', 'Revisar pago/envío'],
    validations: ['No transición inválida', 'No marcar pagado sin permiso', 'PII mínima'],
    endpoints: ['/api/v1/admin/orders', '/api/v1/admin/orders/:orderId', '/api/v1/admin/orders/:orderId/status'],
  },
  {
    key: 'cotizaciones',
    title: 'Cotizaciones',
    href: '/admin/cotizaciones',
    description: 'Solicitudes por asesoría y productos sin precio confirmable.',
    permission: 'orders.read',
    status: 'api-ready',
    primaryActions: ['Revisar solicitud', 'Asignar precio', 'Convertir a pedido'],
    validations: ['No precio automático', 'Usuario y fecha requeridos', 'Canal configurado para enviar'],
    endpoints: ['/api/v1/admin/quotes'],
  },
  {
    key: 'clientes',
    title: 'Clientes',
    href: '/admin/clientes',
    description: 'Consulta operativa con PII enmascarada por defecto.',
    permission: 'orders.read',
    status: 'operational',
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
    status: 'operational',
    primaryActions: ['Consultar pago', 'Reconciliar COD', 'Revisar errores provider'],
    validations: ['No fingir PSE', 'No providerReference inventado', 'Cash collected solo autorizado'],
    endpoints: ['/api/v1/admin/payments', '/api/v1/admin/payments/:paymentId/events'],
  },
  {
    key: 'envios',
    title: 'Envíos',
    href: '/admin/envios',
    description: '99 Envíos API-ready: cotización, guía, etiqueta, tracking, recolección, COD, novedades y devoluciones sin fingir producción.',
    permission: 'shipping.read',
    status: 'operational',
    primaryActions: ['Cotizar envío', 'Crear guía', 'Descargar etiqueta', 'Programar recolección', 'Ver COD/novedades'],
    validations: ['Provider real bloqueado sin credenciales', 'Mock solo local/test', 'Guía solo si provider responde'],
    endpoints: ['/api/v1/admin/shipping/capabilities', '/api/v1/admin/orders/:orderId/shipment', '/api/v1/webhooks/99envios'],
  },
  {
    key: 'rastreo',
    title: 'Rastreo',
    href: '/admin/rastreo',
    description: 'Control operativo de búsqueda de pedidos y estado logístico.',
    permission: 'tracking.read',
    status: 'operational',
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
    status: 'operational',
    primaryActions: ['Ver historial', 'Revisar fallos', 'Validar provider local/test'],
    validations: ['No fingir envío productivo', 'No exponer secretos', 'Preview sin tokens'],
    endpoints: ['/api/v1/admin/notifications'],
  },
  {
    key: 'contenido-legal',
    title: 'Legal',
    href: '/admin/contenido/legal',
    description: 'Administración de contenido legal con revisión obligatoria.',
    permission: 'content.manage',
    status: 'operational',
    primaryActions: ['Editar borrador', 'Previsualizar', 'Marcar revisión', 'Publicar'],
    validations: ['Sin lorem ipsum', 'Sin datos legales inventados', 'HTML sanitizado'],
    endpoints: ['/api/v1/admin/content/legal'],
  },
  {
    key: 'contenido-footer',
    title: 'Footer',
    href: '/admin/contenido/footer',
    description: 'Links, contacto y navegación pública sin enlaces muertos.',
    permission: 'content.manage',
    status: 'operational',
    primaryActions: ['Editar enlaces', 'Validar rutas', 'Publicar footer'],
    validations: ['No href #', 'Rutas 200', 'Mobile sin saturación'],
    endpoints: ['/api/v1/admin/content/footer'],
  },
  {
    key: 'configuracion',
    title: 'Configuración',
    href: '/admin/configuracion',
    description: 'Providers, datos generales, pagos, envíos, notificaciones y legal.',
    permission: 'content.manage',
    status: 'api-ready',
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
    status: 'operational',
    primaryActions: ['Crear usuario', 'Editar usuario', 'Desactivar usuario'],
    validations: ['No dejar sistema sin admin', '2FA requerido', 'Audit log'],
    endpoints: ['/api/v1/admin/users'],
  },
  {
    key: 'roles',
    title: 'Roles',
    href: '/admin/roles',
    description: 'Roles y permisos de operación interna.',
    permission: 'roles.update',
    status: 'operational',
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
    status: 'operational',
    primaryActions: ['Filtrar eventos', 'Ver cambios', 'Revisar usuario/acción'],
    validations: ['Solo lectura', 'No secrets', 'PII mínima'],
    endpoints: ['/api/v1/admin/audit'],
  },
  {
    key: 'reportes',
    title: 'Reportes',
    href: '/admin/reportes',
    description: 'Reportes de catálogo y operación sin datos inventados.',
    permission: 'analytics.read',
    status: 'operational',
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

export async function getAdminCatalogSnapshot() {
  try {
    const [brands, categories, products, variants] = await Promise.all([
      listBrands(),
      listCategories(),
      listProducts(),
      listVariants(),
    ]);

    const variantsByProductId = new Map<string, typeof variants>();
    for (const variant of variants) {
      if (!variant.productId) {
        continue;
      }
      const current = variantsByProductId.get(variant.productId) ?? [];
      current.push(variant);
      variantsByProductId.set(variant.productId, current);
    }

    const catalogProducts = products.map((product) =>
      mapProduct(product, variantsByProductId.get(product.id) ?? []),
    );

    return {
      available: true,
      brands: brands.length,
      categories: categories.length,
      products: products.length,
      variants: variants.length,
      brandRows: brands,
      categoryRows: categories,
      productRows: catalogProducts,
      variantRows: variants,
      productsWithoutPrice: catalogProducts.filter((product) => product.primaryPrice === null).length,
      productsWithoutSku: catalogProducts.filter((product) => !product.primarySku).length,
      productsWithoutImage: catalogProducts.filter((product) => product.image.status !== 'approved').length,
      quoteOnlyProducts: catalogProducts.filter((product) => product.primaryPrice === null).length,
    };
  } catch {
    return {
      available: false,
      brands: 0,
      categories: 0,
      products: 0,
      variants: 0,
      brandRows: [],
      categoryRows: [],
      productRows: [],
      variantRows: [],
      productsWithoutPrice: 0,
      productsWithoutSku: 0,
      productsWithoutImage: 0,
      quoteOnlyProducts: 0,
    };
  }
}

export function getAdminModule(key: AdminModuleKey) {
  return adminModules.find((module) => module.key === key) ?? adminModules[0];
}

import type { ComponentType } from 'react';
import {
  getAdminOperationalSnapshot,
  type AdminOperationalSnapshot,
  type OperationalKey,
  type AdminReadQuery,
} from '@/lib/admin/server-data';
import {
  getAdminCatalogSnapshot,
  type AdminModuleConfig,
  type AdminModuleKey,
} from '@/lib/admin/operations';
import {
  PedidosScreen,
  PagosScreen,
} from '../screen-adapters/sales/SectionScreens';
import {
  CotizacionesScreen,
  ClientesScreen,
} from '../screen-adapters/crm/SectionScreens';
import {
  EnviosScreen,
  NotificacionesScreen,
} from '../screen-adapters/logistics/SectionScreens';
import {
  LegalScreen,
  FooterScreen,
} from '../screen-adapters/content/SectionScreens';
import {
  UsuariosScreen,
  RolesScreen,
  AuditoriaScreen,
  ConfiguracionScreen,
} from '../screen-adapters/iam/SectionScreens';
import {
  InventarioScreen,
  PreciosScreen,
} from '../screen-adapters/inventory/SectionScreens';
import {
  ProductosScreen,
  MarcasScreen,
  CategoriasScreen,
} from '../screen-adapters/catalog/SectionScreens';
import { ReportesScreen } from '../screen-adapters/control/SectionScreens';
import { SectionQueryControls } from './SectionQueryControls';
import { paginationMeta } from './query';
import { CompatibilityFallback } from '../screen-adapters/shared/CompatibilityFallback';

type Context = {
  moduleKey: AdminModuleKey;
  adminModule: AdminModuleConfig;
  query?: AdminReadQuery;
};
type OperationalProps<K extends OperationalKey> = Context & {
  snapshot: null;
  operations: Pick<AdminOperationalSnapshot, K>;
};
async function operational<K extends OperationalKey>(
  Screen: ComponentType<OperationalProps<K>>,
  keys: readonly K[],
  context: Context,
) {
  const operations =
    context.query && Object.keys(context.query).length
      ? await getAdminOperationalSnapshot(keys, context.query)
      : await getAdminOperationalSnapshot(keys);
  // Runtime contract must contain every selected dataset before entering a strong domain adapter.
  for (const key of keys)
    if (!(key in operations))
      throw new Error(`Missing administrative dataset: ${key}`);
  return (
    <>
      <SectionQueryControls
        moduleKey={context.moduleKey}
        query={context.query ?? {}}
        meta={paginationMeta(operations[keys[0]])}
      />
      <Screen {...context} snapshot={null} operations={operations} />
    </>
  );
}

export async function renderAdminSection(context: Context) {
  switch (context.moduleKey) {
    case 'pedidos':
      return operational(PedidosScreen, ['orders'], context);
    case 'pagos':
      return operational(PagosScreen, ['payments'], context);
    case 'cotizaciones':
      return operational(CotizacionesScreen, ['quotes'], context);
    case 'clientes':
      return operational(ClientesScreen, ['customers'], context);
    case 'envios':
    case 'rastreo':
      return operational(
        EnviosScreen,
        ['shipments', 'shippingCapabilities'],
        context,
      );
    case 'notificaciones':
      return operational(NotificacionesScreen, ['notifications'], context);
    case 'contenido-legal':
      return operational(LegalScreen, ['legal'], context);
    case 'contenido-footer':
      return operational(FooterScreen, ['footer'], context);
    case 'usuarios':
      return operational(UsuariosScreen, ['users'], context);
    case 'roles':
      return operational(RolesScreen, ['roles'], context);
    case 'auditoria':
      return operational(AuditoriaScreen, ['audit'], context);
    case 'configuracion':
      return operational(ConfiguracionScreen, ['settings'], context);
    case 'inventario':
      return operational(
        InventarioScreen,
        [
          'inventoryOverview',
          'inventoryWarehouses',
          'inventoryAlerts',
          'inventoryValuation',
          'inventoryReservations',
        ],
        context,
      );
    case 'reportes':
      return operational(
        ReportesScreen,
        ['orders', 'payments', 'customers', 'quotes'],
        context,
      );
    case 'productos':
    case 'marcas':
    case 'categorias':
    case 'precios': {
      const snapshot = await getAdminCatalogSnapshot();
      const Screen = {
        productos: ProductosScreen,
        marcas: MarcasScreen,
        categorias: CategoriasScreen,
        precios: PreciosScreen,
      }[context.moduleKey];
      return <Screen {...context} snapshot={snapshot} operations={{}} />;
    }
    default:
      return <CompatibilityFallback adminModule={context.adminModule} />;
  }
}

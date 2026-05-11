export interface LegalPageContent {
  slug: string;
  title: string;
  description: string;
  updatedAt: string;
  effectiveAt: string;
  version: string;
  reviewStatus: 'pending_legal_review';
  responsible: string;
  contactHref: string;
  seo: {
    title: string;
    description: string;
  };
  sections: Array<{
    title: string;
    body: string;
  }>;
}

const pendingNotice =
  'Documento estructurado para operación ecommerce real, pendiente de revisión jurídica y de completar datos oficiales del comercio. No constituye versión legal definitiva aprobada.';

const companyPending =
  `Responsable pendiente: [RAZÓN SOCIAL PENDIENTE], NIT [NIT PENDIENTE], domicilio [DOMICILIO PRINCIPAL PENDIENTE], dirección [DIRECCIÓN COMERCIAL PENDIENTE]. Canal temporal de soporte: ${storefrontContactConfig.email}. Base operativa temporal: ${storefrontContactConfig.base}.`;

export const legalPages: LegalPageContent[] = [
  {
    slug: 'politica-de-privacidad',
    title: 'Política de privacidad',
    description:
      'Tratamiento de datos para compras, cotizaciones, pagos, envíos, soporte, garantías y navegación del sitio.',
    updatedAt: '2026-04-29',
    effectiveAt: 'Pendiente de aprobación legal',
    version: '1.0-draft',
    reviewStatus: 'pending_legal_review',
    responsible: '[RESPONSABLE DEL TRATAMIENTO PENDIENTE]',
    contactHref: '/contacto',
    seo: {
      title: 'Política de privacidad | DistriTools JL',
      description: 'Política de privacidad estructurada para revisión legal y operación ecommerce.',
    },
    sections: [
      { title: 'Estado del documento', body: pendingNotice },
      { title: 'Identificación del responsable', body: companyPending },
      { title: 'Alcance', body: 'Aplica a datos recolectados en el sitio, paneles de pedido, cotización, atención comercial, pagos disponibles, coordinación logística y solicitudes posventa.' },
      { title: 'Datos recolectados', body: 'Identificación, contacto, datos de compra, cotización, entrega, facturación si aplica, soporte, garantías, navegación técnica y preferencias autorizadas. No se solicitan datos sensibles salvo obligación legal o autorización expresa y necesaria.' },
      { title: 'Finalidades', body: 'Procesar compras, gestionar cotizaciones, coordinar entregas, validar pagos, responder soporte, atender garantías, prevenir fraude, cumplir obligaciones legales y enviar comunicaciones autorizadas.' },
      { title: 'Pagos, PSE y terceros', body: 'PSE o pasarelas solo se tratarán como activos cuando exista proveedor real configurado. Los datos de pago se transmitirán al proveedor autorizado cuando corresponda; no se promete aprobación automática sin confirmación del proveedor.' },
      { title: 'Envíos y transportadoras', body: 'Los datos de entrega podrán compartirse con la transportadora configurada únicamente cuando exista operación logística real. Si no hay provider activo, la entrega queda pendiente de confirmación operativa.' },
      { title: 'Notificaciones', body: 'Email, WhatsApp o CRM solo se usarán si el canal está configurado y autorizado. El sistema no marca comunicaciones como enviadas cuando no hay proveedor real.' },
      { title: 'Conservación', body: 'Los datos se conservarán durante el tiempo necesario para la relación comercial, soporte, garantías, auditoría, obligaciones contables, fiscales, legales y defensa de reclamaciones. No se promete eliminación inmediata cuando exista deber de conservación.' },
      { title: 'Derechos del titular', body: 'El titular podrá consultar, actualizar, rectificar, solicitar prueba de autorización, revocar autorizaciones o pedir supresión cuando sea procedente. Canal pendiente: [CANAL DE RECLAMOS PENDIENTE].' },
      { title: 'Consultas y reclamos', body: 'La solicitud deberá incluir identificación del titular, datos de contacto, descripción clara y soportes. El procedimiento y tiempos serán definidos por revisión legal antes de publicación definitiva.' },
      { title: 'Cookies y analítica', body: 'El sitio puede usar cookies técnicas y analítica si se habilitan. Las cookies no esenciales deberán informarse y gestionarse conforme a la política aprobada.' },
      { title: 'Menores de edad', body: 'El sitio no está dirigido a menores. Si participa un menor, debe actuar mediante adulto responsable cuando aplique.' },
      { title: 'Seguridad', body: 'Se aplican controles de acceso, enmascaramiento de PII en administración, auditoría de acciones sensibles y restricción de secretos al backend.' },
      { title: 'Cambios y vigencia', body: 'Los cambios se versionan y deben pasar por revisión antes de publicación. Vigencia definitiva pendiente de aprobación legal.' },
    ],
  },
  {
    slug: 'tratamiento-de-datos',
    title: 'Política de tratamiento de datos personales',
    description:
      'Marco de autorización, principios, finalidades, derechos, consultas y reclamos para titulares de datos.',
    updatedAt: '2026-04-29',
    effectiveAt: 'Pendiente de aprobación legal',
    version: '1.0-draft',
    reviewStatus: 'pending_legal_review',
    responsible: '[RESPONSABLE DEL TRATAMIENTO PENDIENTE]',
    contactHref: '/contacto',
    seo: {
      title: 'Tratamiento de datos personales | DistriTools JL',
      description: 'Política de tratamiento de datos preparada para revisión jurídica.',
    },
    sections: [
      { title: 'Estado del documento', body: pendingNotice },
      { title: 'Responsable y encargados', body: `${companyPending} Encargados pendientes de confirmar: pasarela de pago, transportadora, proveedor de email, CRM o analítica si se habilitan.` },
      { title: 'Definiciones', body: 'Titular: persona natural dueña del dato. Dato personal: información asociada al titular. Dato sensible: información con protección reforzada. Tratamiento: recolección, uso, almacenamiento, circulación o supresión. Responsable: quien decide sobre el tratamiento. Encargado: quien trata datos por cuenta del responsable.' },
      { title: 'Principios', body: 'Legalidad, finalidad, libertad, veracidad o calidad, transparencia, acceso y circulación restringida, seguridad y confidencialidad.' },
      { title: 'Datos tratados', body: 'Identificación, contacto, compra, cotización, entrega, soporte, garantías, facturación si aplica, autorizaciones y datos técnicos mínimos de navegación.' },
      { title: 'Finalidades detalladas', body: 'Crear y atender pedidos, responder cotizaciones, validar pagos disponibles, coordinar envíos, gestionar garantías, responder consultas, prevenir fraude, realizar auditoría, cumplir obligaciones legales y enviar comunicaciones autorizadas.' },
      { title: 'Clientes', body: 'Los datos de clientes se usan para relación comercial, historial de pedidos, cotizaciones, soporte, garantías y comunicaciones autorizadas. PII completa no se expone por defecto en administración.' },
      { title: 'Usuarios admin y empleados', body: 'Los usuarios administrativos se tratan para autenticación, RBAC, auditoría, seguridad, 2FA, recuperación y trazabilidad de acciones.' },
      { title: 'Proveedores', body: 'Los datos de proveedores se tratarán para contratación, cumplimiento, coordinación operativa y registros contables cuando aplique.' },
      { title: 'Derechos', body: 'Conocer, actualizar, rectificar, solicitar prueba de autorización, revocar autorización, solicitar supresión cuando proceda y presentar quejas ante autoridad competente previa gestión interna.' },
      { title: 'Consultas', body: 'Las consultas deberán enviarse al canal definido. Canal pendiente: [CANAL DE RECLAMOS PENDIENTE]. El procedimiento final requiere revisión legal.' },
      { title: 'Reclamos', body: 'Los reclamos deberán identificar al titular, describir hechos, adjuntar soportes y dirección de respuesta. Plazos y escalamiento quedan sujetos a definición jurídica.' },
      { title: 'Área responsable', body: 'Área/persona responsable pendiente: [RESPONSABLE DEL TRATAMIENTO PENDIENTE].' },
      { title: 'Vigencia de bases de datos', body: 'La vigencia depende de finalidad, relación comercial, obligaciones legales, garantías, auditoría y defensa de reclamaciones. La fecha exacta debe aprobarse legalmente.' },
      { title: 'Transmisión y transferencia', body: 'Podrá existir transmisión a encargados tecnológicos, logísticos o de pago si están configurados. Cualquier transferencia internacional requiere evaluación y base jurídica.' },
      { title: 'Seguridad y confidencialidad', body: 'Se aplican controles de acceso, enmascaramiento, auditoría de vistas sensibles, no exposición de secretos y limitación de datos en logs.' },
      { title: 'Cambios y entrada en vigencia', body: 'Toda modificación debe versionarse y publicarse desde el flujo legal. Fecha de entrada en vigencia: pendiente de aprobación.' },
    ],
  },
  {
    slug: 'terminos-y-condiciones',
    title: 'Términos y condiciones',
    description:
      'Reglas comerciales para catálogo, compra, cotización, pagos, envíos, rastreo, garantías y atención.',
    updatedAt: '2026-04-29',
    effectiveAt: 'Pendiente de aprobación legal',
    version: '1.0-draft',
    reviewStatus: 'pending_legal_review',
    responsible: '[RAZÓN SOCIAL PENDIENTE]',
    contactHref: '/contacto',
    seo: {
      title: 'Términos y condiciones | DistriTools JL',
      description: 'Términos preparados para ecommerce con compra y cotización.',
    },
    sections: [
      { title: 'Estado e identificación', body: `${pendingNotice} Comercio pendiente de completar: ${companyPending}` },
      { title: 'Aceptación y uso permitido', body: 'Al usar el sitio, el usuario acepta reglas de navegación, compra, cotización y atención. Está prohibido usar el sitio para fraude, abuso, extracción no autorizada o interferencia técnica.' },
      { title: 'Catálogo y disponibilidad', body: 'El catálogo puede incluir productos con precio y productos por cotizar. La disponibilidad está sujeta a confirmación de inventario, publicación, precio y condiciones comerciales.' },
      { title: 'Productos con precio', body: 'Los productos con precio pueden iniciar proceso de compra. La confirmación final depende de validaciones de pago, disponibilidad y operación interna.' },
      { title: 'Productos por cotizar', body: 'Los productos sin precio requieren cotización comercial. No se inventan precios; un actor autorizado debe asignarlos antes de aceptación o conversión.' },
      { title: 'Errores de publicación', body: 'Errores evidentes de precio, inventario, descripción o disponibilidad podrán corregirse antes de confirmar una operación.' },
      { title: 'Proceso de compra', body: 'El usuario selecciona productos, ingresa datos de contacto y entrega, selecciona método disponible y recibe estado operativo. Un pedido puede requerir validación adicional.' },
      { title: 'Proceso de cotización y carrito mixto', body: 'Si el carrito mezcla productos comprables y productos por cotizar, la parte cotizable queda sujeta a revisión y aceptación. No se confirma automáticamente como venta cerrada.' },
      { title: 'Métodos de pago', body: 'Pago contra entrega depende de cobertura y confirmación. PSE solo estará disponible cuando exista pasarela configurada. Coordinar pago es un estado operativo, no aprobación automática.' },
      { title: 'Estado de pedido y facturación', body: 'Los estados reflejan avance operativo. Facturación y documentos tributarios quedan sujetos a datos reales del comercio y obligaciones aplicables.' },
      { title: 'Envíos y rastreo', body: 'Despacho, guía, ruta y tracking dependen de transportadora o proceso operativo real. Si no hay provider, no se mostrará guía inventada.' },
      { title: 'Garantías, cambios, devoluciones y retracto', body: 'Estas solicitudes se rigen por la política específica, revisión del producto, soportes y condiciones legales/comerciales aprobadas.' },
      { title: 'Obligaciones del usuario', body: 'Entregar información veraz, revisar datos de pedido, atender comunicaciones operativas y usar productos conforme a instrucciones técnicas o del fabricante.' },
      { title: 'Propiedad intelectual', body: 'Marcas, textos, fotografías, fichas y elementos del sitio están protegidos por sus titulares. El uso no concede licencias no autorizadas.' },
      { title: 'Responsabilidad', body: 'La responsabilidad se limita conforme a la ley aplicable y a la operación real validada. Jurisdicción y ley aplicable quedan pendientes de revisión legal.' },
      { title: 'Atención y cambios', body: 'Canal de atención pendiente: [CANAL DE RECLAMOS PENDIENTE]. Los términos pueden modificarse mediante versión publicada tras aprobación.' },
    ],
  },
  {
    slug: 'politica-de-envios',
    title: 'Política de envíos',
    description:
      'Cobertura, costos, guía, rastreo, intentos, dirección incorrecta y eventos logísticos sin fingir provider.',
    updatedAt: '2026-04-29',
    effectiveAt: 'Pendiente de aprobación legal',
    version: '1.0-draft',
    reviewStatus: 'pending_legal_review',
    responsible: '[RAZÓN SOCIAL PENDIENTE]',
    contactHref: '/rastreo-de-pedido',
    seo: {
      title: 'Política de envíos | DistriTools JL',
      description: 'Política logística preparada para provider real y confirmación operativa.',
    },
    sections: [
      { title: 'Estado del documento', body: pendingNotice },
      { title: 'Cobertura', body: 'La cobertura queda pendiente de confirmación operativa. No se declara cobertura nacional ni zonas activas sin transportadora o regla comercial aprobada.' },
      { title: 'Dirección de entrega', body: 'El cliente debe entregar dirección completa, ciudad, datos de contacto y observaciones necesarias. Datos incompletos pueden bloquear cotización o despacho.' },
      { title: 'Disponibilidad y costos', body: 'Disponibilidad de producto y costo de envío se confirman antes del despacho. No se inventan tarifas ni tiempos si faltan peso, dimensiones, dirección o provider.' },
      { title: 'Transportadoras', body: 'La arquitectura está preparada para proveedor logístico real. Ninguna transportadora se presenta como activa hasta contar con credenciales y operación validada.' },
      { title: 'Guía, ruta y rastreo', body: 'La guía, ruta, etiqueta y tracking solo se muestran cuando un proveedor real los devuelve o el equipo operativo los registra con soporte.' },
      { title: 'Tiempos estimados', body: 'Los tiempos se informarán como estimados cuando existan reglas aprobadas o respuesta del provider. Actualmente quedan sujetos a confirmación operativa.' },
      { title: 'Pago contra entrega', body: 'Pago contra entrega depende de cobertura, validación comercial y condiciones del pedido. No se promete disponibilidad automática.' },
      { title: 'Productos por cotizar o incompletos', body: 'Productos por cotizar, sin peso, sin dimensiones o con disponibilidad incierta pueden requerir cálculo manual antes de despacho.' },
      { title: 'Intentos y reprogramaciones', body: 'Intentos de entrega, reprogramaciones y costos asociados dependen de política comercial y proveedor logístico pendiente de aprobación.' },
      { title: 'Dirección incorrecta', body: 'Errores de dirección pueden generar retrasos, costos adicionales, devolución o cancelación logística conforme a la regla aprobada.' },
      { title: 'Entrega fallida y devolución', body: 'Una entrega fallida o devolución por transportadora se evaluará con eventos reales del envío; no se crean eventos ficticios de tracking.' },
      { title: 'Responsabilidad del cliente', body: 'El cliente debe estar disponible, responder contactos operativos y revisar datos antes de confirmar.' },
      { title: 'Soporte', body: 'Canal de soporte pendiente: [CANAL DE RECLAMOS PENDIENTE]. Rastreo público disponible solo con datos reales.' },
    ],
  },
  {
    slug: 'cambios-devoluciones-y-garantias',
    title: 'Cambios, devoluciones, garantías y retracto',
    description:
      'Procedimiento posventa para cambios, devoluciones, garantías, retracto, evidencias y revisión técnica.',
    updatedAt: '2026-04-29',
    effectiveAt: 'Pendiente de aprobación legal',
    version: '1.0-draft',
    reviewStatus: 'pending_legal_review',
    responsible: '[RAZÓN SOCIAL PENDIENTE]',
    contactHref: '/contacto',
    seo: {
      title: 'Cambios, devoluciones y garantías | DistriTools JL',
      description: 'Política posventa estructurada para revisión jurídica.',
    },
    sections: [
      { title: 'Estado y alcance', body: pendingNotice },
      { title: 'Diferencias clave', body: 'Cambio: reemplazo por condición comercial aprobada. Devolución: reversión de operación cuando proceda. Garantía: atención por falla bajo condiciones legales o del fabricante. Retracto: derecho aplicable cuando corresponda y sujeto a revisión legal.' },
      { title: 'Condiciones generales', body: 'La solicitud se evalúa con número de pedido, producto, fecha, motivo, evidencias, estado del producto, accesorios y empaque si aplica.' },
      { title: 'Estado del producto', body: 'Debe conservar condiciones razonables para evaluación. Uso indebido, instalación incorrecta, manipulación no autorizada o daño externo pueden afectar la garantía.' },
      { title: 'Evidencia requerida', body: 'Fotos, videos, factura o soporte de compra, descripción del problema y datos de contacto. Requisitos finales pendientes de aprobación.' },
      { title: 'Plazos', body: 'Plazos comerciales y legales deben ser definidos por revisión jurídica. Cualquier referencia legal queda sujeta a validación de abogado antes de publicación definitiva.' },
      { title: 'Exclusiones', body: 'Exclusiones por desgaste, mal uso, consumibles, instalación, condiciones técnicas o productos especiales quedan pendientes de definición comercial y legal.' },
      { title: 'Procedimiento', body: 'Solicitud, radicación, revisión inicial, solicitud de evidencias, eventual envío del producto, revisión técnica/comercial, decisión y respuesta formal.' },
      { title: 'Garantía legal y fabricante', body: 'La garantía puede depender de ley aplicable, fabricante, marca, uso y soporte documental. No se promete cobertura no verificada.' },
      { title: 'Productos por cotización o uso técnico', body: 'Productos cotizados, especializados o con instalación/uso técnico pueden requerir evaluación adicional.' },
      { title: 'Costos de transporte', body: 'Costos de transporte por revisión, cambio o devolución dependen de causa, cobertura y regla comercial aprobada. No se promete cobertura automática.' },
      { title: 'Reembolso o cambio', body: 'Reembolso o cambio procede solo tras validación y según condiciones aprobadas. No hay devolución automática sin revisión.' },
      { title: 'Contacto y revisión legal', body: 'Canal pendiente: [CANAL DE RECLAMOS PENDIENTE]. Esta política requiere revisión legal antes de aprobar plazos, exclusiones y procedimiento final.' },
    ],
  },
];

export function getLegalPage(slug: string) {
  return legalPages.find((page) => page.slug === slug) ?? null;
}
import { storefrontContactConfig } from '@/config/storefront-contact';

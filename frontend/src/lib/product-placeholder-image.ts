export interface PlaceholderImage {
  src: string;
  alt: string;
  isPlaceholder: true;
}

function detectToolType(product: {
  name: string;
  category?: { name?: string; slug?: string } | null;
  attributes?: Array<{ label: string; value: string }>;
}): string {
  const text = [
    product.name.toLowerCase(),
    product.category?.name?.toLowerCase() ?? '',
    product.category?.slug?.toLowerCase() ?? '',
    ...(product.attributes ?? []).flatMap((a) => [a.label.toLowerCase(), a.value.toLowerCase()]),
  ].join(' ');

  if (text.includes('taladro') || text.includes('percutor') || text.includes('rotomartillo')) return 'drill';
  if (text.includes('esmeril') || text.includes('pulidora') || text.includes('angular')) return 'grinder';
  if (text.includes('soldadora') || text.includes('soldadura') || text.includes('inversor') || text.includes('welder')) return 'welder';
  if (text.includes('compresor') || text.includes('compressor')) return 'compressor';
  if (text.includes('clavadora') || text.includes('grapadora') || text.includes('nailer') || text.includes('fijacion')) return 'nailer';
  if (text.includes('neumática') || text.includes('neumatico') || text.includes('impacto') || text.includes('air tool')) return 'air-tool';
  if (text.includes('careta') || text.includes('guantes') || text.includes('seguridad') || text.includes('proteccion')) return 'safety';
  if (text.includes('disco') || text.includes('broca') || text.includes('accesorio') || text.includes('accesorios')) return 'accessory';

  return 'generic-tool';
}

export function getProductPlaceholderImages(product: {
  name: string;
  image?: { status?: string; assetPath?: string | null } | null;
  category?: { name?: string; slug?: string } | null;
  attributes?: Array<{ label: string; value: string }>;
}): PlaceholderImage[] {
  const hasRealImage = product.image?.status === 'approved' && product.image?.assetPath;

  if (hasRealImage) {
    return [];
  }

  const toolType = detectToolType(product);
  const typeLabel = toolType === 'drill' ? 'Taladro' :
    toolType === 'grinder' ? 'Esmeril' :
    toolType === 'welder' ? 'Soldadora' :
    toolType === 'compressor' ? 'Compresor' :
    toolType === 'nailer' ? 'Clavadora / Grapadora' :
    toolType === 'air-tool' ? 'Herramienta neumática' :
    toolType === 'safety' ? 'Seguridad' :
    toolType === 'accessory' ? 'Accesorio' : 'Herramienta';

  return [{
    src: `/placeholders/tools/${toolType}.svg`,
    alt: `Imagen referencial de ${typeLabel} para ${product.name}`,
    isPlaceholder: true,
  }];
}

export const storefrontContactConfig = {
  whatsappNumber: '573000000000',
  whatsappDisplay: '+57 300 000 0000',
  whatsappMessage: 'Hola, quiero información sobre un producto de DistriTools JL.',
  email: 'contacto@dristritoolsjl.com',
  base: 'Cali, Valle del Cauca',
  supportLabel: 'Compra, pedidos, garantías y asesoría técnica',
} as const;

export function getStorefrontWhatsappUrl(message = storefrontContactConfig.whatsappMessage) {
  return `https://wa.me/${storefrontContactConfig.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

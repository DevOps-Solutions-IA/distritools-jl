import { z } from 'zod';

export const checkoutSchema = z.object({
  fullName: z.string().min(3, 'Ingresa un nombre completo válido.'),
  email: z.string().email('Ingresa un correo válido.'),
  phone: z.string().min(7, 'Ingresa un teléfono válido.'),
  document: z.string(),
  city: z.string().min(2, 'Ingresa la ciudad.'),
  address: z.string().min(6, 'Ingresa la dirección principal.'),
  addressDetail: z.string(),
  notes: z.string(),
  paymentGateway: z.string().min(1, 'Selecciona un canal de pago backend.'),
  acceptsTerms: z.boolean().refine((value) => value, {
    message: 'Debes aceptar el tratamiento y las condiciones básicas.',
  }),
});

export type CheckoutSchemaValues = z.infer<typeof checkoutSchema>;

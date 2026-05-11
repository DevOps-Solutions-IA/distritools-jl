import { z } from 'zod';

export const checkoutSchema = z.object({
  fullName: z.string().min(3, 'Ingresa un nombre completo válido.'),
  email: z.string().email('Ingresa un correo válido.'),
  phone: z.string().min(7, 'Ingresa un teléfono válido.'),
  document: z.string(),
  department: z.string().min(2, 'Ingresa el departamento.'),
  city: z.string().min(2, 'Ingresa la ciudad.'),
  neighborhood: z.string(),
  postalCode: z.string(),
  address: z.string().min(6, 'Ingresa la dirección principal.'),
  addressDetail: z.string(),
  notes: z.string(),
  paymentGateway: z.enum(['cash_on_delivery', 'pse', 'commercial_confirmation'], {
    message: 'Selecciona un método de pago.',
  }),
  acceptsTerms: z.boolean().refine((value) => value, {
    message: 'Debes aceptar el tratamiento y las condiciones básicas.',
  }),
});

export type CheckoutSchemaValues = z.infer<typeof checkoutSchema>;

import { z } from "zod";
export const orderStatuses = [
  "draft",
  "pending_payment",
  "paid",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export const paymentStatuses = [
  "pending",
  "approved",
  "rejected",
  "expired",
  "refunded",
] as const;
const money = z
  .string()
  .refine(
    (value) => value === "NO_PERMISSION" || /^-?\d+(\.\d+)?$/.test(value),
  );
const renderableCurrency = z.string().refine((currency) => {
  try {
    new Intl.NumberFormat("es-CO", { style: "currency", currency });
    return true;
  } catch {
    return false;
  }
}, "Moneda no compatible con el formato de importes.");
const item = z.object({
  id: z.string(),
  variantId: z.string(),
  warehouseId: z.string(),
  variantNameSnapshot: z.string(),
  skuSnapshot: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: money,
  lineSubtotal: money,
  lineTaxTotal: money,
  lineDiscountTotal: money,
  lineGrandTotal: money,
});
export const orderSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  status: z.enum(orderStatuses),
  customer: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
  }),
  shipping: z.object({
    address: z.string(),
    city: z.string(),
    notes: z.string().nullable(),
  }),
  totals: z.object({
    subtotal: money,
    discountTotal: money,
    taxTotal: money,
    shippingTotal: money,
    grandTotal: money,
  }),
  items: z.array(item),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const orderRowSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  status: z.enum(orderStatuses),
  customerName: z.string(),
  customerEmail: z.string().nullable(),
  customerPhone: z.string().nullable(),
  shippingCity: z.string(),
  itemsCount: z.number(),
  paymentStatus: z.enum(paymentStatuses).nullable(),
  paymentMethod: z.string().nullable(),
  grandTotal: money,
  createdAt: z.string(),
});
export const paymentSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  gateway: z.string(),
  gatewayReference: z.string(),
  transactionId: z.string().nullable(),
  amount: money,
  currency: renderableCurrency,
  status: z.enum(paymentStatuses),
  confirmedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const paymentRowSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  orderNumber: z.string(),
  gateway: z.string(),
  status: z.enum(paymentStatuses),
  amount: money,
  currency: renderableCurrency,
  providerReference: z.string().nullable(),
  createdAt: z.string(),
});
export const pageSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});
export const ordersSchema = z.object({
  data: z.array(orderRowSchema),
  meta: pageSchema,
});
export const paymentsSchema = z.object({
  data: z.array(paymentRowSchema),
  meta: pageSchema,
});
export const eventsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      gateway: z.string(),
      providerEventId: z.string(),
      processedAt: z.string().nullable(),
      receivedAt: z.string(),
    }),
  ),
});
export const auditSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      action: z.string(),
      entityType: z.string(),
      entityId: z.string(),
      actorUserId: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
});
export type Order = z.infer<typeof orderSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export function formatMoney(value: string, currency = "COP") {
  return value === "NO_PERMISSION"
    ? "Importe protegido"
    : new Intl.NumberFormat("es-CO", { style: "currency", currency }).format(
        Number(value),
      );
}

export const mutationConfirmationSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "cancelled"]),
  alreadyReconciled: z.boolean().optional(),
});

export const cancelConfirmationSchema = mutationConfirmationSchema.extend({
  status: z.literal("cancelled"),
  orderNumber: z.string().min(1),
});
export type SaleMutationTarget = { kind: "cancel" | "cod"; id: string };
export type SaleProxyTarget =
  | { kind: "cancel"; orderNumber: string }
  | { kind: "cod"; id: string };

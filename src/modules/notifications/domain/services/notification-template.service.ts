import { Injectable } from '@nestjs/common';
import { DomainEvent } from 'src/common/events/domain-event.publisher';
import { NotificationChannel } from '@prisma/client';

export interface ResolvedNotificationTemplate {
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  content: string;
  provider: string;
}

@Injectable()
export class NotificationTemplateService {
  resolveTemplates(
    event: DomainEvent<Record<string, unknown>>,
  ): ResolvedNotificationTemplate[] {
    const payload = event.payload as Record<string, unknown>;
    const customerEmail =
      typeof payload.customerEmail === 'string' ? payload.customerEmail : null;
    const customerPhone =
      typeof payload.customerPhone === 'string' ? payload.customerPhone : null;
    const orderNumber = String(payload.orderNumber ?? '');
    const trackingCode = String(payload.trackingCode ?? '');
    const total = (payload.totals as { grandTotal?: string } | undefined)?.grandTotal ?? null;
    const items = Array.isArray(payload.items) ? payload.items : [];
    const itemLines = items
      .map((item) => {
        const record = item as {
          sku?: unknown;
          name?: unknown;
          quantity?: unknown;
          lineTotal?: unknown;
        };
        return `- ${String(record.name ?? 'Producto')} (${String(record.sku ?? 'SKU pendiente')}) x ${String(record.quantity ?? '1')}: ${String(record.lineTotal ?? 'Total pendiente')}`;
      })
      .join('\n');

    switch (event.eventName) {
      case 'order.created':
        return [
          ...(customerEmail
            ? [
                {
                  channel: 'email' as const,
                  recipient: customerEmail,
                  subject: `Confirmación de pedido DistriTools JL #${orderNumber}`,
                  content: [
                    `Hola, recibimos tu pedido ${orderNumber}.`,
                    '',
                    `Código de rastreo interno: ${trackingCode}`,
                    'Estado de envío: Guía de transportadora pendiente de asignación.',
                    total ? `Total: ${total} COP` : null,
                    '',
                    'Productos:',
                    itemLines || '- Productos registrados en la orden.',
                    '',
                    `Rastrea tu pedido en /rastreo-de-pedido?query=${encodeURIComponent(trackingCode)}`,
                    'Soporte WhatsApp: https://wa.me/573000000000',
                    '',
                    'Este mensaje no incluye IDs internos, tokens ni secretos.',
                  ]
                    .filter((line): line is string => line !== null)
                    .join('\n'),
                  provider: 'mock-email',
                },
              ]
            : []),
          {
            channel: 'internal' as const,
            recipient: 'ops@internal',
            subject: `Nuevo pedido ${String(payload.orderNumber)}`,
            content: `Se creó el pedido ${String(payload.orderNumber)}.`,
            provider: 'internal-log',
          },
        ];
      case 'order.cancelled':
        return customerEmail
          ? [
              {
                channel: 'email',
                recipient: customerEmail,
                subject: `Pedido ${String(payload.orderNumber)} cancelado`,
                content: `El pedido ${String(payload.orderNumber)} fue cancelado.`,
                provider: 'mock-email',
              },
            ]
          : [];
      case 'payment.approved':
      case 'payment.rejected':
      case 'payment.expired':
        return [
          ...(customerEmail
            ? [
                {
                  channel: 'email' as const,
                  recipient: customerEmail,
                  subject: `Actualización de pago ${String(payload.orderNumber ?? payload.orderId)}`,
                  content: `El pago asociado al pedido fue marcado como ${event.eventName}.`,
                  provider: 'mock-email',
                },
              ]
            : []),
          ...(customerPhone
            ? [
                {
                  channel: 'whatsapp' as const,
                  recipient: customerPhone,
                  content: `Estado del pago actualizado: ${event.eventName}.`,
                  provider: 'mock-whatsapp',
                },
              ]
            : []),
        ];
      case 'inventory.low_stock_detected':
        return [
          {
            channel: 'internal',
            recipient: 'inventory@internal',
            subject: 'Alerta de inventario bajo',
            content: `Inventario bajo detectado para ${String(payload.variantId)}.`,
            provider: 'internal-log',
          },
        ];
      default:
        return [];
    }
  }
}

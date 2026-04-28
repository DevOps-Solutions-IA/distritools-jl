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

    switch (event.eventName) {
      case 'order.created':
        return [
          ...(customerEmail
            ? [
                {
                  channel: 'email' as const,
                  recipient: customerEmail,
                  subject: `Pedido ${String(payload.orderNumber)} recibido`,
                  content: `Tu pedido ${String(payload.orderNumber)} fue creado correctamente.`,
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

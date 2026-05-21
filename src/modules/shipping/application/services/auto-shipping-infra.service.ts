import { Inject, Injectable } from '@nestjs/common';
import { Prisma, ShipmentStatus as PrismaShipmentStatus } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from 'src/common/events/domain-event.publisher';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

function redactPayload(payload: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (!payload || typeof payload !== 'object') return Prisma.JsonNull;
  const input = payload as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = /email|phone|address|document|token|secret|password/i.test(key) ? '[redacted]' : value;
  }
  return output as Prisma.InputJsonValue;
}

export function safeError(error: unknown): string {
  if (error instanceof Error) return error.message.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, '[email]');
  return 'Error logístico no identificado.';
}

export function mergeJsonSnapshot(existing: Prisma.JsonValue | undefined, patch: Record<string, unknown>): Prisma.InputJsonValue {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? existing as Record<string, unknown>
    : {};
  return { ...base, ...patch } as Prisma.InputJsonValue;
}

@Injectable()
export class AutoShippingInfraService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async shipmentEvent(shipmentId: string, status: PrismaShipmentStatus, providerStatus: string, description: string, rawPayload?: Record<string, unknown>) {
    await this.prisma.shipmentEvent.create({
      data: {
        id: uuidv7(), shipmentId, status, providerStatus, description, occurredAt: new Date(),
        rawPayload: rawPayload ? redactPayload(rawPayload) : Prisma.JsonNull,
      },
    });
  }

  async audit(action: string, entityType: string, entityId: string, beforeData: unknown, afterData: unknown, ipAddress?: string, userAgent?: string) {
    await this.prisma.auditLog.create({
      data: {
        id: uuidv7(), actorUserId: null, action, entityType, entityId,
        beforeData: redactPayload(beforeData), afterData: redactPayload(afterData),
        ipAddress: ipAddress ?? null, userAgent: userAgent ?? null,
      },
    });
  }

  async adminNotification(orderId: string, reason: string, message: string) {
    await this.prisma.notificationEvent.create({
      data: {
        id: uuidv7(), entityType: 'order', entityId: orderId,
        provider: 'internal', channel: 'internal',
        recipientMasked: 'ops@internal', errorCode: reason, errorMessage: message,
      },
    }).catch(() => undefined);
  }

  async publish(eventName: string, orderId: string, payload: Record<string, unknown>) {
    await this.eventPublisher.publish({
      eventName, eventVersion: 'v1', occurredAt: new Date().toISOString(),
      payload: { orderId, ...payload },
    });
  }
}

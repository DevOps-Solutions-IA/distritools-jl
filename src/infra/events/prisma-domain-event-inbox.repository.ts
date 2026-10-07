import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { VersionedDomainEvent, validateDomainEvent } from 'src/common/events/domain-event.contracts';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import type { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';

export type InboxRunResult<T> = { status: 'processed'; value: T } | { status: 'duplicate' };

export class ConflictingDomainEventReplayError extends Error {
  constructor() {
    super('Conflicting domain event replay for an existing consumer identity');
    this.name = 'ConflictingDomainEventReplayError';
  }
}

function canonicalize(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

@Injectable()
export class PrismaDomainEventInboxRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async runBatches(
    consumerKey: string, input: VersionedDomainEvent,
    upperBound: (tx: PrismaTransactionClient) => Promise<string | null>,
    batch: (tx: PrismaTransactionClient, cursor: string | null, upper: string | null) => Promise<{ cursor: string | null; done: boolean }>,
  ): Promise<void> {
    if (!consumerKey.trim() || consumerKey.length > 120) throw new Error('Invalid domain event consumer key');
    const event = validateDomainEvent(input, { requireEventId: true });
    const envelopeHash = createHash('sha256').update(canonicalize(event)).digest('hex');
    const identity = { consumerKey, eventId: event.eventId! };
    // Bound a delivery as well as each transaction. Retry resumes the committed cursor.
    for (let iteration = 0; iteration < 100; iteration += 1) {
      const done = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${consumerKey}:${event.eventId}`}, 0))::text`);
        let receipt = await tx.domainEventInbox.findUnique({ where: { consumerKey_eventId: identity } });
        if (receipt && receipt.envelopeHash !== envelopeHash) throw new ConflictingDomainEventReplayError();
        if (receipt?.status === 'completed') return true;
        if (!receipt) receipt = await tx.domainEventInbox.create({ data: {
          id: uuidv7(), ...identity, envelopeHash, status: 'processing',
          progressUpperBound: await upperBound(tx),
        } });
        const progress = await batch(tx, receipt.progressCursor, receipt.progressUpperBound);
        await tx.domainEventInbox.update({ where: { id: receipt.id }, data: {
          progressCursor: progress.cursor,
          ...(progress.done ? { status: 'completed', completedAt: new Date() } : {}),
        } });
        return progress.done;
      });
      if (done) return;
    }
    throw new Error('Search batch delivery budget exhausted; durable progress remains retryable');
  }

  async runOnce<T>(
    consumerKey: string,
    input: VersionedDomainEvent,
    effect: (tx: PrismaTransactionClient) => Promise<T>,
  ): Promise<InboxRunResult<T>> {
    if (!consumerKey.trim() || consumerKey.length > 120) throw new Error('Invalid domain event consumer key');
    const event = validateDomainEvent(input, { requireEventId: true });
    const envelopeHash = createHash('sha256').update(canonicalize(event)).digest('hex');
    const identity = { consumerKey, eventId: event.eventId! };

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${consumerKey}:${event.eventId}`}, 0))::text`);
        const existing = await tx.domainEventInbox.findUnique({ where: { consumerKey_eventId: identity } });
        if (existing) {
          if (existing.envelopeHash !== envelopeHash) throw new ConflictingDomainEventReplayError();
          if (existing.status !== 'completed') throw new Error('Consumer has unfinished batched work');
          return { status: 'duplicate' };
        }

        const receipt = await tx.domainEventInbox.create({ data: {
          id: uuidv7(), ...identity, envelopeHash, status: 'processing',
        } });
        const value = await effect(tx);
        await tx.domainEventInbox.update({
          where: { id: receipt.id },
          data: { status: 'completed', completedAt: new Date() },
        });
        return { status: 'processed', value };
      });
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002') throw error;
      const existing = await this.prisma.domainEventInbox.findUnique({ where: { consumerKey_eventId: identity } });
      if (!existing) throw error;
      if (existing.envelopeHash !== envelopeHash) throw new ConflictingDomainEventReplayError();
      if (existing.status !== 'completed') throw error;
      return { status: 'duplicate' };
    }
  }
}

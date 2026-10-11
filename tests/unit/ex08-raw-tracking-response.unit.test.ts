import { it } from 'node:test';
import assert from 'node:assert/strict';
import { NotFoundException } from '@nestjs/common';
import { GetShipmentTrackingUseCase } from 'src/modules/shipping/application/use-cases/shipment-read.use-case';
import type { PrismaService } from 'src/infra/db/prisma/prisma.service';
import type { ShippingProviderPort } from 'src/modules/shipping/application/ports/shipping-provider.port';

const id = '019a1000-0000-7000-8000-000000000111';
const occurredAt = new Date('2026-10-11T12:00:00.000Z');
const fullEvent = { id, status: 'pending_provider', occurredAt, description: 'Synthetic private recipient', location: 'Synthetic private address', rawPayload: { recipient: 'private@example.test', credential: 'synthetic-only' }, providerStatus: 'private', shipmentId: id, createdAt: occurredAt };
function fixture(trackingNumber: string | null = null, records = [fullEvent]) {
  type Query = { where: { id: string }; include: { events: { take?: number; select?: Partial<Record<keyof typeof fullEvent, boolean>>; orderBy: unknown } } };
  let query: Query;
  const calls: string[] = [];
  const providerStatus = { status: 'in_transit', source: 'mock-local-only', nested: { existingContract: true } };
  const prisma = { shipment: { findUnique: async (input: Query) => {
    query = input;
    const relation = input.include.events;
    let result: Partial<typeof fullEvent>[] = [...records];
    if (relation.take !== undefined) result = result.slice(0, relation.take);
    // Simulate Prisma's select semantics; real PostgreSQL behavior is separately
    // covered by the compiled HTTP integration cases.
    if (relation.select) result = result.map(event => Object.fromEntries(Object.entries(relation.select!).filter(([, included]) => included).map(([k]) => [k, event[k as keyof typeof fullEvent]]))) as typeof result;
    return { id, trackingNumber, events: result };
  } } };
  const provider = { getShipmentStatus: async (guide: string) => { calls.push(guide); return providerStatus; } };
  return { useCase: new GetShipmentTrackingUseCase(prisma as unknown as PrismaService, provider as unknown as ShippingProviderPort), query: () => query, calls, providerStatus };
}
it('pending-guide response exposes only the existing safe event contract', async () => {
  const f = fixture();
  const result = await f.useCase.execute(id);
  assert.deepEqual(result.events, [{ id, status: 'pending_provider', occurredAt }]);
  assert.equal(JSON.stringify(result).includes('private@example.test'), false);
  assert.equal(JSON.stringify(result).includes('synthetic-only'), false);
});
it('keeps pending-guide envelope, operational state and zero provider calls', async () => {
  const f = fixture(); const result = await f.useCase.execute(id);
  assert.equal(result.shipmentId, id); assert.equal(result.trackingNumber, null);
  assert.deepEqual(result.operationalState, { status: 'pending_guide', message: 'No hay guía externa. Se conserva tracking interno.' });
  assert.deepEqual(f.calls, []);
});
it('guide response also excludes private event fields and preserves provider result', async () => {
  const f = fixture('MOCK99-LOCAL'); const result = await f.useCase.execute(id);
  assert.deepEqual(result.events, [{ id, status: 'pending_provider', occurredAt }]);
  assert.equal(result.providerStatus, f.providerStatus);
  assert.deepEqual(f.calls, ['MOCK99-LOCAL']);
  assert.deepEqual(Object.keys(result).sort(), ['events', 'providerStatus', 'shipmentId']);
});
it('bounds the event relation to100 and orders timestamp ties by descending id', async () => {
  const f = fixture(null, Array.from({ length: 105 }, () => fullEvent)); const result = await f.useCase.execute(id);
  assert.equal(result.events.length, 100);
  assert.deepEqual(f.query().include.events.orderBy, [{ occurredAt: 'desc' }, { id: 'desc' }]);
  assert.deepEqual(f.query().include.events.select, { id: true, status: true, occurredAt: true });
});
it('retains404 without consulting provider for an unknown shipment', async () => {
  let called = false; const prisma = { shipment: { findUnique: async () => null } }; const provider = { getShipmentStatus: async () => { called = true; } };
  const useCase = new GetShipmentTrackingUseCase(prisma as unknown as PrismaService, provider as unknown as ShippingProviderPort);
  await assert.rejects(() => useCase.execute(id), (error: unknown) => error instanceof NotFoundException && error.message === 'Envío no encontrado.');
  assert.equal(called, false);
});
it('preserves database failures instead of successful empty events or provider calls', async () => {
  const failure = new Error('Controlled database read failure'); let called = false;
  const prisma = { shipment: { findUnique: async () => { throw failure; } } }; const provider = { getShipmentStatus: async () => { called = true; } };
  const useCase = new GetShipmentTrackingUseCase(prisma as unknown as PrismaService, provider as unknown as ShippingProviderPort);
  await assert.rejects(() => useCase.execute(id), (error: unknown) => error === failure); assert.equal(called, false);
});
it('preserves provider failures without altering the existing provider contract', async () => {
  const failure = new Error('Controlled mock provider failure'); const f = fixture('MOCK99-LOCAL');
  const prisma = { shipment: { findUnique: async () => ({ id, trackingNumber: 'MOCK99-LOCAL', events: [] }) } };
  const calls: string[] = []; const provider = { getShipmentStatus: async (guide: string) => { calls.push(guide); throw failure; } };
  const useCase = new GetShipmentTrackingUseCase(prisma as unknown as PrismaService, provider as unknown as ShippingProviderPort);
  await assert.rejects(() => useCase.execute(id), (error: unknown) => error === failure); assert.deepEqual(calls, ['MOCK99-LOCAL']); assert.deepEqual(f.calls, []);
});

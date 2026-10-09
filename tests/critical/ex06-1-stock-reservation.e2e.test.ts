import 'tests/helpers/test-env';

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { InventoryPolicyService } from 'src/modules/inventory/domain/services/inventory-policy.service';
import { PrismaTransactionClient } from 'src/modules/inventory/domain/repositories/inventory.repository';
import { PrismaInventoryReferenceRepository } from 'src/modules/inventory/infrastructure/repositories/prisma-inventory-reference.repository';
import { PrismaInventoryRepository } from 'src/modules/inventory/infrastructure/repositories/prisma-inventory.repository';
import { CommitStockUseCase } from 'src/modules/inventory/application/use-cases/commit-stock.use-case';
import { ReleaseStockUseCase } from 'src/modules/inventory/application/use-cases/release-stock.use-case';
import { ReserveStockUseCase } from 'src/modules/inventory/application/use-cases/reserve-stock.use-case';
import { PrismaStockMovementRepository } from 'src/modules/stock-movements/infrastructure/repositories/prisma-stock-movement.repository';
import { PrismaAuditRepository } from 'src/modules/auth/infrastructure/repositories/prisma-audit.repository';
import { RequestContextService } from 'src/common/request/request-context.service';
import { StockMovementRepository } from 'src/modules/stock-movements/domain/repositories/stock-movement.repository';
import { InventoryRepository, InventoryLockTarget } from 'src/modules/inventory/domain/repositories/inventory.repository';
import { normalizeStockLines } from 'src/modules/inventory/application/use-cases/normalize-stock-lines';
import { disconnectDatabase, prisma, resetDatabase, seedBaseData } from 'tests/helpers/test-db';

describe('EX-06.1 inventory operation identity', () => {
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;
  let reserve: ReserveStockUseCase;
  let commit: CommitStockUseCase;
  let release: ReleaseStockUseCase;
  let prismaService: PrismaService;
  let inventoryRepository: PrismaInventoryRepository;
  let movementRepository: PrismaStockMovementRepository;
  let auditRepository: { write: () => Promise<void> };

  before(async () => {
    await resetDatabase();
    seeded = await seedBaseData();
    prismaService = prisma as unknown as PrismaService;
    inventoryRepository = new PrismaInventoryRepository(prismaService);
    movementRepository = new PrismaStockMovementRepository(prismaService);
    auditRepository = { write: async () => undefined };
    const policy = new InventoryPolicyService();

    reserve = new ReserveStockUseCase(
      prismaService,
      inventoryRepository,
      new PrismaInventoryReferenceRepository(prismaService),
      movementRepository,
      auditRepository,
      policy,
    );
    commit = new CommitStockUseCase(
      prismaService,
      inventoryRepository,
      movementRepository,
      auditRepository,
      policy,
    );
    release = new ReleaseStockUseCase(
      prismaService,
      inventoryRepository,
      movementRepository,
      auditRepository,
      policy,
    );
  });

  after(disconnectDatabase);

  async function resetInventory(onHandQty: number) {
    await prisma.stockMovement.deleteMany({
      where: {
        variantId: { in: [seeded.inventory.variantId, seeded.inventory.secondVariantId] },
        warehouseId: seeded.inventory.warehouseId,
      },
    });
    await prisma.inventoryItem.updateMany({
      where: { variantId: { in: [seeded.inventory.variantId, seeded.inventory.secondVariantId] } },
      data: { onHandQty: 0, reservedQty: 0, committedQty: 0 },
    });
    await prisma.inventoryItem.update({
      where: { variantId_warehouseId: {
        variantId: seeded.inventory.variantId,
        warehouseId: seeded.inventory.warehouseId,
      } },
      data: { onHandQty, reservedQty: 0, committedQty: 0 },
    });
  }

  function input(referenceId: string, quantity: number) {
    return {
      referenceType: 'test',
      referenceId,
      lines: [{
        variantId: seeded.inventory.variantId,
        warehouseId: seeded.inventory.warehouseId,
        quantity,
      }],
    };
  }

  function withInventoryRepository(repository: InventoryRepository) {
    const policy = new InventoryPolicyService();
    return new ReserveStockUseCase(
      prismaService,
      repository,
      new PrismaInventoryReferenceRepository(prismaService),
      movementRepository,
      auditRepository,
      policy,
    );
  }

  function deferred<T = void>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((complete) => { resolve = complete; });
    return { promise, resolve };
  }

  function hookedRepository(hooks: {
    afterLock?: () => Promise<void>;
    onLockStarted?: () => void;
  }): InventoryRepository {
    return new Proxy(inventoryRepository, {
      get(target, property, receiver) {
        if (property === 'lockMany') {
          return async (tx: PrismaTransactionClient, targets: InventoryLockTarget[]) => {
            const pending = target.lockMany(tx, targets);
            hooks.onLockStarted?.();
            const rows = await pending;
            await hooks.afterLock?.();
            return rows;
          };
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as InventoryRepository;
  }

  it('replays the exact reservation after it consumed all availability', async () => {
    await resetInventory(2);
    const request = input('ex061-reserve-idempotency', 2);

    const first = await reserve.execute(request);
    const second = await reserve.execute(request);
    const state = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: {
        variantId: seeded.inventory.variantId,
        warehouseId: seeded.inventory.warehouseId,
      } },
    });
    const movements = await prisma.stockMovement.count({
      where: {
        movementType: 'reservation',
        referenceType: request.referenceType,
        referenceId: request.referenceId,
      },
    });

    assert.equal(first.movements.length, 1);
    assert.equal(second.movements.length, 1);
    assert.equal(state.reservedQty, 2);
    assert.equal(movements, 1);
  });

  it('replays an exact commit after the reservation has already been committed', async () => {
    await resetInventory(2);
    const request = { ...input(uuidv7(), 2), referenceType: 'test' };
    await reserve.execute(request);

    const first = await commit.execute(request);
    const second = await commit.execute(request);
    const state = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: {
        variantId: seeded.inventory.variantId,
        warehouseId: seeded.inventory.warehouseId,
      } },
    });
    const movements = await prisma.stockMovement.count({
      where: {
        movementType: 'commit',
        referenceType: request.referenceType,
        referenceId: request.referenceId,
      },
    });

    assert.equal(first.movements.length, 1);
    assert.equal(second.movements.length, 1);
    assert.equal(state.onHandQty, 0);
    assert.equal(state.reservedQty, 0);
    assert.equal(movements, 1);
  });

  it('replays an exact release after the reservation has already been released', async () => {
    await resetInventory(2);
    const request = input('ex061-release-idempotency', 2);
    await reserve.execute(request);

    const first = await release.execute(request);
    const second = await release.execute(request);
    const state = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: {
        variantId: seeded.inventory.variantId,
        warehouseId: seeded.inventory.warehouseId,
      } },
    });
    const movements = await prisma.stockMovement.count({
      where: {
        movementType: 'release',
        referenceType: request.referenceType,
        referenceId: request.referenceId,
      },
    });

    assert.equal(first.movements.length, 1);
    assert.equal(second.movements.length, 1);
    assert.equal(state.reservedQty, 0);
    assert.equal(state.onHandQty, 2);
    assert.equal(movements, 1);
  });

  it('rejects a reused operation reference with a different quantity without changing stock', async () => {
    await resetInventory(2);
    const request = input(uuidv7(), 2);
    await reserve.execute(request);

    await assert.rejects(
      reserve.execute({ ...request, lines: [{ ...request.lines[0], quantity: 1 }] }),
      /Existing stock movement conflicts with requested quantity/,
    );
    const state = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: {
        variantId: seeded.inventory.variantId,
        warehouseId: seeded.inventory.warehouseId,
      } },
    });
    assert.equal(state.onHandQty, 2);
    assert.equal(state.reservedQty, 2);
  });

  it('aggregates duplicate order lines for one inventory target before reserving', async () => {
    await resetInventory(5);
    const request = {
      ...input(uuidv7(), 1),
      lines: [
        { ...input('unused', 1).lines[0], quantity: 2 },
        { ...input('unused', 1).lines[0], quantity: 3 },
      ],
    };

    await reserve.execute(request);
    const state = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: {
        variantId: seeded.inventory.variantId,
        warehouseId: seeded.inventory.warehouseId,
      } },
    });
    const movements = await prisma.stockMovement.findMany({
      where: { movementType: 'reservation', referenceId: request.referenceId },
    });

    assert.equal(state.reservedQty, 5);
    assert.equal(movements.length, 1);
    assert.equal(movements[0].quantity, 5);
  });

  it('aggregates duplicate lines for commit and release movement identity', async () => {
    const duplicateLines = [
      { variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId, quantity: 1 },
      { variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId, quantity: 2 },
    ];
    const commitRequest = { referenceType: 'test', referenceId: uuidv7(), lines: duplicateLines };
    await resetInventory(3);
    await reserve.execute(commitRequest);
    await commit.execute(commitRequest);
    await commit.execute(commitRequest);
    const committed = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: {
        variantId: seeded.inventory.variantId,
        warehouseId: seeded.inventory.warehouseId,
      } },
    });
    assert.equal(committed.onHandQty, 0);
    assert.equal(committed.reservedQty, 0);
    assert.equal(await prisma.stockMovement.count({
      where: { movementType: 'commit', referenceId: commitRequest.referenceId },
    }), 1);

    const releaseRequest = { ...commitRequest, referenceId: uuidv7() };
    await resetInventory(3);
    await reserve.execute(releaseRequest);
    await release.execute(releaseRequest);
    await release.execute(releaseRequest);
    const released = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: {
        variantId: seeded.inventory.variantId,
        warehouseId: seeded.inventory.warehouseId,
      } },
    });
    assert.equal(released.onHandQty, 3);
    assert.equal(released.reservedQty, 0);
    assert.equal(await prisma.stockMovement.count({
      where: { movementType: 'release', referenceId: releaseRequest.referenceId },
    }), 1);
  });

  it('rejects unsafe quantities and aggregate overflow before opening a transaction', () => {
    const line = input('unused', 1).lines[0];
    assert.throws(() => normalizeStockLines([{ ...line, quantity: Number.MAX_SAFE_INTEGER + 1 }]),
      /positive safe integer/);
    assert.throws(() => normalizeStockLines([
      { ...line, quantity: Number.MAX_SAFE_INTEGER },
      { ...line, quantity: 1 },
    ]), /Combined quantity exceeds the safe integer range/);
  });

  it('rolls back every line and movement when a later line lacks stock', async () => {
    await resetInventory(3);
    await prisma.inventoryItem.update({
      where: { variantId_warehouseId: {
        variantId: seeded.inventory.secondVariantId,
        warehouseId: seeded.inventory.warehouseId,
      } },
      data: { onHandQty: 0, reservedQty: 0, committedQty: 0 },
    });
    const request = {
      referenceType: 'test',
      referenceId: uuidv7(),
      lines: [
        { variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId, quantity: 1 },
        { variantId: seeded.inventory.secondVariantId, warehouseId: seeded.inventory.warehouseId, quantity: 1 },
      ],
    };

    await assert.rejects(reserve.execute(request), /Insufficient available stock/);
    const rows = await prisma.inventoryItem.findMany({
      where: { variantId: { in: [seeded.inventory.variantId, seeded.inventory.secondVariantId] } },
      orderBy: { variantId: 'asc' },
    });
    const movements = await prisma.stockMovement.count({ where: { referenceId: request.referenceId } });
    assert.deepEqual(rows.map((row) => row.reservedQty), [0, 0]);
    assert.equal(movements, 0);
  });

  it('serializes competing reservations against limited stock using the row lock', async () => {
    await resetInventory(5);
    const locked = deferred();
    const releaseFirst = deferred();
    const secondStarted = deferred();
    const first = withInventoryRepository(hookedRepository({
      afterLock: async () => { locked.resolve(); await releaseFirst.promise; },
    }));
    const second = withInventoryRepository(hookedRepository({
      onLockStarted: () => secondStarted.resolve(),
    }));

    const firstRequest = input(uuidv7(), 4);
    const secondRequest = input(uuidv7(), 4);
    const firstResult = first.execute(firstRequest);
    await locked.promise;
    const secondResult = second.execute(secondRequest);
    await secondStarted.promise;
    releaseFirst.resolve();

    const results = await Promise.allSettled([firstResult, secondResult]);
    const state = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: {
        variantId: seeded.inventory.variantId,
        warehouseId: seeded.inventory.warehouseId,
      } },
    });
    const movementCount = await prisma.stockMovement.count({
      where: { movementType: 'reservation', referenceType: 'test' },
    });
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
    assert.equal(state.onHandQty, 5);
    assert.equal(state.reservedQty, 4);
    assert.equal(state.onHandQty - state.reservedQty - state.committedQty, 1);
    assert.equal(movementCount, 1);
  });

  it('uses the same canonical lock order for requests with reversed multi-variant lines', async () => {
    await resetInventory(2);
    await prisma.inventoryItem.update({
      where: { variantId_warehouseId: {
        variantId: seeded.inventory.secondVariantId,
        warehouseId: seeded.inventory.warehouseId,
      } },
      data: { onHandQty: 2 },
    });
    const observedOrders: string[][] = [];
    const recordingRepository = (barrier?: () => Promise<void>) => new Proxy(inventoryRepository, {
      get(target, property, receiver) {
        if (property === 'lockMany') {
          return async (tx: PrismaTransactionClient, targets: InventoryLockTarget[]) => {
            observedOrders.push(targets.map((item) => `${item.variantId}:${item.warehouseId}`));
            const rows = await target.lockMany(tx, targets);
            await barrier?.();
            return rows;
          };
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as InventoryRepository;
    const locked = deferred();
    const releaseFirst = deferred();
    const secondStarted = deferred();
    const first = withInventoryRepository(recordingRepository(async () => {
      locked.resolve();
      await releaseFirst.promise;
    }));
    const second = withInventoryRepository(new Proxy(recordingRepository(), {
      get(target, property, receiver) {
        if (property === 'lockMany') {
          return async (tx: PrismaTransactionClient, targets: InventoryLockTarget[]) => {
            secondStarted.resolve();
            return target.lockMany(tx, targets);
          };
        }
        return Reflect.get(target, property, receiver) as unknown;
      },
    }) as InventoryRepository);
    const firstRequest = {
      referenceType: 'test', referenceId: uuidv7(),
      lines: [
        { variantId: seeded.inventory.variantId, warehouseId: seeded.inventory.warehouseId, quantity: 1 },
        { variantId: seeded.inventory.secondVariantId, warehouseId: seeded.inventory.warehouseId, quantity: 1 },
      ],
    };
    const secondRequest = {
      ...firstRequest, referenceId: uuidv7(), lines: [...firstRequest.lines].reverse(),
    };

    const firstResult = first.execute(firstRequest);
    await locked.promise;
    const secondResult = second.execute(secondRequest);
    await secondStarted.promise;
    releaseFirst.resolve();
    await Promise.all([firstResult, secondResult]);

    assert.equal(observedOrders.length, 2);
    assert.deepEqual(observedOrders[0], observedOrders[1]);
    assert.deepEqual(observedOrders[0], [...observedOrders[0]].sort());
    const rows = await prisma.inventoryItem.findMany({
      where: { variantId: { in: [seeded.inventory.variantId, seeded.inventory.secondVariantId] } },
    });
    assert.equal(rows.every((row) => row.reservedQty === 2 && row.onHandQty >= row.reservedQty), true);
  });

  it('makes concurrent exact reservation retries idempotent with one movement', async () => {
    await resetInventory(2);
    const locked = deferred();
    const releaseFirst = deferred();
    const secondStarted = deferred();
    const first = withInventoryRepository(hookedRepository({
      afterLock: async () => { locked.resolve(); await releaseFirst.promise; },
    }));
    const second = withInventoryRepository(hookedRepository({
      onLockStarted: () => secondStarted.resolve(),
    }));
    const request = input(uuidv7(), 2);

    const firstResult = first.execute(request);
    await locked.promise;
    const secondResult = second.execute(request);
    await secondStarted.promise;
    releaseFirst.resolve();
    const results = await Promise.all([firstResult, secondResult]);
    const state = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: {
        variantId: seeded.inventory.variantId,
        warehouseId: seeded.inventory.warehouseId,
      } },
    });
    const movements = await prisma.stockMovement.count({
      where: { movementType: 'reservation', referenceId: request.referenceId },
    });
    assert.equal(results.length, 2);
    assert.equal(state.reservedQty, 2);
    assert.equal(movements, 1);
  });

  it('allows only one winner for commit/release races in either lock acquisition order', async () => {
    for (const firstOperation of ['commit', 'release'] as const) {
      await resetInventory(2);
      const request = input(uuidv7(), 2);
      await reserve.execute(request);
      const locked = deferred();
      const releaseFirst = deferred();
      const secondStarted = deferred();
      const firstRepository = hookedRepository({
        afterLock: async () => { locked.resolve(); await releaseFirst.promise; },
      });
      const secondRepository = hookedRepository({
        onLockStarted: () => secondStarted.resolve(),
      });
      const commitUseCase = new CommitStockUseCase(
        prismaService,
        firstOperation === 'commit' ? firstRepository : secondRepository,
        movementRepository,
        auditRepository,
        new InventoryPolicyService(),
      );
      const releaseUseCase = new ReleaseStockUseCase(
        prismaService,
        firstOperation === 'release' ? firstRepository : secondRepository,
        movementRepository,
        auditRepository,
        new InventoryPolicyService(),
      );

      const first = firstOperation === 'commit'
        ? commitUseCase.execute(request)
        : releaseUseCase.execute(request);
      await locked.promise;
      const second = firstOperation === 'commit'
        ? releaseUseCase.execute(request)
        : commitUseCase.execute(request);
      await secondStarted.promise;
      releaseFirst.resolve();
      const results = await Promise.allSettled([first, second]);
      const state = await prisma.inventoryItem.findUniqueOrThrow({
        where: { variantId_warehouseId: {
          variantId: seeded.inventory.variantId,
          warehouseId: seeded.inventory.warehouseId,
        } },
      });

      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
      assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
      assert.equal(state.onHandQty >= 0, true);
      assert.equal(state.reservedQty, 0);
      assert.equal(await prisma.stockMovement.count({
        where: { movementType: { in: ['commit', 'release'] }, referenceId: request.referenceId },
      }), 1);
      assert.equal(state.onHandQty, firstOperation === 'commit' ? 0 : 2);
    }
  });

  it('leaves no stock or movement when a movement insert fails inside the transaction', async () => {
    await resetInventory(2);
    const failingMovementRepository: StockMovementRepository = {
      ...movementRepository,
      findByUniqueReference: movementRepository.findByUniqueReference.bind(movementRepository),
      list: movementRepository.list.bind(movementRepository),
      create: async (tx, data) => {
        await movementRepository.create(tx, data);
        throw new Error('injected stock movement insert failure');
      },
    };
    const failingReserve = new ReserveStockUseCase(
      prismaService,
      inventoryRepository,
      new PrismaInventoryReferenceRepository(prismaService),
      failingMovementRepository,
      auditRepository,
      new InventoryPolicyService(),
    );
    const request = input(uuidv7(), 1);

    await assert.rejects(failingReserve.execute(request), /injected stock movement insert failure/);
    const state = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: {
        variantId: seeded.inventory.variantId,
        warehouseId: seeded.inventory.warehouseId,
      } },
    });
    assert.equal(state.reservedQty, 0);
    assert.equal(await prisma.stockMovement.count({ where: { referenceId: request.referenceId } }), 0);
  });

  it('rolls back stock and movement when transactional audit persistence fails', async () => {
    await resetInventory(2);
    const failingAudit = { write: async () => { throw new Error('injected audit failure'); } };
    const auditedReserve = new ReserveStockUseCase(
      prismaService,
      inventoryRepository,
      new PrismaInventoryReferenceRepository(prismaService),
      movementRepository,
      failingAudit,
      new InventoryPolicyService(),
    );
    const request = input(uuidv7(), 1);

    await assert.rejects(auditedReserve.execute(request), /injected audit failure/);
    const state = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: {
        variantId: seeded.inventory.variantId,
        warehouseId: seeded.inventory.warehouseId,
      } },
    });
    assert.equal(state.reservedQty, 0);
    assert.equal(await prisma.stockMovement.count({ where: { referenceId: request.referenceId } }), 0);
  });

  it('keeps reserve/commit/release audit inside the caller transaction', async () => {
    await resetInventory(2);
    const request = input(uuidv7(), 1);
    const context = { get: () => undefined } as unknown as RequestContextService;
    const transactionalAudit = new PrismaAuditRepository(prismaService, context);
    const auditedReserve = new ReserveStockUseCase(
      prismaService,
      inventoryRepository,
      new PrismaInventoryReferenceRepository(prismaService),
      movementRepository,
      transactionalAudit,
      new InventoryPolicyService(),
    );
    const auditedCommit = new CommitStockUseCase(
      prismaService,
      inventoryRepository,
      movementRepository,
      transactionalAudit,
      new InventoryPolicyService(),
    );
    const auditedRelease = new ReleaseStockUseCase(
      prismaService,
      inventoryRepository,
      movementRepository,
      transactionalAudit,
      new InventoryPolicyService(),
    );

    await assert.rejects(prisma.$transaction(async (tx) => {
      await auditedReserve.execute({ ...request, tx });
      throw new Error('injected outer transaction failure');
    }), /injected outer transaction failure/);
    const state = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: {
        variantId: seeded.inventory.variantId,
        warehouseId: seeded.inventory.warehouseId,
      } },
    });
    assert.equal(state.reservedQty, 0);
    assert.equal(await prisma.stockMovement.count({ where: { referenceId: request.referenceId } }), 0);
    assert.equal(await prisma.auditLog.count({
      where: { action: 'inventory.reserved', entityId: request.referenceId },
    }), 0);

    const committedRequest = input(uuidv7(), 1);
    await prisma.$transaction(async (tx) => {
      await auditedReserve.execute({ ...committedRequest, tx });
    });
    assert.equal(await prisma.auditLog.count({
      where: { action: 'inventory.reserved', entityId: committedRequest.referenceId },
    }), 1);

    await prisma.$transaction(async (tx) => {
      await auditedCommit.execute({ ...committedRequest, tx });
    });
    assert.equal(await prisma.auditLog.count({
      where: { action: 'inventory.committed', entityId: committedRequest.referenceId },
    }), 1);

    await resetInventory(1);
    const releaseRequest = input(uuidv7(), 1);
    await reserve.execute(releaseRequest);
    await prisma.$transaction(async (tx) => {
      await auditedRelease.execute({ ...releaseRequest, tx });
    });
    assert.equal(await prisma.auditLog.count({
      where: { action: 'inventory.released', entityId: releaseRequest.referenceId },
    }), 1);
  });
});

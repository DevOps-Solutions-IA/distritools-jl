import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Prisma, PrismaClient } from '@prisma/client';
import { disconnectDatabase, prisma, resetDatabase } from 'tests/helpers/test-db';

const blocker = new PrismaClient();
const executor = new PrismaClient();
const a = '"public"."ex08_reset_retry_a"';
const b = '"public"."ex08_reset_retry_b"';

function latch() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

before(async () => {
  await prisma.$executeRawUnsafe(`CREATE TABLE ${a} (value integer NOT NULL)`);
  await prisma.$executeRawUnsafe(`CREATE TABLE ${b} (value integer NOT NULL)`);
});
after(async () => {
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${a}, ${b}`);
  await Promise.all([blocker.$disconnect(), executor.$disconnect(), disconnectDatabase()]);
});

describe('EX-08 reset retry with actual isolated PostgreSQL failures', () => {
  it('recovers from actual P2010/55P03 lock timeout without suppressing the error', async () => {
    await prisma.$executeRawUnsafe(`INSERT INTO ${b} VALUES (1)`);
    const held = latch();
    const release = latch();
    const lock = blocker.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`LOCK TABLE ${b} IN ACCESS EXCLUSIVE MODE`);
      held.resolve();
      await release.promise;
    }, { timeout: 10_000 });
    await held.promise;
    const original = prisma.$executeRawUnsafe;
    const failures: Prisma.PrismaClientKnownRequestError[] = [];
    let attempts = 0;
    Object.assign(prisma, { $executeRawUnsafe: async (sql: string) => {
      attempts += 1;
      try {
        return await executor.$transaction(async (tx) => {
          await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '100ms'");
          return tx.$executeRawUnsafe(sql);
        });
      } catch (error) {
        assert.ok(error instanceof Prisma.PrismaClientKnownRequestError);
        failures.push(error);
        release.resolve();
        await lock;
        throw error;
      }
    } });
    try { await resetDatabase(); }
    finally { Object.assign(prisma, { $executeRawUnsafe: original }); release.resolve(); await lock; }
    assert.equal(attempts, 2);
    assert.equal(failures.length, 1);
    assert.equal(failures[0].code, 'P2010');
    assert.equal(failures[0].meta?.code, '55P03');
    assert.deepEqual(await prisma.$queryRawUnsafe(`SELECT * FROM ${b}`), []);
  });

  it('recovers from an actual P2010/40P01 deadlock during reset TRUNCATE', async () => {
    await prisma.$executeRawUnsafe(`INSERT INTO ${a} VALUES (2)`);
    const held = latch();
    const startWait = latch();
    let blockerPid = 0;
    const lock = blocker.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL deadlock_timeout = '5s'");
      const rows = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      blockerPid = rows[0].pid;
      await tx.$executeRawUnsafe(`LOCK TABLE ${b} IN ACCESS EXCLUSIVE MODE`);
      held.resolve();
      await startWait.promise;
      await tx.$executeRawUnsafe(`LOCK TABLE ${a} IN ACCESS EXCLUSIVE MODE`);
    }, { timeout: 10_000 });
    await held.promise;
    const original = prisma.$executeRawUnsafe;
    const failures: Prisma.PrismaClientKnownRequestError[] = [];
    let attempts = 0;
    Object.assign(prisma, { $executeRawUnsafe: async (sql: string) => {
      attempts += 1;
      if (attempts > 1) { await lock; return original.call(prisma, sql); }
      try {
        return await executor.$transaction(async (tx) => {
          await tx.$executeRawUnsafe("SET LOCAL deadlock_timeout = '50ms'");
          await tx.$executeRawUnsafe(`LOCK TABLE ${a} IN ACCESS EXCLUSIVE MODE`);
          startWait.resolve();
          let blocked = false;
          for (let poll = 0; poll < 100; poll += 1) {
            const rows = await tx.$queryRaw<Array<{ blocked: boolean }>>`
              SELECT cardinality(pg_blocking_pids(${blockerPid}::integer)) > 0 AS blocked
            `;
            if (rows[0].blocked) { blocked = true; break; }
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
          assert.ok(blocked, 'opposing lock must be waiting before reset');
          return tx.$executeRawUnsafe(sql);
        }, { timeout: 10_000 });
      } catch (error) {
        assert.ok(error instanceof Prisma.PrismaClientKnownRequestError);
        failures.push(error);
        throw error;
      }
    } });
    try { await resetDatabase(); }
    finally { Object.assign(prisma, { $executeRawUnsafe: original }); startWait.resolve(); await lock; }
    assert.equal(attempts, 2);
    assert.equal(failures.length, 1);
    assert.equal(failures[0].code, 'P2010');
    assert.equal(failures[0].meta?.code, '40P01');
    assert.deepEqual(await prisma.$queryRawUnsafe(`SELECT * FROM ${a}`), []);
  });
});

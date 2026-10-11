import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';

let prisma: PrismaClient;
let resetDatabase: () => Promise<void>;
let disconnectDatabase: () => Promise<void>;

before(async () => {
  // Unit CI has no .env.test or service. Stub only the legacy env-file read
  // during import; restore filesystem access before exercising reset behavior.
  const read = fs.readFileSync;
  const stub = mock.method(fs, 'readFileSync', (file: fs.PathOrFileDescriptor, options: unknown) => {
    if (file === path.resolve(process.cwd(), '.env.test')) return '';
    return Reflect.apply(read, fs, [file, options]);
  });
  try {
    ({ prisma, resetDatabase, disconnectDatabase } = await import('tests/helpers/test-db'));
  } finally { stub.mock.restore(); }
});

function known(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('Synthetic reset failure', {
    code, clientVersion: Prisma.prismaVersion.client, meta,
  });
}

async function exercise(error: unknown, failures: number) {
  const query = prisma.$queryRaw;
  const execute = prisma.$executeRawUnsafe;
  let queries = 0;
  let attempts = 0;
  // Only this process-local client is replaced; no database or global timer.
  Object.assign(prisma, {
    $queryRaw: async () => { queries += 1; return [{ tablename: 'synthetic_retry' }]; },
    $executeRawUnsafe: async () => {
      attempts += 1;
      if (attempts <= failures) throw error;
      return 0;
    },
  });
  let rejected: unknown;
  try { await resetDatabase(); } catch (caught) { rejected = caught; }
  finally { Object.assign(prisma, { $queryRaw: query, $executeRawUnsafe: execute }); }
  return { attempts, queries, rejected };
}

after(async () => { if (disconnectDatabase) await disconnectDatabase(); });

describe('EX-08 bounded reset retry SQLSTATE boundary', () => {
  for (const state of ['40P01', '55P03']) {
    it(`retries P2010 wrapping PostgreSQL ${state} and returns on success`, async () => {
      const result = await exercise(known('P2010', { code: state }), 1);
      assert.equal(result.rejected, undefined);
      assert.equal(result.attempts, 2);
      assert.equal(result.queries, 2);
    });
  }

  it('preserves eight attempts, seven increasing waits and final error identity', async () => {
    const error = known('P2010', { code: '55P03' });
    const started = Date.now();
    const result = await exercise(error, 20);
    assert.equal(result.attempts, 8);
    assert.equal(result.queries, 8);
    assert.equal(result.rejected, error);
    assert.ok(Date.now() - started >= 2800, '100 + 200 + ... + 700 ms backoff');
  });

  for (const [name, error] of [
    ['non-retryable SQLSTATE', known('P2010', { code: '23505' })],
    ['unknown SQLSTATE', known('P2010', { code: 'ZZ999' })],
    ['missing metadata', known('P2010')],
    ['missing metadata code', known('P2010', {})],
    ['numeric metadata', known('P2010', { code: 40001 })],
    ['lowercase malformed metadata', known('P2010', { code: '40p01' })],
    ['whitespace metadata', known('P2010', { code: ' 40P01' })],
    ['long metadata', known('P2010', { code: '40P010' })],
    ['unrelated Prisma code', known('P2002', { code: '40P01' })],
    ['unrelated transaction error', known('P2034', { code: '55P03' })],
    ['plain object lookalike', { code: 'P2010', meta: { code: '40P01' } }],
    ['null', null],
    ['ordinary error', new Error('Synthetic unexpected reset failure')],
  ] as const) {
    it(`does not retry ${name}`, async () => {
      const result = await exercise(error, 20);
      assert.equal(result.attempts, 1);
      assert.equal(result.queries, 1);
      assert.equal(result.rejected, error);
    });
  }

  it('retains the existing unknown-request SQLSTATE compatibility', async () => {
    const error = new Prisma.PrismaClientUnknownRequestError('Code: `40P01`', {
      clientVersion: Prisma.prismaVersion.client,
    });
    assert.deepEqual(await exercise(error, 1), { attempts: 2, queries: 2, rejected: undefined });
  });

  it('retains the existing ordinary Error SQLSTATE compatibility', async () => {
    assert.deepEqual(await exercise(new Error('Code: `55P03`'), 1), {
      attempts: 2, queries: 2, rejected: undefined,
    });
  });
});

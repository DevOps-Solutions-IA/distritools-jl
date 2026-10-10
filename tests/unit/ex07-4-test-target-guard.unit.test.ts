import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertDisposableTarget } from 'tests/helpers/ex07-4-disposable-target';

const canonicalCi: NodeJS.ProcessEnv = {
  CI: 'true', NODE_ENV: 'test', APP_ENV: 'test',
  DATABASE_URL: 'postgresql://postgres:synthetic@127.0.0.1:5432/distritoolsjl_test?schema=public&connection_limit=20',
  REDIS_URL: 'redis://127.0.0.1:6379',
};

describe('EX-07.4 disposable test target guard', () => {
  it('accepts the canonical CI-owned PostgreSQL/Redis targets without agent-specific opt-in', () => {
    assert.doesNotThrow(() => assertDisposableTarget(canonicalCi));
  });
  it('accepts owned local isolated ports with an explicit test database name', () => {
    assert.doesNotThrow(() => assertDisposableTarget({ ...canonicalCi,
      DATABASE_URL: 'postgresql://postgres:synthetic@127.0.0.1:33147/distritoolsjl_ex074_a18_test',
      REDIS_URL: 'redis://127.0.0.1:33148',
    }));
  });
  it('accepts the former A1 target under the same CI-owned test contract', () => {
    assert.doesNotThrow(() => assertDisposableTarget({ ...canonicalCi,
      DATABASE_URL: 'postgresql://postgres:synthetic@localhost:33147/distritools_ex074_a1_test',
    }));
  });

  const unsafe: [string, NodeJS.ProcessEnv][] = [
    ['missing CI ownership', { CI: undefined }],
    ['false CI ownership', { CI: 'false' }],
    ['non-test NODE_ENV', { NODE_ENV: 'production' }],
    ['missing NODE_ENV', { NODE_ENV: undefined }],
    ['non-test APP_ENV', { APP_ENV: 'production' }],
    ['missing APP_ENV', { APP_ENV: undefined }],
    ['remote PostgreSQL', { DATABASE_URL: 'postgresql://postgres:synthetic@192.0.2.1:33147/distritoolsjl_test' }],
    ['non-test database name', { DATABASE_URL: 'postgresql://postgres:synthetic@127.0.0.1:33147/distritoolsjl' }],
    ['misleading test substring', { DATABASE_URL: 'postgresql://postgres:synthetic@127.0.0.1:33147/contest' }],
    ['missing PostgreSQL URL', { DATABASE_URL: undefined }],
    ['non-PostgreSQL URL', { DATABASE_URL: 'mysql://postgres:synthetic@127.0.0.1:33147/distritoolsjl_test' }],
    ['shared developer PostgreSQL port', { DATABASE_URL: 'postgresql://postgres:synthetic@127.0.0.1:55440/distritools_ex074_a1_test' }],
    ['developer Redis port used for PostgreSQL', { DATABASE_URL: 'postgresql://postgres:synthetic@127.0.0.1:56379/distritools_ex074_a1_test' }],
    ['remote Redis', { REDIS_URL: 'redis://192.0.2.1:33148' }],
    ['missing Redis URL', { REDIS_URL: undefined }],
    ['non-Redis URL', { REDIS_URL: 'http://127.0.0.1:33148' }],
    ['shared developer Redis port', { REDIS_URL: 'redis://127.0.0.1:56379' }],
    ['developer PostgreSQL port used for Redis', { REDIS_URL: 'redis://127.0.0.1:55440' }],
    ['default shared PostgreSQL without CI ownership', { CI: undefined, DATABASE_URL: canonicalCi.DATABASE_URL, REDIS_URL: 'redis://127.0.0.1:33148' }],
    ['default shared Redis without CI ownership', { CI: undefined, DATABASE_URL: 'postgresql://postgres:synthetic@127.0.0.1:33147/distritoolsjl_test' }],
  ];
  for (const [name, overrides] of unsafe) {
    it(`rejects ${name} even with the former agent-specific opt-in`, () => {
      assert.throws(() => assertDisposableTarget({ ...canonicalCi,
        DATABASE_URL: 'postgresql://postgres:synthetic@127.0.0.1:33147/distritools_ex074_a1_test',
        EX074_QUOTES_DISPOSABLE_DB: '1', ...overrides }));
    });
  }
});

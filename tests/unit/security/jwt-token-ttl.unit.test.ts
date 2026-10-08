import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { JwtTokenService } from 'src/modules/auth/infrastructure/security/jwt-token.service';
import { syntheticSecret } from 'tests/helpers/synthetic-secret';

const originalEnv = { ...process.env };

function configureProduction(ttls: Record<string, string> = {}) {
  process.env = {
    ...originalEnv,
    APP_ENV: 'production',
    NODE_ENV: 'production',
    JWT_ACCESS_SECRET: syntheticSecret('access'),
    JWT_REFRESH_SECRET: syntheticSecret('refresh'),
    JWT_2FA_CHALLENGE_SECRET: syntheticSecret('challenge'),
    ...ttls,
  };
}

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('JwtTokenService TTL enforcement', () => {
  it('emits accepted sub-maximum durations using normalized numeric seconds', async () => {
    configureProduction({
      JWT_ACCESS_TTL: '14m',
      JWT_REFRESH_TTL: '168h',
      JWT_2FA_CHALLENGE_TTL: '9m',
    });
    const signed: Array<{ expiresIn?: number }> = [];
    const service = new JwtTokenService({
      signAsync: async (_payload: unknown, options: { expiresIn?: number }) => {
        signed.push(options);
        return `token-${signed.length}`;
      },
    } as never);

    await service.issueTokenPair({ sub: 'user-id', email: 'test@example.invalid', role: 'admin', sessionId: 'session-id' });
    await service.issueTwoFactorChallenge({ sub: 'user-id', email: 'test@example.invalid' });

    assert.deepEqual(signed.map(({ expiresIn }) => expiresIn), [840, 604800, 540]);
  });

  it('emits the existing default lifetimes when TTL variables are absent', async () => {
    configureProduction();
    delete process.env.JWT_ACCESS_TTL;
    delete process.env.JWT_REFRESH_TTL;
    delete process.env.JWT_2FA_CHALLENGE_TTL;
    const signed: Array<{ expiresIn?: number }> = [];
    const service = new JwtTokenService({
      signAsync: async (_payload: unknown, options: { expiresIn?: number }) => {
        signed.push(options);
        return `token-${signed.length}`;
      },
    } as never);

    await service.issueTokenPair({ sub: 'user-id', email: 'test@example.invalid', role: 'admin', sessionId: 'session-id' });
    await service.issueTwoFactorChallenge({ sub: 'user-id', email: 'test@example.invalid' });

    assert.deepEqual(signed.map(({ expiresIn }) => expiresIn), [900, 604800, 600]);
  });

  it('refuses over-limit configured TTLs before signing a credential', async () => {
    for (const [name, value] of [
      ['JWT_ACCESS_TTL', '16m'],
      ['JWT_REFRESH_TTL', '8d'],
      ['JWT_2FA_CHALLENGE_TTL', '11m'],
    ]) {
      configureProduction({ [name]: value });
      let signCalls = 0;
      const service = new JwtTokenService({
        signAsync: async () => { signCalls += 1; return 'unexpected'; },
      } as never);

      const issue = name === 'JWT_2FA_CHALLENGE_TTL'
        ? service.issueTwoFactorChallenge({ sub: 'user-id', email: 'test@example.invalid' })
        : service.issueTokenPair({ sub: 'user-id', email: 'test@example.invalid', role: 'admin', sessionId: 'session-id' });
      await assert.rejects(issue, new RegExp(name));
      assert.equal(signCalls, 0, `${name} must be rejected before signing`);
    }
  });

  it('does not replace a malformed TTL with a longer fallback at issuance', async () => {
    configureProduction({ JWT_ACCESS_TTL: 'invalid' });
    let signCalls = 0;
    const service = new JwtTokenService({
      signAsync: async () => { signCalls += 1; return 'unexpected'; },
    } as never);

    await assert.rejects(
      service.issueTokenPair({ sub: 'user-id', email: 'test@example.invalid', role: 'admin', sessionId: 'session-id' }),
      /JWT_ACCESS_TTL/,
    );
    assert.equal(signCalls, 0);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validate } from 'class-validator';
import { LoginAdminRequestDto } from 'src/modules/auth/infrastructure/http/dto/login-admin.request.dto';
import { RefreshTokenRequestDto } from 'src/modules/auth/infrastructure/http/dto/refresh-token.request.dto';
import { VerifyTwoFactorRequestDto } from 'src/modules/auth/infrastructure/http/dto/verify-two-factor.request.dto';

describe('auth request DTO validation', () => {
  it('rejects missing or non-string login credentials', async () => {
    const invalid = Object.assign(new LoginAdminRequestDto(), { email: {}, password: 1 });
    const errors = await validate(invalid);
    assert.deepEqual(errors.map(({ property }) => property).sort(), ['email', 'password']);
  });

  it('rejects malformed refresh and 2FA request bodies', async () => {
    const refreshErrors = await validate(Object.assign(new RefreshTokenRequestDto(), { refreshToken: null }));
    const challengeErrors = await validate(Object.assign(new VerifyTwoFactorRequestDto(), { challengeToken: 1, code: null }));
    assert.deepEqual(refreshErrors.map(({ property }) => property), ['refreshToken']);
    assert.deepEqual(challengeErrors.map(({ property }) => property).sort(), ['challengeToken', 'code']);
  });
});

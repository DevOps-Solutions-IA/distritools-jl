import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import {
  disconnectDatabase,
  resetDatabase,
  seedBaseData,
} from 'tests/helpers/test-db';

describe('Authentication and RBAC', async () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;

  before(async () => {
    await resetDatabase();
    seeded = await seedBaseData();
    const testApp = await createTestApp();
    app = testApp.app;
    http = testApp.http;
  });

  after(async () => {
    await app.close();
    await disconnectDatabase();
  });

  await it('admin login + 2FA + refresh rotation works', async () => {
    const login = await http.post('/api/v1/auth/login').send({
      email: seeded.users.adminEmail,
      password: seeded.users.adminPassword,
    });
    assert.equal(login.status, 201);
    assert.ok(login.body.challengeToken);

    const session = await loginAsAdmin(
      http,
      seeded.users.adminEmail,
      seeded.users.adminPassword,
      seeded.users.twoFactorSecret,
    );
    assert.ok(session.accessToken);
    assert.ok(session.refreshToken);

    const refresh = await http.post('/api/v1/auth/refresh').send({
      refreshToken: session.refreshToken,
    });
    assert.equal(refresh.status, 201);
    assert.ok(refresh.body.accessToken);
    assert.ok(refresh.body.refreshToken);
    assert.notEqual(refresh.body.refreshToken, session.refreshToken);
  });

  await it('rejects unauthorized admin access', async () => {
    const response = await http.get(
      `/api/v1/admin/users/${seeded.users.adminUserId}`,
    );
    assert.equal(response.status, 401);
  });

  await it('enforces RBAC for forbidden actions', async () => {
    const viewer = await loginAsAdmin(
      http,
      seeded.users.viewerEmail,
      seeded.users.viewerPassword,
      seeded.users.twoFactorSecret,
    );

    const response = await http
      .post('/api/v1/admin/inventory/reserve')
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({
        referenceType: 'test',
        referenceId: 'rbac-check',
        lines: [
          {
            variantId: seeded.inventory.variantId,
            warehouseId: seeded.inventory.warehouseId,
            quantity: 1,
          },
        ],
      });

    assert.equal(response.status, 403);
  });
});

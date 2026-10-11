import { URL } from 'node:url';
import process from 'node:process';
import { test, expect } from '@playwright/test';
import * as control from '../private-control.mjs';
let revokedAccess;
test.describe.configure({ mode: 'serial' });
test.afterAll(() => control.close());
async function browserFetch(page, url, options) {
  return page.evaluate(async ({ url, options }) => {
    const response = await globalThis.fetch(url, options);
    return { status: response.status, private: response.headers.get('cache-control')?.includes('no-store') ?? false, payload: await response.json().catch(() => null) };
  }, { url, options });
}
async function login(page, user) {
  await page.goto('/admin/login');
  await page.getByLabel('Correo administrativo').fill(user.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(user.password);
  const start = page.waitForResponse(response => response.url().endsWith('/api/admin/session/start') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  expect((await start).status()).toBe(200);
  await expect(page.getByLabel('Código 2FA')).toBeVisible();
  await page.getByLabel('Código 2FA').fill(await control.otp());
  const verify = page.waitForResponse(response => response.url().endsWith('/api/admin/session/verify') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Entrar al panel' }).click();
  expect((await verify).status()).toBe(200);
  await expect(page.locator('.admin-backend-status')).toHaveText('Sesión verificada');
}

test('Anonymous session is401 and protected SSR routes recover through login', async ({ page }) => {
  await page.goto('/admin/login');
  const self = await browserFetch(page, '/api/admin/session');
  expect(self.status).toBe(401);
  await page.goto('/admin/productos');
  await expect(page).toHaveURL(/\/admin\/login/);
});

test('Invalid login and2FA payloads400 create no partial persisted session', async ({ page }) => {
  await page.goto('/admin/login');
  const before = await control.counts();
  expect((await browserFetch(page, '/api/admin/session/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'invalid', password: 'x' }) })).status).toBe(400);
  expect((await browserFetch(page, '/api/admin/session/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'x' }) })).status).toBe(400);
  const raw = await globalThis.fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: control.fixture.admin.email, password: control.fixture.admin.password, unexpected: 'must-reject' }) });
  expect(raw.status).toBe(400);
  expect((await raw.json()).error).toContain('property unexpected should not exist');
  expect(await control.counts()).toEqual(before);
});

test('Actual UI2FA SecureHttpOnly session reads current persisted role and logout revokes with audit', async ({ page }) => {
  const unexpected = [], errors = [];
  page.on('pageerror', () => errors.push('pageerror'));
  page.on('request', request => { if (new URL(request.url()).origin !== process.env.EX08_BROWSER_BASE_URL) unexpected.push('external'); });
  await login(page, control.fixture.admin);
  let self = await browserFetch(page, '/api/admin/session');
  expect(self.status).toBe(200); expect(self.private).toBe(true);
  expect(self.payload.user.permissions.includes('users.read')).toBe(true);
  const cookies = await page.context().cookies();
  const access = cookies.find(cookie => cookie.name === 'dt_admin_access');
  expect(Boolean(access?.httpOnly && access?.secure && access?.sameSite === 'Lax')).toBe(true);
  expect(Boolean(cookies.find(cookie => cookie.name === 'dt_admin_refresh')?.httpOnly)).toBe(true);
  revokedAccess = access.value;
  try {
    await control.role(control.fixture.roles.limitedRoleId);
    self = await browserFetch(page, '/api/admin/session');
    expect(self.status).toBe(200); expect(self.payload.user.permissions).toEqual(['inventory.read']);
    expect((await browserFetch(page, '/api/admin/users')).status).toBe(403);
    expect((await page.context().cookies()).find(cookie => cookie.name === 'dt_admin_access')?.value === revokedAccess).toBe(true);
  } finally { await control.role(control.fixture.roles.superAdminRoleId); }
  await page.goto('/admin/pedidos');
  await expect(page.locator('.admin-backend-status')).toHaveText('Sesión verificada');
  const widths = [320, 375, 768, 1024, 1440];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const logout = page.waitForResponse(response => response.url().endsWith('/api/admin/session/logout') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Salir', exact: true }).click();
  expect((await logout).status()).toBe(201);
  await expect(page).toHaveURL(/\/admin\/login/);
  expect((await page.context().cookies()).some(cookie => cookie.name.startsWith('dt_admin_'))).toBe(false);
  expect(await control.logoutState()).toEqual({ revokedCount: 1, auditCount: 1, auditedSessionMatches: true });
  const response = await globalThis.fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/admin/session`, { headers: { Authorization: `Bearer ${revokedAccess}` } });
  expect(response.status).toBe(401);
  expect(errors).toEqual([]); expect(unexpected).toEqual([]);
});

test('Viewer actual2FA permits minimal self but forbids target read and write with no mutation', async ({ page }) => {
  await login(page, control.fixture.viewer);
  const self = await browserFetch(page, '/api/admin/session');
  expect(self.status).toBe(200); expect(self.payload.user.permissions).toEqual(['inventory.read']);
  const before = await control.counts();
  expect((await browserFetch(page, '/api/admin/users')).status).toBe(403);
  expect((await browserFetch(page, '/api/admin/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Unauthorized synthetic product', slug: 'qa-unauthorized' }) })).status).toBe(403);
  const after = await control.counts();
  expect({ products: after.products, sessions: after.sessions }).toEqual({ products: before.products, sessions: before.sessions });
  await expect.poll(() => control.denials()).toEqual({ read: true, write: true });
  await page.goto('/admin/pedidos');
  await expect(page.getByRole('heading', { name: 'Acceso denegado' })).toBeVisible();
  expect(await page.locator('.admin-main table').count()).toBe(0);
});

test('Previously revoked real token401 clears local cookies and permits login recovery', async ({ page }) => {
  expect(typeof revokedAccess === 'string' && revokedAccess.length > 20).toBe(true);
  await page.context().addCookies([{ name: 'dt_admin_access', value: revokedAccess, url: process.env.EX08_BROWSER_BASE_URL, secure: true, httpOnly: true, sameSite: 'Lax' }]);
  await page.goto('/admin/login');
  const self = await browserFetch(page, '/api/admin/session');
  expect(self.status).toBe(401);
  expect((await page.context().cookies()).some(cookie => cookie.name === 'dt_admin_access')).toBe(false);
  await page.goto('/admin/productos');
  await expect(page).toHaveURL(/\/admin\/login/);
  expect((await control.logoutState()).auditCount).toBe(1);
});

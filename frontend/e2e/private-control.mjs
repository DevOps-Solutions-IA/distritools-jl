import { setTimeout } from 'node:timers';
import process from 'node:process';
import { createRequire } from 'node:module';
const nodeRequire = createRequire(import.meta.url);
// Test-process-only DB control; no QA endpoint is mounted in the product app.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateTargets, verifyContainer } from './safety.mjs';
const root = path.resolve(import.meta.dirname, '../..');
function prove() {
  const descriptor = JSON.parse(fs.readFileSync(path.join(process.env.EX08_BROWSER_RUN_DIR, 'services.json')));
  validateTargets({ ports: { postgres: descriptor.containers.find(item => item.kind === 'postgres').port, redis: descriptor.containers.find(item => item.kind === 'redis').port }, owner: descriptor.owner, databaseUrl: process.env.DATABASE_URL, redisUrl: process.env.REDIS_URL, appEnv: process.env.APP_ENV, nodeEnv: process.env.NODE_ENV, authDisabled: process.env.ADMIN_AUTH_DISABLED });
  for (const item of descriptor.containers) verifyContainer(JSON.parse(execFileSync('docker', ['inspect', item.id], { encoding: 'utf8' }))[0], { ...item, owner: descriptor.owner });
}
prove();
const { PrismaClient } = nodeRequire(path.join(root, 'node_modules/@prisma/client'));
const { generate } = nodeRequire(path.join(root, 'node_modules/otplib'));
const prisma = new PrismaClient();
const fixture = JSON.parse(fs.readFileSync(path.join(process.env.EX08_BROWSER_RUN_DIR, 'private-fixture.json')));
async function otp() {
  prove();
  const remaining = 30000 - Date.now() % 30000;
  if (remaining < 4000) await new Promise(resolve => setTimeout(resolve, remaining + 100));
  return generate({ secret: fixture.twoFactorSecret });
}
async function role(roleId) {
  prove();
  await prisma.user.update({ where: { id: fixture.admin.id }, data: { roleId } });
}
async function counts() {
  prove();
  return { products: await prisma.product.count(), sessions: await prisma.authSession.count(), audits: await prisma.auditLog.count() };
}
async function logoutState() {
  prove();
  const sessions = await prisma.authSession.findMany({ where: { userId: fixture.admin.id }, select: { id: true, revokedAt: true } });
  const audits = await prisma.auditLog.findMany({ where: { actorUserId: fixture.admin.id, action: 'auth.logout' }, select: { entityId: true } });
  return { revokedCount: sessions.filter(item => item.revokedAt !== null).length, auditCount: audits.length, auditedSessionMatches: audits.some(item => sessions.some(session => session.id === item.entityId && session.revokedAt !== null)) };
}
const close = () => prisma.$disconnect();
async function denials() {
  prove();
  const records = await prisma.auditLog.findMany({ where: { actorUserId: fixture.viewer.id, action: 'auth.permission_denied' }, select: { entityId: true } });
  return { read: records.some(row => row.entityId === 'GET /api/v1/admin/users'), write: records.some(row => row.entityId === 'POST /api/v1/admin/products') };
}
export { fixture, otp, role, counts, logoutState, close, denials };

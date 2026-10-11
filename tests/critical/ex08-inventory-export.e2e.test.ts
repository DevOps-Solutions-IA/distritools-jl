import 'tests/helpers/test-env';
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync, ChildProcess } from 'node:child_process';
import path from 'node:path';
import request, { Response } from 'supertest';
import { generate } from 'otplib';
import { randomUUID } from 'node:crypto';
import { prisma, resetDatabase, seedBaseData, disconnectDatabase } from 'tests/helpers/test-db';

// A plain Node child loads tsc output: production decorator metadata and globals
// must be installed BEFORE init. No legacy helper/global/auth bypass is changed.
const backend = String.raw`
require('reflect-metadata');
const {NestFactory}=require('@nestjs/core');
const {ValidationPipe}=require('@nestjs/common');
const {AppModule}=require('./dist/src/app/app.module');
const {GlobalExceptionFilter}=require('./dist/src/common/filters/global-exception.filter');
const {MetricsInterceptor}=require('./dist/src/infra/telemetry/metrics/metrics.interceptor');
const {AUDIT_REPOSITORY}=require('./dist/src/modules/auth/domain/repositories/audit.repository');
(async()=>{
 const app=await NestFactory.create(AppModule,{rawBody:true,logger:false});
 app.setGlobalPrefix('api/v1');
 app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
 app.useGlobalFilters(new GlobalExceptionFilter());app.useGlobalInterceptors(app.get(MetricsInterceptor));
 const repo=app.get(AUDIT_REPOSITORY);const original=repo.write.bind(repo);let fault=null;
 repo.write=async(entry,tx)=>{if(entry.action===fault)throw new Error('EX08 synthetic audit failure');return original(entry,tx)};
 await app.listen(0,'127.0.0.1');process.send({ready:app.getHttpServer().address().port});
 process.on('message',async(m)=>{if(m.close){await app.close();process.exit(0)}else {fault=m.fault??null;process.send({ack:true})}});
})().catch(()=>process.exit(1));
`;
let child: ChildProcess;
let http: ReturnType<typeof request>;
let seeded: Awaited<ReturnType<typeof seedBaseData>>;
let admin: string;
let viewer: string;
let originalAuthorizedCsv: string;
async function fault(action: string | null) {
 await new Promise<void>((resolve,reject)=>{child.once('message',()=>resolve());child.send({fault:action},(e)=>{if(e)reject(e)})});
}
const auth = () => ({Authorization:`Bearer ${admin}`});
const stockWhere = () => ({variantId_warehouseId:{variantId:seeded.inventory.variantId,warehouseId:seeded.inventory.warehouseId}});
async function login(email:string,password:string) {
 // Do not generate a code at the end of its time step; no backend tolerance is changed.
 const remaining=30000-Date.now()%30000;if(remaining<5000)await new Promise(r=>setTimeout(r,remaining+25));
 const a=await http.post('/api/v1/auth/login').send({email,password});assert.equal(a.status,201);
 const b=await http.post('/api/v1/auth/verify-2fa').send({challengeToken:a.body.challengeToken,code:await generate({secret:seeded.users.twoFactorSecret})});assert.equal(b.status,201);assert.ok(b.body.accessToken);return b.body.accessToken as string;
}
const endpoint = '/api/v1/admin/inventory/export';
function cells(csv: string): string[][] {
 const result: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
 for (let i = 0; i < csv.length; i++) {
  const ch = csv[i];
  if (ch === '"') { if (quoted && csv[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
  else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
  else if (ch === '\n' && !quoted) { row.push(cell); result.push(row); row = []; cell = ''; }
  else cell += ch;
 }
 row.push(cell); result.push(row); assert.equal(quoted, false); return result;
}
async function permissions() {
 const links = await prisma.rolePermission.findMany({ where: { roleId: seeded.roles.limitedRoleId }, include: { permission: true } });
 return links.map(x => x.permission.slug).sort();
}
async function grant(slug: string) {
 const permission = await prisma.permission.findUniqueOrThrow({ where: { slug } });
 await prisma.rolePermission.create({ data: { id: randomUUID(), roleId: seeded.roles.limitedRoleId, permissionId: permission.id } });
}
async function stockSnapshot() {
 return { stock: JSON.stringify(await prisma.inventoryItem.findMany({ orderBy: { id: 'asc' } })), movements: JSON.stringify(await prisma.stockMovement.findMany({ orderBy: { id: 'asc' } })) };
}
describe('EX08 inventory export actual session financial authority', () => {
 before(async () => {
  execFileSync(process.execPath, ['scripts/ci/assert-test-environment.js'], { stdio: 'pipe' });
  execFileSync('npm', ['run', 'build'], { stdio: 'pipe' });
  await resetDatabase(); seeded = await seedBaseData();
  child = spawn(process.execPath, ['-e', backend], { cwd: process.cwd(), env: { ...process.env, NODE_PATH: path.resolve('dist') }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  child.stderr?.resume();
  const port = await new Promise<number>((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Compiled backend startup timed out')), 30000); child.once('message', (m: { ready: number }) => { clearTimeout(timer); resolve(m.ready); }); child.once('exit', () => { clearTimeout(timer); reject(new Error('Compiled backend exited before ready')); }); });
  http = request(`http://127.0.0.1:${port}`);
  admin = await login(seeded.users.adminEmail, seeded.users.adminPassword); viewer = await login(seeded.users.viewerEmail, seeded.users.viewerPassword);
  await prisma.inventoryItem.update({ where: stockWhere(), data: { costPrice: 100, onHandQty: 20, reservedQty: 3, committedQty: 1 } });
 });
 after(async () => { if (child?.connected) { child.send({ close: true }); await new Promise<void>(r => child.once('exit', () => r())); } await disconnectDatabase(); });
 it('enforces real JWT and existing export permission without stock mutation or export audit', async () => {
  const before = await stockSnapshot(); const count = await prisma.auditLog.count({ where: { action: 'inventory.exported' } });
  assert.equal((await http.get(endpoint)).status, 401);
  assert.equal((await http.get(endpoint).set('Authorization', `Bearer ${viewer}`)).status, 403);
  assert.deepEqual(await permissions(), ['inventory.read']);
  assert.deepEqual(await stockSnapshot(), before); assert.equal(await prisma.auditLog.count({ where: { action: 'inventory.exported' } }), count);
 });
 it('retains actual authorized CSV and persisted read audit', async () => {
  const before = await stockSnapshot(); const res = await http.get(endpoint).set(auth());
  assert.equal(res.status, 200); assert.match(res.headers['content-type'], /text\/csv/); assert.match(res.headers['content-disposition'], /inventory-export\.csv/);
  originalAuthorizedCsv = res.text; const parsed = cells(res.text); const sku = (await prisma.variant.findUniqueOrThrow({ where: { id: seeded.inventory.variantId } })).sku;
  const row = parsed.find(r => r[0] === sku)!; assert.ok(row); assert.deepEqual(row.slice(5, 9), ['20', '3', '1', '16']); assert.deepEqual(row.slice(10), ['100', '1600']);
  const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'inventory.exported', actorUserId: seeded.users.adminUserId } });
  assert.equal(audit.entityType, 'inventory_export'); assert.equal((audit.afterData as { rows: number }).rows, parsed.length - 1); assert.deepEqual(await stockSnapshot(), before);
 });
 it('redacts actual cost/value for persisted read+export session; live cost grant restores same full CSV', async () => {
  await grant('inventory.export'); assert.deepEqual(await permissions(), ['inventory.export', 'inventory.read']);
  const session = await http.get('/api/v1/admin/session').set('Authorization', `Bearer ${viewer}`); assert.equal(session.status, 200); assert.deepEqual(session.body.user.permissions.sort(), ['inventory.export', 'inventory.read']);
  const before = await stockSnapshot(); const res = await http.get(endpoint).set('Authorization', `Bearer ${viewer}`); assert.equal(res.status, 200);
  const expected = cells(originalAuthorizedCsv); const denied = cells(res.text);
  const seededSku = (await prisma.variant.findUniqueOrThrow({ where: { id: seeded.inventory.variantId } })).sku;
  assert.deepEqual(denied.find(r => r[0] === seededSku)!.slice(10), ['NO_PERMISSION', 'NO_PERMISSION']); assert.deepEqual(denied[0], expected[0]);
  for (let i = 1; i < expected.length; i++) { assert.deepEqual(denied[i].slice(0, 10), expected[i].slice(0, 10)); assert.deepEqual(denied[i].slice(10), ['NO_PERMISSION', 'NO_PERMISSION']); }
  assert.ok(!res.text.includes(seeded.users.viewerEmail)); assert.ok(!res.text.includes(seeded.users.viewerUserId));
  assert.equal(await prisma.auditLog.count({ where: { action: 'inventory.exported', actorUserId: seeded.users.viewerUserId } }), 1); assert.deepEqual(await stockSnapshot(), before);
  await grant('inventory.cost.read'); const allowed = await http.get(endpoint).set('Authorization', `Bearer ${viewer}`); assert.equal(allowed.status, 200); assert.equal(allowed.text, originalAuthorizedCsv);
  assert.deepEqual(await stockSnapshot(), before);
 });
 it('distinguishes authorized zero/null and protects denied financial cells', async () => {
  const permission = await prisma.permission.findUniqueOrThrow({ where: { slug: 'inventory.cost.read' } });
  await prisma.rolePermission.deleteMany({ where: { roleId: seeded.roles.limitedRoleId, permissionId: permission.id } });
  const sku = (await prisma.variant.findUniqueOrThrow({ where: { id: seeded.inventory.variantId } })).sku;
  for (const [cost, expected] of [[0, ['0', '0']], [null, ['', '']]] as const) {
   await prisma.inventoryItem.update({ where: stockWhere(), data: { costPrice: cost } });
   const allowed = await http.get(endpoint).set(auth()); assert.equal(allowed.status, 200); assert.deepEqual(cells(allowed.text).find(r => r[0] === sku)!.slice(10), expected);
   const denied = await http.get(endpoint).set('Authorization', `Bearer ${viewer}`); assert.equal(denied.status, 200); assert.deepEqual(cells(denied.text).find(r => r[0] === sku)!.slice(10), ['NO_PERMISSION', 'NO_PERMISSION']);
  }
 });
 it('neutralizes actual formula text and preserves quoted multiline cells and negative financial numbers', async () => {
  const variant = await prisma.variant.findUniqueOrThrow({ where: { id: seeded.inventory.variantId } });
  await prisma.inventoryItem.update({ where: stockWhere(), data: { costPrice: -2 } });
  await prisma.product.update({ where: { id: variant.productId! }, data: { name: 'Product, "quoted"\nline\rreturn' } });
  for (const name of ['=1+1', '\t+SUM(1,2)', '-SUM(1,2)', '@SUM(1,2)']) {
   await prisma.variant.update({ where: { id: variant.id }, data: { name } });
   const before = await stockSnapshot(); const res = await http.get(endpoint).set(auth()); assert.equal(res.status, 200);
   const row = cells(res.text).find(r => r[0] === variant.sku)!;
   assert.equal(row[1], 'Product, "quoted"\nline\rreturn'); assert.equal(row[2], "'" + name); assert.deepEqual(row.slice(10), ['-2', '-32']); assert.deepEqual(await stockSnapshot(), before);
  }
 });
 it('fails closed with 500 and no CSV when persisted audit write fails', async () => {
  const before = await stockSnapshot(); const count = await prisma.auditLog.count({ where: { action: 'inventory.exported' } }); await fault('inventory.exported');
  try { const res = await http.get(endpoint).set(auth()); assert.equal(res.status, 500); assert.ok(!/text\/csv/.test(res.headers['content-type'])); assert.ok(!res.headers['content-disposition']); assert.ok(!res.text.includes('costPrice')); assert.deepEqual(await stockSnapshot(), before); assert.equal(await prisma.auditLog.count({ where: { action: 'inventory.exported' } }), count); }
  finally { await fault(null); }
 });
});

import 'tests/helpers/test-env';
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync, ChildProcess } from 'node:child_process';
import path from 'node:path';
import request from 'supertest';
import { generate } from 'otplib';
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
 repo.write=async(entry,tx)=>{const result=await original(entry,tx);if(entry.action===fault)throw new Error('EX08 quantity audit failure after INSERT');return result};
 await app.listen(0,'127.0.0.1');process.send({ready:app.getHttpServer().address().port});
 process.on('message',async(m)=>{if(m.close){await app.close();process.exit(0)}else {fault=m.fault??null;process.send({ack:true})}});
})().catch(()=>process.exit(1));
`;
let child: ChildProcess;
let http: ReturnType<typeof request>;
let seeded: Awaited<ReturnType<typeof seedBaseData>>;
let admin: string;
let viewer: string;
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
describe('EX08 inventory import quantity on compiled Nest and real PostgreSQL', () => {
 before(async () => {
  execFileSync(process.execPath, ['scripts/ci/assert-test-environment.js'], { stdio: 'pipe' });
  execFileSync('npm', ['run', 'build'], { stdio: 'pipe' });
  await resetDatabase(); seeded = await seedBaseData();
  child = spawn(process.execPath, ['-e', backend], { cwd: process.cwd(), env: { ...process.env, NODE_PATH: path.resolve('dist') }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] }); child.stderr?.resume();
  const port = await new Promise<number>((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Compiled API startup timeout')), 30000); child.once('message', (m: { ready: number }) => { clearTimeout(timer); resolve(m.ready); }); child.once('exit', () => { clearTimeout(timer); reject(new Error('Compiled API exited before ready')); }); });
  http = request(`http://127.0.0.1:${port}`); admin = await login(seeded.users.adminEmail, seeded.users.adminPassword); viewer = await login(seeded.users.viewerEmail, seeded.users.viewerPassword);
 });
 after(async () => { if (child?.connected) { child.send({ close: true }); await new Promise<void>(r => child.once('exit', () => r())); } await disconnectDatabase(); });
 async function csv(quantity: string, mode = 'increment') { const variant = await prisma.variant.findUniqueOrThrow({ where: { id: seeded.inventory.variantId } }); const warehouse = await prisma.warehouse.findUniqueOrThrow({ where: { id: seeded.inventory.warehouseId } }); return `sku,warehouseCode,quantity,mode,reason\n${variant.sku},${warehouse.code},${quantity},${mode},EX08 quantity proof`; }
 async function snapshot() { return { batches: await prisma.inventoryImportBatch.findMany({ orderBy: { id: 'asc' } }), rows: await prisma.inventoryImportRow.findMany({ orderBy: { id: 'asc' } }), stock: await prisma.inventoryItem.findMany({ orderBy: { id: 'asc' } }), ledger: await prisma.stockMovement.findMany({ orderBy: { id: 'asc' } }), audits: await prisma.auditLog.findMany({ where: { action: { startsWith: 'inventory.' } }, orderBy: { id: 'asc' } }) }; }
 it('returns400 for every demonstrated unsupported Int representation and creates no batch/row/audit/stock effect', async () => {
  for (const quantity of ['not-a-number', 'NaN', 'Infinity', '-Infinity', '1.5', '2147483648', '-2147483649', '9007199254740993']) {
   const before = await snapshot(); const res = await http.post('/api/v1/admin/inventory/imports/dry-run').set(auth()).send({ csv: await csv(quantity) });
   assert.equal(res.status, 400, quantity); assert.match(res.body.error, /Fila 1.*quantity.*entero.*2147483647/); assert.deepEqual(await snapshot(), before);
  }
 });
 it('rejects a mixed CSV completely and identifies the offending second data row', async () => {
  const good = await csv('2'); const row = (await csv('not-a-number')).split('\n')[1]; const before = await snapshot();
  const res = await http.post('/api/v1/admin/inventory/imports/dry-run').set(auth()).send({ csv: good + '\n' + row }); assert.equal(res.status, 400); assert.match(res.body.error, /Fila 2/); assert.deepEqual(await snapshot(), before);
 });
 it('preserves validzero/maxInt and exact negativeInt error rows, plus existing mode/SKU/warehouse errors', async () => {
  for (const [quantity, status] of [['0', 'dry_run_valid'], ['2147483647', 'dry_run_valid'], ['-1', 'dry_run_errors'], ['-2147483648', 'dry_run_errors']]) {
   const before = await prisma.inventoryItem.findUniqueOrThrow({ where: stockWhere() }); const res = await http.post('/api/v1/admin/inventory/imports/dry-run').set(auth()).send({ csv: await csv(quantity) }); assert.equal(res.status, 201); assert.equal(res.body.status, status); assert.equal(res.body.rows[0].quantity, Number(quantity)); if (status === 'dry_run_errors') assert.deepEqual(res.body.rows[0].errors, ['Cantidad inválida.']); assert.deepEqual(await prisma.inventoryItem.findUniqueOrThrow({ where: stockWhere() }), before); assert.equal(await prisma.auditLog.count({ where: { entityId: res.body.id, action: 'inventory.import_dry_run' } }), 1);
  }
  const before = await prisma.inventoryItem.findUniqueOrThrow({ where: stockWhere() }); const res = await http.post('/api/v1/admin/inventory/imports/dry-run').set(auth()).send({ csv: 'sku,warehouseCode,quantity,mode,reason\nmissing,missing,1,bad,' }); assert.equal(res.status, 201); assert.equal(res.body.status, 'dry_run_errors'); assert.deepEqual(res.body.rows[0].errors, ['SKU missing no encontrado.', 'Bodega missing no encontrada.', 'Modo bad inválido.', 'Falta motivo.']); assert.deepEqual(await prisma.inventoryItem.findUniqueOrThrow({ where: stockWhere() }), before);
 });
 it('accepts a corrected CSV201, applies stock/ledger/audit once and reloads durable approved batch', async () => {
  const res = await http.post('/api/v1/admin/inventory/imports/dry-run').set(auth()).set('user-agent', 'EX08 quantity corrected').send({ csv: await csv('2') }); assert.equal(res.status, 201); assert.equal(res.body.status, 'dry_run_valid'); const before = await prisma.inventoryItem.findUniqueOrThrow({ where: stockWhere() }); const uri = `/api/v1/admin/inventory/imports/${res.body.id}/apply`;
  assert.equal((await http.post(uri).set(auth()).send({})).status, 201); assert.equal((await http.post(uri).set(auth()).send({})).status, 409); assert.equal((await prisma.inventoryItem.findUniqueOrThrow({ where: stockWhere() })).onHandQty, before.onHandQty + 2); assert.equal(await prisma.stockMovement.count({ where: { referenceId: res.body.id } }), 1); assert.equal(await prisma.auditLog.count({ where: { entityId: res.body.id, action: 'inventory.import_applied' } }), 1); const read = await http.get(`/api/v1/admin/inventory/imports/${res.body.id}`).set(auth()); assert.equal(read.status, 200); assert.equal(read.body.status, 'applied'); const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: res.body.id, action: 'inventory.import_dry_run' } }); assert.equal(audit.actorUserId, seeded.users.adminUserId); assert.equal(audit.userAgent, 'EX08 quantity corrected'); assert.match(audit.ipAddress ?? '', /127\.0\.0\.1/);
 });
 it('preserves401/403 and atomic rollback after real dryrun auditINSERT failure', async () => {
  const before = await snapshot(); const body = { csv: await csv('1') }; assert.equal((await http.post('/api/v1/admin/inventory/imports/dry-run').send(body)).status, 401); assert.equal((await http.post('/api/v1/admin/inventory/imports/dry-run').set('Authorization', `Bearer ${viewer}`).send(body)).status, 403); assert.deepEqual(await snapshot(), before);
  await fault('inventory.import_dry_run'); try { assert.equal((await http.post('/api/v1/admin/inventory/imports/dry-run').set(auth()).send(body)).status, 500); assert.deepEqual(await snapshot(), before); } finally { await fault(null); }
 });
});

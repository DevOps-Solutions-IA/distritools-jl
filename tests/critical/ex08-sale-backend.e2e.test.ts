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
async function makePayment(gateway='cash_on_delivery', status: 'pending'|'approved'|'rejected'|'refunded'='pending', orderId?:string) {
 if (!orderId) {const order=await prisma.order.create({data:{id:randomUUID(),orderNumber:'EX08-SALE-'+randomUUID(),status:'pending_payment',customerName:'Synthetic Sale',customerEmail:'sale@example.invalid',customerPhone:'0000000000',shippingAddress:'Synthetic address',shippingCity:'Bogota',subtotal:100,discountTotal:0,taxTotal:0,shippingTotal:0,grandTotal:100}});orderId=order.id;}
 return prisma.payment.create({data:{id:randomUUID(),orderId,gateway,gatewayReference:'synthetic-'+randomUUID(),amount:100,currency:'COP',status}});
}
async function grant(slugs:string[]) {
 for (const slug of slugs) {const p=await prisma.permission.findUniqueOrThrow({where:{slug}});await prisma.rolePermission.upsert({where:{roleId_permissionId:{roleId:seeded.roles.limitedRoleId,permissionId:p.id}},create:{id:randomUUID(),roleId:seeded.roles.limitedRoleId,permissionId:p.id},update:{}});}
}
async function revoke(slug:string) {const p=await prisma.permission.findUniqueOrThrow({where:{slug}});await prisma.rolePermission.deleteMany({where:{roleId:seeded.roles.limitedRoleId,permissionId:p.id}});}
describe('EX08 SALE payment integrity on compiled production bootstrap',()=>{
 before(async()=>{
  execFileSync(process.execPath,['scripts/ci/assert-test-environment.js'],{stdio:'pipe'});execFileSync('npm',['run','build'],{stdio:'pipe'});
  await resetDatabase();seeded=await seedBaseData();
  child=spawn(process.execPath,['-e',backend],{cwd:process.cwd(),env:{...process.env,NODE_PATH:path.resolve('dist')},stdio:['ignore','ignore','pipe','ipc']});child.stderr?.resume();
  const port=await new Promise<number>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Faithful backend startup timed out')),30000);child.once('message',(m:{ready:number})=>{clearTimeout(timer);resolve(m.ready)});child.once('exit',()=>{clearTimeout(timer);reject(new Error('Faithful backend exited before ready'))})});
  http=request(`http://127.0.0.1:${port}`);admin=await login(seeded.users.adminEmail,seeded.users.adminPassword);viewer=await login(seeded.users.viewerEmail,seeded.users.viewerPassword);
 });
 after(async()=>{if(child?.connected){child.send({close:true});await new Promise<void>(r=>child.once('exit',()=>r()))}await disconnectDatabase()});
 it('rolls back the complete COD payment row and audit on a real repository failure',async()=>{
  const p=await makePayment();const audits=await prisma.auditLog.count({where:{entityId:p.id}});const order=await prisma.order.findUniqueOrThrow({where:{id:p.orderId}});const outbox=await prisma.domainEventOutbox.count();
  await fault('payment.cod_reconciled');
  try {const r=await http.post(`/api/v1/admin/payments/${p.id}/reconcile-cod`).set(auth()).send({reference:'synthetic-received-'+randomUUID(),note:'Synthetic fault'});assert.equal(r.status,500);assert.deepEqual(await prisma.payment.findUniqueOrThrow({where:{id:p.id}}),p);assert.equal(await prisma.auditLog.count({where:{entityId:p.id}}),audits);assert.deepEqual(await prisma.order.findUniqueOrThrow({where:{id:p.orderId}}),order);assert.equal(await prisma.domainEventOutbox.count(),outbox);}finally{await fault(null)}
 });
 it('serializes duplicate COD reconciliations to one committed payment and one audit',async()=>{
  const p=await makePayment();const references=['synthetic-A-'+randomUUID(),'synthetic-B-'+randomUUID()];
  const rs=await Promise.all(references.map(reference=>http.post(`/api/v1/admin/payments/${p.id}/reconcile-cod`).set(auth()).set('user-agent','EX08-COD-concurrency').send({reference,note:'Synthetic concurrency'})));
  assert.deepEqual(rs.map(r=>r.status),[201,201]);assert.equal(rs.filter(r=>r.body.alreadyReconciled===true).length,1);assert.equal(rs.filter(r=>r.body.updatedAt).length,1);
  const current=await prisma.payment.findUniqueOrThrow({where:{id:p.id}});assert.equal(current.status,'approved');assert.ok(references.includes(current.gatewayReference));
  const logs=await prisma.auditLog.findMany({where:{entityId:p.id,action:'payment.cod_reconciled'}});assert.equal(logs.length,1);assert.equal(logs[0].actorUserId,seeded.users.adminUserId);assert.equal(logs[0].userAgent,'EX08-COD-concurrency');assert.deepEqual(logs[0].beforeData,{status:'pending'});assert.deepEqual(logs[0].afterData,{status:'approved',note:'Synthetic concurrency'});
  const replay=await http.post(`/api/v1/admin/payments/${p.id}/reconcile-cod`).set(auth()).send({reference:'ignored-synthetic-'+randomUUID()});assert.equal(replay.status,201);assert.equal(replay.body.alreadyReconciled,true);assert.deepEqual(await prisma.payment.findUniqueOrThrow({where:{id:p.id}}),current);assert.equal(await prisma.auditLog.count({where:{entityId:p.id,action:'payment.cod_reconciled'}}),1);
 });
 it('holds the current payment row before deciding reconciliation and waits for an actual PostgreSQL lock',async()=>{
  const p=await makePayment();let release!:()=>void,locked!:()=>void;const ready=new Promise<void>(r=>locked=r),gate=new Promise<void>(r=>release=r);
  const blocker=prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM payments WHERE id=${p.id}::uuid FOR UPDATE`;locked();await gate;await tx.payment.update({where:{id:p.id},data:{status:'approved'}})},{timeout:15000});await ready;
  let response!:Promise<Response>;let done=false;
  try {response=http.post(`/api/v1/admin/payments/${p.id}/reconcile-cod`).set(auth()).send({reference:'must-not-overwrite-'+randomUUID()}).then(r=>{done=true;return r});let waiting=false;
   for(let i=0;i<100&&!done;i++){const rows=await prisma.$queryRaw<Array<{waiting:boolean}>>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE '%FROM payments%') AS waiting`;if(rows[0].waiting){waiting=true;break}await new Promise(r=>setTimeout(r,20))}assert.ok(waiting,'Request must wait for the actual payment row lock');
  }finally{release();await blocker}
  const r=await response;assert.equal(r.status,201);assert.equal(r.body.alreadyReconciled,true);assert.equal((await prisma.payment.findUniqueOrThrow({where:{id:p.id}})).gatewayReference,p.gatewayReference);assert.equal(await prisma.auditLog.count({where:{entityId:p.id}}),0);
 });
 it('preserves gateway guards, live RBAC and not-found behavior without partial writes',async()=>{
  const p=await makePayment();const uri=`/api/v1/admin/payments/${p.id}/reconcile-cod`;
  assert.equal((await http.post(uri).send({})).status,401);assert.equal((await http.post(uri).set('Authorization',`Bearer ${viewer}`).send({})).status,403);
  assert.equal((await http.post(`/api/v1/admin/payments/${randomUUID()}/reconcile-cod`).set(auth()).send({})).status,404);
  const other=await makePayment('pse');assert.equal((await http.post(`/api/v1/admin/payments/${other.id}/reconcile-cod`).set(auth()).send({})).status,400);assert.deepEqual(await prisma.payment.findUniqueOrThrow({where:{id:other.id}}),other);
  await grant(['payments.reconcile']);try {assert.equal((await http.post(uri).set('Authorization',`Bearer ${viewer}`).send({})).status,201);await revoke('payments.reconcile');assert.equal((await http.post(uri).set('Authorization',`Bearer ${viewer}`).send({})).status,403);}finally{await revoke('payments.reconcile')}
  assert.equal(await prisma.auditLog.count({where:{entityId:other.id}}),0);
 });
 it('preserves existing rejected/refunded COD acceptance without changing order state or emitting order.paid',async()=>{
  for(const status of ['rejected','refunded'] as const){const p=await makePayment('cash_on_delivery',status);const order=await prisma.order.findUniqueOrThrow({where:{id:p.orderId}});const outbox=await prisma.domainEventOutbox.count();assert.equal((await http.post(`/api/v1/admin/payments/${p.id}/reconcile-cod`).set(auth()).send({})).status,201);assert.equal((await prisma.payment.findUniqueOrThrow({where:{id:p.id}})).status,'approved');assert.deepEqual(await prisma.order.findUniqueOrThrow({where:{id:p.orderId}}),order);assert.equal(await prisma.domainEventOutbox.count(),outbox);}
 });
 it('filters payment data and totals by order ID with deterministic tied timestamps and actual pagination',async()=>{
  const a=await makePayment();const b=await makePayment('cash_on_delivery','pending',a.orderId);await makePayment();const tie=new Date('2026-01-01T00:00:00Z');await prisma.payment.updateMany({where:{orderId:a.orderId},data:{createdAt:tie}});
  const ids=[a.id,b.id].sort();
  for(const direction of ['asc','desc'])for(let page=1;page<=2;page++){const r=await http.get(`/api/v1/admin/payments?orderId=${a.orderId}&page=${page}&limit=1&direction=${direction}`).set(auth());assert.equal(r.status,200);assert.equal(r.body.meta.total,2);assert.equal(r.body.data.length,1);assert.equal(r.body.data[0].orderId,a.orderId);assert.equal(r.body.data[0].id,(direction==='asc'?ids:[...ids].reverse())[page-1]);assert.equal(r.body.data[0].amount,'100.00');}
  const filtered=await http.get(`/api/v1/admin/payments?orderId=${a.orderId}&gateway=pse`).set(auth());assert.equal(filtered.status,200);assert.equal(filtered.body.meta.total,0);assert.deepEqual(filtered.body.data,[]);
  const missing=await http.get(`/api/v1/admin/payments?orderId=${randomUUID()}`).set(auth());assert.equal(missing.status,200);assert.equal(missing.body.meta.total,0);assert.deepEqual(missing.body.data,[]);
 });
 it('rejects invalid payment filters and preserves finance masking and current read permissions',async()=>{
  assert.equal((await http.get('/api/v1/admin/payments')).status,401);assert.equal((await http.get('/api/v1/admin/payments').set('Authorization',`Bearer ${viewer}`)).status,403);
  for(const q of ['orderId=','orderId=bad','orderId=00000000-0000-4000-8000-000000000001&orderId=00000000-0000-4000-8000-000000000002','page=0','limit=501','direction=bad'])assert.equal((await http.get('/api/v1/admin/payments?'+q).set(auth())).status,400);
  const p=await makePayment();await grant(['payments.read']);try {const r=await http.get(`/api/v1/admin/payments?orderId=${p.orderId}`).set('Authorization',`Bearer ${viewer}`);assert.equal(r.status,200);assert.equal(r.body.data.length,1);assert.equal(r.body.data[0].amount,'NO_PERMISSION');assert.equal(r.body.data[0].providerReference,'[PROTECTED]');await revoke('payments.read');assert.equal((await http.get('/api/v1/admin/payments').set('Authorization',`Bearer ${viewer}`)).status,403);}finally{await revoke('payments.read')}
 });
 it('preserves only canonical order-number cancellation, stock release, policy, audit and permissions',async()=>{
  const made=await http.post('/api/v1/orders').send({customer:{fullName:'Synthetic Sale',email:'cancel@example.invalid',phone:'0000000000'},shipping:{address:'Synthetic address',city:'Bogota'},items:[{variantId:seeded.inventory.variantId,warehouseId:seeded.inventory.warehouseId,quantity:1}]});assert.equal(made.status,201);
  const order=await prisma.order.findUniqueOrThrow({where:{orderNumber:made.body.order.orderNumber}});const stock=await prisma.inventoryItem.findUniqueOrThrow({where:stockWhere()});const movements=await prisma.stockMovement.count({where:{referenceId:order.id}});
  assert.equal((await http.post(`/api/v1/admin/orders/${order.id}/cancel`).set(auth()).send({reason:'Synthetic'})).status,404);assert.deepEqual(await prisma.order.findUniqueOrThrow({where:{id:order.id}}),order);
  const uri=`/api/v1/admin/orders/${order.orderNumber}/cancel`;assert.equal((await http.post(uri).send({})).status,401);assert.equal((await http.post(uri).set('Authorization',`Bearer ${viewer}`).send({})).status,403);
  await grant(['orders.cancel']);try {assert.equal((await http.post(uri).set('Authorization',`Bearer ${viewer}`).send({})).status,403);assert.deepEqual(await prisma.order.findUniqueOrThrow({where:{id:order.id}}),order);}finally{await revoke('orders.cancel')}
  assert.equal((await http.post(uri).set(auth()).send({reason:123})).status,400);assert.equal((await http.post(uri).set(auth()).send({reason:'Synthetic cancellation'})).status,201);assert.equal((await prisma.order.findUniqueOrThrow({where:{id:order.id}})).status,'cancelled');assert.equal((await prisma.inventoryItem.findUniqueOrThrow({where:stockWhere()})).reservedQty,stock.reservedQty-1);assert.equal(await prisma.stockMovement.count({where:{referenceId:order.id}}),movements+1);assert.equal(await prisma.auditLog.count({where:{entityId:order.id,action:'order.cancelled'}}),1);assert.equal((await http.post(uri).set(auth()).send({})).status,409);
 });
});

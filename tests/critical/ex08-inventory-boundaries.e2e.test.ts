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
async function makeCount(quantity?: number) {
 const res=await http.post('/api/v1/admin/inventory/count-sessions').set(auth()).send({warehouseId:seeded.inventory.warehouseId,lines:quantity===undefined?[]:[{variantId:seeded.inventory.variantId,countedQuantity:quantity}]});
 assert.equal(res.status,201);return res.body;
}
async function login(email:string,password:string) {
 // Do not generate a code at the end of its time step; no backend tolerance is changed.
 const remaining=30000-Date.now()%30000;if(remaining<5000)await new Promise(r=>setTimeout(r,remaining+25));
 const a=await http.post('/api/v1/auth/login').send({email,password});assert.equal(a.status,201);
 const b=await http.post('/api/v1/auth/verify-2fa').send({challengeToken:a.body.challengeToken,code:await generate({secret:seeded.users.twoFactorSecret})});assert.equal(b.status,201);assert.ok(b.body.accessToken);return b.body.accessToken as string;
}
describe('EX08 inventory boundaries on production bootstrap',()=>{
 before(async()=>{
  execFileSync(process.execPath,['scripts/ci/assert-test-environment.js'],{stdio:'pipe'});
  execFileSync('npm',['run','build'],{stdio:'pipe'});
  await resetDatabase();seeded=await seedBaseData();
  child=spawn(process.execPath,['-e',backend],{cwd:process.cwd(),env:{...process.env,NODE_PATH:path.resolve('dist')},stdio:['ignore','ignore','pipe','ipc']});
  child.stderr?.resume();
  const port=await new Promise<number>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Faithful backend startup timed out')),30000);child.once('message',(m: { ready: number })=>{clearTimeout(timer);resolve(m.ready)});child.once('exit',()=>{clearTimeout(timer);reject(new Error('Faithful backend exited before ready'))})});
  http=request(`http://127.0.0.1:${port}`);admin=await login(seeded.users.adminEmail,seeded.users.adminPassword);viewer=await login(seeded.users.viewerEmail,seeded.users.viewerPassword);
  await prisma.inventoryItem.update({where:stockWhere(),data:{costPrice:100}});
 });
 after(async()=>{if(child?.connected){child.send({close:true});await new Promise<void>(r=>child.once('exit',()=>r()))}await disconnectDatabase()});
 it('masks costs at overview and item API while retaining authorized actual values',async()=>{
  for(const endpoint of ['/api/v1/admin/inventory/overview',`/api/v1/admin/inventory/${seeded.inventory.variantId}/${seeded.inventory.warehouseId}`]){
   const denied=await http.get(endpoint).set('Authorization',`Bearer ${viewer}`);assert.equal(denied.status,200);
   if(endpoint.endsWith('overview')){assert.equal(denied.body.summary.inventoryValue,'NO_PERMISSION');assert.equal(denied.body.summary.missingCost,'NO_PERMISSION');assert.ok(denied.body.data.every((r: { costPrice: string; inventoryValue: string })=>r.costPrice==='NO_PERMISSION'&&r.inventoryValue==='NO_PERMISSION'))}
   else assert.equal(denied.body.costPrice,'NO_PERMISSION');
   const allowed=await http.get(endpoint).set(auth());assert.equal(allowed.status,200);assert.equal(Number(endpoint.endsWith('overview')?allowed.body.data.find((r: {variantId:string})=>r.variantId===seeded.inventory.variantId).costPrice:allowed.body.costPrice),100);
  }
 });
 it('lists and recovers count/import resources with bounded deterministic pagination and correct permissions',async()=>{
  const c1=await makeCount(),c2=await makeCount();
  const tie=new Date('2026-01-01T00:00:00Z');await prisma.inventoryCountSession.updateMany({where:{id:{in:[c1.id,c2.id]}},data:{createdAt:tie}});
  const variant=await prisma.variant.findUniqueOrThrow({where:{id:seeded.inventory.variantId}});const wh=await prisma.warehouse.findUniqueOrThrow({where:{id:seeded.inventory.warehouseId}});
  const b=await http.post('/api/v1/admin/inventory/imports/dry-run').set(auth()).send({csv:`sku,warehouseCode,quantity,mode,reason\n${variant.sku},${wh.code},1,increment,EX08 read`});assert.equal(b.status,201);
  for(const [ns,id] of [['count-sessions',c1.id],['imports',b.body.id]]){
   const uri=`/api/v1/admin/inventory/${ns}`;
   assert.equal((await http.get(uri)).status,401);assert.equal((await http.get(uri).set('Authorization',`Bearer ${viewer}`)).status,403);
   const first=await http.get(uri+'?page=1&limit=1').set(auth());assert.equal(first.status,200);assert.equal(first.body.data.length,1);assert.equal(first.body.meta.limit,1);
   const again=await http.get(uri+'?page=1&limit=1').set(auth());assert.deepEqual(first.body,again.body);
   const detail=await http.get(uri+'/'+id).set(auth());assert.equal(detail.status,200);assert.equal(detail.body.id,id);assert.ok(Array.isArray(ns==='imports'?detail.body.rows:detail.body.lines));
   assert.equal((await http.get(uri+'/bad-uuid').set(auth())).status,400);assert.equal((await http.get(uri+'/'+randomUUID()).set(auth())).status,404);
   for(const q of ['page=0','limit=101','page=1.5','page=1e2','page=21474837','page=1&page=2','page=1&unexpected=true'])assert.equal((await http.get(uri+'?'+q).set(auth())).status,400);
  }
  const first=await http.get('/api/v1/admin/inventory/count-sessions?page=1&limit=1').set(auth());const second=await http.get('/api/v1/admin/inventory/count-sessions?page=2&limit=1').set(auth());assert.notEqual(first.body.data[0].id,second.body.data[0].id);assert.ok([c1.id,c2.id].includes(first.body.data[0].id));
 });
 it('rejects mixed valid/missing count lines without partial mutation or audit',async()=>{
  const c=await makeCount(16);const before=await prisma.inventoryCountLine.findMany({where:{sessionId:c.id},orderBy:{id:'asc'}});const audits=await prisma.auditLog.count({where:{entityId:c.id}});
  const r=await http.patch(`/api/v1/admin/inventory/count-sessions/${c.id}/lines`).set(auth()).send({lines:[{variantId:seeded.inventory.variantId,countedQuantity:17},{variantId:randomUUID(),countedQuantity:20}]});assert.equal(r.status,404);
  assert.deepEqual(await prisma.inventoryCountLine.findMany({where:{sessionId:c.id},orderBy:{id:'asc'}}),before);assert.equal(await prisma.auditLog.count({where:{entityId:c.id}}),audits);
 });
 it('audits count edits transactionally and rolls them back on audit failure',async()=>{
  const c=await makeCount(18);const uri=`/api/v1/admin/inventory/count-sessions/${c.id}/lines`;
  const before=await prisma.inventoryCountLine.findMany({where:{sessionId:c.id},orderBy:{id:'asc'}});
  const body={lines:[{variantId:seeded.inventory.variantId,countedQuantity:19}]};
  assert.equal((await http.patch(uri).send(body)).status,401);assert.equal((await http.patch(uri).set('Authorization',`Bearer ${viewer}`).send(body)).status,403);
  assert.equal((await http.patch('/api/v1/admin/inventory/count-sessions/bad-id/lines').set(auth()).send(body)).status,400);
  assert.equal((await http.patch(`/api/v1/admin/inventory/count-sessions/${randomUUID()}/lines`).set(auth()).send(body)).status,404);
  assert.equal((await http.patch(uri).set(auth()).send({lines:[...body.lines,...body.lines]})).status,400);
  await fault('inventory.count_lines_updated');
  try {const r=await http.patch(uri).set(auth()).send({lines:[{variantId:seeded.inventory.variantId,countedQuantity:19}]});assert.equal(r.status,500);assert.deepEqual(await prisma.inventoryCountLine.findMany({where:{sessionId:c.id},orderBy:{id:'asc'}}),before)}finally{await fault(null)}
  const r=await http.patch(uri).set(auth()).set('user-agent','EX08-count-audit-proof').send({lines:[{variantId:seeded.inventory.variantId,countedQuantity:19}]});assert.equal(r.status,200);
  const audit=await prisma.auditLog.findFirstOrThrow({where:{entityId:c.id,action:'inventory.count_lines_updated'}});assert.equal(audit.actorUserId,seeded.users.adminUserId);assert.ok(audit.beforeData);assert.ok(audit.afterData);assert.match(audit.ipAddress??'',/127\.0\.0\.1/);assert.equal(audit.userAgent,'EX08-count-audit-proof');
  for(const body of [{extra:true,lines:[{variantId:seeded.inventory.variantId,countedQuantity:20}]},{lines:[{variantId:seeded.inventory.variantId,countedQuantity:null}]},{lines:[{variantId:seeded.inventory.variantId,countedQuantity:1,extra:1}]}])assert.equal((await http.patch(uri).set(auth()).send(body)).status,400);
 });
 it('rolls back price and stock/ledger when auditing fails; successful replay remains idempotent',async()=>{
  const priceBefore=await prisma.variant.findUniqueOrThrow({where:{id:seeded.inventory.variantId}});await fault('variant.price_updated');
  try{const r=await http.patch(`/api/v1/admin/prices/${seeded.inventory.variantId}`).set(auth()).send({price:Number(priceBefore.price)+1,reason:'EX08 fault'});assert.equal(r.status,500);assert.equal((await prisma.variant.findUniqueOrThrow({where:{id:seeded.inventory.variantId}})).price.toString(),priceBefore.price.toString())}finally{await fault(null)}
  const payload={variantId:seeded.inventory.variantId,warehouseId:seeded.inventory.warehouseId,quantityDelta:1,reason:'EX08 audit fault',referenceId:randomUUID()};const before=await prisma.inventoryItem.findUniqueOrThrow({where:stockWhere()});await fault('inventory.adjusted');
  try{const r=await http.patch('/api/v1/admin/inventory/adjust').set(auth()).send(payload);assert.equal(r.status,500);assert.equal((await prisma.inventoryItem.findUniqueOrThrow({where:stockWhere()})).onHandQty,before.onHandQty);assert.equal(await prisma.stockMovement.count({where:{referenceId:payload.referenceId}}),0)}finally{await fault(null)}
  const good=await http.patch('/api/v1/admin/inventory/adjust').set(auth()).send(payload);assert.equal(good.status,200);const replay=await http.patch('/api/v1/admin/inventory/adjust').set(auth()).send(payload);assert.equal(replay.status,200);assert.equal(replay.body.movement.id,good.body.movement.id);assert.equal((await prisma.inventoryItem.findUniqueOrThrow({where:stockWhere()})).onHandQty,before.onHandQty+1);assert.equal(await prisma.stockMovement.count({where:{referenceId:payload.referenceId}}),1);
 });
 it('serializes concurrent price edits with a complete audit before/after chain',async()=>{
  const initial=await prisma.variant.findUniqueOrThrow({where:{id:seeded.inventory.variantId}});const base=Number(initial.price);
  const reasonA='EX08 concurrent price A '+randomUUID(),reasonB='EX08 concurrent price B '+randomUUID();
  const results=await Promise.all([http.patch(`/api/v1/admin/prices/${initial.id}`).set(auth()).send({price:base+10,reason:reasonA}),http.patch(`/api/v1/admin/prices/${initial.id}`).set(auth()).send({price:base+20,reason:reasonB})]);assert.ok(results.every(r=>r.status===200));
  const logs=await prisma.auditLog.findMany({where:{entityId:initial.id,action:'variant.price_updated'},orderBy:[{createdAt:'asc'},{id:'asc'}]});
  const relevant=logs.filter(r=>[reasonA,reasonB].includes((r.afterData as {reason:string}).reason));assert.equal(relevant.length,2);
  assert.equal((relevant[0].beforeData as {price:string}).price,initial.price.toFixed(2));assert.equal((relevant[1].beforeData as {price:string}).price,(relevant[0].afterData as {price:string}).price);assert.equal((await prisma.variant.findUniqueOrThrow({where:{id:initial.id}})).price.toFixed(2),(relevant[1].afterData as {price:string}).price);
 });
 it('applies a concurrent adjustment reference once and rejects a changed quantity replay',async()=>{
  const before=await prisma.inventoryItem.findUniqueOrThrow({where:stockWhere()});const payload={variantId:seeded.inventory.variantId,warehouseId:seeded.inventory.warehouseId,quantityDelta:2,reason:'EX08 concurrent adjustment',referenceId:randomUUID()};
  const results=await Promise.all([http.patch('/api/v1/admin/inventory/adjust').set(auth()).send(payload),http.patch('/api/v1/admin/inventory/adjust').set(auth()).send(payload)]);assert.ok(results.every(r=>r.status===200));assert.equal(results[0].body.movement.id,results[1].body.movement.id);
  assert.equal((await prisma.inventoryItem.findUniqueOrThrow({where:stockWhere()})).onHandQty,before.onHandQty+2);assert.equal(await prisma.stockMovement.count({where:{referenceId:payload.referenceId}}),1);
  assert.equal((await http.patch('/api/v1/admin/inventory/adjust').set(auth()).send({...payload,quantityDelta:3})).status,409);
 });
 it('allows only one concurrent close and rejects later edits of the closed session',async()=>{
  const before=await prisma.inventoryItem.findUniqueOrThrow({where:stockWhere()});const c=await makeCount(before.onHandQty+1);
  const results=await Promise.all([http.post(`/api/v1/admin/inventory/count-sessions/${c.id}/close`).set(auth()).send({}),http.post(`/api/v1/admin/inventory/count-sessions/${c.id}/close`).set(auth()).send({})]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal((await prisma.inventoryItem.findUniqueOrThrow({where:stockWhere()})).onHandQty,before.onHandQty+1);assert.equal(await prisma.stockMovement.count({where:{referenceId:c.id}}),1);assert.equal(await prisma.auditLog.count({where:{entityId:c.id,action:'inventory.count_closed'}}),1);
  assert.equal((await http.patch(`/api/v1/admin/inventory/count-sessions/${c.id}/lines`).set(auth()).send({lines:[{variantId:seeded.inventory.variantId,countedQuantity:before.onHandQty+2}]})).status,409);
 });
 it('rolls back close status, quantities and movements when close audit fails',async()=>{
  const before=await prisma.inventoryItem.findUniqueOrThrow({where:stockWhere()});const c=await makeCount(before.onHandQty+1);await fault('inventory.count_closed');
  try {const r=await http.post(`/api/v1/admin/inventory/count-sessions/${c.id}/close`).set(auth()).send({});assert.equal(r.status,500);
   assert.equal((await prisma.inventoryCountSession.findUniqueOrThrow({where:{id:c.id}})).status,'in_progress');
   assert.equal((await prisma.inventoryItem.findUniqueOrThrow({where:stockWhere()})).onHandQty,before.onHandQty);
   assert.equal(await prisma.stockMovement.count({where:{referenceId:c.id}}),0);assert.equal(await prisma.auditLog.count({where:{entityId:c.id,action:'inventory.count_closed'}}),0);
  }finally{await fault(null)}
 });
 it('does not disclose financial costs in an adjustment response for a stock-only operator',async()=>{
  const permission=await prisma.permission.findUniqueOrThrow({where:{slug:'inventory.adjust'}});
  const key={roleId_permissionId:{roleId:seeded.roles.limitedRoleId,permissionId:permission.id}};
  await prisma.rolePermission.create({data:{id:randomUUID(),roleId:seeded.roles.limitedRoleId,permissionId:permission.id}});
  try {const r=await http.patch('/api/v1/admin/inventory/adjust').set('Authorization',`Bearer ${viewer}`).send({variantId:seeded.inventory.variantId,warehouseId:seeded.inventory.warehouseId,quantityDelta:1,reason:'EX08 stock-only role',referenceId:randomUUID()});assert.equal(r.status,200);assert.equal(r.body.item.costPrice,'NO_PERMISSION')}
  finally{await prisma.rolePermission.delete({where:key})}
 });
 it('serializes an edit against a closing count so the persisted count matches its movement',async()=>{
  const before=await prisma.inventoryItem.findUniqueOrThrow({where:stockWhere()});const c=await makeCount(before.onHandQty+1);
  let release!:()=>void;let locked!:()=>void;const ready=new Promise<void>(r=>locked=r);const gate=new Promise<void>(r=>release=r);
  const lock=prisma.$transaction(async(tx)=>{await tx.$queryRaw`SELECT id FROM inventory_items WHERE variant_id=${seeded.inventory.variantId}::uuid AND warehouse_id=${seeded.inventory.warehouseId}::uuid FOR UPDATE`;locked();await gate},{timeout:15000});await ready;
  let close!: Promise<Response>;let edit!: Promise<Response>;let editCompleted=false;
  try {
   close=http.post(`/api/v1/admin/inventory/count-sessions/${c.id}/close`).set(auth()).send({}).then(r=>r);
   let waiting=false;
   for(let i=0;i<100;i++){const rows=await prisma.$queryRaw<Array<{waiting:boolean}>>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE '%FROM inventory_items%') AS waiting`;if(rows[0].waiting){waiting=true;break}await new Promise(r=>setTimeout(r,20))}assert.ok(waiting,'Close must reach the actual held stock row');
   edit=http.patch(`/api/v1/admin/inventory/count-sessions/${c.id}/lines`).set(auth()).send({lines:[{variantId:seeded.inventory.variantId,countedQuantity:before.onHandQty+2}]}).then(r=>{editCompleted=true;return r});
   let editWaiting=false;
   for(let i=0;i<100&&!editCompleted;i++){const rows=await prisma.$queryRaw<Array<{waiting:boolean}>>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE '%FROM inventory_count_sessions%') AS waiting`;if(rows[0].waiting){editWaiting=true;break}await new Promise(r=>setTimeout(r,20))}
   assert.ok(editWaiting||editCompleted,'The edit must reach its real session lock or complete before releasing stock');
  }finally{release();await lock}
  const [closed,edited]=await Promise.all([close,edit]);assert.equal(closed.status,201);assert.equal(edited.status,409);
  const line=await prisma.inventoryCountLine.findUniqueOrThrow({where:{sessionId_variantId:{sessionId:c.id,variantId:seeded.inventory.variantId}}});const item=await prisma.inventoryItem.findUniqueOrThrow({where:stockWhere()});assert.equal(item.onHandQty,line.countedQuantity);
 });

 it('V6 count start leaves no session, lines or audit when the audit fails',async()=>{
  const payload={warehouseId:seeded.inventory.warehouseId,notes:'EX08 V6 count start'};
  assert.equal((await http.post('/api/v1/admin/inventory/count-sessions').send(payload)).status,401);
  assert.equal((await http.post('/api/v1/admin/inventory/count-sessions').set('Authorization',`Bearer ${viewer}`).send(payload)).status,403);
  assert.equal((await http.post('/api/v1/admin/inventory/count-sessions').set(auth()).send({})).status,400);
  assert.equal((await http.post('/api/v1/admin/inventory/count-sessions').set(auth()).send({warehouseId:randomUUID()})).status,404);
  const before={sessions:await prisma.inventoryCountSession.count(),lines:await prisma.inventoryCountLine.count(),audits:await prisma.auditLog.count({where:{action:'inventory.count_started'}})};
  await fault('inventory.count_started');
  try {assert.equal((await http.post('/api/v1/admin/inventory/count-sessions').set(auth()).send(payload)).status,500);
   assert.deepEqual({sessions:await prisma.inventoryCountSession.count(),lines:await prisma.inventoryCountLine.count(),audits:await prisma.auditLog.count({where:{action:'inventory.count_started'}})},before);
  }finally{await fault(null)}
  const good=await http.post('/api/v1/admin/inventory/count-sessions').set(auth()).set('user-agent','EX08-V6-count').send(payload);assert.equal(good.status,201);assert.ok(good.body.warehouse);assert.ok(good.body.lines.length>0);
  const audit=await prisma.auditLog.findFirstOrThrow({where:{entityId:good.body.id,action:'inventory.count_started'}});assert.equal(audit.actorUserId,seeded.users.adminUserId);assert.equal(audit.userAgent,'EX08-V6-count');assert.match(audit.ipAddress??'',/127\.0\.0\.1/);
 });
 it('V6 dry run leaves no batch, rows or audit when the audit fails',async()=>{
  const variant=await prisma.variant.findUniqueOrThrow({where:{id:seeded.inventory.variantId}});const warehouse=await prisma.warehouse.findUniqueOrThrow({where:{id:seeded.inventory.warehouseId}});
  const payload={filename:'EX08-V6.csv',csv:`sku,warehouseCode,quantity,mode,reason\n${variant.sku},${warehouse.code},1,increment,EX08 V6 import`};
  assert.equal((await http.post('/api/v1/admin/inventory/imports/dry-run').send(payload)).status,401);assert.equal((await http.post('/api/v1/admin/inventory/imports/dry-run').set('Authorization',`Bearer ${viewer}`).send(payload)).status,403);
  assert.equal((await http.post('/api/v1/admin/inventory/imports/dry-run').set(auth()).send({csv:'sku\nunknown'})).status,400);
  const before={batches:await prisma.inventoryImportBatch.count(),rows:await prisma.inventoryImportRow.count(),audits:await prisma.auditLog.count({where:{action:'inventory.import_dry_run'}})};
  await fault('inventory.import_dry_run');
  try {assert.equal((await http.post('/api/v1/admin/inventory/imports/dry-run').set(auth()).send(payload)).status,500);
   assert.deepEqual({batches:await prisma.inventoryImportBatch.count(),rows:await prisma.inventoryImportRow.count(),audits:await prisma.auditLog.count({where:{action:'inventory.import_dry_run'}})},before);
  }finally{await fault(null)}
  const good=await http.post('/api/v1/admin/inventory/imports/dry-run').set(auth()).set('user-agent','EX08-V6-dryrun').send(payload);assert.equal(good.status,201);assert.equal(good.body.status,'dry_run_valid');assert.equal(good.body.rows.length,1);
  const audit=await prisma.auditLog.findFirstOrThrow({where:{entityId:good.body.id,action:'inventory.import_dry_run'}});assert.equal(audit.actorUserId,seeded.users.adminUserId);assert.equal(audit.userAgent,'EX08-V6-dryrun');assert.match(audit.ipAddress??'',/127\.0\.0\.1/);
 });
 it('V6 apply rolls back batch, rows, stock, movements and audit on audit failure',async()=>{
  const variant=await prisma.variant.findUniqueOrThrow({where:{id:seeded.inventory.variantId}});const warehouse=await prisma.warehouse.findUniqueOrThrow({where:{id:seeded.inventory.warehouseId}});
  const dry=await http.post('/api/v1/admin/inventory/imports/dry-run').set(auth()).send({csv:`sku,warehouseCode,quantity,mode,reason\n${variant.sku},${warehouse.code},1,increment,EX08 V6 apply`});assert.equal(dry.status,201);
  const uri=`/api/v1/admin/inventory/imports/${dry.body.id}/apply`;
  assert.equal((await http.post(uri).send({})).status,401);assert.equal((await http.post(uri).set('Authorization',`Bearer ${viewer}`).send({})).status,403);
  assert.equal((await http.post(`/api/v1/admin/inventory/imports/${randomUUID()}/apply`).set(auth()).send({})).status,404);
  const before={batch:await prisma.inventoryImportBatch.findUniqueOrThrow({where:{id:dry.body.id}}),rows:await prisma.inventoryImportRow.findMany({where:{batchId:dry.body.id},orderBy:{id:'asc'}}),stock:await prisma.inventoryItem.findUniqueOrThrow({where:stockWhere()}),movements:await prisma.stockMovement.count({where:{referenceId:dry.body.id}}),audits:await prisma.auditLog.count({where:{entityId:dry.body.id,action:'inventory.import_applied'}})};
  await fault('inventory.import_applied');
  try {assert.equal((await http.post(uri).set(auth()).send({})).status,500);
   assert.deepEqual({batch:await prisma.inventoryImportBatch.findUniqueOrThrow({where:{id:dry.body.id}}),rows:await prisma.inventoryImportRow.findMany({where:{batchId:dry.body.id},orderBy:{id:'asc'}}),stock:await prisma.inventoryItem.findUniqueOrThrow({where:stockWhere()}),movements:await prisma.stockMovement.count({where:{referenceId:dry.body.id}}),audits:await prisma.auditLog.count({where:{entityId:dry.body.id,action:'inventory.import_applied'}})},before);
  }finally{await fault(null)}
  const good=await http.post(uri).set(auth()).set('user-agent','EX08-V6-apply').send({});assert.equal(good.status,201);assert.equal(good.body.batch.status,'applied');assert.equal(good.body.movements.length,1);assert.equal((await prisma.inventoryItem.findUniqueOrThrow({where:stockWhere()})).onHandQty,before.stock.onHandQty+1);
  assert.equal((await http.post(uri).set(auth()).send({})).status,409);assert.equal(await prisma.stockMovement.count({where:{referenceId:dry.body.id}}),1);
  const audit=await prisma.auditLog.findFirstOrThrow({where:{entityId:dry.body.id,action:'inventory.import_applied'}});assert.equal(audit.actorUserId,seeded.users.adminUserId);assert.equal(audit.userAgent,'EX08-V6-apply');assert.match(audit.ipAddress??'',/127\.0\.0\.1/);
  const invalid=await http.post('/api/v1/admin/inventory/imports/dry-run').set(auth()).send({csv:`sku,warehouseCode,quantity,mode,reason\nunknown-${randomUUID()},${warehouse.code},1,increment,EX08 invalid`});assert.equal(invalid.status,201);assert.equal(invalid.body.status,'dry_run_errors');assert.equal((await http.post(`/api/v1/admin/inventory/imports/${invalid.body.id}/apply`).set(auth()).send({})).status,409);
 });
 it('V6 serializes the same import batch so concurrent requests create one movement',async()=>{
  const variant=await prisma.variant.findUniqueOrThrow({where:{id:seeded.inventory.variantId}});const warehouse=await prisma.warehouse.findUniqueOrThrow({where:{id:seeded.inventory.warehouseId}});
  const dry=await http.post('/api/v1/admin/inventory/imports/dry-run').set(auth()).send({csv:`sku,warehouseCode,quantity,mode,reason\n${variant.sku},${warehouse.code},1,increment,EX08 V6 concurrent`});assert.equal(dry.status,201);
  const before=await prisma.inventoryItem.findUniqueOrThrow({where:stockWhere()});const uri=`/api/v1/admin/inventory/imports/${dry.body.id}/apply`;
  let release!:()=>void;let locked!:()=>void;const ready=new Promise<void>(r=>locked=r);const gate=new Promise<void>(r=>release=r);
  const lock=prisma.$transaction(async(tx)=>{await tx.$queryRaw`SELECT id FROM inventory_items WHERE variant_id=${seeded.inventory.variantId}::uuid AND warehouse_id=${seeded.inventory.warehouseId}::uuid FOR UPDATE`;locked();await gate},{timeout:15000});await ready;
  let first!: Promise<Response>;let second!: Promise<Response>;
  try {
   first=http.post(uri).set(auth()).send({}).then(r=>r);
   let firstWaiting=false;
   for(let i=0;i<100;i++){const rows=await prisma.$queryRaw<Array<{waiting:boolean}>>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE '%FROM inventory_items%') AS waiting`;if(rows[0].waiting){firstWaiting=true;break}await new Promise(r=>setTimeout(r,20))}assert.ok(firstWaiting,'First apply must reach the actual held stock lock');
   second=http.post(uri).set(auth()).send({}).then(r=>r);
   let secondWaiting=false;
   for(let i=0;i<100;i++){const rows=await prisma.$queryRaw<Array<{waiting:boolean}>>`SELECT (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE '%FROM inventory_items%')>=2 OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE '%FROM inventory_import_batches%') AS waiting`;if(rows[0].waiting){secondWaiting=true;break}await new Promise(r=>setTimeout(r,20))}assert.ok(secondWaiting,'Second apply must reach its real batch lock or held stock row before release');
  }finally{release();await lock}
  const results=await Promise.all([first,second]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  assert.equal((await prisma.inventoryItem.findUniqueOrThrow({where:stockWhere()})).onHandQty,before.onHandQty+1);assert.equal(await prisma.stockMovement.count({where:{referenceId:dry.body.id}}),1);assert.equal(await prisma.auditLog.count({where:{entityId:dry.body.id,action:'inventory.import_applied'}}),1);assert.equal((await prisma.inventoryImportBatch.findUniqueOrThrow({where:{id:dry.body.id}})).status,'applied');
 });
});

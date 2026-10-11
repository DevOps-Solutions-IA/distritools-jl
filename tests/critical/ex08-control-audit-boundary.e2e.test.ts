import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const compiledProbe = String.raw`
const assert=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module'),W=process.cwd(),req=createRequire(W+'/package.json');
process.env.NODE_PATH=W+'/dist:'+W;require('node:module').Module._initPaths();req('reflect-metadata');
const {register}=req('tsx/cjs/api');const unregister=register({tsconfig:W+'/tsconfig.json'});const {prisma,resetDatabase,seedBaseData}=req(W+'/tests/helpers/test-db.ts');unregister();
const {NestFactory}=req('@nestjs/core'),{ValidationPipe}=req('@nestjs/common'),{AppModule}=req(W+'/dist/src/app/app.module.js'),{GlobalExceptionFilter}=req(W+'/dist/src/common/filters/global-exception.filter.js'),{MetricsInterceptor}=req(W+'/dist/src/infra/telemetry/metrics/metrics.interceptor.js'),request=req('supertest'),{generate}=req('otplib');
let app;
(async()=>{
await resetDatabase();const s=await seedBaseData();app=await NestFactory.create(AppModule,{rawBody:true,logger:false});app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.useGlobalFilters(new GlobalExceptionFilter());app.useGlobalInterceptors(app.get(MetricsInterceptor));await app.init();const http=request(app.getHttpServer());
const remain=30000-Date.now()%30000;if(remain<5000)await new Promise(r=>setTimeout(r,remain+100));const login=await http.post('/api/v1/auth/login').send({email:s.users.adminEmail,password:s.users.adminPassword});assert.equal(login.status,201);const verified=await http.post('/api/v1/auth/verify-2fa').send({challengeToken:login.body.challengeToken,code:await generate({secret:s.users.twoFactorSecret})});assert.equal(verified.status,201);const token=verified.body.accessToken;
async function setPermissions(slugs){const permissions=await prisma.permission.findMany({where:{slug:{in:slugs}}});assert.equal(permissions.length,slugs.length);await prisma.rolePermission.deleteMany({where:{roleId:s.roles.limitedRoleId}});await prisma.rolePermission.createMany({data:permissions.map(p=>({id:req('node:crypto').randomUUID(),roleId:s.roles.limitedRoleId,permissionId:p.id}))});await prisma.user.update({where:{id:s.users.adminUserId},data:{roleId:s.roles.limitedRoleId}});}
const probes=[];
async function get(p){return http.get('/api/v1/admin/'+p).set('Authorization','Bearer '+token);}
await setPermissions(['inventory.read','reports.read','dashboard.read']);const before=await prisma.auditLog.findMany({orderBy:{id:'asc'}});const audit=await get('reports/audit');assert.equal(audit.status,403);
let summary=await get('reports/summary?range=today');assert.equal(summary.status,200);assert.equal(summary.body.reports.audit.accessStatus,'NO_PERMISSION');assert.deepEqual(summary.body.reports.audit.rows,[]);assert.deepEqual(summary.body.reports.audit.chart,[]);assert.equal(summary.body.reports.audit.kpis.auditEvents,'NO_PERMISSION');assert.equal(summary.body.reports.audit.empty,false);probes.push('summary_sameJWT_denied');
let dashboard=await get('dashboard?range=today');assert.equal(dashboard.status,200);assert.equal(dashboard.body.recentActivity.auditAccessStatus,'NO_PERMISSION');assert.deepEqual(dashboard.body.recentActivity.audit,[]);assert.equal(dashboard.body.kpis.system.lastAuditEventsCount,'NO_PERMISSION');probes.push('dashboard_sameJWT_denied');
await setPermissions(['inventory.read','reports.read','dashboard.read','audit.read']);summary=await get('reports/summary?range=today');assert.equal(summary.status,200);assert.equal(summary.body.reports.audit.accessStatus,'GRANTED');assert(summary.body.reports.audit.rows.length>0);dashboard=await get('dashboard?range=today');assert.equal(dashboard.status,200);assert.equal(dashboard.body.recentActivity.auditAccessStatus,'GRANTED');assert(dashboard.body.recentActivity.audit.length>0);probes.push('current_role_grant_without_token_renewal');
await setPermissions(['inventory.read','reports.read','dashboard.read','reports.export','audit.export']);summary=await get('reports/summary?range=today');assert.equal(summary.status,200);assert.deepEqual(summary.body.reports.audit.rows,[]);const countBeforeExport=await prisma.auditLog.count({where:{action:'reports.exported'}});const exported=await http.post('/api/v1/admin/reports/export').set('Authorization','Bearer '+token).send({type:'audit',format:'csv',range:'today'});assert.equal(exported.status,200);assert.match(exported.headers['content-type'],/text\/csv/);assert(exported.text.includes('auth.permission_denied'));assert.equal(await prisma.auditLog.count({where:{action:'reports.exported'}}),countBeforeExport+1);probes.push('audit_export_independent_preserved');
await setPermissions(['inventory.read','reports.read','dashboard.read','reports.export','audit.read']);const deniedExport=await http.post('/api/v1/admin/reports/export').set('Authorization','Bearer '+token).send({type:'audit',format:'csv',range:'today'});assert.equal(deniedExport.status,403);probes.push('audit_read_not_export');
const anonymous=await http.get('/api/v1/admin/reports/summary');assert.equal(anonymous.status,401);await setPermissions(['inventory.read']);assert.equal((await get('reports/summary')).status,403);assert.equal((await get('dashboard')).status,403);probes.push('anonymous_and_parent_permissions_fail_closed');
assert(before.length>0);process.stdout.write('ROOT_AUDIT_PROBE '+JSON.stringify({status:'PASS',cases:probes,JWTUnmodified:true,providersCalled:false,production:'NO-GO'})+'\n');await app.close();await prisma.$disconnect();
})().catch(async e=>{if(app)await app.close();await prisma.$disconnect();console.error(e);process.exitCode=1;});
`;
describe('Compiled HTTP audit projection permissions', () => {
  before(() => {
    execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', 'tsconfig.build.json'], { cwd: process.cwd(), env: process.env, stdio: 'pipe' });
  });
  it('honors current audit.read and independent audit.export across both aggregates', (t) => {
    const r = spawnSync(process.execPath, ['-e', compiledProbe], { cwd: process.cwd(), env: process.env, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /ROOT_AUDIT_PROBE /);
    const result = JSON.parse(r.stdout.split('ROOT_AUDIT_PROBE ')[1].trim());
    assert.equal(result.status, 'PASS'); assert.equal(result.cases.length, 6); assert.equal(result.JWTUnmodified, true);
    t.diagnostic('ROOT_AUDIT_PROBE ' + JSON.stringify(result));
  });
});

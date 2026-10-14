import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { before, describe, it } from 'node:test';

const probe = String.raw`
const assert=require('node:assert/strict'),{createRequire}=require('node:module'),W=process.cwd(),req=createRequire(W+'/package.json');
process.env.NODE_PATH=W+'/dist:'+W;require('node:module').Module._initPaths();req('reflect-metadata');
const {register}=req('tsx/cjs/api');const unregister=register({tsconfig:W+'/tsconfig.json'});const {prisma,resetDatabase,seedBaseData}=req(W+'/tests/helpers/test-db.ts');unregister();
const {NestFactory}=req('@nestjs/core'),{ValidationPipe}=req('@nestjs/common'),{AppModule}=req(W+'/dist/src/app/app.module.js'),{PrismaService}=req(W+'/dist/src/infra/db/prisma/prisma.service.js'),{GlobalExceptionFilter}=req(W+'/dist/src/common/filters/global-exception.filter.js'),{MetricsInterceptor}=req(W+'/dist/src/infra/telemetry/metrics/metrics.interceptor.js'),request=req('supertest'),{generate}=req('otplib'),{randomUUID}=req('node:crypto');
let app;
(async()=>{
await resetDatabase();const s=await seedBaseData();await prisma.auditLog.createMany({data:[1,2].map(n=>({id:randomUUID(),action:'legacy.audit.boundary.probe',entityType:'test',entityId:String(n)}))});
app=await NestFactory.create(AppModule,{rawBody:true,logger:false});app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.useGlobalFilters(new GlobalExceptionFilter());app.useGlobalInterceptors(app.get(MetricsInterceptor));await app.init();const http=request(app.getHttpServer());
const remain=30000-Date.now()%30000;if(remain<5000)await new Promise(r=>setTimeout(r,remain+100));const login=await http.post('/api/v1/auth/login').send({email:s.users.adminEmail,password:s.users.adminPassword});assert.equal(login.status,201);const verified=await http.post('/api/v1/auth/verify-2fa').send({challengeToken:login.body.challengeToken,code:await generate({secret:s.users.twoFactorSecret})});assert.equal(verified.status,201);const token=verified.body.accessToken;assert.equal(typeof token,'string');
async function setPermissions(slugs){const permissions=await prisma.permission.findMany({where:{slug:{in:slugs}}});assert.equal(permissions.length,slugs.length);await prisma.rolePermission.deleteMany({where:{roleId:s.roles.limitedRoleId}});await prisma.rolePermission.createMany({data:permissions.map(p=>({id:randomUUID(),roleId:s.roles.limitedRoleId,permissionId:p.id}))});await prisma.user.update({where:{id:s.users.adminUserId},data:{roleId:s.roles.limitedRoleId}});}
const db=app.get(PrismaService),count=db.auditLog.count.bind(db.auditLog);let auditCalls=0,auditFault=false;db.auditLog.count=async(...args)=>{auditCalls++;if(auditFault)throw new Error('owned audit fault');return count(...args);};
const groups=[];async function get(query=''){return http.get('/api/v1/admin/analytics/operational-metrics'+query).set('Authorization','Bearer '+token);}
await setPermissions(['dashboard.read']);let r=await get();assert.equal(r.status,200);process.stdout.write('LEGACY_DENIED_OBSERVATION '+JSON.stringify({count:r.body.executive.auditEventsCount,auditCalls})+'\n');assert.equal(r.body.executive.auditEventsCount,'NO_PERMISSION');assert.equal(r.body.executive.auditAccessStatus,'NO_PERMISSION');assert.equal(auditCalls,0);groups.push('denied_no_audit_source_query');
for(const query of ['?audit.read=true','?permissions=audit.read','?auditAccessStatus=GRANTED','?auditForExport=true','?permissions[]=audit.read']){r=await get(query);assert.equal(r.status,200);assert.equal(r.body.executive.auditEventsCount,'NO_PERMISSION');assert.equal(r.body.executive.auditAccessStatus,'NO_PERMISSION');assert.equal(auditCalls,0);}groups.push('five_forged_queries_cannot_grant');
assert.equal((await http.get('/api/v1/admin/reports/audit').set('Authorization','Bearer '+token)).status,403);groups.push('audit_endpoint_denied');
await setPermissions(['dashboard.read','audit.export']);r=await get();assert.equal(r.status,200);assert.equal(r.body.executive.auditEventsCount,'NO_PERMISSION');assert.equal(auditCalls,0);groups.push('export_does_not_grant_read');
auditFault=true;r=await get();assert.equal(r.status,200);assert.equal(r.body.executive.auditEventsCount,'NO_PERMISSION');assert.equal(auditCalls,0);groups.push('forbidden_source_failure_not_queried');auditFault=false;
await setPermissions(['dashboard.read','audit.read']);const actual=await prisma.auditLog.count();assert(actual>=2);r=await get();assert.equal(r.status,200);assert.equal(r.body.executive.auditEventsCount,actual);assert.equal(r.body.executive.auditAccessStatus,'GRANTED');assert.equal(auditCalls,1);const authorized=r.body;groups.push('grant_same_JWT_real_database_count');
auditFault=true;r=await get();assert.equal(r.status,500);assert.equal(auditCalls,2);assert.equal(r.body.executive,undefined);groups.push('authorized_source_failure_not_fake_zero');auditFault=false;
await setPermissions(['dashboard.read']);r=await get();assert.equal(r.status,200);assert.equal(r.body.executive.auditEventsCount,'NO_PERMISSION');assert.equal(r.body.executive.auditAccessStatus,'NO_PERMISSION');assert.equal(auditCalls,2);assert.deepEqual({...authorized,executive:{...authorized.executive,auditEventsCount:null,auditAccessStatus:null}},{...r.body,executive:{...r.body.executive,auditEventsCount:null,auditAccessStatus:null}});groups.push('revoke_same_JWT_no_query_other_metrics_unchanged');
await setPermissions(['audit.read']);r=await get();assert.equal(r.status,403);assert.equal(auditCalls,2);groups.push('dashboard_permission_still_required');
assert.equal((await http.get('/api/v1/admin/analytics/operational-metrics')).status,401);assert.equal(auditCalls,2);groups.push('anonymous_401_no_query');
process.stdout.write('LEGACY_AUDIT_RESULT '+JSON.stringify({status:'PASS',groups,auditCalls,actualAuditCount:actual,JWTUnmodified:true,providersCalled:false,production:'NO-GO'})+'\n');await app.close();await prisma.$disconnect();
})().catch(async e=>{if(app)await app.close();await prisma.$disconnect();process.stderr.write(String(e.stack||e)+'\n');process.exitCode=1;});
`;

describe('Compiled legacy audit-count RBAC', () => {
  before(() => {
    execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', 'tsconfig.build.json'], {
      cwd: process.cwd(), env: process.env, stdio: 'pipe',
    });
  });

  it('enforces current audit.read without querying or fabricating forbidden audit metrics', (t) => {
    const result = spawnSync(process.execPath, ['-e', probe], {
      cwd: process.cwd(), env: process.env, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024,
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /LEGACY_AUDIT_RESULT /);
    const receipt = JSON.parse(result.stdout.split('LEGACY_AUDIT_RESULT ')[1].trim());
    assert.equal(receipt.status, 'PASS');
    assert.equal(receipt.groups.length, 10);
    assert.equal(receipt.JWTUnmodified, true);
    assert.equal(receipt.providersCalled, false);
    t.diagnostic('LEGACY_AUDIT_RESULT ' + JSON.stringify(receipt));
  });
});

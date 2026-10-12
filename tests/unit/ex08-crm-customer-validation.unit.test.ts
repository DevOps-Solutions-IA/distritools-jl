import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminOperationsController } from 'src/modules/admin-operations/infrastructure/http/controllers/admin-operations.controller';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { AuditRepository } from 'src/modules/auth/domain/repositories/audit.repository';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
const actor = { sub: '00000000-0000-4000-8000-000000000001', permissions: ['customers.notes.write'] } as CurrentUser;
const id = '00000000-0000-4000-8000-000000000002';
const current = { id, fullName:'Synthetic Person',email:'original@example.invalid',phone:'0000000000',defaultAddress:'Synthetic address',city:'Bogota',department:null,country:'CO',marketingConsent:false,dataTreatmentConsent:false,lastOrderAt:null,createdAt:new Date(),updatedAt:new Date() };
function fixture(error?: unknown) {
 const writes: Array<Record<string, unknown>> = []; let transactions = 0; let audited = false;
 const tx = { $queryRaw:async()=>[],customer:{findUnique:async()=>current,update:async (args:{data:Record<string,unknown>})=>{ if(error)throw error;writes.push(args.data);return {...current,...args.data}; }} };
 const db = { $transaction:async (fn:(tx:unknown)=>Promise<unknown>)=>{transactions++;return fn(tx);} };
 const controller = new AdminOperationsController(db as unknown as PrismaService,{write:async()=>{audited=true;}} as unknown as AuditRepository);
 return {controller,writes,transactions:()=>transactions,audited:()=>audited};
}
describe('CRM update email boundary',()=>{
 it('rejects invalid email strings and non-string values before entering the transaction',async()=>{
  for(const email of ['not-an-email','a@',123,true,null,[],{}]){const f=fixture();await assert.rejects(f.controller.updateCustomer(id,{email} as Parameters<AdminOperationsController['updateCustomer']>[1],actor,'127.0.0.1'),BadRequestException);assert.equal(f.transactions(),0);assert.equal(f.writes.length,0);assert.equal(f.audited(),false);}
 });
 it('keeps blank and omitted email unchanged and normalizes a valid replacement locally',async()=>{
  for(const [body,want] of [[{},current.email],[{email:'   '},current.email],[{email:' User@Example.COM '},'user@example.com']] as const){const f=fixture();const out=await f.controller.updateCustomer(id,body,actor,'127.0.0.1');assert.equal(f.writes[0].email,want);assert.ok(f.audited());assert.notEqual(out.email,want);}
 });
 it('maps only actual Prisma unique-email conflicts to a fixed 409',async()=>{
  const error=new Prisma.PrismaClientKnownRequestError('synthetic unique email',{code:'P2002',clientVersion:'6',meta:{target:['email']}});const f=fixture(error);await assert.rejects(f.controller.updateCustomer(id,{email:'taken@example.invalid'},actor,'127.0.0.1'),ConflictException);assert.equal(f.audited(),false);
 });
 it('preserves non-email unique and other database/audit failures instead of converting them to conflicts',async()=>{
  for(const error of [new Prisma.PrismaClientKnownRequestError('synthetic unique id',{code:'P2002',clientVersion:'6',meta:{target:['id']}}),new Error('synthetic unrelated failure')]){const f=fixture(error);await assert.rejects(f.controller.updateCustomer(id,{email:'valid@example.invalid'},actor,'127.0.0.1'),e=>e===error);assert.equal(f.audited(),false);}
 });
});

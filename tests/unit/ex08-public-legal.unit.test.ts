import 'reflect-metadata';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { GetPublishedLegalUseCase } from 'src/modules/content/application/use-cases/get-published-legal.use-case';
import { PrismaContentRepository } from 'src/modules/content/infrastructure/repositories/prisma-content.repository';
import { PublicLegalController } from 'src/modules/content/infrastructure/http/controllers/public-legal.controller';
import { IS_PUBLIC_KEY } from 'src/common/constants/auth.constants';

it('restricts database projection to eligible persisted publication and public fields', async () => {
  const publication = { pageKey: 'actual-page', slug: 'actual-page', title: 'Actual title', version: 2, content: { text: 'Actual content' }, publishedAt: new Date('2026-10-11T00:00:00Z') };
  const prisma = {
    legalVersion: {
      findFirst: async (query: unknown) => {
        assert.deepEqual(query, {
          where: { pageKey: 'actual-page', status: 'published', publishedAt: { not: null } },
          orderBy: [{ version: 'desc' }, { id: 'desc' }],
          select: { pageKey: true, slug: true, title: true, version: true, content: true, publishedAt: true },
        });
        return publication;
      },
    },
  } as unknown as PrismaService;
  assert.deepEqual(await new GetPublishedLegalUseCase(new PrismaContentRepository(prisma)).execute('actual-page'), publication);
});

it('returns a missing-publication error without writes or template construction', async () => {
  const prisma = { legalVersion: { findFirst: async () => null } } as unknown as PrismaService;
  await assert.rejects(new GetPublishedLegalUseCase(new PrismaContentRepository(prisma)).execute('absent-page'), NotFoundException);
});

it('propagates database failures rather than reporting an absent document', async () => {
  const failure = new Error('controlled DB read failure');
  const prisma = { legalVersion: { findFirst: async () => { throw failure; } } } as unknown as PrismaService;
  await assert.rejects(new GetPublishedLegalUseCase(new PrismaContentRepository(prisma)).execute('actual-page'), (error) => error === failure);
});

it('marks only the public read as anonymous', () => {
  assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, PublicLegalController.prototype.get), true);
  assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, PublicLegalController), undefined);
});

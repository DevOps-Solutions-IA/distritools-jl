import { Prisma } from '@prisma/client';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  ContentRepository,
  PublishedLegalDocumentRecord,
  CreateContentBlockRecord,
  UpdateContentBlockRecord,
} from 'src/modules/content/domain/repositories/content.repository';

@Injectable()
export class PrismaContentRepository implements ContentRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(data: CreateContentBlockRecord) {
    return this.prisma.contentBlock.create({
      data: {
        ...data,
        body: data.body as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async update(data: UpdateContentBlockRecord) {
    const { id, ...update } = data;
    const updateData: Record<string, unknown> = {
      ...update,
    };

    if (update.body !== undefined) {
      updateData.body = update.body as unknown as Prisma.InputJsonValue;
    }

    return this.prisma.contentBlock.update({
      where: { id },
      data: updateData,
    });
  }

  async findById(id: string) {
    return this.prisma.contentBlock.findUnique({
      where: { id },
    });
  }

  async listAll() {
    return this.prisma.contentBlock.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async listVisible(placementKey?: string, at = new Date()) {
    return this.prisma.contentBlock.findMany({
      where: {
        ...(placementKey ? { placementKey } : {}),
        isPublished: true,
        OR: [{ startsAt: null }, { startsAt: { lte: at } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: at } }] }],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findPublishedLegal(pageKey: string): Promise<PublishedLegalDocumentRecord | null> {
    return this.prisma.legalVersion.findFirst({
      where: { pageKey, status: 'published', publishedAt: { not: null } },
      orderBy: [{ version: 'desc' }, { id: 'desc' }],
      select: {
        pageKey: true,
        slug: true,
        title: true,
        version: true,
        content: true,
        publishedAt: true,
      },
    });
  }
}

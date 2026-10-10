import { createHash } from 'node:crypto';
import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import { FOOTER_LINK_LIMIT, inspectFooterHref } from './footer-route-authority';

@Injectable()
export class PublicFooterService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository,
  ) {}

  async getPublished() {
    return this.prisma.$transaction(
      async (tx) => {
        // Share the publication lock: projection and alert refer to one immutable revision.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(74074, 2)`;
        const revision = await tx.footerRevision.findFirst({
          where: { status: 'published' },
          orderBy: { version: 'desc' },
          include: {
            links: { orderBy: [{ order: 'asc' }, { id: 'asc' }], take: FOOTER_LINK_LIMIT + 1 },
          },
        });
        if (!revision) return { version: null, groups: [] };
        if (revision.links.length > FOOTER_LINK_LIMIT)
          throw new ServiceUnavailableException(
            'El footer supera el límite técnico de enlaces y requiere una nueva revisión.',
          );
        const groups = new Map<
          string,
          Array<{ label: string; href: string }>
        >();
        const invalidLinks = new Map<
          string,
          { linkId: string; reason: string }
        >();
        for (const link of revision.links) {
          if (!link.isVisible) continue;
          const result = await inspectFooterHref(tx, link.href);
          if (!result.valid) {
            const invalid = {
              linkId: link.id,
              reason: result.reason ?? 'Destino no disponible.',
            };
            invalidLinks.set(JSON.stringify(invalid), invalid);
            continue;
          }
          const items = groups.get(link.group) ?? [];
          items.push({ label: link.label, href: link.href });
          groups.set(link.group, items);
        }
        if (invalidLinks.size > 0) {
          const invalid = [...invalidLinks.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, value]) => value);
          const fingerprint = createHash('sha256')
            .update(JSON.stringify(invalid))
            .digest('hex');
          const exists = await tx.auditLog.findFirst({
            where: {
              action: 'footer.route_invalidated',
              entityType: 'footerRevision',
              entityId: revision.id,
              afterData: { path: ['fingerprint'], equals: fingerprint },
            },
            select: { id: true },
          });
          if (!exists)
            await this.audit.write(
              {
                action: 'footer.route_invalidated',
                entityType: 'footerRevision',
                entityId: revision.id,
                afterData: {
                  version: revision.version,
                  fingerprint,
                  invalidLinks: invalid,
                },
              },
              tx,
            );
        }
        // No groupsJson, identifiers, actors or audit metadata cross the public boundary.
        return {
          version: revision.version,
          groups: [...groups].map(([title, items]) => ({ title, items })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
}

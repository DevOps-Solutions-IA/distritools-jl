import 'reflect-metadata';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { PublicFooterService } from 'src/modules/admin-operations/application/public-footer.service';
import { PublicFooterController } from 'src/modules/admin-operations/infrastructure/http/controllers/public-footer.controller';
import { PrismaAuditRepository } from 'src/modules/auth/infrastructure/repositories/prisma-audit.repository';
import { RequestContextService } from 'src/common/request/request-context.service';
import { IS_PUBLIC_KEY } from 'src/common/constants/auth.constants';

const links = [
  {
    id: 'safe',
    group: 'Catálogo',
    label: 'Productos',
    href: '/productos',
    order: 0,
    isVisible: true,
  },
  {
    id: 'dynamic',
    group: 'Catálogo',
    label: 'Detalle',
    href: '/productos/dynamic',
    order: 1,
    isVisible: true,
  },
  {
    id: 'hidden',
    group: 'Ocultos',
    label: 'Oculto',
    href: '/missing',
    order: 2,
    isVisible: false,
  },
];
function harness(
  options: { absent?: boolean; failAudit?: boolean; active?: boolean } = {},
) {
  let active = options.active ?? true;
  const published = {
    id: 'published-id',
    version: 2,
    status: 'published',
    links: structuredClone(links),
    groupsJson: { internalNotes: 'never-public' },
    approvedById: 'operator',
  };
  let audits: Prisma.AuditLogUncheckedCreateInput[] = [];
  let serial = Promise.resolve();
  const calls: string[] = [];
  const prisma = {
    $transaction: async <T>(
      operation: (tx: Prisma.TransactionClient) => Promise<T>,
    ) => {
      let release!: () => void;
      const predecessor = serial;
      serial = new Promise<void>((resolve) => {
        release = resolve;
      });
      await predecessor;
      const staged = structuredClone(audits);
      const tx = {
        $executeRaw: async (strings: TemplateStringsArray) => {
          calls.push(strings.join(''));
          return 1;
        },
        footerRevision: {
          findFirst: async (query: {
            where: { status: string };
            orderBy: { version: string };
          }) => {
            assert.equal(query.where.status, 'published');
            assert.equal(query.orderBy.version, 'desc');
            return options.absent ? null : structuredClone(published);
          },
        },
        product: {
          findUnique: async () => (active ? { isActive: true } : null),
        },
        category: { findUnique: async () => null },
        brand: { findUnique: async () => null },
        auditLog: {
          findFirst: async (query: {
            where: {
              action: string;
              entityId: string;
              afterData: { equals: string };
            };
          }) =>
            staged.find(
              (entry) =>
                entry.action === query.where.action &&
                entry.entityId === query.where.entityId &&
                (entry.afterData as { fingerprint: string }).fingerprint ===
                  query.where.afterData.equals,
            ) ?? null,
          create: async ({
            data,
          }: {
            data: Prisma.AuditLogUncheckedCreateInput;
          }) => {
            staged.push(structuredClone(data));
            if (options.failAudit)
              throw new Error('audit unavailable after insert');
            return data;
          },
        },
      } as unknown as Prisma.TransactionClient;
      try {
        const result = await operation(tx);
        audits = staged;
        return result;
      } finally {
        release();
      }
    },
  } as unknown as PrismaService;
  const audit = new PrismaAuditRepository(prisma, new RequestContextService());
  const service = new PublicFooterService(prisma, audit);
  return {
    service,
    published,
    calls,
    audits: () => audits,
    setActive: (value: boolean) => {
      active = value;
    },
  };
}
it('no published revision returns an empty fail-closed projection and no default writes', async () => {
  const h = harness({ absent: true });
  assert.deepEqual(await h.service.getPublished(), {
    version: null,
    groups: [],
  });
  assert.equal(h.audits().length, 0);
});
it('public projection contains only visible validated labels/hrefs and version', async () => {
  const h = harness();
  assert.deepEqual(await h.service.getPublished(), {
    version: 2,
    groups: [
      {
        title: 'Catálogo',
        items: [
          { label: 'Productos', href: '/productos' },
          { label: 'Detalle', href: '/productos/dynamic' },
        ],
      },
    ],
  });
  assert.equal(h.audits().length, 0);
  assert.ok(h.calls[0].includes('pg_advisory_xact_lock(74074, 2)'));
});
it('resource invalidation hides broken link, durably alerts and preserves published revision', async () => {
  const h = harness();
  const before = structuredClone(h.published);
  await h.service.getPublished();
  h.setActive(false);
  assert.deepEqual(await h.service.getPublished(), {
    version: 2,
    groups: [
      {
        title: 'Catálogo',
        items: [{ label: 'Productos', href: '/productos' }],
      },
    ],
  });
  assert.deepEqual(h.published, before);
  assert.equal(h.audits().length, 1);
  const alert = h.audits()[0];
  assert.equal(alert.action, 'footer.route_invalidated');
  assert.equal(alert.entityType, 'footerRevision');
  assert.equal(alert.entityId, before.id);
  assert.deepEqual(
    (alert.afterData as { invalidLinks: unknown }).invalidLinks,
    [
      {
        linkId: 'dynamic',
        reason: 'El recurso no existe o no está activo/publicado.',
      },
    ],
  );
});
it('duplicate and concurrent reads deduplicate alert in serialized transaction', async () => {
  const h = harness({ active: false });
  await Promise.all(Array.from({ length: 5 }, () => h.service.getPublished()));
  assert.equal(h.audits().length, 1);
});
it('new invalid link set records distinct alert without changing published source', async () => {
  const h = harness({ active: false });
  await h.service.getPublished();
  h.published.links[0].href = '/missing';
  const before = structuredClone(h.published);
  await h.service.getPublished();
  assert.equal(h.audits().length, 2);
  assert.deepEqual(h.published, before);
});
it('failed durable audit fails closed and staged insert rolls back', async () => {
  const h = harness({ active: false, failAudit: true });
  const before = structuredClone(h.published);
  await assert.rejects(h.service.getPublished(), /audit unavailable/);
  assert.equal(h.audits().length, 0);
  assert.deepEqual(h.published, before);
});
it('legacy manipulated URLs never enter alerts or public projection', async () => {
  const h = harness();
  h.published.links[0].href = '/productos?token=synthetic-sensitive';
  const response = await h.service.getPublished();
  assert.ok(!JSON.stringify(response).includes('synthetic-sensitive'));
  assert.ok(!JSON.stringify(h.audits()).includes('synthetic-sensitive'));
  assert.deepEqual(
    (h.audits()[0].afterData as { invalidLinks: unknown }).invalidLinks,
    [
      {
        linkId: 'safe',
        reason: 'Parámetros de ruta no permitidos o manipulados.',
      },
    ],
  );
});
it('public controller exposes explicit public/no-store metadata and delegates safely', async () => {
  const h = harness();
  const controller = new PublicFooterController(h.service);
  assert.equal(
    Reflect.getMetadata(
      IS_PUBLIC_KEY,
      PublicFooterController.prototype.getPublished,
    ),
    true,
  );
  const headers = Reflect.getMetadata(
    '__headers__',
    PublicFooterController.prototype.getPublished,
  ) as Array<{ name: string; value: string }>;
  assert.ok(
    headers.some(
      (header) =>
        header.name === 'Cache-Control' && header.value === 'no-store',
    ),
  );
  assert.equal((await controller.getPublished()).version, 2);
});

it('technical bound accepts exactly 1000 links and fails closed on 1001 without truncating', async () => {
  const h = harness();
  h.published.links = Array.from({ length: 1000 }, (_, index) => ({
    ...links[0],
    id: `link-${index}`,
    order: index,
  }));
  const projection = await h.service.getPublished();
  assert.equal(projection.groups[0].items.length, 1000);
  h.published.links.push({ ...links[0], id: 'overflow' });
  await assert.rejects(h.service.getPublished(), /límite técnico/);
  assert.equal(h.audits().length, 0);
});
it('resource reactivation restores valid projection but retains durable review alert', async () => {
  const h = harness({ active: false });
  await h.service.getPublished();
  h.setActive(true);
  assert.equal((await h.service.getPublished()).groups[0].items.length, 2);
  assert.equal(h.audits().length, 1);
});

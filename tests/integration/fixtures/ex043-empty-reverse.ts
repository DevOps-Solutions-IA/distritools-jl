import { Prisma, PrismaClient } from '@prisma/client';

// TEST ONLY. Never a deployment rollback. Refuses history rather than transforming/deleting it.
export async function reverseEmptyEx043(db: PrismaClient, databaseName: string, marker: string) {
  if (!/^ex043_test_roundtrip_[a-f0-9]+$/.test(databaseName)) throw new Error('Invalid disposable database identity');
  await db.$transaction(async (tx) => {
    const identity = await tx.$queryRaw<Array<{ name: string; marker: string }>>(Prisma.sql`
      SELECT current_database() AS name, shobj_description(oid, 'pg_database') AS marker
      FROM pg_database WHERE datname = current_database()
    `);
    if (identity[0]?.name !== databaseName || identity[0]?.marker !== marker) throw new Error('Disposable creation marker mismatch');
    await tx.$executeRawUnsafe('LOCK TABLE domain_event_outbox, domain_event_inbox, notifications, notification_audit_intents IN ACCESS EXCLUSIVE MODE');
    const populated = await tx.$queryRaw<Array<{ populated: boolean }>>(Prisma.sql`
      SELECT EXISTS(SELECT 1 FROM domain_event_outbox) OR EXISTS(SELECT 1 FROM domain_event_inbox)
        OR EXISTS(SELECT 1 FROM notifications) OR EXISTS(SELECT 1 FROM notification_audit_intents) AS populated
    `);
    if (populated[0].populated) throw new Error('Refusing reverse fixture: populated durable backlog');
    for (const statement of [
      'DROP TABLE notification_audit_intents',
      'DROP TABLE domain_event_inbox',
      'DROP INDEX notifications_dispatch_recovery_idx',
      'ALTER TABLE notifications DROP COLUMN dispatch_claim_token, DROP COLUMN dispatch_lease_until, DROP COLUMN last_error_code, DROP COLUMN dispatch_eligible',
      'ALTER TABLE notifications ALTER COLUMN status DROP DEFAULT',
      'ALTER TYPE "NotificationStatus" RENAME TO "Ex043TestOldNotificationStatus"',
      `CREATE TYPE "NotificationStatus" AS ENUM ('queued', 'sent', 'failed')`,
      'ALTER TABLE notifications ALTER COLUMN status TYPE "NotificationStatus" USING (status::text::"NotificationStatus")',
      `ALTER TABLE notifications ALTER COLUMN status SET DEFAULT 'queued'::"NotificationStatus"`,
      'DROP TYPE "Ex043TestOldNotificationStatus"',
      `DELETE FROM _prisma_migrations WHERE migration_name = '20261006zz_consumer_inbox_notification_recovery'`,
    ]) await tx.$executeRawUnsafe(statement);
  });
}

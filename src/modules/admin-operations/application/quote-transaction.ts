import type { Prisma } from '@prisma/client';

export function formatNextQuoteNumber(maximumSuffix: string): string {
  return `QTE-${String(BigInt(maximumSuffix) + 1n).padStart(6, '0')}`;
}

export async function allocateQuoteNumber(tx: Prisma.TransactionClient): Promise<string> {
  // Reserved advisory key for QTE allocation. The transaction must also insert
  // the quote before releasing this lock; a process-local mutex is insufficient.
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(748074, 1)`;
  const [row] = await tx.$queryRaw<Array<{ maximum: string }>>`
    SELECT COALESCE(MAX(SUBSTRING("quote_number" FROM 5)::numeric), 0)::text AS maximum
    FROM "quotes"
    WHERE "quote_number" ~ '^QTE-[0-9]+$'
  `;
  return formatNextQuoteNumber(row.maximum);
}

export async function lockQuote(tx: Prisma.TransactionClient, quoteId: string): Promise<void> {
  // All quote writers must take this lock before reading the state/items they
  // validate. ReadCommitted then sees the preceding writer's committed state.
  await tx.$queryRaw`SELECT "id" FROM "quotes" WHERE "id" = ${quoteId}::uuid FOR UPDATE`;
}

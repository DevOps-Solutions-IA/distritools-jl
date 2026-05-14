-- Enterprise inventory closure: kardex, counts, imports, valuation and warehouse metadata.
ALTER TABLE "warehouses"
  ADD COLUMN IF NOT EXISTS "code" TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 100;

UPDATE "warehouses"
SET "code" = COALESCE(NULLIF("code", ''), upper(regexp_replace(COALESCE("name", 'warehouse'), '[^a-zA-Z0-9]+', '-', 'g')))
WHERE "code" IS NULL;

UPDATE "warehouses"
SET "code" = 'WH-' || substr("id"::text, 1, 8)
WHERE "code" IS NULL OR "code" = '';

WITH ranked AS (
  SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS rn
  FROM "warehouses"
)
UPDATE "warehouses" w
SET "code" = w."code" || '-' || ranked.rn
FROM ranked
WHERE ranked."id" = w."id"
  AND EXISTS (
    SELECT 1 FROM "warehouses" d
    WHERE d."code" = w."code" AND d."id" <> w."id"
  );

ALTER TABLE "warehouses" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "warehouses_code_key" ON "warehouses"("code");

WITH first_warehouse AS (
  SELECT "id"
  FROM "warehouses"
  WHERE "is_active" = true
  ORDER BY "created_at", "id"
  LIMIT 1
)
UPDATE "warehouses"
SET "is_default" = true
WHERE "id" IN (SELECT "id" FROM first_warehouse)
  AND NOT EXISTS (SELECT 1 FROM "warehouses" WHERE "is_default" = true);

ALTER TABLE "inventory_items"
  ADD COLUMN IF NOT EXISTS "committed_qty" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "min_stock" INTEGER,
  ADD COLUMN IF NOT EXISTS "max_stock" INTEGER,
  ADD COLUMN IF NOT EXISTS "reorder_point" INTEGER,
  ADD COLUMN IF NOT EXISTS "reorder_qty" INTEGER,
  ADD COLUMN IF NOT EXISTS "cost_price" DECIMAL(12, 2);

ALTER TABLE "stock_movements"
  ADD COLUMN IF NOT EXISTS "product_id" UUID,
  ADD COLUMN IF NOT EXISTS "sku" TEXT,
  ADD COLUMN IF NOT EXISTS "quantity_delta" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "quantity_before" INTEGER,
  ADD COLUMN IF NOT EXISTS "quantity_after" INTEGER,
  ADD COLUMN IF NOT EXISTS "order_id" UUID,
  ADD COLUMN IF NOT EXISTS "reason_code" TEXT,
  ADD COLUMN IF NOT EXISTS "reason_text" TEXT,
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS "raw_metadata" JSONB;

UPDATE "stock_movements" sm
SET "sku" = v."sku",
    "product_id" = v."product_id",
    "quantity_delta" = CASE
      WHEN sm."movement_type" IN ('commit') THEN -sm."quantity"
      WHEN sm."movement_type" IN ('adjustment', 'return') THEN sm."quantity"
      ELSE 0
    END,
    "reason_code" = COALESCE(sm."reason", sm."movement_type"::text),
    "reason_text" = sm."reason"
FROM "variants" v
WHERE v."id" = sm."variant_id";

DO $$
BEGIN
  ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'initial_stock';
  ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'manual_adjustment_in';
  ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'manual_adjustment_out';
  ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'order_cancelled_release';
  ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'return_received';
  ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'physical_count_correction';
  ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'import_adjustment';
  ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'system_correction';
END $$;

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "inventory_return_lines" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "order_item_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "condition" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "comment" TEXT,
  "stock_movement_id" UUID,
  "created_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_return_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_return_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_return_lines_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "inventory_return_lines_order_id_idx" ON "inventory_return_lines"("order_id");
CREATE INDEX IF NOT EXISTS "inventory_return_lines_order_item_id_idx" ON "inventory_return_lines"("order_item_id");

CREATE TABLE IF NOT EXISTS "inventory_count_sessions" (
  "id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "started_by" UUID,
  "closed_by" UUID,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMP(3),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_count_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_count_sessions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "inventory_count_sessions_warehouse_id_status_idx" ON "inventory_count_sessions"("warehouse_id", "status");

CREATE TABLE IF NOT EXISTS "inventory_count_lines" (
  "id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "sku" TEXT NOT NULL,
  "system_quantity" INTEGER NOT NULL,
  "counted_quantity" INTEGER,
  "difference" INTEGER,
  "adjustment_movement_id" UUID,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_count_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_count_lines_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "inventory_count_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_count_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_count_lines_session_id_variant_id_key" ON "inventory_count_lines"("session_id", "variant_id");

CREATE TABLE IF NOT EXISTS "inventory_import_batches" (
  "id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'dry_run',
  "filename" TEXT,
  "total_rows" INTEGER NOT NULL DEFAULT 0,
  "valid_rows" INTEGER NOT NULL DEFAULT 0,
  "error_rows" INTEGER NOT NULL DEFAULT 0,
  "created_by" UUID,
  "applied_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "applied_at" TIMESTAMP(3),
  CONSTRAINT "inventory_import_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory_import_rows" (
  "id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "row_number" INTEGER NOT NULL,
  "sku" TEXT NOT NULL,
  "warehouse_code" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "mode" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "valid" BOOLEAN NOT NULL DEFAULT false,
  "errors" JSONB,
  "movement_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_import_rows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_import_rows_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "inventory_import_rows_batch_id_idx" ON "inventory_import_rows"("batch_id");

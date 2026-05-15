-- Drop old unique constraints (replaced)
DROP INDEX IF EXISTS "shipments_order_id_provider_key";
DROP INDEX IF EXISTS "stock_movements_movement_type_variant_id_warehouse_id_refer_key";
DROP INDEX IF EXISTS "categories_parent_id_idx";

-- Add columns
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_id" UUID;

ALTER TABLE "inventory_import_batches" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);
UPDATE "inventory_import_batches" SET "updated_at" = NOW() WHERE "updated_at" IS NULL;
ALTER TABLE "inventory_import_batches" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "inventory_import_batches" ALTER COLUMN "updated_at" SET DEFAULT NOW();

ALTER TABLE "inventory_return_lines" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);
UPDATE "inventory_return_lines" SET "updated_at" = NOW() WHERE "updated_at" IS NULL;
ALTER TABLE "inventory_return_lines" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "inventory_return_lines" ALTER COLUMN "updated_at" SET DEFAULT NOW();

ALTER TABLE "webhook_receipts" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);
UPDATE "webhook_receipts" SET "updated_at" = NOW() WHERE "updated_at" IS NULL;
ALTER TABLE "webhook_receipts" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "webhook_receipts" ALTER COLUMN "updated_at" SET DEFAULT NOW();

-- New indexes
CREATE INDEX IF NOT EXISTS "analytics_snapshots_created_at_idx" ON "analytics_snapshots"("created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "categories_parent_id_sort_order_idx" ON "categories"("parent_id", "sort_order");
CREATE INDEX IF NOT EXISTS "customers_document_number_idx" ON "customers"("document_number");
CREATE INDEX IF NOT EXISTS "inventory_return_lines_variant_id_created_at_idx" ON "inventory_return_lines"("variant_id", "created_at");
CREATE INDEX IF NOT EXISTS "inventory_return_lines_warehouse_id_idx" ON "inventory_return_lines"("warehouse_id");
CREATE INDEX IF NOT EXISTS "order_items_warehouse_id_idx" ON "order_items"("warehouse_id");
CREATE INDEX IF NOT EXISTS "orders_customer_id_idx" ON "orders"("customer_id");

-- New unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "shipments_order_id_provider_status_key" ON "shipments"("order_id", "provider", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "stock_movements_movement_type_variant_id_warehouse_id_refer_key" ON "stock_movements"("movement_type", "variant_id", "warehouse_id", "reference_type", "reference_id", "created_at");

-- Foreign keys (without IF NOT EXISTS - not supported in PostgreSQL)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_customer_id_fkey') THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_warehouse_id_fkey') THEN ALTER TABLE "order_items" ADD CONSTRAINT "order_items_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_return_lines_variant_id_fkey') THEN ALTER TABLE "inventory_return_lines" ADD CONSTRAINT "inventory_return_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_return_lines_warehouse_id_fkey') THEN ALTER TABLE "inventory_return_lines" ADD CONSTRAINT "inventory_return_lines_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_return_lines_stock_movement_id_fkey') THEN ALTER TABLE "inventory_return_lines" ADD CONSTRAINT "inventory_return_lines_stock_movement_id_fkey" FOREIGN KEY ("stock_movement_id") REFERENCES "stock_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_count_sessions_started_by_fkey') THEN ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_started_by_fkey" FOREIGN KEY ("started_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_count_sessions_closed_by_fkey') THEN ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_count_lines_adjustment_movement_id_fkey') THEN ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_adjustment_movement_id_fkey" FOREIGN KEY ("adjustment_movement_id") REFERENCES "stock_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_import_batches_created_by_fkey') THEN ALTER TABLE "inventory_import_batches" ADD CONSTRAINT "inventory_import_batches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_import_batches_applied_by_fkey') THEN ALTER TABLE "inventory_import_batches" ADD CONSTRAINT "inventory_import_batches_applied_by_fkey" FOREIGN KEY ("applied_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_import_rows_movement_id_fkey') THEN ALTER TABLE "inventory_import_rows" ADD CONSTRAINT "inventory_import_rows_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "stock_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

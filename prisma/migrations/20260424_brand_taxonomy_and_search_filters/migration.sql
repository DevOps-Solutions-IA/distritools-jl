DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'brands'
  ) THEN
    ALTER TABLE "brands"
    ADD COLUMN IF NOT EXISTS "metadata" JSONB;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'search_documents'
  ) THEN
    ALTER TABLE "search_documents"
    ADD COLUMN IF NOT EXISTS "brand_slug" TEXT,
    ADD COLUMN IF NOT EXISTS "category_slug" TEXT;

    CREATE INDEX IF NOT EXISTS "search_documents_brand_slug_idx" ON "search_documents"("brand_slug");
    CREATE INDEX IF NOT EXISTS "search_documents_category_slug_idx" ON "search_documents"("category_slug");
  END IF;
END $$;

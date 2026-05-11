ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "search_documents_document_type_variant_id_key"
ON "search_documents"("document_type", "variant_id")
WHERE "variant_id" IS NOT NULL;

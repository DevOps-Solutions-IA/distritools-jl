CREATE TABLE "order_request_idempotencies" (
    "id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "key_hash" CHAR(64) NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "order_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_request_idempotencies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_request_idempotencies_order_id_fkey"
      FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "order_request_idempotencies_scope_key_hash_key"
  ON "order_request_idempotencies"("scope", "key_hash");
CREATE UNIQUE INDEX "order_request_idempotencies_order_id_key"
  ON "order_request_idempotencies"("order_id");
CREATE INDEX "order_request_idempotencies_created_at_idx"
  ON "order_request_idempotencies"("created_at");

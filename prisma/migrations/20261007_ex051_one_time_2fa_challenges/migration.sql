CREATE TABLE "auth_two_factor_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_two_factor_challenges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_two_factor_challenges_expiry_check" CHECK ("expires_at" > "created_at")
);

CREATE INDEX "auth_two_factor_challenges_user_id_expires_at_idx"
    ON "auth_two_factor_challenges"("user_id", "expires_at");

-- ---------------------------------------------------------------------------
-- Grow webhook implementation (src/app/api/grow/webhook/route.ts) needs
-- somewhere to record which provider wrote a row, Grow's own transaction id
-- (for idempotent replay handling), and the raw payload for debugging since
-- Grow's exact field-name shape is still unconfirmed against a real sandbox
-- account. `stripe_customer_id` becomes nullable because Grow has no
-- equivalent concept.
-- ---------------------------------------------------------------------------

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'stripe';
ALTER TABLE "subscriptions" ADD COLUMN "provider_transaction_id" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "raw_payload" JSONB;
ALTER TABLE "subscriptions" ALTER COLUMN "stripe_customer_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_provider_provider_transaction_id_key" ON "subscriptions"("provider", "provider_transaction_id");

-- ---------------------------------------------------------------------------
-- Local-storage -> Supabase data-layer swap for hands (src/lib/localHandStore.ts).
--
-- `StoredHand` already carries these fields when hands lived in localStorage only;
-- the `hands` table never grew columns for them because nothing wrote to Supabase yet.
-- This adds them so the real Supabase-backed store can persist every field the UI already
-- reads/writes, instead of silently dropping data on the swap.
--
-- `opponent_id` / `session_id` are plain nullable text columns with NO foreign key —
-- src/lib/localOpponentStore.ts and src/lib/localSessionStore.ts are explicitly out of
-- scope for this migration, so there is nothing yet on the other end of those ids to
-- reference. `street_actions` is `jsonb`, matching the existing `stats_json` /
-- `tendencies` precedent on `sessions` / `opponents` — no fixed shape enforced in SQL.
-- ---------------------------------------------------------------------------

-- AlterTable
ALTER TABLE "hands" ADD COLUMN "position" TEXT;
ALTER TABLE "hands" ADD COLUMN "action_taken" TEXT;
ALTER TABLE "hands" ADD COLUMN "ev_loss_estimate" DOUBLE PRECISION;
ALTER TABLE "hands" ADD COLUMN "hand_category" TEXT;
ALTER TABLE "hands" ADD COLUMN "pot_odds_required" DOUBLE PRECISION;
ALTER TABLE "hands" ADD COLUMN "villain_range_raw" TEXT;
ALTER TABLE "hands" ADD COLUMN "opponent_id" TEXT;
ALTER TABLE "hands" ADD COLUMN "session_id" TEXT;
ALTER TABLE "hands" ADD COLUMN "note" TEXT;
ALTER TABLE "hands" ADD COLUMN "street_actions" JSONB;
ALTER TABLE "hands" ADD COLUMN "analysis_mode" TEXT;

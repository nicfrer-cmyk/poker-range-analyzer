-- Server-side counter for real AI-quota enforcement (see src/lib/aiUsage.ts). Until now, the
-- "1 free AI review/day" rule was enforced only client-side (localStorage usageTracker), which
-- a signed-in user could trivially bypass. Writes happen exclusively through Prisma
-- (server-side, after the route's own Supabase Auth check) — no client INSERT/UPDATE policy is
-- needed, matching the "subscriptions" table's read-only-from-client convention.

create table "ai_usage_daily" (
  "user_id" text not null references "users"("id") on delete cascade,
  "usage_date" date not null,
  "count" integer not null default 0,
  primary key ("user_id", "usage_date")
);

alter table "ai_usage_daily" enable row level security;

create policy "ai_usage_daily_select_own" on "ai_usage_daily"
  for select using (auth.uid()::text = user_id);

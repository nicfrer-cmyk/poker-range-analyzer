-- ---------------------------------------------------------------------------
-- Close a privilege-escalation gap in the "users" row-level-security policy.
--
-- `users_update_own` (see 20260707090000_auth_trigger_and_rls) only checks
-- *which row* is being updated (auth.uid() = id) — RLS in Postgres has no
-- concept of "which columns", so it does not stop a signed-in user from
-- PATCHing their OWN row's `plan` column directly against the Supabase REST
-- API (PostgREST), e.g.:
--
--   PATCH /rest/v1/users?id=eq.<their-own-id>
--   Authorization: Bearer <their-own-access-token>
--   { "plan": "PRO" }
--
-- The Stripe webhook (see stripe/webhook/route.ts) writes this exact column
-- as its source of truth for a paid subscription, so without this trigger,
-- any authenticated user could self-upgrade to PRO for free, with no
-- payment and no app-code bug involved at all — the hole is in the schema.
--
-- Fix: a BEFORE UPDATE trigger that reverts server-managed columns back to
-- their previous value whenever the write comes in as `anon`/`authenticated`
-- (i.e. via PostgREST with a user's JWT). Writes made by any other role —
-- `postgres`/the Prisma connection the Stripe/Grow webhook handlers use, and
-- this migration's own `security definer` functions — are unaffected.
-- ---------------------------------------------------------------------------

create or replace function public.protect_users_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.plan := old.plan;
    new.email := old.email;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_users_billing_columns on "users";
create trigger protect_users_billing_columns
  before update on "users"
  for each row execute procedure public.protect_users_billing_columns();

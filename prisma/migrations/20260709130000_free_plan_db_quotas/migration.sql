-- ---------------------------------------------------------------------------
-- DB-level enforcement of the FREE plan's maxSavedHands / maxOpponentProfiles caps, as
-- defense-in-depth alongside the client-side + API-route gating in src/lib/plan.ts
-- (PLAN_LIMITS.FREE) — that gating only stops the app's own UI/routes from letting a FREE user
-- over the cap, not a direct write against the database (e.g. via PostgREST with a user's own
-- JWT, which RLS otherwise allows for their own rows).
--
-- The limits below (25 hands, 3 opponent profiles) are hardcoded to match
-- PLAN_LIMITS.FREE.maxSavedHands / maxOpponentProfiles in src/lib/plan.ts at the time of this
-- migration — there is no shared source of truth across SQL and TypeScript, so if those
-- TypeScript values ever change, update this migration (a new one; migrations are immutable)
-- to match.
--
-- `security invoker` (not `definer`): see 20260707101500_fix_billing_trigger_security_context
-- for why this codebase specifically got burned by `security definer` on a trigger before. Not
-- load-bearing for correctness here (the app writes hands/opponents via Prisma over a
-- superuser-ish connection that bypasses RLS entirely, not via PostgREST), but kept consistent
-- with that lesson in case a future write path goes through PostgREST with a user's own JWT —
-- under invoker, the trigger's own SELECTs are still readable via each table's existing
-- `*_select_own` RLS policy, since NEW.user_id is always the inserting user's own id.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_free_plan_hand_limit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  user_plan "Plan";
  hand_count integer;
begin
  select plan into user_plan from "users" where id = new.user_id;
  if user_plan = 'FREE' then
    select count(*) into hand_count from "hands" where user_id = new.user_id;
    if hand_count >= 25 then
      raise exception 'הגעת למגבלת 25 הידיים השמורות בתוכנית החינמית. שדרג לפרו כדי לשמור עוד.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_free_plan_hand_limit on "hands";
create trigger enforce_free_plan_hand_limit
  before insert on "hands"
  for each row execute procedure public.enforce_free_plan_hand_limit();

create or replace function public.enforce_free_plan_opponent_limit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  user_plan "Plan";
  opponent_count integer;
begin
  select plan into user_plan from "users" where id = new.user_id;
  if user_plan = 'FREE' then
    select count(*) into opponent_count from "opponents" where user_id = new.user_id;
    if opponent_count >= 3 then
      raise exception 'הגעת למגבלת 3 פרופילי היריבים בתוכנית החינמית. שדרג לפרו כדי להוסיף עוד.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_free_plan_opponent_limit on "opponents";
create trigger enforce_free_plan_opponent_limit
  before insert on "opponents"
  for each row execute procedure public.enforce_free_plan_opponent_limit();

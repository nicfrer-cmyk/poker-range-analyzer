-- ---------------------------------------------------------------------------
-- Fix a bug in 20260707100000_protect_users_billing_columns: the guard
-- function was declared `security definer`, which means `current_user`
-- inside its body reflects the FUNCTION OWNER (the migration-running role,
-- e.g. `postgres`), not the role that actually issued the UPDATE — so the
-- `current_user in ('anon', 'authenticated')` check was always false and
-- the trigger silently did nothing. Verified live: a simulated authenticated
-- self-update of `plan` still went through after the first migration.
--
-- Fix: redeclare the same function as `security invoker` (the default), so
-- `current_user` correctly reflects whatever role PostgREST switched to
-- (`anon`/`authenticated`) for the request that triggered the UPDATE. The
-- trigger itself doesn't need to change — it already references this
-- function by name.
-- ---------------------------------------------------------------------------

create or replace function public.protect_users_billing_columns()
returns trigger
language plpgsql
security invoker
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

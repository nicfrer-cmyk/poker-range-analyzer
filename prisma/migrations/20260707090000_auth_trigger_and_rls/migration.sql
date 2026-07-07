-- Mirror new Supabase Auth users into public.users, keyed by the same UUID, so that
-- `auth.uid() = users.id` (and `auth.uid() = <table>.user_id` on every other table) is a
-- valid, working RLS check without the app having to remember to create the row itself.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, created_at, updated_at)
  values (new.id::text, new.email, now(), now())
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table "users" enable row level security;
alter table "hands" enable row level security;
alter table "ranges" enable row level security;
alter table "sessions" enable row level security;
alter table "opponents" enable row level security;
alter table "subscriptions" enable row level security;

-- users: a user can only read/update their own row (no direct insert/delete from the
-- client — rows are created by the trigger above and deleted via account-deletion flows
-- using the service-role key server-side).
create policy "users_select_own" on "users"
  for select using (auth.uid()::text = id);
create policy "users_update_own" on "users"
  for update using (auth.uid()::text = id);

-- hands: full CRUD, but only on rows the user owns.
create policy "hands_select_own" on "hands"
  for select using (auth.uid()::text = user_id);
create policy "hands_insert_own" on "hands"
  for insert with check (auth.uid()::text = user_id);
create policy "hands_update_own" on "hands"
  for update using (auth.uid()::text = user_id);
create policy "hands_delete_own" on "hands"
  for delete using (auth.uid()::text = user_id);

-- ranges: everyone can read preset ranges (user_id is null); users get full CRUD on their
-- own saved ranges only.
create policy "ranges_select_presets_or_own" on "ranges"
  for select using (is_preset = true or auth.uid()::text = user_id);
create policy "ranges_insert_own" on "ranges"
  for insert with check (auth.uid()::text = user_id);
create policy "ranges_update_own" on "ranges"
  for update using (auth.uid()::text = user_id);
create policy "ranges_delete_own" on "ranges"
  for delete using (auth.uid()::text = user_id);

-- sessions: full CRUD, own rows only.
create policy "sessions_select_own" on "sessions"
  for select using (auth.uid()::text = user_id);
create policy "sessions_insert_own" on "sessions"
  for insert with check (auth.uid()::text = user_id);
create policy "sessions_update_own" on "sessions"
  for update using (auth.uid()::text = user_id);
create policy "sessions_delete_own" on "sessions"
  for delete using (auth.uid()::text = user_id);

-- opponents: full CRUD, own rows only.
create policy "opponents_select_own" on "opponents"
  for select using (auth.uid()::text = user_id);
create policy "opponents_insert_own" on "opponents"
  for insert with check (auth.uid()::text = user_id);
create policy "opponents_update_own" on "opponents"
  for update using (auth.uid()::text = user_id);
create policy "opponents_delete_own" on "opponents"
  for delete using (auth.uid()::text = user_id);

-- subscriptions: read-only from the client; all writes happen server-side via the
-- service-role key (Stripe webhook handler), which bypasses RLS entirely.
create policy "subscriptions_select_own" on "subscriptions"
  for select using (auth.uid()::text = user_id);

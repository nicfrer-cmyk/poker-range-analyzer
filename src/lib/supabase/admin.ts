// ---------------------------------------------------------------------------
// Supabase admin (service-role) client — SERVER-ONLY.
//
// Uses SUPABASE_SERVICE_ROLE_KEY, which bypasses Row Level Security entirely.
// Never import this from a Client Component or anything that could end up in
// a browser bundle — only from Route Handlers / Server Actions that have
// already authenticated the caller themselves. Currently used for account
// deletion (src/app/api/account/delete/route.ts), which needs
// `auth.admin.deleteUser` — an operation the anon/user-scoped client can't do.
//
// LOCAL-ONLY NOTE: throws a clear error if SUPABASE_SERVICE_ROLE_KEY isn't
// set, rather than silently returning a broken client — see `.env.example`.
// ---------------------------------------------------------------------------

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export class SupabaseAdminNotConfiguredError extends Error {
  constructor() {
    super(
      "Supabase admin client is not configured: missing SUPABASE_SERVICE_ROLE_KEY. " +
        "See `.env.example` — get it from Project Settings > API > service_role key."
    );
    this.name = "SupabaseAdminNotConfiguredError";
  }
}

/** Throws `SupabaseAdminNotConfiguredError` if the required env vars aren't set. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new SupabaseAdminNotConfiguredError();
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

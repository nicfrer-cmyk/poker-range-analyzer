"use client";

// ---------------------------------------------------------------------------
// Supabase browser client
//
// For use inside Client Components only. Reads the public (safe to expose)
// Supabase URL + anon key from env vars. See `.env.example` at the project
// root for the required variables.
//
// LOCAL-ONLY NOTE: until a real Supabase project is connected, these env
// vars won't be set, and calling `createClient()` will throw a clear error
// rather than silently returning a broken client — see the guard below.
// ---------------------------------------------------------------------------

import { createBrowserClient } from "@supabase/ssr";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured: missing NEXT_PUBLIC_SUPABASE_URL and/or " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy `.env.example` to `.env.local`, " +
        "create a Supabase project at https://supabase.com, and fill in its " +
        "Project URL and anon/public key."
    );
  }

  return { url, anonKey };
}

/**
 * Creates a new Supabase client scoped to the browser. Safe to call inside
 * Client Components (e.g. in a `useMemo` or at module scope of a small
 * client-side hook). Do not reuse a single instance across unrelated
 * requests on the server — use `src/lib/supabase/server.ts` there instead.
 */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}

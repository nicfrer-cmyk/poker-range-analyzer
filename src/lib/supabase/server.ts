// ---------------------------------------------------------------------------
// Supabase server client
//
// For use in Server Components, Server Actions, and Route Handlers (App
// Router). Wires Supabase Auth's cookie storage up to Next.js's `cookies()`
// so sessions persist across requests.
//
// LOCAL-ONLY NOTE: until a real Supabase project is connected, these env
// vars won't be set, and calling `createClient()` will throw a clear error
// rather than silently returning a broken client. See `.env.example`.
// ---------------------------------------------------------------------------

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

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
 * Creates a Supabase client for use on the server, backed by the Next.js
 * `cookies()` store. Safe to call in Server Components, Server Actions, and
 * Route Handlers.
 *
 * Note: Server Components cannot write cookies (Next.js will throw if you
 * try). Supabase may attempt to refresh the auth token during a read in a
 * Server Component; the `set`/`remove` calls below are wrapped in try/catch
 * so that refresh attempt fails silently there. Session refresh is expected
 * to actually persist via `src/lib/supabase/middleware.ts` instead, which
 * runs on every request and can write cookies.
 */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Called from a Server Component — the middleware handles
          // refreshing the user's session instead. Safe to ignore.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // Called from a Server Component — see note above.
        }
      },
    },
  });
}

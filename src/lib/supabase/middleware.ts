// ---------------------------------------------------------------------------
// Supabase middleware session refresh helper
//
// This file exports `updateSession(request)` only — it does NOT create the
// root `middleware.ts` at the project root. Whichever process wires up the
// App Router shell should create `middleware.ts` there and call this
// helper, e.g.:
//
//   // middleware.ts (project root)
//   import { type NextRequest } from "next/server";
//   import { updateSession } from "@/lib/supabase/middleware";
//
//   export async function middleware(request: NextRequest) {
//     return updateSession(request);
//   }
//
//   export const config = {
//     matcher: [
//       "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
//     ],
//   };
//
// LOCAL-ONLY NOTE: if Supabase env vars aren't set yet, this helper passes
// the request through unchanged instead of throwing, so the rest of the app
// shell keeps working before Supabase is connected.
// ---------------------------------------------------------------------------

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Supabase isn't configured yet — let the request through unchanged
    // rather than crashing every page load. See `.env.example`.
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  // Refreshes the auth token if it's expired. Required for Server Components
  // to reliably read a valid session, since they can't write cookies
  // themselves — this is the one place in the request lifecycle that can.
  await supabase.auth.getUser();

  return response;
}

// ---------------------------------------------------------------------------
// Supabase middleware session refresh + auth gate
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
//
// AUTH GATE (Phase 1 — registration is now mandatory): every route except the
// public auth pages below requires a signed-in Supabase user. This includes
// everything under the `(app)` route group (dashboard, analyze, hands,
// settings, etc. — route groups don't appear in the URL, so gating is done by
// exclusion: anything NOT explicitly public is treated as an `(app)` page).
// `/api/*` is intentionally left out of the gate here — it has its own auth
// needs per-route (e.g. the Stripe webhook is called by Stripe itself, with
// no user session at all, and must stay reachable).
// ---------------------------------------------------------------------------

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Paths (and their sub-paths) reachable without being signed in. */
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/auth",
  "/forgot-password",
  "/reset-password",
  "/shared",
  "/terms",
  "/privacy",
  "/api",
  "/_next",
];

/** Auth-only pages: redirect an already-signed-in user away from these (avoids a pointless
 *  re-login screen and prevents a loop with the "already authenticated" redirect below). */
const AUTH_ENTRY_PATHS = new Set(["/login", "/signup"]);

function isPublicPath(pathname: string): boolean {
  if (
    PUBLIC_PATH_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
  ) {
    return true;
  }
  // Static files (favicon.ico, manifest.webmanifest, sw.js, /icons/*.png, robots.txt, …) —
  // the root `middleware.ts` matcher already excludes some of these, but not all (e.g.
  // .webmanifest / sw.js), so this is a defense-in-depth fallback for anything with an
  // extension.
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return true;
  return false;
}

/** Copies cookies set on `from` (e.g. a refreshed auth token) onto `to`, so building a fresh
 *  NextResponse.redirect(...) doesn't silently drop a token refresh that just happened. */
function withCarriedCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

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
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refreshes the auth token if it's expired. Required for Server Components
  // to reliably read a valid session, since they can't write cookies
  // themselves — this is the one place in the request lifecycle that can.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already signed in and visiting /login or /signup — send them to the app instead of
  // showing a pointless login screen again.
  if (user && AUTH_ENTRY_PATHS.has(pathname)) {
    return withCarriedCookies(response, NextResponse.redirect(new URL("/", request.url)));
  }

  if (isPublicPath(pathname)) {
    return response;
  }

  // Everything else is an `(app)` page — require a signed-in user (Phase 1: registration is
  // mandatory before using the app at all).
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return withCarriedCookies(response, NextResponse.redirect(loginUrl));
  }

  return response;
}

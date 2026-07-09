"use server";

// ---------------------------------------------------------------------------
// Supabase Auth — Next.js Server Actions
//
// Thin wrappers around Supabase Auth for use directly from `<form action={}>`
// or client-side `startTransition` calls. Each action returns a typed
// `{ error: string | null }` result (never throws on expected auth failures),
// and redirects on success where that's the natural next step.
//
// LOCAL-ONLY NOTE: until NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY are set, every
// action here returns a friendly `{ error: "..." }` instead of crashing, so
// the UI can render a real error message during local development.
// ---------------------------------------------------------------------------

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/authErrors";

export type AuthActionResult = { error: string | null };

/** True if the failure is "Supabase isn't configured yet", not a real auth error. */
function isConfigError(err: unknown): err is Error {
  return (
    err instanceof Error && err.message.startsWith("Supabase is not configured")
  );
}

/** Fallback Hebrew message for any Supabase failure that isn't a config error or a normal
 *  `{error}` result (e.g. a network/timeout blip) — never let a raw English exception reach
 *  the UI via Next's default error boundary. */
const UNEXPECTED_ERROR = "אירעה שגיאה בלתי צפויה. נסו שוב בעוד רגע.";

async function getOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  if (host) return `${protocol}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/**
 * Signs in an existing user with email + password. Redirects to `redirectTo` (defaults to
 * `/`) on success; returns `{ error }` on failure so the caller can render it.
 *
 * `redirectTo` is an optional third param (rather than changing the first two) so existing
 * 2-arg call sites keep behaving exactly as before. Callers are responsible for validating
 * `redirectTo` is a safe same-origin relative path — see `login/page.tsx`'s `safeNextPath`.
 */
export async function signInWithEmail(
  email: string,
  password: string,
  redirectTo: string = "/"
): Promise<AuthActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: translateAuthError(error.message) };
  } catch (err) {
    if (isConfigError(err)) return { error: err.message };
    return { error: UNEXPECTED_ERROR };
  }

  redirect(redirectTo);
}

/**
 * Creates a new account with email + password. Depending on your Supabase
 * project's email confirmation setting, the user may need to confirm their
 * email before a session is created — in that case there's no session to
 * redirect with yet, so we send them to a "check your email" screen instead
 * of `/dashboard`.
 *
 * `next` is a same-origin relative path to land on afterward, same contract as
 * `signInWithEmail`'s `redirectTo` — validate it before calling (see `safeNextPath`).
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  next: string = "/"
): Promise<AuthActionResult> {
  let hasSession = false;
  const callbackUrl = `${await getOrigin()}/auth/callback${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: callbackUrl,
      },
    });
    if (error) return { error: translateAuthError(error.message) };
    hasSession = Boolean(data.session);
  } catch (err) {
    if (isConfigError(err)) return { error: err.message };
    return { error: UNEXPECTED_ERROR };
  }

  // With a session already established (email confirmation disabled on this Supabase
  // project), go straight to `next`. Otherwise the user needs to click the confirmation
  // email first — `next` travels with them via `callbackUrl` above and is applied by
  // `/auth/callback` once they do.
  redirect(hasSession ? next : "/auth/check-email");
}

/**
 * Kicks off an OAuth sign-in flow (Google or Apple) and redirects the
 * browser to the provider's consent screen. Supabase redirects back to
 * `${origin}/auth/callback` after the provider completes.
 */
export async function signInWithOAuth(
  provider: "google" | "apple",
  next: string = "/"
): Promise<AuthActionResult> {
  let url: string | null = null;
  const callbackUrl = `${await getOrigin()}/auth/callback${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl,
      },
    });
    if (error) return { error: translateAuthError(error.message) };
    url = data.url;
  } catch (err) {
    if (isConfigError(err)) return { error: err.message };
    return { error: UNEXPECTED_ERROR };
  }

  if (!url) return { error: `לא ניתן היה להתחיל התחברות דרך ${provider === "google" ? "גוגל" : "אפל"}.` };
  redirect(url);
}

/** Signs the current user out and redirects to the home page. */
export async function signOut(): Promise<AuthActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) return { error: translateAuthError(error.message) };
  } catch (err) {
    if (isConfigError(err)) return { error: err.message };
    return { error: UNEXPECTED_ERROR };
  }

  redirect("/");
}

/**
 * Sends a password-reset email if the given address has an account. Always returns
 * `{ error: null }` on the happy path regardless of whether the email actually exists — never
 * reveal account existence through this endpoint (Supabase itself doesn't error for unknown
 * emails here, so this naturally stays privacy-safe).
 */
export async function requestPasswordReset(email: string): Promise<AuthActionResult> {
  try {
    const supabase = await createClient();
    // Intentionally not surfacing Supabase's `error` (if any) to the caller — doing so could
    // let someone probe which emails have accounts. Only a config error (thrown, caught
    // below) is worth telling the caller about.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${await getOrigin()}/reset-password`,
    });
  } catch (err) {
    if (isConfigError(err)) return { error: err.message };
    return { error: UNEXPECTED_ERROR };
  }

  return { error: null };
}

/**
 * Sets a new password for the currently-authenticated user (expected to be called from
 * `/reset-password` after the browser has established a recovery session from the emailed
 * link — see that page for how the session gets there). Redirects to `/login` on success.
 */
export async function updatePassword(password: string): Promise<AuthActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: translateAuthError(error.message) };
  } catch (err) {
    if (isConfigError(err)) return { error: err.message };
    return { error: UNEXPECTED_ERROR };
  }

  redirect(`/login?message=${encodeURIComponent("הסיסמה עודכנה בהצלחה. אפשר להתחבר עכשיו.")}`);
}

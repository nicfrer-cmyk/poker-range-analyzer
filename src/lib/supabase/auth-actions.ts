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

export type AuthActionResult = { error: string | null };

/** True if the failure is "Supabase isn't configured yet", not a real auth error. */
function isConfigError(err: unknown): err is Error {
  return (
    err instanceof Error && err.message.startsWith("Supabase is not configured")
  );
}

function getOrigin(): string {
  const headerList = headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  if (host) return `${protocol}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/**
 * Signs in an existing user with email + password. Redirects to `/dashboard`
 * on success; returns `{ error }` on failure so the caller can render it.
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthActionResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
  } catch (err) {
    if (isConfigError(err)) return { error: err.message };
    throw err;
  }

  redirect("/");
}

/**
 * Creates a new account with email + password. Depending on your Supabase
 * project's email confirmation setting, the user may need to confirm their
 * email before a session is created — in that case there's no session to
 * redirect with yet, so we send them to a "check your email" screen instead
 * of `/dashboard`.
 */
export async function signUpWithEmail(
  email: string,
  password: string
): Promise<AuthActionResult> {
  let hasSession = false;

  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${getOrigin()}/auth/callback`,
      },
    });
    if (error) return { error: error.message };
    hasSession = Boolean(data.session);
  } catch (err) {
    if (isConfigError(err)) return { error: err.message };
    throw err;
  }

  redirect(hasSession ? "/dashboard" : "/auth/check-email");
}

/**
 * Kicks off an OAuth sign-in flow (Google or Apple) and redirects the
 * browser to the provider's consent screen. Supabase redirects back to
 * `${origin}/auth/callback` after the provider completes.
 */
export async function signInWithOAuth(
  provider: "google" | "apple"
): Promise<AuthActionResult> {
  let url: string | null = null;

  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${getOrigin()}/auth/callback`,
      },
    });
    if (error) return { error: error.message };
    url = data.url;
  } catch (err) {
    if (isConfigError(err)) return { error: err.message };
    throw err;
  }

  if (!url) return { error: `Failed to start ${provider} sign-in.` };
  redirect(url);
}

/** Signs the current user out and redirects to the home page. */
export async function signOut(): Promise<AuthActionResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) return { error: error.message };
  } catch (err) {
    if (isConfigError(err)) return { error: err.message };
    throw err;
  }

  redirect("/");
}

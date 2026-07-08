"use client";

// ---------------------------------------------------------------------------
// Runs once when an `(app)` page mounts on an authenticated session:
//  1. Pushes any pre-login localStorage data (hands/ranges/sessions/opponents — all four are
//     Supabase-backed now) into the real tables for this user, once per user per browser.
//  2. If the login redirect tagged the URL with `?justLoggedIn=1` (set in
//     `src/app/login/page.tsx`), shows a brief "welcome back" toast with the
//     user's email, then strips the flag from the URL.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { migrateLocalHandsAndRangesToSupabase } from "@/lib/migrateLocalHandsRangesToSupabase";
import { migrateLocalSessionsAndOpponentsToSupabase } from "@/lib/migrateLocalSessionsOpponentsToSupabase";
import { track } from "@/lib/analytics";

/** Today as `YYYY-MM-DD` in the browser's local timezone — good enough for a once-a-day flag,
 *  no need for UTC precision here. */
function todayKey(): string {
  return new Date().toDateString();
}

export function AuthSync() {
  const router = useRouter();
  const pathname = usePathname();
  const [welcomeEmail, setWelcomeEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      // Supabase not configured yet (local dev before it's wired up) — nothing to sync.
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const user = data.session?.user;
      if (!user) return;

      // Hands/ranges/sessions/opponents all moved from localStorage to Supabase — push whatever
      // this browser still has sitting in the old localStorage keys into the real tables, once
      // per user per browser (own flag, own idempotency check — see each file for details).
      // Fire-and-forget from the caller's perspective: it doesn't block the rest of this effect,
      // and pages that read this data already re-fetch from Supabase on their own mount.
      void migrateLocalHandsAndRangesToSupabase(user.id);
      void migrateLocalSessionsAndOpponentsToSupabase(user.id);

      // `signup_completed`: fired once, the first time we see a session for this user whose
      // `created_at` and `last_sign_in_at` are within a few seconds of each other — a reliable,
      // provider-agnostic signal that this session is the direct result of a signup (either an
      // immediate-session signup or the email-confirmation callback), not a later login.
      // Guarded by its own once-per-user flag, parallel to `claimFlag` above, so it never
      // re-fires on subsequent app loads by this same user.
      try {
        const signupTrackedFlag = `pra:signupTracked:${user.id}`;
        if (!window.localStorage.getItem(signupTrackedFlag)) {
          const createdAt = user.created_at ? new Date(user.created_at).getTime() : null;
          const lastSignInAt = user.last_sign_in_at
            ? new Date(user.last_sign_in_at).getTime()
            : null;
          if (
            createdAt !== null &&
            lastSignInAt !== null &&
            Math.abs(lastSignInAt - createdAt) < 10_000
          ) {
            track("signup_completed");
          }
          window.localStorage.setItem(signupTrackedFlag, "1");
        }
      } catch {
        // localStorage unavailable — skip signup-completion tracking rather than risk re-firing
        // it on every load.
      }

      // `user_returned`: an already-onboarded, already-authenticated user loading the app on a
      // day they haven't been active yet — distinct from `login_completed` below, which is a
      // fresh sign-in. Same once-per-day-flag idea as `claimFlag`, just keyed by date instead of
      // a one-shot boolean. Never fires on a user's very first-ever visit (no `lastActiveFlag`
      // yet *and* no claim flag yet means this is the first app load this browser has ever seen
      // for this user, i.e. a brand-new signup session, not a "return").
      try {
        const lastActiveFlag = `pra:lastActiveDate:${user.id}`;
        const today = todayKey();
        const lastActive = window.localStorage.getItem(lastActiveFlag);
        if (lastActive && lastActive !== today) {
          track("user_returned");
        }
        if (lastActive !== today) {
          window.localStorage.setItem(lastActiveFlag, today);
        }
      } catch {
        // localStorage unavailable — skip return-visit tracking.
      }

      const params = new URLSearchParams(window.location.search);
      if (params.get("justLoggedIn") === "1") {
        track("login_completed");
        setWelcomeEmail(user.email ?? null);
        params.delete("justLoggedIn");
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
      }
    });

    return () => {
      cancelled = true;
    };
    // Intentionally run once on mount — claiming is idempotent, and the welcome toast is a
    // one-shot flag anyway, so there's no need to re-check on every client-side navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!welcomeEmail) return;
    const timer = setTimeout(() => setWelcomeEmail(null), 3000);
    return () => clearTimeout(timer);
  }, [welcomeEmail]);

  return (
    <AnimatePresence>
      {welcomeEmail && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-x-0 top-3 z-50 mx-auto w-fit rounded-full border border-base-border bg-base-panel px-4 py-2 text-sm shadow-soft"
        >
          שלום {welcomeEmail}, ברוך הבא בחזרה
        </motion.div>
      )}
    </AnimatePresence>
  );
}

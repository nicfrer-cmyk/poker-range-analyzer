"use client";

// ---------------------------------------------------------------------------
// Decides whether to show the first-time onboarding tour on an authenticated
// `(app)` page mount, and renders it as a full-screen overlay on top of
// whichever page it happens to land on (no route redirect involved).
//
// Kept separate from `AuthSync` on purpose: `AuthSync` already owns claiming
// pre-login local data + the "welcome back" toast — this is an unrelated
// concern (first-run education), so it gets its own small component.
// Mirrors AuthSync's exact auth-detection pattern: `createClient()` +
// `supabase.auth.getSession()` + a per-user `localStorage` flag.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";

export function OnboardingTrigger() {
  const [userId, setUserId] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;

    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      // Supabase not configured yet (local dev before it's wired up) — nothing to show.
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const user = data.session?.user;
      if (!user) return;

      setUserId(user.id);
      try {
        const flag = `pra:onboarded:${user.id}`;
        if (!window.localStorage.getItem(flag)) {
          setShow(true);
        }
      } catch {
        // localStorage unavailable — skip onboarding rather than risk showing it every load.
      }
    });

    return () => {
      cancelled = true;
    };
    // Intentionally run once on mount, same rationale as AuthSync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!show || !userId) return null;

  return <OnboardingTour userId={userId} onDone={() => setShow(false)} />;
}

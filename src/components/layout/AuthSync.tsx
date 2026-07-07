"use client";

// ---------------------------------------------------------------------------
// Runs once when an `(app)` page mounts on an authenticated session:
//  1. Claims any pre-login localStorage data for this user (see
//     `src/lib/claimLocalData.ts`) — guarded by a `localStorage` flag so the
//     scan only actually runs once per user per browser.
//  2. If the login redirect tagged the URL with `?justLoggedIn=1` (set in
//     `src/app/login/page.tsx`), shows a brief "welcome back" toast with the
//     user's email, then strips the flag from the URL.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { claimAllLocalData } from "@/lib/claimLocalData";

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

      const claimFlag = `pra:claimed:${user.id}`;
      try {
        if (!window.localStorage.getItem(claimFlag)) {
          claimAllLocalData(user.id);
          window.localStorage.setItem(claimFlag, "1");
        }
      } catch {
        // localStorage unavailable (e.g. private browsing edge cases) — nothing to do.
      }

      const params = new URLSearchParams(window.location.search);
      if (params.get("justLoggedIn") === "1") {
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

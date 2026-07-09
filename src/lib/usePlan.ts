"use client";

import { useEffect, useState } from "react";
import type { Plan } from "@/lib/plan";

const DEV_OVERRIDE_KEY = "pra:devPlanOverride";
const isDev = process.env.NODE_ENV !== "production";

let cachedPlanPromise: Promise<Plan> | null = null;

function fetchRealPlan(): Promise<Plan> {
  if (!cachedPlanPromise) {
    cachedPlanPromise = fetch("/api/plan")
      .then((res) => (res.ok ? res.json() : Promise.resolve({ plan: "FREE" as Plan })))
      .then((data: { plan?: Plan }) => (data.plan === "PRO" ? "PRO" : "FREE"))
      .catch(() => "FREE" as Plan);
  }
  return cachedPlanPromise;
}

/**
 * The user's real plan, read from `/api/plan` (which reads the same `users.plan` column the
 * Grow webhook writes on a real payment — see `src/lib/aiUsage.ts` for the server-side
 * enforcement counterpart). This is the single source of truth for feature-gating UI.
 *
 * Client-side gating driven by this hook is still just UX — a fast "should I show this
 * control / this teaser" check, not enforcement. Anything with real cost or abuse risk (AI
 * calls) has its own server-side check in the API route itself; don't add a feature here and
 * assume the client read alone protects it.
 *
 * In non-production builds only, a `pra:devPlanOverride` localStorage flag (set via Settings'
 * dev-only plan switcher, see `useDevPlanOverride`) can force a plan locally without a live
 * Grow subscription, for development/demo. That branch is compiled out of production builds
 * entirely — `process.env.NODE_ENV` is statically replaced at build time, so Next.js
 * dead-code-eliminates it — it cannot ship as a live free-upgrade path.
 */
export function usePlan(): { plan: Plan; loading: boolean } {
  const [plan, setPlan] = useState<Plan>("FREE");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (isDev) {
      const override = window.localStorage.getItem(DEV_OVERRIDE_KEY);
      if (override === "PRO" || override === "FREE") {
        setPlan(override);
        setLoading(false);
        return;
      }
    }

    fetchRealPlan().then((p) => {
      if (!cancelled) {
        setPlan(p);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { plan, loading };
}

/** Dev/demo-only plan switcher backing Settings' "מצב פיתוח" panel — reads/writes the same
 *  `pra:devPlanOverride` flag `usePlan` checks. `setOverride` and the stored flag are both
 *  no-ops in production builds (see `usePlan`'s doc comment for why that's safe). */
export function useDevPlanOverride(): [Plan | null, (p: Plan | null) => void] {
  const [override, setOverrideState] = useState<Plan | null>(null);

  useEffect(() => {
    if (!isDev) return;
    const stored = window.localStorage.getItem(DEV_OVERRIDE_KEY);
    if (stored === "PRO" || stored === "FREE") setOverrideState(stored);
  }, []);

  const setOverride = (p: Plan | null) => {
    if (!isDev) return;
    if (p) window.localStorage.setItem(DEV_OVERRIDE_KEY, p);
    else window.localStorage.removeItem(DEV_OVERRIDE_KEY);
    setOverrideState(p);
  };

  return [override, setOverride];
}

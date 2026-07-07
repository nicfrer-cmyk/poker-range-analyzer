"use client";

import { useEffect, useState } from "react";

export type MockPlan = "FREE" | "PRO";
const KEY = "pra:mockPlan";

/**
 * Temporary client-side plan flag so gated features (leak finder, ICM, etc.) can be built
 * and demoed before real Supabase Auth + Stripe subscriptions are wired up. Once a real user
 * session exists, replace reads of this hook with the user's actual `Subscription.plan`.
 */
export function useMockPlan(): [MockPlan, (p: MockPlan) => void] {
  const [plan, setPlanState] = useState<MockPlan>("FREE");

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "PRO" || stored === "FREE") setPlanState(stored);
  }, []);

  const setPlan = (p: MockPlan) => {
    window.localStorage.setItem(KEY, p);
    setPlanState(p);
  };

  return [plan, setPlan];
}

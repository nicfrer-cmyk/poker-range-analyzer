"use client";

// ---------------------------------------------------------------------------
// Claims anonymous (pre-login) localStorage records for a newly-authenticated user, across
// all four local stores. Each store's own `claimAnonymous*` function is idempotent (only
// touches records with no owner yet), so calling this repeatedly is safe — the caller (see
// `src/components/layout/AuthSync.tsx`) additionally guards it with a `localStorage` flag so
// it only actually scans once per user per browser, not on every page load.
//
// This does NOT sync anything to Supabase — records stay in localStorage, just tagged with an
// owner. Cross-device sync is an explicitly later phase.
// ---------------------------------------------------------------------------

import { claimAnonymousHands } from "./localHandStore";
import { claimAnonymousOpponents } from "./localOpponentStore";
import { claimAnonymousSessions } from "./localSessionStore";
import { claimAnonymousRanges } from "./localRangeStore";

export function claimAllLocalData(userId: string): void {
  claimAnonymousHands(userId);
  claimAnonymousOpponents(userId);
  claimAnonymousSessions(userId);
  claimAnonymousRanges(userId);
}

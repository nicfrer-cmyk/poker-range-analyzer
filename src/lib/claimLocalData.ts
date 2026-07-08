"use client";

// ---------------------------------------------------------------------------
// Claims anonymous (pre-login) localStorage records for a newly-authenticated user, across
// the two local stores that are still localStorage-only. Each store's own `claimAnonymous*`
// function is idempotent (only touches records with no owner yet), so calling this
// repeatedly is safe — the caller (see `src/components/layout/AuthSync.tsx`) additionally
// guards it with a `localStorage` flag so it only actually scans once per user per browser,
// not on every page load.
//
// This does NOT sync anything to Supabase — records stay in localStorage, just tagged with an
// owner. Cross-device sync is an explicitly later phase.
//
// Hands and ranges used to be claimed here too, but they're Supabase-backed now (see
// src/lib/localHandStore.ts / localRangeStore.ts) — their pre-login localStorage data is
// migrated for real by `migrateLocalHandsAndRangesToSupabase`
// (src/lib/migrateLocalHandsRangesToSupabase.ts), called alongside this from AuthSync.
// ---------------------------------------------------------------------------

import { claimAnonymousOpponents } from "./localOpponentStore";
import { claimAnonymousSessions } from "./localSessionStore";

export function claimAllLocalData(userId: string): void {
  claimAnonymousOpponents(userId);
  claimAnonymousSessions(userId);
}

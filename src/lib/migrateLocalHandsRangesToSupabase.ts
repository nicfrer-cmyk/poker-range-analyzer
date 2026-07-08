"use client";

// ---------------------------------------------------------------------------
// One-time migration: pushes hands/ranges that were saved to `localStorage` before the
// Supabase-backed data layer shipped (src/lib/localHandStore.ts / localRangeStore.ts) into
// the real `hands`/`ranges` tables, then clears the old localStorage keys.
//
// Guarded by a `pra:migrated-to-supabase:<userId>` localStorage flag so it only actually runs
// once per user per browser.
//
// This is the only code left that reads the old `pra:hands:v1` / `pra:ranges:v1` keys.
// Wired into src/components/layout/AuthSync.tsx, alongside
// migrateLocalSessionsOpponentsToSupabase.ts (the same idea, one phase later, for
// sessions/opponents).
// ---------------------------------------------------------------------------

import { createClient } from "@/lib/supabase/client";

const HANDS_KEY = "pra:hands:v1";
const RANGES_KEY = "pra:ranges:v1";

/** Loose shape of a pre-migration localStorage hand record — every field optional since old
 *  records may predate fields added to `StoredHand` after they were saved. */
interface LegacyStoredHand {
  id?: string;
  heroCards?: string[];
  board?: string[];
  villainRange?: string;
  villainRangeTextRaw?: string;
  position?: string;
  potSize?: number;
  street?: string;
  equityAtDecision?: number;
  potOddsRequired?: number;
  actionTaken?: string;
  evLossEstimate?: number;
  timestamp?: number | string;
  handCategory?: string;
  tags?: string[];
  source?: string;
  sessionId?: string;
  note?: string;
  userId?: string;
  streetActions?: unknown;
  analysisMode?: string;
}

interface LegacyStoredRange {
  id?: string;
  name?: string;
  combos?: string;
  createdAt?: number;
  userId?: string;
}

const STREET_TO_DB: Record<string, string> = {
  preflop: "PREFLOP",
  flop: "FLOP",
  turn: "TURN",
  river: "RIVER",
};
const SOURCE_TO_DB: Record<string, string> = {
  manual: "MANUAL",
  imported: "IMPORTED",
};

function readLegacyArray<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * Migrates this browser's pre-Supabase localStorage hands/ranges into the real tables for
 * `userId`, then clears the old keys. Safe to call on every login:
 *  - the localStorage flag makes every call after the first a no-op;
 *  - even within a single (first) run, records already present in Supabase are skipped by a
 *    content-based dedupe check, so a prior partial failure (e.g. hands inserted, ranges
 *    threw) can't double-insert on retry;
 *  - only migrates records that aren't already owned by a *different* signed-in user, mirroring
 *    the old claimAnonymousHands/claimAnonymousRanges behavior of only tagging unowned
 *    records — so a shared browser never leaks one user's pre-migration hands into another
 *    user's account.
 * The flag is only set once every step succeeds, so a genuine failure (network error, etc.)
 * leaves it to retry on the user's next authenticated page load rather than silently losing
 * their pre-migration data.
 */
export async function migrateLocalHandsAndRangesToSupabase(userId: string): Promise<void> {
  if (typeof window === "undefined") return;

  const flag = `pra:migrated-to-supabase:${userId}`;
  try {
    if (window.localStorage.getItem(flag)) return;
  } catch {
    return;
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    return; // Supabase not configured yet (local dev) — nothing to migrate to.
  }

  try {
    const legacyHands = readLegacyArray<LegacyStoredHand>(HANDS_KEY).filter(
      (h) => h.userId === undefined || h.userId === userId
    );
    if (legacyHands.length > 0) {
      const { data: existingHands } = await supabase
        .from("hands")
        .select("hero_cards, created_at")
        .eq("user_id", userId);
      const existingKeys = new Set(
        (existingHands ?? []).map((h) => `${h.hero_cards}|${new Date(h.created_at).getTime()}`)
      );

      const rows = legacyHands
        .map((h) => {
          const heroCards = Array.isArray(h.heroCards) ? h.heroCards.filter(Boolean) : [];
          const board = Array.isArray(h.board) ? h.board.filter(Boolean) : [];
          const timestamp = h.timestamp ? Number(h.timestamp) : Date.now();
          return {
            key: `${heroCards.join(" ")}|${timestamp}`,
            row: {
              id: crypto.randomUUID(),
              user_id: userId,
              hero_cards: heroCards.join(" "),
              board: board.length ? board.join(" ") : null,
              villain_range: h.villainRange ?? h.villainRangeTextRaw ?? "",
              villain_range_raw: h.villainRangeTextRaw ?? h.villainRange ?? "",
              position: h.position ?? null,
              pot: h.potSize ?? 0,
              street: STREET_TO_DB[h.street ?? "preflop"] ?? "PREFLOP",
              equity_at_decision: h.equityAtDecision ?? 0,
              pot_odds_required: h.potOddsRequired ?? 0,
              action_taken: h.actionTaken ?? "call",
              ev_loss_estimate: h.evLossEstimate ?? 0,
              created_at: new Date(timestamp).toISOString(),
              hand_category: h.handCategory ?? null,
              tags: h.tags ?? [],
              source: SOURCE_TO_DB[h.source ?? "manual"] ?? "MANUAL",
              session_id: h.sessionId ?? null,
              note: h.note ?? null,
              street_actions: h.streetActions ?? null,
              analysis_mode: h.analysisMode ?? null,
            },
          };
        })
        .filter(({ key }) => !existingKeys.has(key))
        .map(({ row }) => row);

      if (rows.length > 0) {
        const { error } = await supabase.from("hands").insert(rows);
        if (error) throw error;
      }
    }

    const legacyRanges = readLegacyArray<LegacyStoredRange>(RANGES_KEY).filter(
      (r) => r.userId === undefined || r.userId === userId
    );
    if (legacyRanges.length > 0) {
      const { data: existingRanges } = await supabase
        .from("ranges")
        .select("name, combos, created_at")
        .eq("user_id", userId);
      const existingKeys = new Set(
        (existingRanges ?? []).map((r) => `${r.name}|${r.combos}|${new Date(r.created_at).getTime()}`)
      );

      const rows = legacyRanges
        .map((r) => {
          const createdAt = r.createdAt ?? Date.now();
          const name = r.name ?? "טווח ללא שם";
          const combos = r.combos ?? "";
          return {
            key: `${name}|${combos}|${createdAt}`,
            row: {
              id: crypto.randomUUID(),
              user_id: userId,
              name,
              combos,
              created_at: new Date(createdAt).toISOString(),
            },
          };
        })
        .filter(({ key }) => !existingKeys.has(key))
        .map(({ row }) => row);

      if (rows.length > 0) {
        const { error } = await supabase.from("ranges").insert(rows);
        if (error) throw error;
      }
    }

    window.localStorage.removeItem(HANDS_KEY);
    window.localStorage.removeItem(RANGES_KEY);
    window.localStorage.setItem(flag, "1");
  } catch (err) {
    console.error("Failed to migrate local hands/ranges to Supabase", err);
  }
}

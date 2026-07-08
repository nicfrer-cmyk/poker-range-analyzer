"use client";

// ---------------------------------------------------------------------------
// One-time migration: pushes sessions/opponents that were saved to `localStorage` before the
// Supabase-backed data layer shipped (src/lib/localSessionStore.ts / localOpponentStore.ts)
// into the real `sessions`/`opponents` tables, then clears the old localStorage keys.
//
// Mirrors migrateLocalHandsRangesToSupabase.ts exactly, one phase later — guarded by a
// `pra:migrated-sessions-opponents-to-supabase:<userId>` localStorage flag so it only actually
// runs once per user per browser.
//
// This is the only code left that reads the old `pra:sessions:v1` / `pra:opponents:v1` keys.
// Wired into src/components/layout/AuthSync.tsx, alongside the hands/ranges migration.
// ---------------------------------------------------------------------------

import { createClient } from "@/lib/supabase/client";

const SESSIONS_KEY = "pra:sessions:v1";
const OPPONENTS_KEY = "pra:opponents:v1";

interface LegacyStoredSession {
  id?: string;
  name?: string;
  handIds?: string[];
  createdAt?: number;
  userId?: string;
}

interface LegacyStoredOpponent {
  id?: string;
  name?: string;
  tightLoose?: string;
  passiveAggressive?: string;
  notes?: string;
  createdAt?: number;
  userId?: string;
}

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
 * Migrates this browser's pre-Supabase localStorage sessions/opponents into the real tables
 * for `userId`, then clears the old keys. Safe to call on every login — see
 * migrateLocalHandsAndRangesToSupabase for the exact idempotency/dedupe reasoning this mirrors.
 */
export async function migrateLocalSessionsAndOpponentsToSupabase(userId: string): Promise<void> {
  if (typeof window === "undefined") return;

  const flag = `pra:migrated-sessions-opponents-to-supabase:${userId}`;
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
    const legacySessions = readLegacyArray<LegacyStoredSession>(SESSIONS_KEY).filter(
      (s) => s.userId === undefined || s.userId === userId
    );
    if (legacySessions.length > 0) {
      const { data: existingSessions } = await supabase
        .from("sessions")
        .select("name, date")
        .eq("user_id", userId);
      const existingKeys = new Set(
        (existingSessions ?? []).map((s) => `${s.name}|${new Date(s.date).getTime()}`)
      );

      const rows = legacySessions
        .map((s) => {
          const createdAt = s.createdAt ?? Date.now();
          const name = s.name ?? "סשן ללא שם";
          return {
            key: `${name}|${createdAt}`,
            row: {
              id: crypto.randomUUID(),
              user_id: userId,
              name,
              hand_ids: Array.isArray(s.handIds) ? s.handIds : [],
              date: new Date(createdAt).toISOString(),
            },
          };
        })
        .filter(({ key }) => !existingKeys.has(key))
        .map(({ row }) => row);

      if (rows.length > 0) {
        const { error } = await supabase.from("sessions").insert(rows);
        if (error) throw error;
      }
    }

    const legacyOpponents = readLegacyArray<LegacyStoredOpponent>(OPPONENTS_KEY).filter(
      (o) => o.userId === undefined || o.userId === userId
    );
    if (legacyOpponents.length > 0) {
      const { data: existingOpponents } = await supabase
        .from("opponents")
        .select("name, created_at")
        .eq("user_id", userId);
      const existingKeys = new Set(
        (existingOpponents ?? []).map((o) => `${o.name}|${new Date(o.created_at).getTime()}`)
      );

      const rows = legacyOpponents
        .map((o) => {
          const createdAt = o.createdAt ?? Date.now();
          const name = o.name ?? "יריב ללא שם";
          return {
            key: `${name}|${createdAt}`,
            row: {
              id: crypto.randomUUID(),
              user_id: userId,
              name,
              notes: o.notes ?? null,
              tendencies: {
                tightLoose: o.tightLoose ?? "tight",
                passiveAggressive: o.passiveAggressive ?? "passive",
              },
              created_at: new Date(createdAt).toISOString(),
            },
          };
        })
        .filter(({ key }) => !existingKeys.has(key))
        .map(({ row }) => row);

      if (rows.length > 0) {
        const { error } = await supabase.from("opponents").insert(rows);
        if (error) throw error;
      }
    }

    window.localStorage.removeItem(SESSIONS_KEY);
    window.localStorage.removeItem(OPPONENTS_KEY);
    window.localStorage.setItem(flag, "1");
  } catch (err) {
    console.error("Failed to migrate local sessions/opponents to Supabase", err);
  }
}

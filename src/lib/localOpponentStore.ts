"use client";

import { createClient } from "@/lib/supabase/client";

export type TightLoose = "tight" | "loose";
export type PassiveAggressive = "passive" | "aggressive";

/**
 * Supabase-backed opponent storage (`opponents` table, RLS owner-only). Every function is
 * async now — it round-trips to Postgres via the browser Supabase client, scoped to the
 * signed-in user. Was localStorage-only before this; see git history / ROADMAP.md for the
 * previous synchronous implementation.
 */
export interface StoredOpponent {
  id: string;
  name: string;
  tightLoose: TightLoose;
  passiveAggressive: PassiveAggressive;
  notes: string;
  createdAt: number;
  /** Owning user's Supabase auth id. Always set for rows read back from Supabase. */
  userId?: string;
}

interface OpponentRow {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  tendencies: { tightLoose?: TightLoose; passiveAggressive?: PassiveAggressive } | null;
  created_at: string;
}

function rowToStoredOpponent(row: OpponentRow): StoredOpponent {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    notes: row.notes ?? "",
    tightLoose: row.tendencies?.tightLoose ?? "tight",
    passiveAggressive: row.tendencies?.passiveAggressive ?? "passive",
    createdAt: new Date(row.created_at).getTime(),
  };
}

/** Returns the signed-in user, or `null` if nobody is signed in (never throws — callers
 *  treat "logged out" as "empty result" rather than an error). */
async function getUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function listOpponents(): Promise<StoredOpponent[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("opponents")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as OpponentRow[]).map(rowToStoredOpponent);
}

export async function getOpponent(id: string): Promise<StoredOpponent | undefined> {
  const userId = await getUserId();
  if (!userId) return undefined;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("opponents")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return undefined;
  return rowToStoredOpponent(data as OpponentRow);
}

export async function saveOpponent(data: {
  name: string;
  tightLoose: TightLoose;
  passiveAggressive: PassiveAggressive;
  notes: string;
}): Promise<StoredOpponent> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    throw new Error("יש להתחבר כדי לשמור פרופיל יריב.");
  }

  const insertRow = {
    id: crypto.randomUUID(),
    user_id: user.id,
    name: data.name,
    notes: data.notes,
    tendencies: { tightLoose: data.tightLoose, passiveAggressive: data.passiveAggressive },
    created_at: new Date().toISOString(),
  };

  const { data: row, error } = await supabase.from("opponents").insert(insertRow).select("*").single();
  if (error || !row) {
    throw new Error(error?.message ?? "שגיאה בשמירת פרופיל היריב.");
  }
  return rowToStoredOpponent(row as OpponentRow);
}

export async function updateOpponent(id: string, patch: Partial<StoredOpponent>): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  const supabase = createClient();

  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  if (patch.tightLoose !== undefined || patch.passiveAggressive !== undefined) {
    const current = await getOpponent(id);
    dbPatch.tendencies = {
      tightLoose: patch.tightLoose ?? current?.tightLoose ?? "tight",
      passiveAggressive: patch.passiveAggressive ?? current?.passiveAggressive ?? "passive",
    };
  }

  const { error } = await supabase.from("opponents").update(dbPatch).eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function deleteOpponent(id: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  const supabase = createClient();
  const { error } = await supabase.from("opponents").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function clearAllOpponents(): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  const supabase = createClient();
  const { error } = await supabase.from("opponents").delete().eq("user_id", userId);
  if (error) throw error;
}

export const STYLE_LABEL: Record<TightLoose | PassiveAggressive, string> = {
  tight: "טייט",
  loose: "לוס",
  passive: "פסיבי",
  aggressive: "אגרסיבי",
};

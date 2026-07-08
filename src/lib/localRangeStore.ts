"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Supabase-backed range storage (`ranges` table, RLS owner-only — see the RLS migration for
 * the `is_preset` carve-out, which this file doesn't touch; every function here is scoped to
 * the signed-in user's own saved ranges). Every function is async now — it round-trips to
 * Postgres via the browser Supabase client. Was localStorage-only before this; see git
 * history / ROADMAP.md for the previous synchronous implementation.
 */
export interface StoredRange {
  id: string;
  name: string;
  combos: string; // range notation
  createdAt: number;
  /** Owning user's Supabase auth id. Always set for rows read back from Supabase — kept
   *  optional on the type only for parity with pre-migration records. */
  userId?: string;
}

interface RangeRow {
  id: string;
  user_id: string | null;
  name: string;
  combos: string;
  created_at: string;
}

function rowToStoredRange(row: RangeRow): StoredRange {
  return {
    id: row.id,
    name: row.name,
    combos: row.combos,
    createdAt: new Date(row.created_at).getTime(),
    userId: row.user_id ?? undefined,
  };
}

/** Returns the signed-in user, or `null` if nobody is signed in (never throws — callers
 *  treat "logged out" as "empty result" rather than an error). */
async function getUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function listRanges(): Promise<StoredRange[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ranges")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as RangeRow[]).map(rowToStoredRange);
}

export async function saveRange(name: string, combos: string): Promise<StoredRange> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    throw new Error("יש להתחבר כדי לשמור טווח.");
  }

  const insertRow = {
    id: crypto.randomUUID(),
    user_id: user.id,
    name,
    combos,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("ranges").insert(insertRow).select("*").single();
  if (error || !data) {
    throw new Error(error?.message ?? "שגיאה בשמירת הטווח.");
  }
  return rowToStoredRange(data as RangeRow);
}

export async function deleteRange(id: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  const supabase = createClient();
  const { error } = await supabase.from("ranges").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function updateRange(
  id: string,
  patch: Partial<Pick<StoredRange, "name" | "combos">>
): Promise<StoredRange | undefined> {
  const userId = await getUserId();
  if (!userId) return undefined;
  const supabase = createClient();

  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.combos !== undefined) dbPatch.combos = patch.combos;

  const { data, error } = await supabase
    .from("ranges")
    .update(dbPatch)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error || !data) return undefined;
  return rowToStoredRange(data as RangeRow);
}

export async function clearAllRanges(): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  const supabase = createClient();
  const { error } = await supabase.from("ranges").delete().eq("user_id", userId);
  if (error) throw error;
}

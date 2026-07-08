"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Supabase-backed session storage (`sessions` table, RLS owner-only). Every function is async
 * now — it round-trips to Postgres via the browser Supabase client, scoped to the signed-in
 * user. Was localStorage-only before this; see git history / ROADMAP.md for the previous
 * synchronous implementation.
 */
export interface StoredSession {
  id: string;
  name: string;
  handIds: string[];
  createdAt: number;
  /** Owning user's Supabase auth id. Always set for rows read back from Supabase. */
  userId?: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  name: string;
  hand_ids: string[] | null;
  date: string;
}

function rowToStoredSession(row: SessionRow): StoredSession {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    handIds: row.hand_ids ?? [],
    createdAt: new Date(row.date).getTime(),
  };
}

/** Returns the signed-in user, or `null` if nobody is signed in (never throws — callers
 *  treat "logged out" as "empty result" rather than an error). */
async function getUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function listSessions(): Promise<StoredSession[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });
  if (error || !data) return [];
  return (data as SessionRow[]).map(rowToStoredSession);
}

export async function createSession(name: string, handIds: string[]): Promise<StoredSession> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    throw new Error("יש להתחבר כדי לשמור סשן.");
  }

  const insertRow = {
    id: crypto.randomUUID(),
    user_id: user.id,
    name,
    hand_ids: handIds,
    date: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("sessions").insert(insertRow).select("*").single();
  if (error || !data) {
    throw new Error(error?.message ?? "שגיאה בשמירת הסשן.");
  }
  return rowToStoredSession(data as SessionRow);
}

export async function deleteSession(id: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  const supabase = createClient();
  const { error } = await supabase.from("sessions").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function clearAllSessions(): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  const supabase = createClient();
  const { error } = await supabase.from("sessions").delete().eq("user_id", userId);
  if (error) throw error;
}

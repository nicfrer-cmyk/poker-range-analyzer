"use client";

export interface StoredSession {
  id: string;
  name: string;
  handIds: string[];
  createdAt: number;
  /** Owning user's Supabase auth id, once claimed (see `claimAnonymousSessions` below).
   *  Undefined on records created before Phase 1 (mandatory auth) or not yet claimed. */
  userId?: string;
}

const STORAGE_KEY = "pra:sessions:v1";

function readAll(): StoredSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession[]) : [];
  } catch {
    return [];
  }
}

function writeAll(sessions: StoredSession[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function listSessions(): StoredSession[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function createSession(name: string, handIds: string[]): StoredSession {
  const sessions = readAll();
  const record: StoredSession = {
    id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    handIds,
    createdAt: Date.now(),
  };
  sessions.push(record);
  writeAll(sessions);
  return record;
}

export function deleteSession(id: string) {
  writeAll(readAll().filter((s) => s.id !== id));
}

export function clearAllSessions() {
  writeAll([]);
}

/** Tags every session that doesn't yet have an owner with `userId`. Idempotent — safe to call
 *  on every login. Data stays in `localStorage`; Supabase sync is a later phase. */
export function claimAnonymousSessions(userId: string): void {
  const sessions = readAll();
  let changed = false;
  for (const session of sessions) {
    if (session.userId === undefined) {
      session.userId = userId;
      changed = true;
    }
  }
  if (changed) writeAll(sessions);
}

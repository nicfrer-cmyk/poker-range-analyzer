"use client";

export interface StoredRange {
  id: string;
  name: string;
  combos: string; // range notation
  createdAt: number;
  /** Owning user's Supabase auth id, once claimed (see `claimAnonymousRanges` below).
   *  Undefined on records created before Phase 1 (mandatory auth) or not yet claimed. */
  userId?: string;
}

const STORAGE_KEY = "pra:ranges:v1";

function readAll(): StoredRange[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredRange[]) : [];
  } catch {
    return [];
  }
}

function writeAll(ranges: StoredRange[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ranges));
}

export function listRanges(): StoredRange[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function saveRange(name: string, combos: string): StoredRange {
  const ranges = readAll();
  const range: StoredRange = {
    id: `range_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    combos,
    createdAt: Date.now(),
  };
  ranges.push(range);
  writeAll(ranges);
  return range;
}

export function deleteRange(id: string) {
  writeAll(readAll().filter((r) => r.id !== id));
}

export function updateRange(id: string, patch: Partial<Pick<StoredRange, "name" | "combos">>) {
  const ranges = readAll();
  const idx = ranges.findIndex((r) => r.id === id);
  if (idx === -1) return;
  ranges[idx] = { ...ranges[idx]!, ...patch };
  writeAll(ranges);
}

export function clearAllRanges() {
  writeAll([]);
}

/** Tags every range that doesn't yet have an owner with `userId`. Idempotent — safe to call
 *  on every login. Data stays in `localStorage`; Supabase sync is a later phase. */
export function claimAnonymousRanges(userId: string): void {
  const ranges = readAll();
  let changed = false;
  for (const range of ranges) {
    if (range.userId === undefined) {
      range.userId = userId;
      changed = true;
    }
  }
  if (changed) writeAll(ranges);
}

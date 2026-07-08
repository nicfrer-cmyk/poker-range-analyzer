"use client";

/**
 * Local-first bankroll ledger. Mirrors the exact pattern of `localOpponentStore.ts` /
 * `localSessionStore.ts` (localStorage-backed, `list*`/`add*`/`delete*`), but is deliberately its
 * own fully self-contained store — it does NOT read from or write to `localHandStore.ts` /
 * `localSessionStore.ts` (a parallel workstream is migrating those to Supabase right now; this
 * store stays untouched by that migration since it never references hand/session data at all).
 */

export type BankrollEntryType = "buy-in" | "cash-out" | "deposit" | "withdrawal";

export interface StoredBankrollEntry {
  id: string;
  /** ISO date string, "YYYY-MM-DD" — the date the entry actually happened (not when it was
   *  logged), so backfilled entries sort correctly. */
  date: string;
  type: BankrollEntryType;
  /** Always a positive amount; direction (adds to or subtracts from the running balance) is
   *  implied by `type` — see `signedAmount` below. */
  amount: number;
  note?: string;
  createdAt: number;
  /** Owning user's Supabase auth id, once claimed (see `claimAnonymousBankrollEntries` below).
   *  Undefined on records created before Phase 1 (mandatory auth) or not yet claimed. */
  userId?: string;
}

const STORAGE_KEY = "pra:bankroll:v1";

function readAll(): StoredBankrollEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredBankrollEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: StoredBankrollEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/** Chronological order (oldest first) — a ledger's natural reading order, and what a running-
 *  balance calculation/chart needs directly with no re-sorting. Ties (same date) fall back to
 *  insertion order via `createdAt`. */
export function listEntries(): StoredBankrollEntry[] {
  return readAll().sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}

export function addEntry(data: {
  date: string;
  type: BankrollEntryType;
  amount: number;
  note?: string;
}): StoredBankrollEntry {
  const entries = readAll();
  const record: StoredBankrollEntry = {
    id: `bkr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    ...data,
  };
  entries.push(record);
  writeAll(entries);
  return record;
}

export function deleteEntry(id: string) {
  writeAll(readAll().filter((e) => e.id !== id));
}

export function clearAllBankrollEntries() {
  writeAll([]);
}

/** Tags every bankroll entry that doesn't yet have an owner with `userId`. Idempotent — safe to
 *  call on every login. Data stays in `localStorage`; Supabase sync is a later phase. */
export function claimAnonymousBankrollEntries(userId: string): void {
  const entries = readAll();
  let changed = false;
  for (const entry of entries) {
    if (entry.userId === undefined) {
      entry.userId = userId;
      changed = true;
    }
  }
  if (changed) writeAll(entries);
}

export const BANKROLL_TYPE_LABEL: Record<BankrollEntryType, string> = {
  "buy-in": "באיין (כניסה למשחק)",
  "cash-out": "קאשאאוט (יציאה מהשולחן)",
  deposit: "הפקדה לבנקרול",
  withdrawal: "משיכה מהבנקרול",
};

/** Whether this entry type adds money to the bankroll (+) or takes it away (-). */
export function signedAmount(entry: Pick<StoredBankrollEntry, "type" | "amount">): number {
  const direction = entry.type === "cash-out" || entry.type === "deposit" ? 1 : -1;
  return direction * entry.amount;
}

/** Current bankroll balance — the sum of every entry's signed amount. */
export function currentBalance(entries: StoredBankrollEntry[]): number {
  return entries.reduce((sum, e) => sum + signedAmount(e), 0);
}

export interface BalancePoint {
  date: string;
  balance: number;
}

/** Running balance over time, for the balance chart — assumes `entries` is already in
 *  chronological order (as `listEntries()` returns it). Same-day entries collapse into a single
 *  point holding that day's end-of-day balance, so the chart doesn't draw a vertical stack of
 *  overlapping points for a day with several entries. */
export function runningBalance(entries: StoredBankrollEntry[]): BalancePoint[] {
  const points: BalancePoint[] = [];
  let balance = 0;
  for (const entry of entries) {
    balance += signedAmount(entry);
    const last = points[points.length - 1];
    if (last && last.date === entry.date) {
      last.balance = balance;
    } else {
      points.push({ date: entry.date, balance });
    }
  }
  return points;
}

"use client";

import type { SavedHandRecord, ActionTaken } from "@/lib/engine/leakFinder";
import { isGoodDecision } from "@/lib/engine/leakFinder";
import type { AnalysisInput } from "@/lib/store/analysisStore";
import type { AnalysisResult } from "@/lib/analysisTypes";
import { estimateEvLoss } from "@/lib/analysisEngine";
import type { ActionEntry } from "@/lib/engine/handHistoryParser";

/**
 * Local-first hand storage. Persists to localStorage so the app is fully usable before a
 * real Supabase project is connected. Shape mirrors `SavedHandRecord` (the leak finder's
 * input) plus a few extra display-only fields for the Hand Library UI. Swapping this for
 * Supabase later just means replacing these functions' bodies — call sites don't change.
 */
export interface StoredHand extends SavedHandRecord {
  id: string;
  villainRangeTextRaw: string;
  potOddsRequired: number;
  tags: string[];
  source: "manual" | "imported";
  /** Links this hand to an Opponent profile (src/lib/localOpponentStore.ts), if tagged. */
  opponentId?: string;
  /** Links this hand to a Session (src/lib/localSessionStore.ts), if imported/saved as one. */
  sessionId?: string;
  /** Free-text note the user can attach when reviewing the hand later. */
  note?: string;
  /** Owning user's Supabase auth id, once claimed (see `claimAnonymousHands` below).
   *  Undefined on records created before Phase 1 (mandatory auth) or not yet claimed. */
  userId?: string;
  /** Full street-by-street action sequence, when known (currently only populated for hands
   *  imported from a parsed hand history — see handHistoryParser.ts's ParsedHand.actions).
   *  Manually-entered or older hands simply omit this; the Hand Replay player falls back to
   *  an equity-only walkthrough when it's missing. */
  streetActions?: ActionEntry[];
}

export type MistakeTag = "good" | "mistake" | "review";

/** A meaningful-but-not-huge EV loss reads as "possible mistake"; anything smaller is just
 *  "worth a second look" rather than a clear error — avoids over-labeling small EV noise. */
const MISTAKE_EV_THRESHOLD = 0.05;

export function mistakeTagOf(hand: SavedHandRecord): MistakeTag {
  if (isGoodDecision(hand)) return "good";
  return hand.evLossEstimate >= MISTAKE_EV_THRESHOLD ? "mistake" : "review";
}

export const MISTAKE_TAG_LABEL: Record<MistakeTag, string> = {
  good: "החלטה טובה",
  mistake: "טעות אפשרית",
  review: "לבדיקה",
};

const STORAGE_KEY = "pra:hands:v1";

function readAll(): StoredHand[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredHand[]) : [];
  } catch {
    return [];
  }
}

function writeAll(hands: StoredHand[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hands));
}

export function listHands(): StoredHand[] {
  return readAll().sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
}

export function getHand(id: string): StoredHand | undefined {
  return readAll().find((h) => h.id === id);
}

export function deleteHand(id: string) {
  writeAll(readAll().filter((h) => h.id !== id));
}

export function updateHand(id: string, patch: Partial<StoredHand>): StoredHand | undefined {
  const hands = readAll();
  const idx = hands.findIndex((h) => h.id === id);
  if (idx === -1) return undefined;
  hands[idx] = { ...hands[idx]!, ...patch, id: hands[idx]!.id };
  writeAll(hands);
  return hands[idx];
}

export function saveHand({
  input,
  result,
  action = "call",
  position,
  tags = [],
  source = "manual",
  sessionId,
  streetActions,
}: {
  input: AnalysisInput;
  result: AnalysisResult;
  action?: ActionTaken;
  position?: string;
  tags?: string[];
  source?: "manual" | "imported";
  sessionId?: string;
  streetActions?: ActionEntry[];
}): StoredHand {
  const hands = readAll();
  const record: StoredHand = {
    id: `hand_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    heroCards: input.heroCards.filter(Boolean) as StoredHand["heroCards"],
    board: input.board.filter(Boolean) as StoredHand["board"],
    villainRange: input.villainRangeText,
    villainRangeTextRaw: input.villainRangeText,
    position,
    potSize: input.pot,
    street: result.street,
    equityAtDecision: result.heroEquityPct / 100,
    potOddsRequired: result.potOdds.requiredEquityPct / 100,
    actionTaken: action,
    evLossEstimate: estimateEvLoss(result, action),
    timestamp: Date.now(),
    handCategory: result.heroCategory,
    tags,
    source,
    sessionId,
    streetActions,
  };
  hands.push(record);
  writeAll(hands);
  return record;
}

export function clearAllHands() {
  writeAll([]);
}

/**
 * Tags every hand that doesn't yet have an owner with `userId`. Idempotent — safe to call on
 * every login, not just the first: already-claimed records (whether owned by this user or a
 * different one on a shared browser) are left untouched. Data stays in `localStorage`; syncing
 * it to Supabase is an explicitly later phase.
 */
export function claimAnonymousHands(userId: string): void {
  const hands = readAll();
  let changed = false;
  for (const hand of hands) {
    if (hand.userId === undefined) {
      hand.userId = userId;
      changed = true;
    }
  }
  if (changed) writeAll(hands);
}

export function exportHandsAsJson(hands: StoredHand[] = listHands()): string {
  return JSON.stringify(hands, null, 2);
}

export function exportHandsAsCsv(hands: StoredHand[] = listHands()): string {
  const header = [
    "תאריך",
    "קלפי הירו",
    "בורד",
    "פוזיציה",
    "רחוב",
    "אקוויטי",
    "פעולה",
    "תגית",
  ];
  const rows = hands.map((h) => [
    new Date(Number(h.timestamp)).toLocaleDateString("he-IL"),
    h.heroCards.join(" "),
    h.board.join(" "),
    h.position ?? "",
    h.street,
    `${(h.equityAtDecision * 100).toFixed(1)}%`,
    h.actionTaken,
    MISTAKE_TAG_LABEL[mistakeTagOf(h)],
  ]);
  return [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

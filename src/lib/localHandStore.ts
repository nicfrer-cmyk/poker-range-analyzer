"use client";

import type { SavedHandRecord, ActionTaken } from "@/lib/engine/leakFinder";
import { isGoodDecision } from "@/lib/engine/leakFinder";
import type { AnalysisInput } from "@/lib/store/analysisStore";
import type { AnalysisResult } from "@/lib/analysisTypes";
import { estimateEvLoss } from "@/lib/analysisEngine";
import type { ActionEntry } from "@/lib/engine/handHistoryParser";
import { createClient } from "@/lib/supabase/client";

/**
 * Supabase-backed hand storage (`hands` table, RLS owner-only). Shape mirrors
 * `SavedHandRecord` (the leak finder's input) plus a few extra display-only fields for the
 * Hand Library UI. Every function is async now — it round-trips to Postgres via the
 * browser Supabase client, scoped to the signed-in user. Was localStorage-only before this;
 * see git history / ROADMAP.md for the previous synchronous implementation.
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
  /** Owning user's Supabase auth id. Always set for rows read back from Supabase — kept
   *  optional on the type only because some call sites build a `StoredHand`-shaped object
   *  before it has been persisted. */
  userId?: string;
  /** Full street-by-street action sequence, when known (currently only populated for hands
   *  imported from a parsed hand history — see handHistoryParser.ts's ParsedHand.actions).
   *  Manually-entered or older hands simply omit this; the Hand Replay player falls back to
   *  an equity-only walkthrough when it's missing. */
  streetActions?: ActionEntry[];
  /** Which flow the user saved the hand from — the Quick Analysis panel or the Advanced
   *  Analysis wizard. Undefined on records saved before this field existed; treat as unknown
   *  rather than backfilling a guess. */
  analysisMode?: "quick" | "advanced";
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

// ---------------------------------------------------------------------------
// DB <-> app-shape mapping. The `hands` table uses snake_case columns and Postgres enums
// for `street`/`source`; `StoredHand` uses camelCase and lowercase string literals.
// ---------------------------------------------------------------------------

const STREET_TO_DB: Record<StoredHand["street"], string> = {
  preflop: "PREFLOP",
  flop: "FLOP",
  turn: "TURN",
  river: "RIVER",
};
const STREET_FROM_DB: Record<string, StoredHand["street"]> = {
  PREFLOP: "preflop",
  FLOP: "flop",
  TURN: "turn",
  RIVER: "river",
};
const SOURCE_TO_DB: Record<StoredHand["source"], string> = {
  manual: "MANUAL",
  imported: "IMPORTED",
};
const SOURCE_FROM_DB: Record<string, StoredHand["source"]> = {
  MANUAL: "manual",
  IMPORTED: "imported",
};

interface HandRow {
  id: string;
  user_id: string;
  hero_cards: string;
  board: string | null;
  villain_range: string;
  street: string;
  pot: number;
  equity_at_decision: number | null;
  source: string;
  created_at: string;
  tags: string[] | null;
  position: string | null;
  action_taken: string | null;
  ev_loss_estimate: number | null;
  hand_category: string | null;
  pot_odds_required: number | null;
  villain_range_raw: string | null;
  opponent_id: string | null;
  session_id: string | null;
  note: string | null;
  street_actions: unknown;
  analysis_mode: string | null;
}

function rowToStoredHand(row: HandRow): StoredHand {
  return {
    id: row.id,
    userId: row.user_id,
    heroCards: (row.hero_cards ? row.hero_cards.split(" ").filter(Boolean) : []) as StoredHand["heroCards"],
    board: (row.board ? row.board.split(" ").filter(Boolean) : []) as StoredHand["board"],
    villainRange: row.villain_range ?? undefined,
    villainRangeTextRaw: row.villain_range_raw ?? row.villain_range ?? "",
    position: row.position ?? undefined,
    potSize: row.pot,
    street: STREET_FROM_DB[row.street] ?? "preflop",
    equityAtDecision: row.equity_at_decision ?? 0,
    potOddsRequired: row.pot_odds_required ?? 0,
    actionTaken: (row.action_taken ?? "call") as ActionTaken,
    evLossEstimate: row.ev_loss_estimate ?? 0,
    timestamp: new Date(row.created_at).getTime(),
    handCategory: row.hand_category ?? undefined,
    tags: row.tags ?? [],
    source: SOURCE_FROM_DB[row.source] ?? "manual",
    opponentId: row.opponent_id ?? undefined,
    sessionId: row.session_id ?? undefined,
    note: row.note ?? undefined,
    streetActions: (row.street_actions as ActionEntry[] | null) ?? undefined,
    analysisMode: (row.analysis_mode as StoredHand["analysisMode"] | null) ?? undefined,
  };
}

/** Returns the signed-in user, or `null` if nobody is signed in (never throws — callers
 *  treat "logged out" as "empty result" rather than an error, same as before Supabase). */
async function getUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function listHands(): Promise<StoredHand[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hands")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as HandRow[]).map(rowToStoredHand);
}

export async function getHand(id: string): Promise<StoredHand | undefined> {
  const userId = await getUserId();
  if (!userId) return undefined;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hands")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return undefined;
  return rowToStoredHand(data as HandRow);
}

export async function deleteHand(id: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  const supabase = createClient();
  const { error } = await supabase.from("hands").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function updateHand(
  id: string,
  patch: Partial<StoredHand>
): Promise<StoredHand | undefined> {
  const userId = await getUserId();
  if (!userId) return undefined;
  const supabase = createClient();

  const dbPatch: Record<string, unknown> = {};
  if (patch.heroCards !== undefined) dbPatch.hero_cards = patch.heroCards.join(" ");
  if (patch.board !== undefined) dbPatch.board = patch.board.length ? patch.board.join(" ") : null;
  if (patch.villainRange !== undefined) dbPatch.villain_range = patch.villainRange;
  if (patch.villainRangeTextRaw !== undefined) dbPatch.villain_range_raw = patch.villainRangeTextRaw;
  if (patch.position !== undefined) dbPatch.position = patch.position;
  if (patch.potSize !== undefined) dbPatch.pot = patch.potSize;
  if (patch.street !== undefined) dbPatch.street = STREET_TO_DB[patch.street];
  if (patch.equityAtDecision !== undefined) dbPatch.equity_at_decision = patch.equityAtDecision;
  if (patch.potOddsRequired !== undefined) dbPatch.pot_odds_required = patch.potOddsRequired;
  if (patch.actionTaken !== undefined) dbPatch.action_taken = patch.actionTaken;
  if (patch.evLossEstimate !== undefined) dbPatch.ev_loss_estimate = patch.evLossEstimate;
  if (patch.handCategory !== undefined) dbPatch.hand_category = patch.handCategory;
  if (patch.tags !== undefined) dbPatch.tags = patch.tags;
  if (patch.source !== undefined) dbPatch.source = SOURCE_TO_DB[patch.source];
  if (patch.opponentId !== undefined) dbPatch.opponent_id = patch.opponentId;
  if (patch.sessionId !== undefined) dbPatch.session_id = patch.sessionId;
  if (patch.note !== undefined) dbPatch.note = patch.note;
  if (patch.streetActions !== undefined) dbPatch.street_actions = patch.streetActions;
  if (patch.analysisMode !== undefined) dbPatch.analysis_mode = patch.analysisMode;
  if (patch.timestamp !== undefined) {
    dbPatch.created_at = new Date(Number(patch.timestamp)).toISOString();
  }

  const { data, error } = await supabase
    .from("hands")
    .update(dbPatch)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error || !data) return undefined;
  return rowToStoredHand(data as HandRow);
}

export async function saveHand({
  input,
  result,
  action = "call",
  position,
  tags = [],
  source = "manual",
  sessionId,
  streetActions,
  analysisMode,
}: {
  input: AnalysisInput;
  result: AnalysisResult;
  action?: ActionTaken;
  position?: string;
  tags?: string[];
  source?: "manual" | "imported";
  sessionId?: string;
  streetActions?: ActionEntry[];
  analysisMode?: "quick" | "advanced";
}): Promise<StoredHand> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    throw new Error("יש להתחבר כדי לשמור יד.");
  }

  const heroCards = input.heroCards.filter(Boolean) as StoredHand["heroCards"];
  const board = input.board.filter(Boolean) as StoredHand["board"];
  const timestamp = Date.now();

  const insertRow = {
    id: crypto.randomUUID(),
    user_id: user.id,
    hero_cards: heroCards.join(" "),
    board: board.length ? board.join(" ") : null,
    villain_range: input.villainRangeText,
    villain_range_raw: input.villainRangeText,
    position: position ?? null,
    pot: input.pot,
    street: STREET_TO_DB[result.street],
    equity_at_decision: result.heroEquityPct / 100,
    pot_odds_required: result.potOdds.requiredEquityPct / 100,
    action_taken: action,
    ev_loss_estimate: estimateEvLoss(result, action),
    created_at: new Date(timestamp).toISOString(),
    hand_category: result.heroCategory,
    tags,
    source: SOURCE_TO_DB[source],
    session_id: sessionId ?? null,
    street_actions: streetActions ?? null,
    analysis_mode: analysisMode ?? null,
  };

  const { data, error } = await supabase.from("hands").insert(insertRow).select("*").single();
  if (error || !data) {
    throw new Error(error?.message ?? "שגיאה בשמירת היד.");
  }
  return rowToStoredHand(data as HandRow);
}

export async function clearAllHands(): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  const supabase = createClient();
  const { error } = await supabase.from("hands").delete().eq("user_id", userId);
  if (error) throw error;
}

export async function exportHandsAsJson(hands?: StoredHand[]): Promise<string> {
  const list = hands ?? (await listHands());
  return JSON.stringify(list, null, 2);
}

export async function exportHandsAsCsv(hands?: StoredHand[]): Promise<string> {
  const list = hands ?? (await listHands());
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
  const rows = list.map((h) => [
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

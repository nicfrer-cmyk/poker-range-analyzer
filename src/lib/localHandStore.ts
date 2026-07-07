"use client";

import type { SavedHandRecord, ActionTaken } from "@/lib/engine/leakFinder";
import type { AnalysisInput } from "@/lib/store/analysisStore";
import type { AnalysisResult } from "@/lib/analysisTypes";
import { estimateEvLoss } from "@/lib/analysisEngine";

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
}

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

export function saveHand({
  input,
  result,
  action = "call",
  position,
  tags = [],
  source = "manual",
}: {
  input: AnalysisInput;
  result: AnalysisResult;
  action?: ActionTaken;
  position?: string;
  tags?: string[];
  source?: "manual" | "imported";
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
  };
  hands.push(record);
  writeAll(hands);
  return record;
}

export function clearAllHands() {
  writeAll([]);
}

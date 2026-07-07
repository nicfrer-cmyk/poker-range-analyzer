"use client";

export type TightLoose = "tight" | "loose";
export type PassiveAggressive = "passive" | "aggressive";

export interface StoredOpponent {
  id: string;
  name: string;
  tightLoose: TightLoose;
  passiveAggressive: PassiveAggressive;
  notes: string;
  createdAt: number;
}

const STORAGE_KEY = "pra:opponents:v1";

function readAll(): StoredOpponent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredOpponent[]) : [];
  } catch {
    return [];
  }
}

function writeAll(opponents: StoredOpponent[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(opponents));
}

export function listOpponents(): StoredOpponent[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function getOpponent(id: string): StoredOpponent | undefined {
  return readAll().find((o) => o.id === id);
}

export function saveOpponent(data: {
  name: string;
  tightLoose: TightLoose;
  passiveAggressive: PassiveAggressive;
  notes: string;
}): StoredOpponent {
  const opponents = readAll();
  const record: StoredOpponent = {
    id: `opp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    ...data,
  };
  opponents.push(record);
  writeAll(opponents);
  return record;
}

export function updateOpponent(id: string, patch: Partial<StoredOpponent>): void {
  const opponents = readAll();
  const idx = opponents.findIndex((o) => o.id === id);
  if (idx === -1) return;
  opponents[idx] = { ...opponents[idx]!, ...patch, id: opponents[idx]!.id };
  writeAll(opponents);
}

export function deleteOpponent(id: string) {
  writeAll(readAll().filter((o) => o.id !== id));
}

export function clearAllOpponents() {
  writeAll([]);
}

export const STYLE_LABEL: Record<TightLoose | PassiveAggressive, string> = {
  tight: "טייט",
  loose: "לוס",
  passive: "פסיבי",
  aggressive: "אגרסיבי",
};

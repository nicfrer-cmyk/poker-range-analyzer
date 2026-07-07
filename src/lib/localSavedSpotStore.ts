"use client";

/** Same localStorage read/write pattern as localSessionStore.ts — a lightweight bookmark of a
 *  recurring position matchup (table size + hero/villain position) for quick re-analysis from
 *  Step1GameType, not a full saved analysis. */

export interface SavedSpot {
  id: string;
  label: string;
  tableSize: number;
  heroPosition: string;
  villainPosition: string;
  createdAt: number;
}

const STORAGE_KEY = "pra:savedSpots:v1";

function readAll(): SavedSpot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedSpot[]) : [];
  } catch {
    return [];
  }
}

function writeAll(spots: SavedSpot[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(spots));
}

export function listSavedSpots(): SavedSpot[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function createSavedSpot(spot: {
  label: string;
  tableSize: number;
  heroPosition: string;
  villainPosition: string;
}): SavedSpot {
  const spots = readAll();
  const record: SavedSpot = {
    id: `spot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    label: spot.label,
    tableSize: spot.tableSize,
    heroPosition: spot.heroPosition,
    villainPosition: spot.villainPosition,
    createdAt: Date.now(),
  };
  spots.push(record);
  writeAll(spots);
  return record;
}

export function deleteSavedSpot(id: string) {
  writeAll(readAll().filter((s) => s.id !== id));
}

export function clearAllSavedSpots() {
  writeAll([]);
}

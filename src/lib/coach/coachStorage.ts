"use client";

/** Shared localStorage helpers for the coach modules — mirrors the read/write pattern already
 *  used by localHandStore.ts / localSessionStore.ts / training.ts, just factored out once since
 *  every coach module (iq/missions/roadmap/achievements) needs the same JSON get/set + date key. */

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

/** Calendar-day key (YYYY-MM-DD), same convention as leakFinder.ts's bucketKey and usageTracker.ts. */
export function dateKey(d: Date | number = Date.now()): string {
  return new Date(d).toISOString().slice(0, 10);
}

/** Small deterministic PRNG seeded from a string (e.g. a date key), so "today's missions" are
 *  stable across re-renders/reloads without needing to persist the picks themselves. */
export function seededRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function rng() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

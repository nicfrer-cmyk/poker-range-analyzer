import type { Card, Combo, Rank, WeightedRange } from './types';
import { SUITS, RANKS } from './types';
import { cardRank, cardSuit } from './deck';
import { rankValue } from './evaluator';

/**
 * Range shorthand parser.
 *
 * Supported syntax:
 *  - Pairs:            "AA", "77"
 *  - Pairs plus:        "22+"                (22,33,...,AA)
 *  - Suited/offsuit:    "AKs", "AKo"
 *  - Either suitedness: "AK"                 (both AKs and AKo -> 16 combos)
 *  - Two-rank plus:     "ATs+", "KQo+"       (increase the *lower* rank up to one below the higher rank)
 *  - Comma lists:       "AA,KK,QQ,AKs"
 *  - Dash ranges (nice-to-have):
 *      - same top rank bound:  "ATs-AQs"      (ATs,AJs,AQs)
 *      - connector run:       "54s-98s"       (54s,65s,76s,87s,98s)
 *  - Optional per-token weight suffix (nice-to-have): "AKs:0.5" (half-weight combos)
 */

/** Canonical, order-independent key for a combo: higher rank card first, suit as tiebreak. */
export function comboKey(combo: Combo): string {
  const [a, b] = normalizeComboOrder(combo);
  return `${a}${b}`;
}

function normalizeComboOrder(combo: Combo): [Card, Card] {
  const cards: [Card, Card] = [combo.c1, combo.c2];
  cards.sort((x, y) => {
    const rv = rankValue(cardRank(y)) - rankValue(cardRank(x));
    if (rv !== 0) return rv;
    return cardSuit(x).localeCompare(cardSuit(y));
  });
  return cards;
}

export function comboFromKey(key: string): Combo {
  return { c1: key.slice(0, 2) as Card, c2: key.slice(2, 4) as Card };
}

function makeCombo(c1: Card, c2: Card): Combo {
  const [a, b] = normalizeComboOrder({ c1, c2 });
  return { c1: a, c2: b };
}

/** All 6 combos of a pocket pair. */
function pairCombos(rank: Rank): Combo[] {
  const combos: Combo[] = [];
  for (let i = 0; i < SUITS.length; i++) {
    for (let j = i + 1; j < SUITS.length; j++) {
      combos.push(makeCombo(`${rank}${SUITS[i]}` as Card, `${rank}${SUITS[j]}` as Card));
    }
  }
  return combos;
}

type Suitedness = 'suited' | 'offsuit' | 'both';

/** Combos for two distinct ranks: 4 suited, 12 offsuit. */
function twoRankCombos(high: Rank, low: Rank, mode: Suitedness): Combo[] {
  const combos: Combo[] = [];
  if (mode === 'suited' || mode === 'both') {
    for (const s of SUITS) {
      combos.push(makeCombo(`${high}${s}` as Card, `${low}${s}` as Card));
    }
  }
  if (mode === 'offsuit' || mode === 'both') {
    for (const s1 of SUITS) {
      for (const s2 of SUITS) {
        if (s1 === s2) continue;
        combos.push(makeCombo(`${high}${s1}` as Card, `${low}${s2}` as Card));
      }
    }
  }
  return combos;
}

const PAIR_RE = /^([2-9TJQKA])\1(\+)?$/;
const DASH_RE = /^([2-9TJQKA])([2-9TJQKA])([SO])?-([2-9TJQKA])([2-9TJQKA])([SO])?$/;
const TWO_RANK_RE = /^([2-9TJQKA])([2-9TJQKA])([SO])?(\+)?$/;

function normalizeToken(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

function suitModeFromFlag(flag: string | undefined): Suitedness {
  if (flag === 'S') return 'suited';
  if (flag === 'O') return 'offsuit';
  return 'both';
}

function orderByValue(r1: Rank, r2: Rank): [Rank, Rank] {
  return rankValue(r1) >= rankValue(r2) ? [r1, r2] : [r2, r1];
}

function parseToken(rawToken: string): Combo[] {
  const token = normalizeToken(rawToken);

  const pairMatch = token.match(PAIR_RE);
  if (pairMatch) {
    const rank = pairMatch[1] as Rank;
    const plus = !!pairMatch[2];
    const combos: Combo[] = [];
    if (plus) {
      for (let v = rankValue(rank); v <= rankValue('A'); v++) {
        combos.push(...pairCombos(RANKS[v] as Rank));
      }
    } else {
      combos.push(...pairCombos(rank));
    }
    return combos;
  }

  const dashMatch = token.match(DASH_RE);
  if (dashMatch) {
    const [, r1a, r1b, suit1, r2a, r2b, suit2] = dashMatch;
    const [high1, low1] = orderByValue(r1a as Rank, r1b as Rank);
    const [high2, low2] = orderByValue(r2a as Rank, r2b as Rank);
    const mode = suitModeFromFlag(suit1 ?? suit2);
    const combos: Combo[] = [];

    if (high1 === high2) {
      // Bounded range on the low card, e.g. ATs-AQs
      const lo = Math.min(rankValue(low1), rankValue(low2));
      const hi = Math.max(rankValue(low1), rankValue(low2));
      for (let v = lo; v <= hi; v++) {
        combos.push(...twoRankCombos(high1, RANKS[v] as Rank, mode));
      }
    } else {
      // Connector run with a constant gap, e.g. 54s-98s
      const gap1 = rankValue(high1) - rankValue(low1);
      const gap2 = rankValue(high2) - rankValue(low2);
      const gap = gap1 === gap2 ? gap1 : gap1; // assume consistent gap; fall back to gap1
      const startHigh = Math.min(rankValue(high1), rankValue(high2));
      const endHigh = Math.max(rankValue(high1), rankValue(high2));
      for (let hv = startHigh; hv <= endHigh; hv++) {
        const lv = hv - gap;
        if (lv < 0) continue;
        combos.push(...twoRankCombos(RANKS[hv] as Rank, RANKS[lv] as Rank, mode));
      }
    }
    return combos;
  }

  const twoRankMatch = token.match(TWO_RANK_RE);
  if (twoRankMatch) {
    const [, ra, rb, suitFlag, plusFlag] = twoRankMatch;
    const [high, low] = orderByValue(ra as Rank, rb as Rank);
    const mode = suitModeFromFlag(suitFlag);
    const combos: Combo[] = [];
    if (plusFlag) {
      for (let v = rankValue(low); v <= rankValue(high) - 1; v++) {
        combos.push(...twoRankCombos(high, RANKS[v] as Rank, mode));
      }
    } else {
      combos.push(...twoRankCombos(high, low, mode));
    }
    return combos;
  }

  throw new Error(`Unrecognized range token: "${rawToken}"`);
}

/** Parses a comma-separated range string into a weighted set of combos. */
export function parseRange(input: string): WeightedRange {
  const range: WeightedRange = new Map();
  if (!input || !input.trim()) return range;

  const tokens = input.split(',').map((t) => t.trim()).filter(Boolean);
  for (const rawToken of tokens) {
    let token = rawToken;
    let weight = 1;
    const weightMatch = token.match(/:(\d*\.?\d+)\s*$/);
    if (weightMatch) {
      weight = Math.max(0, Math.min(1, parseFloat(weightMatch[1] as string)));
      token = token.slice(0, weightMatch.index ?? 0).trim();
    }
    const combos = parseToken(token);
    for (const combo of combos) {
      range.set(comboKey(combo), weight);
    }
  }
  return range;
}

/** Flattens a WeightedRange into its combos (weight > 0 only). */
export function rangeToCombos(range: WeightedRange): Combo[] {
  const combos: Combo[] = [];
  for (const [key, weight] of range.entries()) {
    if (weight > 0) combos.push(comboFromKey(key));
  }
  return combos;
}

/** Like rangeToCombos, but keeps the weight attached to each combo. */
export function rangeEntries(range: WeightedRange): Array<{ combo: Combo; weight: number }> {
  const entries: Array<{ combo: Combo; weight: number }> = [];
  for (const [key, weight] of range.entries()) {
    if (weight > 0) entries.push({ combo: comboFromKey(key), weight });
  }
  return entries;
}

/** Removes combos that share a card with any of `dead` cards. Returns a new range. */
export function removeConflicts(range: WeightedRange, dead: readonly Card[]): WeightedRange {
  if (dead.length === 0) return new Map(range);
  const deadSet = new Set(dead);
  const filtered: WeightedRange = new Map();
  for (const [key, weight] of range.entries()) {
    const combo = comboFromKey(key);
    if (deadSet.has(combo.c1) || deadSet.has(combo.c2)) continue;
    filtered.set(key, weight);
  }
  return filtered;
}

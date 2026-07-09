import type { Card, Combo } from './types';
import { cardRank, cardSuit } from './deck';
import { evaluateHand, rankValue } from './evaluator';

/** Best-made-hand tier for a combo relative to a board. */
export type MadeTier =
  | 'straight-flush'
  | 'quads'
  | 'full-house'
  | 'flush'
  | 'straight'
  | 'set'
  | 'trips'
  | 'two-pair'
  | 'overpair'
  | 'top-pair'
  | 'second-pair'
  | 'bottom-pair'
  | 'underpair'
  | 'overcards'
  | 'air';

/** Draw categories. A combo can carry zero, one, or several of these alongside its made tier. */
export type DrawType =
  | 'flush-draw'
  | 'backdoor-flush-draw'
  | 'open-ended-straight-draw'
  | 'gutshot-straight-draw';

export interface HandClassification {
  madeTier: MadeTier;
  draws: DrawType[];
  description: string;
}

function uniqueSortedDesc(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => b - a);
}

function classifyMadeTier(combo: Combo, board: Card[]): MadeTier {
  const holeRanks: [number, number] = [rankValue(cardRank(combo.c1)), rankValue(cardRank(combo.c2))];
  const boardRanks = board.map((c) => rankValue(cardRank(c)));
  const boardRanksDesc = uniqueSortedDesc(boardRanks);
  const isPocketPair = holeRanks[0] === holeRanks[1];

  if (board.length < 3) {
    // Preflop (or any malformed partial board with fewer than 3 cards): no board relationships
    // apply yet beyond the raw hole cards, and evaluateHand requires at least 5 cards.
    return isPocketPair ? 'overpair' /* pocket pair, informally "the best hand so far" */ : 'air';
  }

  const evaluated = evaluateHand([combo.c1, combo.c2, ...board]);

  switch (evaluated.category) {
    case 'straight-flush':
      return 'straight-flush';
    case 'quads':
      return 'quads';
    case 'full-house':
      return 'full-house';
    case 'flush':
      return 'flush';
    case 'straight':
      return 'straight';
    case 'trips': {
      // Set: pocket pair in the hole cards, matched by exactly one board card.
      // Trips: one hole card pairs with a pair already on the board (or board trips).
      if (isPocketPair) {
        const boardMatches = boardRanks.filter((r) => r === holeRanks[0]).length;
        if (boardMatches === 1) return 'set';
      }
      return 'trips';
    }
    case 'two-pair':
      return 'two-pair';
    case 'pair': {
      if (isPocketPair) {
        const pairRank = holeRanks[0];
        if (boardRanksDesc.every((r) => pairRank > r)) return 'overpair';
        if (boardRanksDesc.every((r) => pairRank < r)) return 'underpair';
        // Pocket pair sits between board cards, e.g. 88 on a K-9-2 board: treat as an underpair
        // to the top of the board (closest available bucket in the requested tier list).
        return 'underpair';
      }
      // One hole card paired with a board card: rank it by the matched board card's position.
      const matchedRank = holeRanks.find((r) => boardRanks.includes(r));
      if (matchedRank === undefined) {
        // The board itself is paired (e.g. K-K-7) and neither hole card matches anything on
        // it — hero's showdown pair is entirely the board's, not hero's own contribution, so
        // classify hero's own hand the same way the unpaired-board case does: by whether both
        // hole cards are overcards to the board, not as an unconditional 'air'.
        const maxBoardRank = boardRanksDesc[0] as number;
        if (holeRanks[0] > maxBoardRank && holeRanks[1] > maxBoardRank) return 'overcards';
        return 'air';
      }
      const position = boardRanksDesc.indexOf(matchedRank);
      if (position === 0) return 'top-pair';
      if (position === boardRanksDesc.length - 1) return 'bottom-pair';
      return 'second-pair';
    }
    case 'high-card':
    default: {
      // board.length >= 3 here, so boardRanksDesc always has at least one entry.
      const maxBoardRank = boardRanksDesc[0] as number;
      if (holeRanks[0] > maxBoardRank && holeRanks[1] > maxBoardRank) return 'overcards';
      return 'air';
    }
  }
}

function findStraightDraws(uniqueRankValues: Set<number>): DrawType[] {
  const draws: DrawType[] = [];
  // Represent the ace as both 12 (high) and -1 (low, for wheel-type draws).
  const values = new Set(uniqueRankValues);
  if (values.has(12)) values.add(-1);

  // Count *distinct completing ranks* across every possible 5-slot window, rather than
  // classifying open-ended/gutshot from a single window's missing-card position. This matters
  // for ace-low runs: A-2-3-4 only has one real out (a 5) because there's no rank below a
  // low ace to extend into — a naive "missing card sits at the window's edge" check would
  // misread that as open-ended (as if two ranks completed it) when only one actually does.
  // A normalized rank of -1 and 12 both mean "ace", so they're folded into the same entry.
  const completingRanks = new Set<number>();
  for (let windowMin = -1; windowMin <= 8; windowMin++) {
    const window = [windowMin, windowMin + 1, windowMin + 2, windowMin + 3, windowMin + 4];
    const present = window.filter((v) => values.has(v));
    if (present.length === 4) {
      const missing = window.find((v) => !values.has(v))!;
      completingRanks.add(missing === -1 ? 12 : missing);
    }
  }

  if (completingRanks.size >= 2) draws.push('open-ended-straight-draw');
  else if (completingRanks.size === 1) draws.push('gutshot-straight-draw');
  return draws;
}

function findDraws(combo: Combo, board: Card[]): DrawType[] {
  // Draws only make sense when there are future cards to come (flop or turn).
  if (board.length !== 3 && board.length !== 4) return [];

  const allCards = [combo.c1, combo.c2, ...board];
  const suitCounts = new Map<string, number>();
  for (const c of allCards) {
    const s = cardSuit(c);
    suitCounts.set(s, (suitCounts.get(s) ?? 0) + 1);
  }

  const draws: DrawType[] = [];
  for (const count of suitCounts.values()) {
    if (count === 4) draws.push('flush-draw');
    else if (count === 3 && board.length === 3) draws.push('backdoor-flush-draw');
  }

  const rankValues = new Set(allCards.map((c) => rankValue(cardRank(c))));
  draws.push(...findStraightDraws(rankValues));

  return draws;
}

function describe(madeTier: MadeTier, draws: DrawType[]): string {
  const tierLabels: Record<MadeTier, string> = {
    'straight-flush': 'Straight Flush',
    quads: 'Four of a Kind',
    'full-house': 'Full House',
    flush: 'Flush',
    straight: 'Straight',
    set: 'Set',
    trips: 'Trips',
    'two-pair': 'Two Pair',
    overpair: 'Overpair',
    'top-pair': 'Top Pair',
    'second-pair': 'Second Pair',
    'bottom-pair': 'Bottom Pair',
    underpair: 'Underpair',
    overcards: 'Overcards',
    air: 'Air',
  };
  const drawLabels: Record<DrawType, string> = {
    'flush-draw': 'Flush Draw',
    'backdoor-flush-draw': 'Backdoor Flush Draw',
    'open-ended-straight-draw': 'Open-Ended Straight Draw',
    'gutshot-straight-draw': 'Gutshot Straight Draw',
  };
  const parts = [tierLabels[madeTier], ...draws.map((d) => drawLabels[d])];
  return parts.join(' + ');
}

/**
 * Classifies a hole-card combo against a (possibly partial) board into a made-hand tier plus
 * any live draws. Both fields are always populated: draws is simply empty when there's no
 * board to have a draw against (preflop) or no more cards to come (river).
 */
export function classifyHand(combo: Combo, board: Card[]): HandClassification {
  const madeTier = classifyMadeTier(combo, board);
  const draws = findDraws(combo, board);
  return { madeTier, draws, description: describe(madeTier, draws) };
}

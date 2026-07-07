import type { Card, Combo, WeightedRange } from './types';
import { remainingDeck, drawRandomCards } from './deck';
import { rangeEntries, removeConflicts } from './range';
import { evaluateHand, compareHands } from './evaluator';

export interface EquityResult {
  /** Hero's share of equity in [0,1], counting split pots proportionally. */
  heroEquity: number;
  /** Portion of equity that came from tied pots (already included in heroEquity/villainEquity). */
  tieEquity: number;
  villainEquity: number;
  /** Number of Monte Carlo trials, or number of exactly-enumerated showdowns. */
  iterations: number;
  /** True if the result is an exact enumeration (turn/river), false if Monte Carlo (preflop/flop). */
  exact: boolean;
}

export interface EquityInput {
  /** A single hero combo. Mutually exclusive with heroRange (heroCards takes priority if both given). */
  heroCards?: Combo;
  /** A hero range, averaged over combo weights, for range-vs-range equity. */
  heroRange?: WeightedRange;
  villainRange: WeightedRange;
  /** 0, 3, 4, or 5 board cards. */
  board: Card[];
  /** Monte Carlo iteration count used for preflop/flop (default 10,000). Ignored on turn/river (exact). */
  iterations?: number;
}

const DEFAULT_ITERATIONS = 10_000;

interface Accumulator {
  heroWins: number;
  ties: number;
  villainWins: number;
  totalWeight: number;
}

function newAccumulator(): Accumulator {
  return { heroWins: 0, ties: 0, villainWins: 0, totalWeight: 0 };
}

function accumulateShowdown(acc: Accumulator, hero: Combo, villain: Combo, board: Card[], weight: number): void {
  const heroEval = evaluateHand([hero.c1, hero.c2, ...board]);
  const villainEval = evaluateHand([villain.c1, villain.c2, ...board]);
  const cmp = compareHands(heroEval, villainEval);
  acc.totalWeight += weight;
  if (cmp > 0) acc.heroWins += weight;
  else if (cmp < 0) acc.villainWins += weight;
  else acc.ties += weight;
}

function pickWeighted<T extends { weight: number }>(entries: readonly T[], totalWeight: number, rng: () => number): T {
  let r = rng() * totalWeight;
  for (const entry of entries) {
    r -= entry.weight;
    if (r <= 0) return entry;
  }
  return entries[entries.length - 1] as T;
}

function toResult(acc: Accumulator, iterations: number, exact: boolean): EquityResult {
  if (acc.totalWeight === 0) {
    return { heroEquity: NaN, tieEquity: NaN, villainEquity: NaN, iterations, exact };
  }
  return {
    heroEquity: (acc.heroWins + acc.ties / 2) / acc.totalWeight,
    tieEquity: acc.ties / acc.totalWeight,
    villainEquity: (acc.villainWins + acc.ties / 2) / acc.totalWeight,
    iterations,
    exact,
  };
}

/** Computes equity for a single hero combo against a villain range, for any board street. */
function equityForCombo(
  hero: Combo,
  villainRange: WeightedRange,
  board: Card[],
  iterations: number,
  rng: () => number,
): EquityResult {
  const dead = [hero.c1, hero.c2, ...board];
  const villainEntries = rangeEntries(removeConflicts(villainRange, dead));

  if (villainEntries.length === 0) {
    return { heroEquity: NaN, tieEquity: NaN, villainEquity: NaN, iterations: 0, exact: board.length >= 4 };
  }

  const acc = newAccumulator();

  if (board.length === 5) {
    for (const { combo, weight } of villainEntries) {
      accumulateShowdown(acc, hero, combo, board, weight);
    }
    return toResult(acc, villainEntries.length, true);
  }

  if (board.length === 4) {
    const deckAfterHeroBoard = remainingDeck(dead);
    let enumerated = 0;
    for (const { combo, weight } of villainEntries) {
      const riverCandidates = deckAfterHeroBoard.filter((c) => c !== combo.c1 && c !== combo.c2);
      for (const river of riverCandidates) {
        accumulateShowdown(acc, hero, combo, [...board, river], weight);
        enumerated++;
      }
    }
    return toResult(acc, enumerated, true);
  }

  // board.length === 3 (flop) or 0 (preflop): Monte Carlo.
  const cardsToComeCount = 5 - board.length;
  const deckAfterHeroBoard = remainingDeck(dead);
  const totalWeight = villainEntries.reduce((sum, e) => sum + e.weight, 0);

  for (let i = 0; i < iterations; i++) {
    const picked = pickWeighted(villainEntries, totalWeight, rng);
    const deckForTrial = deckAfterHeroBoard.filter((c) => c !== picked.combo.c1 && c !== picked.combo.c2);
    const runout = drawRandomCards(deckForTrial, cardsToComeCount, rng);
    accumulateShowdown(acc, hero, picked.combo, [...board, ...runout], 1);
  }

  return toResult(acc, iterations, false);
}

/**
 * Calculates hero equity vs a villain range on a partial or complete board.
 *
 * - River (5 board cards) and turn (4 board cards): exact enumeration of all remaining
 *   villain combos (and, on the turn, all remaining river cards) — few enough to brute force.
 * - Flop (3) and preflop (0): Monte Carlo sampling (default 10,000 iterations) since full
 *   enumeration of all runouts is too slow to do synchronously.
 *
 * Supports either a single hero combo (`heroCards`) or a hero range (`heroRange`), in which
 * case equity is averaged across the hero's combos, weighted by their range weight.
 */
export function calculateEquity(input: EquityInput): EquityResult {
  const board = input.board ?? [];
  const iterations = input.iterations ?? DEFAULT_ITERATIONS;
  const rng = Math.random;

  if (input.heroCards) {
    return equityForCombo(input.heroCards, input.villainRange, board, iterations, rng);
  }

  if (input.heroRange) {
    const heroEntries = rangeEntries(removeConflicts(input.heroRange, board));
    if (heroEntries.length === 0) {
      return { heroEquity: NaN, tieEquity: NaN, villainEquity: NaN, iterations: 0, exact: board.length >= 4 };
    }
    // Keep total work roughly bounded regardless of how many hero combos are in the range.
    const perComboIterations = board.length >= 4 ? iterations : Math.max(200, Math.floor(iterations / heroEntries.length));

    let heroWeighted = 0;
    let tieWeighted = 0;
    let villainWeighted = 0;
    let totalWeight = 0;
    let totalIterations = 0;
    let allExact = true;

    for (const { combo, weight } of heroEntries) {
      const result = equityForCombo(combo, input.villainRange, board, perComboIterations, rng);
      if (Number.isNaN(result.heroEquity)) continue;
      heroWeighted += result.heroEquity * weight;
      tieWeighted += result.tieEquity * weight;
      villainWeighted += result.villainEquity * weight;
      totalWeight += weight;
      totalIterations += result.iterations;
      allExact = allExact && result.exact;
    }

    if (totalWeight === 0) {
      return { heroEquity: NaN, tieEquity: NaN, villainEquity: NaN, iterations: totalIterations, exact: allExact };
    }

    return {
      heroEquity: heroWeighted / totalWeight,
      tieEquity: tieWeighted / totalWeight,
      villainEquity: villainWeighted / totalWeight,
      iterations: totalIterations,
      exact: allExact,
    };
  }

  throw new Error('calculateEquity requires either heroCards or heroRange');
}

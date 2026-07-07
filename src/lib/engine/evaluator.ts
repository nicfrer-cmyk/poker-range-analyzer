import type { Card, EvaluatedHand, HandCategory } from './types';
import { RANKS, HAND_CATEGORY_ORDER } from './types';
import { cardRank, cardSuit } from './deck';

const RANK_NAMES: readonly string[] = [
  'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Jack', 'Queen', 'King', 'Ace',
];

const RANK_PLURAL: readonly string[] = [
  'Twos', 'Threes', 'Fours', 'Fives', 'Sixes', 'Sevens', 'Eights', 'Nines',
  'Tens', 'Jacks', 'Queens', 'Kings', 'Aces',
];

export function rankValue(rank: string): number {
  const idx = RANKS.indexOf(rank as (typeof RANKS)[number]);
  if (idx === -1) throw new Error(`Invalid rank: ${rank}`);
  return idx;
}

function categoryIndex(category: HandCategory): number {
  return HAND_CATEGORY_ORDER.indexOf(category);
}

/** Packs a category + up to 5 tiebreaker rank values (0-12) into a single comparable integer. */
function packRank(category: HandCategory, tiebreakers: number[]): number {
  const t: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (let i = 0; i < Math.min(5, tiebreakers.length); i++) t[i] = tiebreakers[i] ?? 0;
  const cat = categoryIndex(category);
  return (cat << 20) | (t[0] << 16) | (t[1] << 12) | (t[2] << 8) | (t[3] << 4) | t[4];
}

interface StraightCheck {
  isStraight: boolean;
  /** Rank value (0-12) of the top card of the straight; for the wheel (A-5) this is 3 (five-high). */
  highValue: number;
}

/** Detects a straight among 5 *distinct* rank values (as required for evaluate5's straight check). */
function detectStraight(distinctValuesDesc: number[]): StraightCheck {
  if (distinctValuesDesc.length !== 5) return { isStraight: false, highValue: -1 };

  // Length is now known to be exactly 5; pull each position into its own guaranteed-defined binding.
  const [v0, v1, v2, v3, v4] = distinctValuesDesc as [number, number, number, number, number];

  // Wheel: A,5,4,3,2 -> values 12,3,2,1,0
  const isWheel = v0 === 12 && v1 === 3 && v2 === 2 && v3 === 1 && v4 === 0;
  if (isWheel) return { isStraight: true, highValue: 3 };

  const isConsecutive = v0 - v1 === 1 && v1 - v2 === 1 && v2 - v3 === 1 && v3 - v4 === 1;
  if (!isConsecutive) return { isStraight: false, highValue: -1 };
  return { isStraight: true, highValue: v0 };
}

/** Evaluates exactly 5 cards into a best-hand result. */
export function evaluate5(cards: readonly Card[]): EvaluatedHand {
  if (cards.length !== 5) throw new Error('evaluate5 requires exactly 5 cards');

  const values = cards.map((c) => rankValue(cardRank(c)));
  const suits = cards.map((c) => cardSuit(c));

  const firstSuit = suits[0] as (typeof suits)[number];
  const isFlush = suits.every((s) => s === firstSuit);

  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const distinctValuesDesc = [...counts.keys()].sort((a, b) => b - a);
  const topValue = distinctValuesDesc[0] as number; // 5 cards always yield at least 1 distinct value

  const straightInfo = detectStraight(distinctValuesDesc);

  // Groups sorted by count desc, then value desc: e.g. quads+kicker, trips+pair, two pairs+kicker.
  const groups = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => (b.count - a.count) || (b.value - a.value));

  // groups[0] always exists (5 cards -> at least 1 distinct rank group); groups[1]/[2] may not.
  const g0 = groups[0] as { value: number; count: number };
  const g1 = groups[1];
  const g2 = groups[2];

  const cardsSortedDesc = cards.slice().sort((a, b) => rankValue(cardRank(b)) - rankValue(cardRank(a)));

  if (isFlush && straightInfo.isStraight) {
    return build('straight-flush', [straightInfo.highValue], cardsSortedDesc, straightFlushDescription(straightInfo.highValue));
  }

  if (g0.count === 4 && g1) {
    const kicker = g1.value;
    return build('quads', [g0.value, kicker], cardsSortedDesc, `Four of a Kind, ${RANK_PLURAL[g0.value]}`);
  }

  if (g0.count === 3 && g1?.count === 2) {
    return build(
      'full-house',
      [g0.value, g1.value],
      cardsSortedDesc,
      `Full House, ${RANK_PLURAL[g0.value]} over ${RANK_PLURAL[g1.value]}`,
    );
  }

  if (isFlush) {
    return build('flush', distinctValuesDesc.slice(0, 5), cardsSortedDesc, `Flush, ${RANK_NAMES[topValue]} high`);
  }

  if (straightInfo.isStraight) {
    return build('straight', [straightInfo.highValue], cardsSortedDesc, `Straight, ${RANK_NAMES[straightInfo.highValue]} high`);
  }

  if (g0.count === 3) {
    const kickers = groups.slice(1).map((g) => g.value);
    return build('trips', [g0.value, ...kickers], cardsSortedDesc, `Three of a Kind, ${RANK_PLURAL[g0.value]}`);
  }

  if (g0.count === 2 && g1?.count === 2) {
    const highPair = Math.max(g0.value, g1.value);
    const lowPair = Math.min(g0.value, g1.value);
    const kicker = (g2 as { value: number; count: number }).value;
    return build(
      'two-pair',
      [highPair, lowPair, kicker],
      cardsSortedDesc,
      `Two Pair, ${RANK_PLURAL[highPair]} and ${RANK_PLURAL[lowPair]}`,
    );
  }

  if (g0.count === 2) {
    const kickers = groups.slice(1).map((g) => g.value);
    return build('pair', [g0.value, ...kickers], cardsSortedDesc, `Pair of ${RANK_PLURAL[g0.value]}`);
  }

  return build('high-card', distinctValuesDesc.slice(0, 5), cardsSortedDesc, `${RANK_NAMES[topValue]} High`);
}

function straightFlushDescription(highValue: number): string {
  if (highValue === 12) return 'Royal Flush';
  return `Straight Flush, ${RANK_NAMES[highValue]} high`;
}

function build(category: HandCategory, tiebreakers: number[], cards: Card[], description: string): EvaluatedHand {
  return {
    category,
    rank: packRank(category, tiebreakers),
    tiebreakers,
    cards,
    description,
  };
}

function combinations<T>(items: readonly T[], k: number): T[][] {
  const results: T[][] = [];
  const combo: T[] = [];
  function backtrack(start: number) {
    if (combo.length === k) {
      results.push(combo.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      combo.push(items[i] as T);
      backtrack(i + 1);
      combo.pop();
    }
  }
  backtrack(0);
  return results;
}

/**
 * Evaluates the best possible 5-card hand out of 5, 6, or 7 cards.
 * For 6/7 cards this brute-forces all C(n,5) subsets (at most 21), which is trivially fast.
 */
export function evaluateHand(cards: readonly Card[]): EvaluatedHand {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error(`evaluateHand requires 5-7 cards, got ${cards.length}`);
  }
  if (cards.length === 5) return evaluate5(cards);

  let best: EvaluatedHand | null = null;
  for (const subset of combinations(cards, 5)) {
    const evaluated = evaluate5(subset);
    if (!best || evaluated.rank > best.rank) best = evaluated;
  }
  return best as EvaluatedHand;
}

/** Positive => a wins, negative => b wins, 0 => tie. */
export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  return a.rank - b.rank;
}

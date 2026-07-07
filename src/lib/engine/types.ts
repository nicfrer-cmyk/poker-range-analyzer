/**
 * Shared types for the pure-TypeScript Texas Hold'em equity engine.
 *
 * Design notes:
 * - `Card` is represented as the template-literal string `${Rank}${Suit}` (e.g. "Ah", "Td", "2s").
 *   This keeps cards usable directly as Map/Set/object keys, which the range parser, the deck
 *   utilities, and the equity engine all rely on heavily. Every other file in this package
 *   consumes/produces this same representation, so there is a single canonical card format
 *   throughout the engine.
 */

export type Suit = 's' | 'h' | 'd' | 'c';

export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'T' | 'J' | 'Q' | 'K' | 'A';

/** Canonical card representation, e.g. "Ah", "Td", "2s". */
export type Card = `${Rank}${Suit}`;

/** Ranks ordered low -> high. Index in this array is the numeric rank value used for comparisons. */
export const RANKS: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export const SUITS: readonly Suit[] = ['s', 'h', 'd', 'c'];

export type HandCategory =
  | 'high-card'
  | 'pair'
  | 'two-pair'
  | 'trips'
  | 'straight'
  | 'flush'
  | 'full-house'
  | 'quads'
  | 'straight-flush';

/** Category ordered worst -> best; the array index is used as the base of the comparable rank score. */
export const HAND_CATEGORY_ORDER: readonly HandCategory[] = [
  'high-card',
  'pair',
  'two-pair',
  'trips',
  'straight',
  'flush',
  'full-house',
  'quads',
  'straight-flush',
];

/**
 * Result of evaluating the best 5-card hand out of a set of 5, 6, or 7 cards.
 *
 * `rank` is a single comparable integer: higher is always better, regardless of category.
 * It is built from the category index and up to five tiebreaker rank values (0-12), packed
 * into 4-bit fields, so two hands can be compared with simple integer subtraction.
 */
export interface EvaluatedHand {
  category: HandCategory;
  /** Single comparable score. Higher wins. Safe for integer comparison/subtraction. */
  rank: number;
  /** Rank values (0-12, low->high) used to break ties within a category, most significant first. */
  tiebreakers: number[];
  /** The best 5 cards that produced this evaluation. */
  cards: Card[];
  /** Human readable description, e.g. "Full House, Kings over Threes". */
  description: string;
}

/** Two hole cards. */
export interface Combo {
  c1: Card;
  c2: Card;
}

/**
 * A range of hole-card combos, each with a weight in [0, 1] representing how often that combo
 * is played (1 = always, 0.5 = half the time, etc). Keyed by a canonical combo string (see
 * `comboKey` in range.ts) so the same combo can't appear twice under different orderings.
 */
export type WeightedRange = Map<string, number>;

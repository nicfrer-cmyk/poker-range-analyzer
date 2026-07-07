import type { Card, Rank, Suit } from './types';
import { RANKS, SUITS } from './types';

/** Builds a fresh, ordered 52-card deck. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push(`${rank}${suit}` as Card);
    }
  }
  return deck;
}

/** Fisher-Yates shuffle. Returns a new array; does not mutate the input. */
export function shuffleDeck(deck: readonly Card[], rng: () => number = Math.random): Card[] {
  const result = deck.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i] as Card;
    result[i] = result[j] as Card;
    result[j] = tmp;
  }
  return result;
}

/** Removes dead cards (hero's hand, board, folded/known villain cards, ...) from a deck. */
export function removeDeadCards(deck: readonly Card[], dead: readonly Card[]): Card[] {
  if (dead.length === 0) return deck.slice();
  const deadSet = new Set(dead);
  return deck.filter((c) => !deadSet.has(c));
}

/** Convenience: full deck minus a set of dead cards, ready for Monte Carlo sampling. */
export function remainingDeck(dead: readonly Card[]): Card[] {
  return removeDeadCards(createDeck(), dead);
}

export function cardRank(card: Card): Rank {
  return card[0] as Rank;
}

export function cardSuit(card: Card): Suit {
  return card[1] as Suit;
}

/** Draw `count` random cards without replacement from `pool`, without mutating it. */
export function drawRandomCards(pool: readonly Card[], count: number, rng: () => number = Math.random): Card[] {
  if (count > pool.length) {
    throw new Error(`Cannot draw ${count} cards from a pool of ${pool.length}`);
  }
  const working = pool.slice();
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * working.length);
    drawn.push(working[idx] as Card);
    working[idx] = working[working.length - 1] as Card;
    working.pop();
  }
  return drawn;
}

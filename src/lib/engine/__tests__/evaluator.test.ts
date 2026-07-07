import { describe, it, expect } from 'vitest';
import type { Card } from '../types';
import { evaluate5, evaluateHand, compareHands } from '../evaluator';

describe('evaluate5 — hand category detection', () => {
  it('detects high card', () => {
    const hand = evaluate5(['Ah', 'Kd', '7c', '4s', '2h'] as Card[]);
    expect(hand.category).toBe('high-card');
  });

  it('detects a pair', () => {
    const hand = evaluate5(['Ah', 'Ad', 'Kc', '7s', '2h'] as Card[]);
    expect(hand.category).toBe('pair');
  });

  it('detects two pair', () => {
    const hand = evaluate5(['Ah', 'Ad', 'Kc', 'Ks', '2h'] as Card[]);
    expect(hand.category).toBe('two-pair');
  });

  it('detects three of a kind', () => {
    const hand = evaluate5(['Ah', 'Ad', 'Ac', '7s', '2h'] as Card[]);
    expect(hand.category).toBe('trips');
  });

  it('detects a straight', () => {
    const hand = evaluate5(['5h', '6d', '7c', '8s', '9h'] as Card[]);
    expect(hand.category).toBe('straight');
  });

  it('detects a flush', () => {
    const hand = evaluate5(['2h', '5h', '9h', 'Jh', 'Kh'] as Card[]);
    expect(hand.category).toBe('flush');
  });

  it('detects a full house', () => {
    const hand = evaluate5(['Ah', 'Ad', 'Ac', '7s', '7h'] as Card[]);
    expect(hand.category).toBe('full-house');
  });

  it('detects four of a kind', () => {
    const hand = evaluate5(['Ah', 'Ad', 'Ac', 'As', '7h'] as Card[]);
    expect(hand.category).toBe('quads');
  });

  it('detects a straight flush', () => {
    const hand = evaluate5(['5h', '6h', '7h', '8h', '9h'] as Card[]);
    expect(hand.category).toBe('straight-flush');
  });
});

describe('tie-breaking', () => {
  it('breaks ties between two-pair hands by kicker', () => {
    const better = evaluate5(['Ah', 'Ad', 'Kc', 'Ks', 'Qh'] as Card[]); // AA KK, Q kicker
    const worse = evaluate5(['Ac', 'As', 'Kd', 'Kh', '2h'] as Card[]); // AA KK, 2 kicker
    expect(compareHands(better, worse)).toBeGreaterThan(0);
  });

  it('breaks ties between pairs by the pair rank first', () => {
    const kings = evaluate5(['Kh', 'Kd', '2c', '3s', '4h'] as Card[]);
    const queens = evaluate5(['Qh', 'Qd', 'Ac', 'Ks', '4h'] as Card[]);
    expect(compareHands(kings, queens)).toBeGreaterThan(0);
  });

  it('breaks ties between full houses by trip rank then pair rank', () => {
    const acesOverKings = evaluate5(['Ah', 'Ad', 'Ac', 'Ks', 'Kh'] as Card[]);
    const acesOverQueens = evaluate5(['As', 'Ac', 'Ah', 'Qs', 'Qh'] as Card[]);
    expect(compareHands(acesOverKings, acesOverQueens)).toBeGreaterThan(0);
  });
});

describe('the wheel (A-2-3-4-5)', () => {
  it('ranks as a straight, playing the ace low', () => {
    const wheel = evaluate5(['Ah', '2d', '3c', '4s', '5h'] as Card[]);
    expect(wheel.category).toBe('straight');
    expect(wheel.tiebreakers[0]).toBe(3); // five-high straight
  });

  it('is the lowest possible straight', () => {
    const wheel = evaluate5(['Ah', '2d', '3c', '4s', '5h'] as Card[]);
    const sixHigh = evaluate5(['2h', '3d', '4c', '5s', '6h'] as Card[]);
    expect(compareHands(sixHigh, wheel)).toBeGreaterThan(0);
  });

  it('a wheel straight flush is still the lowest straight flush', () => {
    const wheelFlush = evaluate5(['Ah', '2h', '3h', '4h', '5h'] as Card[]);
    const sixHighFlush = evaluate5(['2d', '3d', '4d', '5d', '6d'] as Card[]);
    expect(wheelFlush.category).toBe('straight-flush');
    expect(compareHands(sixHighFlush, wheelFlush)).toBeGreaterThan(0);
  });
});

describe('category ordering', () => {
  it('a straight flush beats four of a kind', () => {
    const straightFlush = evaluate5(['5h', '6h', '7h', '8h', '9h'] as Card[]);
    const quads = evaluate5(['Ah', 'Ad', 'Ac', 'As', '7h'] as Card[]);
    expect(compareHands(straightFlush, quads)).toBeGreaterThan(0);
  });

  it('four of a kind beats a full house', () => {
    const quads = evaluate5(['Ah', 'Ad', 'Ac', 'As', '7h'] as Card[]);
    const fullHouse = evaluate5(['Kh', 'Kd', 'Kc', '7s', '7h'] as Card[]);
    expect(compareHands(quads, fullHouse)).toBeGreaterThan(0);
  });

  it('a full house beats a flush', () => {
    const fullHouse = evaluate5(['Kh', 'Kd', 'Kc', '7s', '7h'] as Card[]);
    const flush = evaluate5(['2h', '5h', '9h', 'Jh', 'Kh'] as Card[]);
    expect(compareHands(fullHouse, flush)).toBeGreaterThan(0);
  });
});

describe('evaluateHand — best 5-of-7 selection', () => {
  it('picks the best 5-card hand out of 7 cards', () => {
    // Broadway straight (A-K-Q-J-T) buried among 7 cards, with unrelated low cards mixed in.
    const seven: Card[] = ['9s', 'Ah', 'Kd', '2c', 'Qc', 'Jh', 'Th'];
    const hand = evaluateHand(seven);
    expect(hand.category).toBe('straight');
    expect(hand.tiebreakers[0]).toBe(12); // ace-high straight
  });

  it('prefers the higher-value full house among multiple candidate subsets', () => {
    // 2c 2d 2h (trips), plus 9c 9d (pair) and 3h 3d (pair) -> best full house is 2s-over-9s,
    // not 2s-over-3s, even though both are valid 5-card full houses within these 7 cards.
    const seven: Card[] = ['2c', '2d', '2h', '3h', '3d', '9c', '9d'];
    const hand = evaluateHand(seven);
    expect(hand.category).toBe('full-house');
    expect(hand.tiebreakers[0]).toBe(0); // trip rank: deuces
    expect(hand.tiebreakers[1]).toBe(7); // pair rank: nines (not treys)
  });

  it('handles exactly 6 cards', () => {
    const six: Card[] = ['Ah', 'Ad', 'Ac', 'Kh', 'Kd', '2h'];
    const hand = evaluateHand(six);
    expect(hand.category).toBe('full-house');
  });
});

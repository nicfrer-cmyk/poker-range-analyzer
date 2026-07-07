import { describe, it, expect } from 'vitest';
import type { Card, Combo } from '../types';
import { parseRange } from '../range';
import { calculateEquity } from '../equity';

describe('calculateEquity — preflop', () => {
  it('AA vs KK heads-up is roughly a 80-82% favorite for AA', () => {
    const hero: Combo = { c1: 'Ah' as Card, c2: 'Ad' as Card };
    const villainRange = parseRange('KK');

    const result = calculateEquity({ heroCards: hero, villainRange, board: [], iterations: 8000 });

    expect(result.exact).toBe(false);
    expect(result.heroEquity).toBeGreaterThan(0.78);
    expect(result.heroEquity).toBeLessThan(0.84);
  });

  it('equity vs a wider, weaker range is higher than vs a narrower, stronger range', () => {
    const hero: Combo = { c1: 'Ah' as Card, c2: 'Kd' as Card };
    const narrowStrong = parseRange('QQ+'); // QQ, KK, AA
    const wide = parseRange('22+'); // every pocket pair, 22 through AA

    const vsNarrow = calculateEquity({ heroCards: hero, villainRange: narrowStrong, board: [], iterations: 8000 });
    const vsWide = calculateEquity({ heroCards: hero, villainRange: wide, board: [], iterations: 8000 });

    expect(vsNarrow.heroEquity).toBeLessThan(vsWide.heroEquity);
  });
});

describe('calculateEquity — river (exact enumeration)', () => {
  it('the nuts have ~100% equity (minus any tie chance) against a wide range', () => {
    // Board carries four clubs (2-3-4-5), hero holds 6c7c completing a 3-7 club straight flush.
    // No higher straight flush is possible (would need 8c/9c on the board, which isn't there),
    // so this is the unbeatable nuts with this exact board.
    const board: Card[] = ['2c', '3c', '4c', '5c', '9d'];
    const hero: Combo = { c1: '6c' as Card, c2: '7c' as Card };
    const villainRange = parseRange('22+,A2+,K2+,Q2+,J2+,T2+,92+,82+,72+,62+,52+,42+,32+');

    const result = calculateEquity({ heroCards: hero, villainRange, board });

    expect(result.exact).toBe(true);
    expect(result.tieEquity).toBe(0);
    expect(result.heroEquity).toBeGreaterThan(0.999);
  });
});

describe('calculateEquity — turn (exact enumeration)', () => {
  it('reports exact=true and enumerates every possible river', () => {
    const board: Card[] = ['2h', '7d', '9s', 'Kc'];
    const hero: Combo = { c1: 'Ah' as Card, c2: 'Kd' as Card }; // top pair, top kicker
    const villainRange = parseRange('QQ,JJ,TT');

    const result = calculateEquity({ heroCards: hero, villainRange, board });

    expect(result.exact).toBe(true);
    expect(result.heroEquity).toBeGreaterThan(0.7);
  });
});

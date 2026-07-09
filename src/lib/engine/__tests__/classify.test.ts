import { describe, it, expect } from 'vitest';
import type { Card, Combo } from '../types';
import { classifyHand } from '../classify';

function combo(c1: string, c2: string): Combo {
  return { c1: c1 as Card, c2: c2 as Card };
}

describe('classifyHand — made-hand tiers', () => {
  it('top pair on a dry board', () => {
    const c = classifyHand(combo('Ah', 'Kd'), ['Kc', '7s', '2h'] as Card[]);
    expect(c.madeTier).toBe('top-pair');
  });

  it('second pair', () => {
    const c = classifyHand(combo('Ah', '7d'), ['Kc', '7s', '2h'] as Card[]);
    expect(c.madeTier).toBe('second-pair');
  });

  it('bottom pair', () => {
    const c = classifyHand(combo('Ah', '2d'), ['Kc', '7s', '2h'] as Card[]);
    expect(c.madeTier).toBe('bottom-pair');
  });

  it('overpair (pocket pair above the whole board)', () => {
    const c = classifyHand(combo('Th', 'Td'), ['7c', '5s', '2h'] as Card[]);
    expect(c.madeTier).toBe('overpair');
  });

  it('underpair (pocket pair below the whole board)', () => {
    const c = classifyHand(combo('5h', '5d'), ['Kc', '9s', '7h'] as Card[]);
    expect(c.madeTier).toBe('underpair');
  });

  it('two pair (top two)', () => {
    const c = classifyHand(combo('As', 'Ks'), ['Ad', 'Kd', '7c'] as Card[]);
    expect(c.madeTier).toBe('two-pair');
  });

  it('set (pocket pair matched by exactly one board card, no other board pair)', () => {
    const c = classifyHand(combo('7s', '7d'), ['7c', 'Kh', '2d'] as Card[]);
    expect(c.madeTier).toBe('set');
  });

  it('trips (one hole card matches a board that is not paired via hero)', () => {
    const c = classifyHand(combo('Ks', '2d'), ['Kc', 'Kh', '7d'] as Card[]);
    expect(c.madeTier).toBe('trips');
  });

  it('full house', () => {
    const c = classifyHand(combo('7h', 'Kd'), ['7c', '7s', 'Kh'] as Card[]);
    expect(c.madeTier).toBe('full-house');
  });

  it('flush (made)', () => {
    const c = classifyHand(combo('Ah', '3h'), ['5h', '9h', 'Kh'] as Card[]);
    expect(c.madeTier).toBe('flush');
  });

  it('straight (made, using both hole cards to complete a board run)', () => {
    const c = classifyHand(combo('As', 'Ks'), ['Qh', 'Jd', 'Tc'] as Card[]);
    expect(c.madeTier).toBe('straight');
  });

  it('overcards (no pair, both hole cards rank above the whole board)', () => {
    const c = classifyHand(combo('As', 'Kd'), ['7c', '6h', '2s'] as Card[]);
    expect(c.madeTier).toBe('overcards');
  });

  it('air (no pair, does not connect and is not overcards)', () => {
    const c = classifyHand(combo('9s', '3d'), ['Ac', 'Kh', '7s'] as Card[]);
    expect(c.madeTier).toBe('air');
  });

  it('preflop pocket pair reports overpair (informal "best hand so far")', () => {
    const c = classifyHand(combo('9s', '9d'), []);
    expect(c.madeTier).toBe('overpair');
  });

  it('preflop non-pair reports air', () => {
    const c = classifyHand(combo('As', 'Kd'), []);
    expect(c.madeTier).toBe('air');
  });
});

describe('classifyHand — draws', () => {
  it('flush draw (4 cards of one suit, one more to come)', () => {
    const c = classifyHand(combo('Ah', 'Kh'), ['2h', '7h', '9c'] as Card[]);
    expect(c.draws).toContain('flush-draw');
  });

  it('backdoor flush draw only flagged on the flop, not the turn', () => {
    const flop = classifyHand(combo('Ah', 'Kh'), ['2h', '7c', '9c'] as Card[]);
    expect(flop.draws).toContain('backdoor-flush-draw');
    const turn = classifyHand(combo('Ah', 'Kh'), ['2h', '7c', '9c', '4d'] as Card[]);
    expect(turn.draws).not.toContain('backdoor-flush-draw');
  });

  it('open-ended straight draw', () => {
    const c = classifyHand(combo('9s', '8s'), ['7d', '6c', '2h'] as Card[]);
    expect(c.draws).toContain('open-ended-straight-draw');
    expect(c.draws).not.toContain('gutshot-straight-draw');
  });

  it('gutshot straight draw', () => {
    const c = classifyHand(combo('Js', 'Ts'), ['8d', '7c', '2h'] as Card[]);
    expect(c.draws).toContain('gutshot-straight-draw');
    expect(c.draws).not.toContain('open-ended-straight-draw');
  });

  it('wheel-type gutshot using the ace as a low card', () => {
    // A-3-4-2 present (via hole+board), needs a 5 -> gutshot wheel draw.
    const c = classifyHand(combo('As', '4d'), ['3c', '2h', 'Kd'] as Card[]);
    expect(c.draws).toContain('gutshot-straight-draw');
  });

  it('no draws on the river (no more cards to come)', () => {
    const c = classifyHand(combo('9s', '8s'), ['7d', '6c', '2h', 'Kd', '3c'] as Card[]);
    expect(c.draws).toEqual([]);
  });

  it('no draws preflop', () => {
    const c = classifyHand(combo('9s', '8s'), []);
    expect(c.draws).toEqual([]);
  });
});

describe('classifyHand — board-pair edge case (hero does not connect)', () => {
  it('hero holding neither pairing rank on a paired board should not silently read as a made pair', () => {
    // Board pairs Kings; hero's A-Q doesn't touch a King or a 7 at all.
    const c = classifyHand(combo('As', 'Qd'), ['Kc', 'Kh', '7d'] as Card[]);
    // Whatever label this resolves to, it must NOT be reported as "air" while secretly being
    // a made pair at showdown (evaluateHand would score this as a pair of Kings). "air" is only
    // correct here if it's describing hero's own contribution, not hero's showdown strength.
    expect(['air', 'overcards']).toContain(c.madeTier);
  });
});

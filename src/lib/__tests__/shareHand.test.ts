import { describe, it, expect } from 'vitest';
import { encodeSharedHand, decodeSharedHand } from '../shareHand';
import type { StoredHand } from '../localHandStore';

const sampleHand: StoredHand = {
  id: 'hand_1',
  heroCards: ['Ah', 'Kd'],
  board: ['2c', '7h', 'Jd'],
  villainRange: '22-JJ,AJs+,KQs',
  villainRangeTextRaw: '22-JJ,AJs+,KQs',
  position: 'BTN',
  potSize: 40,
  street: 'flop',
  equityAtDecision: 0.62,
  potOddsRequired: 0.3,
  actionTaken: 'call',
  evLossEstimate: 0.03,
  timestamp: 1700000000000,
  handCategory: 'top-pair',
  tags: ['אגרסיבי'],
  source: 'manual',
  note: 'הערה בעברית עם רווחים ותווים מיוחדים !@#',
};

describe('shareHand encode/decode round trip', () => {
  it('round-trips the fields the shared view needs, including Hebrew text', () => {
    const encoded = encodeSharedHand(sampleHand);
    const decoded = decodeSharedHand(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.heroCards).toEqual(sampleHand.heroCards);
    expect(decoded?.board).toEqual(sampleHand.board);
    expect(decoded?.position).toBe(sampleHand.position);
    expect(decoded?.street).toBe(sampleHand.street);
    expect(decoded?.equityAtDecision).toBe(sampleHand.equityAtDecision);
    expect(decoded?.actionTaken).toBe(sampleHand.actionTaken);
    expect(decoded?.evLossEstimate).toBe(sampleHand.evLossEstimate);
    expect(decoded?.handCategory).toBe(sampleHand.handCategory);
    expect(decoded?.villainRange).toBe(sampleHand.villainRange);
    expect(decoded?.note).toBe(sampleHand.note);
  });

  it('produces a URL-safe string with no "/" or "+"', () => {
    const encoded = encodeSharedHand(sampleHand);
    expect(encoded).not.toMatch(/[/+]/);
  });

  it('returns null for garbage input instead of throwing', () => {
    expect(decodeSharedHand('not-valid-base64!!!')).toBeNull();
    expect(decodeSharedHand('')).toBeNull();
  });
});

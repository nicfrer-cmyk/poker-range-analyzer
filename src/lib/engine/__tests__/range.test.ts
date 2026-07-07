import { describe, it, expect } from 'vitest';
import { parseRange, rangeToCombos, comboFromKey } from '../range';
import { cardRank, cardSuit } from '../deck';

describe('parseRange — single combos', () => {
  it('parses a pocket pair into 6 combos', () => {
    const range = parseRange('AA');
    expect(range.size).toBe(6);
  });

  it('parses a suited combo into 4 combos, all same-suited', () => {
    const range = parseRange('AKs');
    expect(range.size).toBe(4);
    for (const combo of rangeToCombos(range)) {
      expect(cardSuit(combo.c1)).toBe(cardSuit(combo.c2));
      expect([cardRank(combo.c1), cardRank(combo.c2)].sort()).toEqual(['A', 'K'].sort());
    }
  });

  it('parses an offsuit combo into 12 combos, none same-suited', () => {
    const range = parseRange('AKo');
    expect(range.size).toBe(12);
    for (const combo of rangeToCombos(range)) {
      expect(cardSuit(combo.c1)).not.toBe(cardSuit(combo.c2));
    }
  });

  it('a bare two-rank token (no s/o) includes both suited and offsuit: 16 combos', () => {
    const range = parseRange('AK');
    expect(range.size).toBe(16);
  });
});

describe('parseRange — plus ranges', () => {
  it('"22+" expands to every pocket pair, 22 through AA (13 * 6 = 78 combos)', () => {
    const range = parseRange('22+');
    expect(range.size).toBe(78);
  });

  it('"ATs+" expands to ATs, AJs, AQs, AKs (4 combos each = 16 total)', () => {
    const range = parseRange('ATs+');
    expect(range.size).toBe(16);
    const ranksSeen = new Set(rangeToCombos(range).map((c) => [cardRank(c.c1), cardRank(c.c2)].sort().join('')));
    expect(ranksSeen).toEqual(new Set(['AT', 'AJ', 'AQ', 'AK'].map((s) => s.split('').sort().join(''))));
  });

  it('"KQo+" only has room for one rank step (KQo itself): 12 combos', () => {
    const range = parseRange('KQo+');
    expect(range.size).toBe(12);
  });
});

describe('parseRange — comma-separated lists', () => {
  it('parses a list of pairs into the sum of their combos', () => {
    const range = parseRange('AA,KK,QQ');
    expect(range.size).toBe(18); // 6 + 6 + 6
  });

  it('mixes pairs and suited/offsuit tokens', () => {
    const range = parseRange('AA,AKs,AKo');
    expect(range.size).toBe(6 + 4 + 12);
  });
});

describe('rangeToCombos / comboFromKey round-trip', () => {
  it('round-trips every combo key back into valid cards', () => {
    const range = parseRange('QQ+,AKs');
    for (const [key] of range.entries()) {
      const combo = comboFromKey(key);
      expect(combo.c1).toHaveLength(2);
      expect(combo.c2).toHaveLength(2);
    }
    expect(rangeToCombos(range).length).toBe(range.size);
  });
});

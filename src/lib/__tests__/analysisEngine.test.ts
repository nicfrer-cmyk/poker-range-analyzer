import { describe, it, expect } from "vitest";
import { runAnalysis, outsFromDraws } from "@/lib/analysisEngine";
import type { AnalysisInput } from "@/lib/store/analysisStore";

function baseInput(overrides: Partial<AnalysisInput>): AnalysisInput {
  return {
    gameType: "cash",
    tableSize: 6,
    smallBlind: 1,
    bigBlind: 2,
    heroPosition: "BTN",
    villainPosition: "BB",
    heroCards: [],
    board: [],
    villainRangeText: "22+,ATs+,KQo",
    pot: 100,
    toCall: 50,
    heroStack: 1000,
    numPlayers: 2,
    actionTaken: "call",
    betSize: 0,
    ...overrides,
  };
}

describe("runAnalysis — documented scenario test cases", () => {
  it("strong hand vs a dry board: hero has a big equity edge", () => {
    // Input: Hero AA on a dry K-7-2 rainbow board vs a wide range.
    const result = runAnalysis(
      baseInput({ heroCards: ["Ah", "Ad"], board: ["Kc", "7s", "2h"], villainRangeText: "22+,A2s+,K9o+" })
    )!;
    // Expected (approx): heroCategory overpair, heroEquityPct comfortably > 70%.
    expect(result.heroCategory).toBe("overpair");
    expect(result.heroEquityPct).toBeGreaterThan(70);
  });

  it("flush draw: 9 outs, rule-of-4 ≈ 36%", () => {
    // Input: Hero AhKh on 2h7h9c (flop, two cards to come).
    const result = runAnalysis(baseInput({ heroCards: ["Ah", "Kh"], board: ["2h", "7h", "9c"] }))!;
    expect(result.heroDraw).toBe("flush-draw");
    expect(result.spr.outs).toBe(9);
    expect(result.spr.outsRuleOf2And4Pct).toBe(36);
  });

  it("open-ended straight draw: 8 outs, rule-of-4 ≈ 32%", () => {
    // Input: Hero 9s8s on 7d6c2h (flop).
    const result = runAnalysis(baseInput({ heroCards: ["9s", "8s"], board: ["7d", "6c", "2h"] }))!;
    expect(result.heroDraw).toBe("open-ended-straight-draw");
    expect(result.spr.outs).toBe(8);
    expect(result.spr.outsRuleOf2And4Pct).toBe(32);
  });

  it("gutshot straight draw: 4 outs, rule-of-4 ≈ 16%", () => {
    // Input: Hero JsTs on 8d7c2h (flop).
    const result = runAnalysis(baseInput({ heroCards: ["Js", "Ts"], board: ["8d", "7c", "2h"] }))!;
    expect(result.heroDraw).toBe("gutshot-straight-draw");
    expect(result.spr.outs).toBe(4);
    expect(result.spr.outsRuleOf2And4Pct).toBe(16);
  });

  it("gutshot on the turn uses the rule-of-2 (only the river left), not rule-of-4", () => {
    const result = runAnalysis(
      baseInput({ heroCards: ["Js", "Ts"], board: ["8d", "7c", "2h", "3d"] })
    )!;
    expect(result.heroDraw).toBe("gutshot-straight-draw");
    expect(result.spr.outs).toBe(4);
    expect(result.spr.outsRuleOf2And4Pct).toBe(8);
  });

  it("overcards: no pair yet, both hole cards above the board", () => {
    const result = runAnalysis(baseInput({ heroCards: ["As", "Kd"], board: ["7c", "6h", "2s"] }))!;
    expect(result.heroCategory).toBe("overcards");
  });

  it("top pair", () => {
    const result = runAnalysis(baseInput({ heroCards: ["Ah", "Kd"], board: ["Kc", "7s", "2h"] }))!;
    expect(result.heroCategory).toBe("top-pair");
  });

  it("two pair", () => {
    const result = runAnalysis(baseInput({ heroCards: ["As", "Ks"], board: ["Ad", "Kh", "7c"] }))!;
    expect(result.heroCategory).toBe("two-pair");
  });

  it("set", () => {
    const result = runAnalysis(baseInput({ heroCards: ["7s", "7d"], board: ["7c", "Kh", "2d"] }))!;
    expect(result.heroCategory).toBe("set");
  });

  it("full house", () => {
    const result = runAnalysis(baseInput({ heroCards: ["7h", "Kd"], board: ["7c", "7s", "Kh", "2c", "3d"] }))!;
    expect(result.heroCategory).toBe("full-house");
    // On the river with no more cards to come, the hero should be ~100% (a made full house
    // beats everything in this villain range) with no live draws left.
    expect(result.heroEquityPct).toBeGreaterThan(95);
    expect(result.exact).toBe(true);
  });

  it("board pair, hero does not connect: reads as overcards, not silently as a made pair", () => {
    // Board pairs Kings; hero AhQd doesn't touch a King or a 7, but both hole cards are below
    // the board's King, so this should NOT be "overcards" either — it's genuine air.
    const result = runAnalysis(baseInput({ heroCards: ["Ah", "Qd"], board: ["Kc", "Kh", "7d"] }))!;
    expect(result.heroCategory).toBe("air");
  });

  it("board pair, hero has two overcards to it: reads as overcards (regression for the fixed inconsistency)", () => {
    const result = runAnalysis(baseInput({ heroCards: ["As", "Kd"], board: ["9c", "9h", "2d"] }))!;
    expect(result.heroCategory).toBe("overcards");
  });

  it("monotone board: hero holds none of the flush suit and shouldn't be flagged with a flush draw", () => {
    const result = runAnalysis(baseInput({ heroCards: ["Ad", "Kd"], board: ["2h", "7h", "9h"] }))!;
    expect(result.heroDraw).not.toBe("flush-draw");
    expect(result.boardTexture).toContain("שלוש-פלאש");
  });

  it("paired board texture is flagged in the coach text", () => {
    const result = runAnalysis(baseInput({ heroCards: ["Ad", "Kc"], board: ["9h", "9c", "2d"] }))!;
    expect(result.boardTexture).toContain("בורד זוגי");
  });

  it("split pot: hero and villain both play the same board straight (tie)", () => {
    // Board itself is a made 7-high straight (3-4-5-6-7); neither hero's A-2 (wheel is lower,
    // 5-high) nor a villain holding e.g. K-Q (no extension) can improve on it, so this should
    // be a full chop — hero's equity should sit at ~50% via the tie bucket, not skewed toward
    // either player.
    const result = runAnalysis(
      baseInput({
        heroCards: ["Ah", "2d"],
        board: ["3c", "4d", "5h", "6s", "7c"],
        villainRangeText: "KQo",
      })
    )!;
    expect(result.exact).toBe(true);
    expect(result.tieEquityPct).toBeGreaterThan(99);
    expect(result.heroEquityPct).toBeGreaterThan(49);
    expect(result.heroEquityPct).toBeLessThan(51);
  });

  it("hero already behind: a weak kicker loses to a range that dominates it", () => {
    const result = runAnalysis(
      baseInput({ heroCards: ["Ah", "2d"], board: ["Ac", "7s", "3h", "9d", "Kc"], villainRangeText: "AKo,AQo,AJo" })
    )!;
    expect(result.exact).toBe(true);
    // Hero has bottom kicker (A2) against a range that's exclusively better-kicker Ax hands.
    expect(result.heroEquityPct).toBeLessThan(5);
  });

  it("blockers: holding one specific card only blocks combos containing that exact card, not every combo of that rank", () => {
    // Villain range is exactly "AKs" (4 combos, one per suit: AcKc/AdKd/AhKh/AsKs). Hero holds
    // the Ah. Only the AhKh combo is physically blocked by hero holding that literal card — the
    // other 3 suited combos are still fully live. A rank-based (not exact-card) match would
    // have wrongly counted all 4 as blocked.
    const result = runAnalysis(
      baseInput({ heroCards: ["Ah", "2c"], board: ["7s", "8d", "9h"], villainRangeText: "AKs" })
    )!;
    const aceBlocker = result.blockers.find((b) => b.card === "Ah")!;
    const totalBlockedByAce =
      aceBlocker.valueCombosBlocked + aceBlocker.drawCombosBlocked + aceBlocker.bluffCombosBlocked;
    expect(totalBlockedByAce).toBe(1);
  });
});

describe("outsFromDraws", () => {
  it("sums outs across simultaneous draws and ignores backdoor draws", () => {
    expect(outsFromDraws(["flush-draw", "open-ended-straight-draw"])).toBe(17);
    expect(outsFromDraws(["backdoor-flush-draw"])).toBe(0);
    expect(outsFromDraws([])).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import {
  TRACKS,
  generateScenario,
  evaluateAnswer,
  recordAnswer,
  loadProgress,
  pickWeighted,
} from "./training";

describe("training smoke", () => {
  it("generates scenarios for every track without throwing", () => {
    for (const track of TRACKS) {
      for (let i = 0; i < 5; i++) {
        const s = generateScenario(track.id, {});
        expect(s.trackId).toBe(track.id);
        expect(s.heroCards.length).toBe(2);
        expect(Number.isFinite(s.heroEquityPct)).toBe(true);
        expect(s.actionOptions.length).toBeGreaterThan(0);
        expect(s.actionOptions).toContain(s.correctAction);
        const evalGood = evaluateAnswer(s, s.correctAction);
        expect(evalGood.correct).toBe(true);
        const wrongAction = s.actionOptions.find((a) => a !== s.correctAction);
        if (wrongAction) {
          const evalBad = evaluateAnswer(s, wrongAction);
          expect(evalBad.correct).toBe(false);
        }
      }
    }
  });

  it("pickWeighted favors heavily-weighted items over many draws", () => {
    // Tests the actual selection math `generateScenario` delegates to, without paying for real
    // scenario generation (each of which runs a Monte Carlo equity calc) — a candidate pool of
    // 5 items where one has a huge weight should win the large majority of 500 cheap draws.
    const items = ["a", "b", "c", "d", "e"];
    const weights = [1, 1, 1, 1, 21]; // "e" is heavily miss-weighted, like a real 8-miss boost
    let hitsForE = 0;
    for (let i = 0; i < 500; i++) {
      if (pickWeighted(items, weights, Math.random) === "e") hitsForE++;
    }
    // Expected ~84% (21/25); assert well above the 20% an unweighted pick would give.
    expect(hitsForE).toBeGreaterThan(250);
  });

  it("pickWeighted is deterministic for a given rng", () => {
    const items = ["a", "b", "c"];
    const weights = [1, 1, 1];
    // rng() = 0.5 -> r = 0.5 * 3 = 1.5, first subtraction (1.5-1=0.5>0), second (0.5-1=-0.5<=0) -> "b"
    expect(pickWeighted(items, weights, () => 0.5)).toBe("b");
  });

  it("records answers and updates streak/accuracy", () => {
    let progress = loadProgress();
    const s = generateScenario("preflop", {});
    const { progress: p1 } = recordAnswer(progress, s, true);
    expect(p1.totalAnswered).toBe(progress.totalAnswered + 1);
    expect(p1.currentStreak).toBe(progress.currentStreak + 1);
  });
});

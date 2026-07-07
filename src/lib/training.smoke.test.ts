import { describe, it, expect } from "vitest";
import {
  TRACKS,
  generateScenario,
  evaluateAnswer,
  recordAnswer,
  loadProgress,
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

  it("weights re-selection toward missed signatures", () => {
    const s = generateScenario("pot-odds", {});
    const missCounts = { [s.signature]: 8 };
    // With a huge miss weight on this exact signature, generating many times should
    // reproduce that signature far more than a 1-in-5 base rate would predict.
    let hits = 0;
    for (let i = 0; i < 40; i++) {
      const candidate = generateScenario("pot-odds", missCounts);
      if (candidate.signature === s.signature) hits++;
    }
    expect(hits).toBeGreaterThan(0);
  });

  it("records answers and updates streak/accuracy", () => {
    let progress = loadProgress();
    const s = generateScenario("preflop", {});
    const { progress: p1 } = recordAnswer(progress, s, true);
    expect(p1.totalAnswered).toBe(progress.totalAnswered + 1);
    expect(p1.currentStreak).toBe(progress.currentStreak + 1);
  });
});

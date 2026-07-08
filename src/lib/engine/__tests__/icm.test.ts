import { describe, it, expect } from "vitest";
import { calculateIcmEquity, icmEquityForStack } from "../icm";

describe("calculateIcmEquity — heads-up", () => {
  it("chip leader's equity sits strictly between the winner-take-all value and their raw chip-share of the pool", () => {
    const stacks = [6000, 4000];
    const payouts = [70, 30];
    const [equityLeader, equityShort] = calculateIcmEquity(stacks, payouts);

    // Closed-form for heads-up: equity_i = (stack_i * payout1 + stack_j * payout2) / total.
    const chipShareLeader = (6000 / 10000) * (70 + 30); // 60 — proportional split of the whole pool
    const wtaLeader = (6000 / 10000) * 70; // 42 — as if 2nd place paid nothing

    expect(equityLeader).toBeCloseTo(54, 5);
    expect(equityShort).toBeCloseTo(46, 5);
    expect(equityLeader).toBeGreaterThan(wtaLeader);
    expect(equityLeader).toBeLessThan(chipShareLeader);
  });

  it("sums to the total prize pool actually paid out", () => {
    const equities = calculateIcmEquity([6000, 4000], [70, 30]);
    expect((equities[0] as number) + (equities[1] as number)).toBeCloseTo(100, 6);
  });
});

describe("calculateIcmEquity — even stacks", () => {
  it("splits the prize pool exactly evenly regardless of the payout curve's shape", () => {
    const equities = calculateIcmEquity([1000, 1000, 1000, 1000], [50, 30, 15, 5]);
    for (const e of equities) expect(e).toBeCloseTo(25, 6);
  });
});

describe("calculateIcmEquity — hand-verified published example", () => {
  it("matches a hand-enumerated 3-player example (5000/3000/2000 chips, 50/30/20 payouts)", () => {
    // Cross-checked by hand: enumerating all 3! = 6 possible finish orders and weighting each by
    // its Malmuth-Harville probability (P(first) = stack/total, then recurse on the remainder):
    //   A,B,C: 0.5 * 0.6      = 0.300000
    //   A,C,B: 0.5 * 0.4      = 0.200000
    //   B,A,C: 0.3 * 5000/7000 = 0.214286
    //   B,C,A: 0.3 * 2000/7000 = 0.085714
    //   C,A,B: 0.2 * 5000/8000 = 0.125000
    //   C,B,A: 0.2 * 3000/8000 = 0.075000
    // then equity_i = sum(prob(order) * payout at i's position in that order). This is a
    // commonly-cited textbook ICM example for exactly this stack/payout combination.
    const [a, b, c] = calculateIcmEquity([5000, 3000, 2000], [50, 30, 20]);
    expect(a).toBeCloseTo(38.39, 1);
    expect(b).toBeCloseTo(32.75, 1);
    expect(c).toBeCloseTo(28.86, 1);
    expect((a as number) + (b as number) + (c as number)).toBeCloseTo(100, 6);
  });
});

describe("calculateIcmEquity — general properties", () => {
  it("a bigger stack never has lower ICM equity than a smaller stack under the same payouts", () => {
    const equities = calculateIcmEquity([8000, 5000, 3000, 1000], [50, 30, 15, 5]);
    for (let i = 0; i < equities.length - 1; i++) {
      expect(equities[i] as number).toBeGreaterThanOrEqual(equities[i + 1] as number);
    }
  });

  it("still distributes correctly when fewer positions are paid than there are players", () => {
    const equities = calculateIcmEquity([4000, 3000, 2000, 1000], [60, 40]); // only top 2 paid
    const total = equities.reduce((s, e) => s + e, 0);
    expect(total).toBeCloseTo(100, 6);
    // The shortest stack still has some equity (a chance of min-cashing), but strictly less
    // than the chip leader's.
    expect(equities[3] as number).toBeGreaterThan(0);
    expect(equities[3] as number).toBeLessThan(equities[0] as number);
  });

  it("a single remaining player takes the entire 1st-place payout", () => {
    expect(calculateIcmEquity([5000], [100])).toEqual([100]);
  });

  it("throws on non-positive stacks", () => {
    expect(() => calculateIcmEquity([1000, 0], [50, 50])).toThrow();
    expect(() => calculateIcmEquity([1000, -500], [50, 50])).toThrow();
  });
});

describe("icmEquityForStack", () => {
  it("shows increased equity when a hypothetical call would grow the hero's stack", () => {
    const stacks = [5000, 3000, 2000];
    const payouts = [50, 30, 20];
    const before = calculateIcmEquity(stacks, payouts)[0] as number;
    const { heroEquity: after } = icmEquityForStack(stacks, payouts, 0, 7000);
    expect(after).toBeGreaterThan(before);
  });

  it("busting out (stack becomes 0) gives exactly the last-place payout, and redistributes the rest via ICM among survivors", () => {
    const stacks = [5000, 3000, 2000];
    const payouts = [50, 30, 20];
    const { heroEquity, allEquities } = icmEquityForStack(stacks, payouts, 0, 0);

    expect(heroEquity).toBeCloseTo(20, 6); // last of 3 players -> 3rd-place money, deterministically
    const survivorTotal = (allEquities[1] as number) + (allEquities[2] as number);
    expect(survivorTotal).toBeCloseTo(80, 6); // whatever's left of the $100 pool

    // Survivors' equity split between themselves should match a plain 2-player ICM over just
    // their own stacks (same global payout table).
    const survivorEquities = calculateIcmEquity([3000, 2000], payouts);
    expect(allEquities[1]).toBeCloseTo(survivorEquities[0] as number, 6);
    expect(allEquities[2]).toBeCloseTo(survivorEquities[1] as number, 6);
  });
});

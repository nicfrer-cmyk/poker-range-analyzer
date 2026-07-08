/**
 * Independent Chip Model (ICM) — converts tournament chip stacks into $ equity given a payout
 * structure, using the standard Malmuth-Harville recursive model:
 *
 *  - The probability a player finishes 1st is proportional to their share of the total chips
 *    in play.
 *  - Conditional on a particular player finishing 1st, the remaining players' probabilities of
 *    every subsequent placement are computed the same way, recursively, over their own stacks
 *    (i.e. as if a brand-new, smaller tournament started among just the players left).
 *
 * Naively summing over every permutation of finish order is O(n!), which blows up fast for more
 * than a handful of players. The key trick used here: a state's future payout distribution only
 * depends on *which* players are still live — never on the order the already-busted players
 * finished in. So the recursion is memoized by the bitmask of still-live player indices, which
 * drops the cost to O(2^n * n) — trivial for any realistic tournament field.
 */

const MAX_PLAYERS = 22; // 2^22 subsets * O(n) work each is still sub-second; comfortably covers any real final table or bubble situation.

function popcount(mask: number): number {
  let count = 0;
  let m = mask;
  while (m) {
    m &= m - 1;
    count++;
  }
  return count;
}

/**
 * Computes each player's ICM dollar equity given their chip stacks and a payout structure.
 *
 * @param stacks Chip counts for each remaining player, in any order. Must all be positive
 *   finite numbers — a player who has already busted (stack 0) isn't "remaining" and shouldn't
 *   be included (see `icmEquityForStack` below for modeling a hero busting out).
 * @param payouts Prize money for 1st, 2nd, 3rd, ... place, in order. If there are fewer payout
 *   entries than players, every position beyond the last paid one is treated as $0 — this is
 *   normal (e.g. computing equities for an entire remaining field when only the top few places
 *   are paid), not an error.
 * @returns $ equity for each player, in the same order as `stacks`. Always sums to
 *   `sum(payouts)` (the total prize pool actually being distributed among these players).
 */
export function calculateIcmEquity(stacks: number[], payouts: number[]): number[] {
  const n = stacks.length;
  if (n === 0) return [];
  if (stacks.some((s) => !Number.isFinite(s) || s <= 0)) {
    throw new Error("ICM stacks must all be positive numbers.");
  }
  if (payouts.some((p) => !Number.isFinite(p) || p < 0)) {
    throw new Error("ICM payouts must all be non-negative numbers.");
  }
  if (n > MAX_PLAYERS) {
    throw new Error(`ICM calculation supports at most ${MAX_PLAYERS} remaining players.`);
  }

  const fullMask = (1 << n) - 1;
  const memo = new Map<number, number[]>();

  function solve(mask: number): number[] {
    const cached = memo.get(mask);
    if (cached) return cached;

    const result = new Array<number>(n).fill(0);
    if (mask === 0) {
      memo.set(mask, result);
      return result;
    }

    const remainingCount = popcount(mask);
    // 0-based position index: this recursion level decides who takes finishing place
    // `position + 1` among the *original* n players.
    const position = n - remainingCount;
    const payout = position < payouts.length ? (payouts[position] as number) : 0;

    let total = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) total += stacks[i] as number;
    }

    for (let i = 0; i < n; i++) {
      if (!(mask & (1 << i))) continue;
      const pWin = (stacks[i] as number) / total;
      result[i] = (result[i] as number) + pWin * payout;
      if (remainingCount > 1) {
        const subMask = mask & ~(1 << i);
        const subResult = solve(subMask);
        for (let j = 0; j < n; j++) {
          if (subMask & (1 << j)) result[j] = (result[j] as number) + pWin * (subResult[j] as number);
        }
      }
    }

    memo.set(mask, result);
    return result;
  }

  return solve(fullMask);
}

export interface IcmDelta {
  /** Hero's $ ICM equity for the given hypothetical stack. */
  heroEquity: number;
  /** $ ICM equity for every player (same order as the input `stacks`), after the hypothetical change. */
  allEquities: number[];
}

/**
 * Convenience for a poker decision ("if I call/fold this all-in, my stack becomes X") — returns
 * the hero's new $ ICM equity (and everyone else's) after hypothetically changing just the
 * hero's stack, holding every other player's stack fixed. Compare the result's `heroEquity`
 * against `calculateIcmEquity(stacks, payouts)[heroIndex]` (the hero's *current* equity) to get
 * the $ swing a decision represents.
 *
 * `newHeroStack` may be 0 (the hero busts, e.g. loses the all-in) — handled as a special case
 * rather than fed into `calculateIcmEquity` directly, since a stack of 0 can't be assigned a
 * finishing-position probability by the proportional-to-stack formula (that would require
 * dividing by a stack of 0 once the hero is the only "live" player left in the recursion). A
 * bust is instead deterministic: the hero takes the last-place finish among the original field,
 * and every remaining player's equity becomes a fresh ICM calculation over just their own
 * stacks (still against the same global payout table).
 */
export function icmEquityForStack(
  stacks: number[],
  payouts: number[],
  heroIndex: number,
  newHeroStack: number
): IcmDelta {
  if (newHeroStack <= 0) {
    const survivorStacks = stacks.filter((_, i) => i !== heroIndex);
    const survivorEquities = survivorStacks.length > 0 ? calculateIcmEquity(survivorStacks, payouts) : [];
    const lastPosition = stacks.length - 1; // 0-based: last place among the original field
    const heroEquity = lastPosition < payouts.length ? (payouts[lastPosition] as number) : 0;

    const allEquities: number[] = [];
    let survivorCursor = 0;
    for (let i = 0; i < stacks.length; i++) {
      allEquities.push(i === heroIndex ? heroEquity : (survivorEquities[survivorCursor++] as number));
    }
    return { heroEquity, allEquities };
  }

  const nextStacks = [...stacks];
  nextStacks[heroIndex] = newHeroStack;
  const allEquities = calculateIcmEquity(nextStacks, payouts);
  return { heroEquity: allEquities[heroIndex] as number, allEquities };
}

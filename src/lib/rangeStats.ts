import { parseRange, rangeEntries } from "@/lib/engine/range";

const TOTAL_STARTING_COMBOS = 1326; // C(52,2)

/** % of all 1326 possible starting hands a range notation string covers (weighted). */
export function rangeSelectionPercent(rangeText: string): number {
  if (!rangeText.trim()) return 0;
  const entries = rangeEntries(parseRange(rangeText));
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
  return (totalWeight / TOTAL_STARTING_COMBOS) * 100;
}

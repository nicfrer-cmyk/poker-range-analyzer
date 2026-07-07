export type StatusTone = "crushing" | "ahead" | "close" | "risky" | "behind" | "neutral";

export function equityTone(equityPct: number): StatusTone {
  if (equityPct >= 80) return "crushing";
  if (equityPct >= 55) return "ahead";
  if (equityPct >= 45) return "close";
  if (equityPct >= 25) return "risky";
  return "behind";
}

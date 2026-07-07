import type { StoredHand } from "@/lib/localHandStore";
import { leaksByPosition, leaksByPotSizeBucket, leaksByStreet, isGoodDecision, type LeakGroup } from "@/lib/engine/leakFinder";
import type { MadeTier } from "@/lib/engine/classify";
import { TRACKS, type TrackId, type TrainingProgress } from "@/lib/training";

export type SkillDomainId =
  | "preflop"
  | "position"
  | "rangeReading"
  | "potOdds"
  | "bluffing"
  | "valueBetting"
  | "riverPlay"
  | "tournament";

export type SkillTier = "beginner" | "developing" | "good" | "expert";

export const SKILL_TIER_LABEL: Record<SkillTier, string> = {
  beginner: "מתחיל",
  developing: "מתפתח",
  good: "טוב",
  expert: "מעולה",
};

export interface SkillDomain {
  id: SkillDomainId;
  label: string;
  description: string;
  masteryPct: number | null; // null = not enough data yet
  tier: SkillTier | null;
  sampleSize: number;
  recommendationTrackId: TrackId | null;
  note?: string;
}

export interface SkillTreeResult {
  domains: SkillDomain[];
  weakestDomain: SkillDomain | null;
}

const MIN_SAMPLE = 5;
const STRONG_TIERS = new Set<MadeTier>([
  "straight-flush", "quads", "full-house", "flush", "straight", "set", "trips",
  "two-pair", "overpair", "top-pair",
]);
const WEAK_TIERS = new Set<MadeTier>(["air", "overcards", "underpair", "bottom-pair"]);

function tierFromPct(pct: number): SkillTier {
  if (pct < 25) return "beginner";
  if (pct < 50) return "developing";
  if (pct < 75) return "good";
  return "expert";
}

function masteryFromBadRate(groups: LeakGroup[]): { masteryPct: number | null; sampleSize: number } {
  const sampleSize = groups.reduce((sum, g) => sum + g.count, 0);
  if (sampleSize < MIN_SAMPLE) return { masteryPct: null, sampleSize };
  const weightedBad = groups.reduce((sum, g) => sum + g.badDecisionRate * g.count, 0);
  const badRate = weightedBad / sampleSize;
  return { masteryPct: Math.round((1 - badRate) * 100), sampleSize };
}

function trackAccuracy(progress: TrainingProgress, trackId: TrackId): { masteryPct: number | null; sampleSize: number } {
  const stats = progress.perTrack[trackId];
  if (!stats || stats.answered < MIN_SAMPLE) return { masteryPct: null, sampleSize: stats?.answered ?? 0 };
  return { masteryPct: Math.round((stats.correct / stats.answered) * 100), sampleSize: stats.answered };
}

/** Averages any number of (masteryPct, sampleSize) sources, weighted by sample size, skipping
 *  sources with no data. Used to blend hand-derived and training-derived signals per domain. */
function blend(...sources: Array<{ masteryPct: number | null; sampleSize: number }>): {
  masteryPct: number | null;
  sampleSize: number;
} {
  const usable = sources.filter((s) => s.masteryPct !== null && s.sampleSize > 0);
  const sampleSize = sources.reduce((sum, s) => sum + s.sampleSize, 0);
  if (usable.length === 0) return { masteryPct: null, sampleSize };
  const weighted = usable.reduce((sum, s) => sum + (s.masteryPct as number) * s.sampleSize, 0);
  const weightSum = usable.reduce((sum, s) => sum + s.sampleSize, 0);
  return { masteryPct: Math.round(weighted / weightSum), sampleSize };
}

function toDomain(
  id: SkillDomainId,
  label: string,
  description: string,
  source: { masteryPct: number | null; sampleSize: number },
  recommendationTrackId: TrackId | null,
  note?: string
): SkillDomain {
  return {
    id,
    label,
    description,
    masteryPct: source.masteryPct,
    tier: source.masteryPct === null ? null : tierFromPct(source.masteryPct),
    sampleSize: source.sampleSize,
    recommendationTrackId,
    note,
  };
}

export function computeSkillTree(hands: StoredHand[], progress: TrainingProgress): SkillTreeResult {
  const preflop = blend(masteryFromBadRate(leaksByStreet(hands).filter((g) => g.key === "preflop")), trackAccuracy(progress, "preflop"));
  const position = masteryFromBadRate(leaksByPosition(hands));
  const rangeReading = trackAccuracy(progress, "range-reading");
  const potOdds = blend(masteryFromBadRate(leaksByPotSizeBucket(hands)), trackAccuracy(progress, "pot-odds"));

  const aggro = hands.filter((h) => h.actionTaken === "bet" || h.actionTaken === "raise");
  const bluffLike = aggro.filter((h) => WEAK_TIERS.has(h.handCategory as MadeTier));
  const bluffingHands = { masteryPct: bluffLike.length >= MIN_SAMPLE ? Math.round((bluffLike.filter(isGoodDecision).length / bluffLike.length) * 100) : null, sampleSize: bluffLike.length };
  const bluffing = blend(bluffingHands, trackAccuracy(progress, "common-leaks"));

  const strongNoBet = hands.filter((h) => h.potOddsRequired === 0 && STRONG_TIERS.has(h.handCategory as MadeTier));
  const wentForValue = strongNoBet.filter((h) => h.actionTaken === "bet" || h.actionTaken === "raise");
  const valueBetting = { masteryPct: strongNoBet.length >= MIN_SAMPLE ? Math.round((wentForValue.length / strongNoBet.length) * 100) : null, sampleSize: strongNoBet.length };

  const riverPlay = masteryFromBadRate(leaksByStreet(hands).filter((g) => g.key === "river"));

  const domains: SkillDomain[] = [
    toDomain("preflop", "פרה-פלופ", "החלטות פתיחה/הגנה לפני הבורד.", preflop, "preflop"),
    toDomain("position", "משחק לפי פוזיציה", "כמה טוב אתה מתאים את המשחק לפוזיציה שלך בשולחן.", position, null),
    toDomain("rangeReading", "קריאת טווחים", "זיהוי איפה היד שלך עומדת מול טווח היריב.", rangeReading, "range-reading"),
    toDomain("potOdds", "יחסי סיכוי (פוט אודס)", "התאמת ההחלטה לגודל ההימור מול הפוט.", potOdds, "pot-odds"),
    toDomain("bluffing", "בלופים", "כיול תדירות ובחירת בלופים.", bluffing, "common-leaks"),
    toDomain("valueBetting", "Value Betting", "גיבוי ערך עם ידיים חזקות במקום לתת קלף בחינם.", valueBetting, null),
    toDomain("riverPlay", "משחק ברחוב הריבר", "החלטות בריבר, כשאין עוד קלפים שיבואו.", riverPlay, null),
    toDomain(
      "tournament",
      "משחק טורניר",
      "החלטות מותאמות טורניר (ICM, סטאקים קצרים).",
      { masteryPct: null, sampleSize: 0 },
      null,
      "אין עדיין מספיק נתוני טורניר — נסה את מחשבון ה-ICM כדי להתחיל."
    ),
  ];

  const withData = domains.filter((d) => d.masteryPct !== null);
  const weakestDomain = withData.length > 0
    ? withData.reduce((worst, d) => ((d.masteryPct as number) < (worst.masteryPct as number) ? d : worst))
    : null;

  return { domains, weakestDomain };
}

export function trackLabelFor(trackId: TrackId | null): string | null {
  if (!trackId) return null;
  return TRACKS.find((t) => t.id === trackId)?.shortLabel ?? null;
}

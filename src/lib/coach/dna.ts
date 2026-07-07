import type { StoredHand } from "@/lib/localHandStore";
import type { MadeTier } from "@/lib/engine/classify";
import { isGoodDecision } from "@/lib/engine/leakFinder";

/**
 * Poker DNA — a dynamic personal-play profile computed entirely from hands already saved via
 * the analyzer/importer. No new data is captured for this: every metric is a proxy derived from
 * `StoredHand.actionTaken/handCategory/street/potOddsRequired/evLossEstimate`, the same fields
 * the leak finder already uses. Metrics are framed as observations, not verdicts.
 */

const STRONG_TIERS = new Set<MadeTier>([
  "straight-flush",
  "quads",
  "full-house",
  "flush",
  "straight",
  "set",
  "trips",
  "two-pair",
  "overpair",
  "top-pair",
]);

const WEAK_TIERS = new Set<MadeTier>(["air", "overcards", "underpair", "bottom-pair"]);

function tierOf(hand: StoredHand): MadeTier | undefined {
  return hand.handCategory as MadeTier | undefined;
}

/** No `facingBet` field is stored directly, but `potOddsRequired` is only ever non-zero when
 *  the hand had a real bet to call (see analysisEngine.ts's requiredEquityPct), so it doubles
 *  as a reliable "was hero facing a bet?" proxy without adding a new field. */
function facingBet(hand: StoredHand): boolean {
  return hand.potOddsRequired > 0;
}

export type DnaMetricId =
  | "aggressiveness"
  | "overCalling"
  | "overFolding"
  | "patience"
  | "bluffFrequency"
  | "valueBetting"
  | "riverDecisions";

export interface DnaMetric {
  id: DnaMetricId;
  label: string;
  valuePct: number | null; // null = not enough data
  sampleSize: number;
  explanation: string;
  tip: string;
}

export interface PokerDnaProfile {
  metrics: DnaMetric[];
  strengths: DnaMetric[];
  weaknesses: DnaMetric[];
}

const MIN_SAMPLE = 4;

function pct(numerator: number, denominator: number): number | null {
  if (denominator < MIN_SAMPLE) return null;
  return Math.round((numerator / denominator) * 100);
}

function computeAggressiveness(hands: StoredHand[]): DnaMetric {
  const acted = hands.filter((h) => h.actionTaken);
  const aggro = acted.filter((h) => h.actionTaken === "bet" || h.actionTaken === "raise").length;
  return {
    id: "aggressiveness",
    label: "אגרסיביות",
    valuePct: pct(aggro, acted.length),
    sampleSize: acted.length,
    explanation: "כמה מההחלטות שלך היו בט או רייז, לעומת צ'ק וקול. לא חיובי או שלילי כשלעצמו — תלוי בהקשר.",
    tip: "שווה לבדוק אם רמת האגרסיביות שלך מתאימה לחוזק היד: יותר אגרסיבי עם ידיים חזקות ודרואים טובים, פחות עם ידיים חלשות.",
  };
}

function computeOverCalling(hands: StoredHand[]): DnaMetric {
  const calls = hands.filter((h) => h.actionTaken === "call");
  const badCalls = calls.filter((h) => !isGoodDecision(h));
  return {
    id: "overCalling",
    label: "נטייה ל-Call מיותר",
    valuePct: pct(badCalls.length, calls.length),
    sampleSize: calls.length,
    explanation: "מתוך כל הקולים שרשמת, כמה מהם היו קולים שבהם האקוויטי לא הצדיק את המחיר לפי המנוע.",
    tip: "לפני שקוראים, שאל את עצמך: 'מה האקוויטי הנדרש כאן, ומה יש לי בפועל?' — תרגול פוט אודס יעזור להוריד את המדד הזה.",
  };
}

function computeOverFolding(hands: StoredHand[]): DnaMetric {
  const folds = hands.filter((h) => h.actionTaken === "fold");
  const badFolds = folds.filter((h) => !isGoodDecision(h));
  return {
    id: "overFolding",
    label: "נטייה לקיפול יתר",
    valuePct: pct(badFolds.length, folds.length),
    sampleSize: folds.length,
    explanation: "מתוך כל הפולדים שרשמת, כמה מהם היו למעשה קולים משתלמים לפי המנוע — פולד שאיבד ערך.",
    tip: "כשההימור מול קטן, בדוק את היחס בין הפוט להימור לפני שאתה מקפל — פולדים מהירים על יחסים טובים הם דליפה נפוצה.",
  };
}

function computePatience(hands: StoredHand[]): DnaMetric {
  const weakPreflop = hands.filter(
    (h) => h.street === "preflop" && WEAK_TIERS.has(tierOf(h) as MadeTier)
  );
  const disciplinedFolds = weakPreflop.filter((h) => h.actionTaken === "fold");
  return {
    id: "patience",
    label: "סבלנות",
    valuePct: pct(disciplinedFolds.length, weakPreflop.length),
    sampleSize: weakPreflop.length,
    explanation: "מתוך ידיים חלשות פרה-פלופ, כמה מהן ויתרת עליהן במקום להמשיך בהן.",
    tip: "יד חלשה פרה-פלופ שלא משתלמת להמשיך בה — פולד מוקדם חוסך צ'יפים לטווח הארוך.",
  };
}

function computeBluffFrequency(hands: StoredHand[]): DnaMetric {
  const aggro = hands.filter((h) => h.actionTaken === "bet" || h.actionTaken === "raise");
  const bluffLike = aggro.filter((h) => WEAK_TIERS.has(tierOf(h) as MadeTier));
  return {
    id: "bluffFrequency",
    label: "תדירות בלופים",
    valuePct: pct(bluffLike.length, aggro.length),
    sampleSize: aggro.length,
    explanation: "מתוך כל הבטים/רייזים שלך, כמה מהם נעשו עם יד חלשה (הערכה גסה של בלופים, לא סיווג GTO מדויק).",
    tip: "בלופים אקראיים לגמרי קלים לקריאה. שווה לבסס בלופים על בלוקרים ועל טווח שהיריב לא יכול להתמודד איתו טוב.",
  };
}

function computeValueBetting(hands: StoredHand[]): DnaMetric {
  const strongNoBet = hands.filter((h) => !facingBet(h) && STRONG_TIERS.has(tierOf(h) as MadeTier));
  const wentForValue = strongNoBet.filter((h) => h.actionTaken === "bet" || h.actionTaken === "raise");
  return {
    id: "valueBetting",
    label: "נטייה ל-Value Betting",
    valuePct: pct(wentForValue.length, strongNoBet.length),
    sampleSize: strongNoBet.length,
    explanation: "כשלא היה הימור לענות עליו והיד שלך הייתה חזקה, כמה פעמים בחרת להמר ולגבות ערך במקום לצ'ק.",
    tip: "יד חזקה שצ'קית בלי הימור מפסידה ערך — כשאתה חושב שהיריב יכול לקרוא, המר.",
  };
}

function computeRiverDecisions(hands: StoredHand[]): DnaMetric {
  const river = hands.filter((h) => h.street === "river");
  const good = river.filter(isGoodDecision);
  return {
    id: "riverDecisions",
    label: "קבלת החלטות ב-River",
    valuePct: pct(good.length, river.length),
    sampleSize: river.length,
    explanation: "אחוז ההחלטות שלך בריבר שהיו קרובות להחלטה הטובה ביותר לפי המנוע.",
    tip: "בריבר אין עוד קלפים שיבואו — ההחלטה תלויה כולה בקריאת טווח היריב ובגודל הפוט. תרגול קריאת טווחים יעזור כאן.",
  };
}

export function computePokerDNA(hands: StoredHand[]): PokerDnaProfile {
  const metrics = [
    computeAggressiveness(hands),
    computeOverCalling(hands),
    computeOverFolding(hands),
    computePatience(hands),
    computeBluffFrequency(hands),
    computeValueBetting(hands),
    computeRiverDecisions(hands),
  ];

  // "Strengths"/"weaknesses" only make sense for metrics where a higher number is unambiguously
  // good; the leak-flavored metrics (over-calling/over-folding/bluff frequency) are framed as
  // observations on their own page instead of being ranked into this list.
  const positiveMetricIds = new Set<DnaMetricId>(["patience", "valueBetting", "riverDecisions"]);
  const ranked = metrics.filter((m) => positiveMetricIds.has(m.id) && m.valuePct !== null);
  const sorted = [...ranked].sort((a, b) => (b.valuePct ?? 0) - (a.valuePct ?? 0));

  return {
    metrics,
    strengths: sorted.slice(0, 2),
    weaknesses: sorted.slice(-2).reverse(),
  };
}

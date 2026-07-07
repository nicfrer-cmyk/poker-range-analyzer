import type { Card, Combo, WeightedRange } from "@/lib/engine/types";
import { parseRange, rangeEntries, removeConflicts, rangeToCombos, comboKey } from "@/lib/engine/range";
import { calculateEquity } from "@/lib/engine/equity";
import { classifyHand, type MadeTier } from "@/lib/engine/classify";
import { createDeck, cardRank, cardSuit } from "@/lib/engine/deck";
import { rankValue } from "@/lib/engine/evaluator";
import type { AnalysisInput } from "@/lib/store/analysisStore";
import { streetFromBoard } from "@/lib/store/analysisStore";
import type {
  AnalysisResult,
  ComboBucket,
  Insight,
  NextCardOutlook,
  BlockerInfo,
} from "@/lib/analysisTypes";
import { equityTone, type StatusTone } from "@/lib/statusTone";
import { MADE_TIER_LABEL, drawsToHebrew } from "@/lib/labels";

const VALUE_TIERS = new Set<MadeTier>([
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

function toneFromDanger(level: number): StatusTone {
  if (level >= 4) return "behind"; // very dangerous / wet board
  if (level >= 3) return "risky";
  if (level >= 2) return "close";
  return "ahead"; // dry, safe board
}

function describeBoardTexture(board: Card[]): { text: string; danger: StatusTone } {
  if (board.length === 0) return { text: "אין עדיין בורד — פרה-פלופ.", danger: "ahead" };

  const ranks = board.map((c) => rankValue(cardRank(c)));
  const suits = board.map((c) => cardSuit(c));
  const suitCounts = new Map<string, number>();
  suits.forEach((s) => suitCounts.set(s, (suitCounts.get(s) ?? 0) + 1));
  const maxSuitCount = Math.max(...suitCounts.values());
  const uniqueRanks = new Set(ranks);
  const paired = uniqueRanks.size < ranks.length;
  const sortedRanks = [...uniqueRanks].sort((a, b) => a - b);
  const spread = sortedRanks.length > 1 ? sortedRanks[sortedRanks.length - 1]! - sortedRanks[0]! : 0;
  const connected = sortedRanks.length >= 3 && spread <= 4;

  let danger = 1;
  const notes: string[] = [];
  if (maxSuitCount >= 3) {
    notes.push("טקסטורת שלוש-פלאש");
    danger += 2;
  } else if (maxSuitCount === 2) {
    notes.push("דו-גוני");
    danger += 1;
  } else {
    notes.push("ריינבו");
  }
  if (paired) {
    notes.push("בורד זוגי");
    danger += 1;
  }
  if (connected) {
    notes.push("מחובר, עתיר דרואים לסטרייט");
    danger += 1;
  }
  const highCard = Math.max(...ranks);
  if (highCard >= rankValue("Q")) notes.push("בורד עם קלפים גבוהים");

  return { text: `טקסטורת הבורד: ${notes.join(", ")}.`, danger: toneFromDanger(danger) };
}

function verdictFromEquity(pct: number): { text: string; tone: StatusTone } {
  const tone = equityTone(pct);
  if (tone === "crushing") return { text: "אתה פייבוריט ענק במצב הזה.", tone };
  if (tone === "ahead") return { text: "אתה מוביל במצב הזה.", tone };
  if (tone === "close") return { text: "זה מטבע באוויר — צמוד מאוד.", tone };
  if (tone === "risky") return { text: "אתה מאחור, אבל לא הולך למוות.", tone };
  return { text: "אתה אנדרדוג משמעותי במצב הזה.", tone };
}

function outsFromDraws(draws: string[]): number {
  let outs = 0;
  if (draws.includes("flush-draw")) outs += 9;
  if (draws.includes("open-ended-straight-draw")) outs += 8;
  if (draws.includes("gutshot-straight-draw")) outs += 4;
  if (draws.includes("backdoor-flush-draw")) outs += 0; // not a live draw yet
  return outs;
}

function bucketRangeComposition(
  entries: Array<{ combo: Combo; weight: number }>,
  board: Card[]
): ComboBucket[] {
  const totals = new Map<MadeTier, { weight: number; count: number }>();
  let totalWeight = 0;
  for (const { combo, weight } of entries) {
    const { madeTier } = classifyHand(combo, board);
    const cur = totals.get(madeTier) ?? { weight: 0, count: 0 };
    cur.weight += weight;
    cur.count += 1;
    totals.set(madeTier, cur);
    totalWeight += weight;
  }
  const buckets: ComboBucket[] = [];
  totals.forEach((v, category) => {
    buckets.push({
      category,
      weight: totalWeight > 0 ? v.weight / totalWeight : 0,
      combosCount: v.count,
    });
  });
  return buckets.sort((a, b) => b.weight - a.weight);
}

function computeBlockers(
  heroCards: Card[],
  rawEntries: Array<{ combo: Combo; weight: number }>,
  board: Card[]
): BlockerInfo[] {
  return heroCards.map((heroCard) => {
    const heroRank = cardRank(heroCard);
    let value = 0;
    let draw = 0;
    let bluff = 0;
    for (const { combo } of rawEntries) {
      if (cardRank(combo.c1) !== heroRank && cardRank(combo.c2) !== heroRank) continue;
      const { madeTier, draws } = classifyHand(combo, board);
      if (VALUE_TIERS.has(madeTier)) value += 1;
      else if (draws.length > 0) draw += 1;
      else bluff += 1;
    }
    return { card: heroCard, valueCombosBlocked: value, drawCombosBlocked: draw, bluffCombosBlocked: bluff };
  });
}

export function runAnalysis(input: AnalysisInput): AnalysisResult | null {
  if (input.heroCards.length < 2 || !input.heroCards[0] || !input.heroCards[1]) return null;

  const heroCards = input.heroCards as Card[];
  const board = input.board.filter(Boolean) as Card[];
  const street = streetFromBoard(board);
  const combo: Combo = { c1: heroCards[0]!, c2: heroCards[1]! };
  const dead = [...heroCards, ...board];

  const rawRange = parseRange(input.villainRangeText);
  const villainRange = removeConflicts(rawRange, dead);
  const rawEntries = rangeEntries(rawRange);
  const entries = rangeEntries(villainRange);

  const equity = calculateEquity({ heroCards: combo, villainRange, board, iterations: 6_000 });
  const heroEquityPct = equity.heroEquity * 100;
  const tieEquityPct = equity.tieEquity * 100;
  const villainEquityPct = equity.villainEquity * 100;

  const classification = classifyHand(combo, board);
  const { text: boardTexture, danger: dangerLevel } = describeBoardTexture(board);
  const { text: verdictText, tone: verdictTone } = verdictFromEquity(heroEquityPct);

  const pot = input.pot;
  const toCall = input.toCall;
  const requiredEquityPct = toCall > 0 ? (toCall / (pot + toCall)) * 100 : 0;
  const ev = (heroEquityPct / 100) * (pot + toCall) - toCall;
  const callProfitable = heroEquityPct >= requiredEquityPct;
  const multiwayAdjustedEquityPct =
    input.numPlayers > 2
      ? Math.pow(heroEquityPct / 100, input.numPlayers - 1) * 100
      : heroEquityPct;

  const outs = outsFromDraws(classification.draws);
  const cardsToCome = street === "flop" ? 2 : street === "turn" ? 1 : 0;
  const outsRuleOf2And4Pct = outs * (cardsToCome === 2 ? 4 : 2);
  const sprValue = toCall > 0 ? input.heroStack / (pot + toCall) : input.heroStack / Math.max(pot, 1);
  const sprInterpretation =
    sprValue < 3
      ? "SPR נמוך — היד הזו בדרך להכנסת כל הצ'יפים, שחק להתחייבות."
      : sprValue < 6
      ? "SPR בינוני — יש מקום לתמרון אחרי הפלופ."
      : "SPR גבוה — עמוק ביחס לקופה, שחק בזהירות בלי יד חזקה.";

  const rangeComposition = bucketRangeComposition(entries, board);
  const blockers = computeBlockers(heroCards, rawEntries, board);

  const keyInsights: Insight[] = [];
  keyInsights.push({
    id: "equity",
    text: `ה${MADE_TIER_LABEL[classification.madeTier]} שלך עומד על ${heroEquityPct.toFixed(1)}% אקוויטי מול הטווח הזה.`,
    tone: verdictTone,
  });
  if (classification.draws.length > 0) {
    keyInsights.push({
      id: "draw",
      text: `יש לך גם דרואו חי (${drawsToHebrew(classification.draws)}) בשווי של כ-${outs} אאוטים.`,
      tone: "close",
    });
  }
  const topBucket = rangeComposition[0];
  if (topBucket) {
    keyInsights.push({
      id: "range-top",
      text: `הטווח של היריב מורכב בעיקר מ${MADE_TIER_LABEL[topBucket.category as MadeTier] ?? topBucket.category} (${(topBucket.weight * 100).toFixed(0)}% מהקומבינציות).`,
      tone: "neutral",
    });
  }
  keyInsights.push({
    id: "pot-odds",
    text: callProfitable
      ? `קול משתלם כאן: אתה צריך ${requiredEquityPct.toFixed(1)}% אקוויטי ויש לך ${heroEquityPct.toFixed(1)}%.`
      : `קול מפסיד ערך כאן: אתה צריך ${requiredEquityPct.toFixed(1)}% אקוויטי אבל יש לך רק ${heroEquityPct.toFixed(1)}%.`,
    tone: callProfitable ? "ahead" : "behind",
  });
  if (input.numPlayers > 2) {
    keyInsights.push({
      id: "multiway",
      text: `עם ${input.numPlayers} שחקנים עדיין ביד, נתח האקוויטי הריאלי שלך יורד לכ-${multiwayAdjustedEquityPct.toFixed(1)}%.`,
      tone: "risky",
    });
  }

  const whatChanged: string[] = [];
  if (street !== "preflop") {
    whatChanged.push(boardTexture);
    if (classification.draws.length > 0) {
      whatChanged.push(`ברחוב הזה קיבלת: ${drawsToHebrew(classification.draws)}.`);
    }
  }

  // Next-card outlook is deliberately NOT computed here — enumerating every remaining card
  // on the turn/river requires an exact (not Monte Carlo) equity calc per candidate card,
  // which is too slow to run on every keystroke. See `computeNextCardOutlook` below; the
  // analyze page calls it lazily, only once the user opens the Deep Analysis layer.
  const nextCardOutlook = { best: [] as NextCardOutlook[], worst: [] as NextCardOutlook[] };

  const coachMessages: string[] = [];
  coachMessages.push(verdictText);
  if (street === "preflop") {
    coachMessages.push("זו תמונת מצב של אקוויטי פרה-פלופ — המשחק אחרי הפלופ יהיה תלוי מאוד בטקסטורת הבורד.");
  } else {
    coachMessages.push(boardTexture);
  }
  coachMessages.push(
    callProfitable
      ? "מול ההימור הזה, קול עובר את סף האקוויטי הנדרש."
      : "מול ההימור הזה, פולד מפסיד פחות מקול בטווח הארוך — אלא אם יש לך אימפלייד אודס טובים או פולד אקוויטי לקחת בחשבון."
  );
  if (classification.draws.length > 0) {
    coachMessages.push("זכור: הערך של הדרואו שלך תלוי בכך שתקבל תשלום כשתפגע, לא רק בפגיעה עצמה.");
  }

  return {
    street,
    heroEquityPct,
    tieEquityPct,
    villainEquityPct,
    exact: equity.exact,
    iterations: equity.iterations,
    heroCategory: classification.madeTier,
    heroDraw: (classification.draws[0] as AnalysisResult["heroDraw"]) ?? "none",
    verdictText,
    verdictTone,
    starScore: Math.max(0, Math.min(100, Math.round(heroEquityPct))),
    boardTexture,
    dangerLevel,
    keyInsights: keyInsights.slice(0, 5),
    potOdds: { pot, toCall, requiredEquityPct, ev, callProfitable, multiwayAdjustedEquityPct },
    spr: { value: sprValue, interpretation: sprInterpretation, outs, outsRuleOf2And4Pct },
    rangeComposition,
    whatChanged,
    nextCardOutlook,
    blockers,
    coachMessages: coachMessages.slice(0, 5),
  };
}

function comboToLabel(combo: Combo): string {
  const r1 = cardRank(combo.c1);
  const r2 = cardRank(combo.c2);
  const v1 = rankValue(r1);
  const v2 = rankValue(r2);
  if (v1 === v2) return `${r1}${r2}`;
  const [hi, lo] = v1 > v2 ? [r1, r2] : [r2, r1];
  const suited = cardSuit(combo.c1) === cardSuit(combo.c2);
  return `${hi}${lo}${suited ? "s" : "o"}`;
}

/** Per-cell hero equity vs each starting-hand label present in the villain range, for the
 *  deep-analysis heatmap matrix. Uses one representative combo per label (not the full combo
 *  set) and a reduced iteration count, since this needs to run up to ~169 times per render. */
export function computeMatrixEquities(
  heroCombo: Combo,
  board: Card[],
  villainRange: WeightedRange
): Record<string, number> {
  const byLabel = new Map<string, Combo>();
  for (const { combo } of rangeEntries(villainRange)) {
    const label = comboToLabel(combo);
    if (!byLabel.has(label)) byLabel.set(label, combo);
  }

  const result: Record<string, number> = {};
  byLabel.forEach((combo, label) => {
    const singleRange: WeightedRange = new Map([[comboKey(combo), 1]]);
    const eq = calculateEquity({
      heroCards: heroCombo,
      villainRange: singleRange,
      board,
      iterations: 600,
    });
    result[label] = eq.heroEquity * 100;
  });
  return result;
}

/** Caps a range down to at most `max` combos (uniform sample) so expensive per-card lookahead
 *  loops stay fast — a representative sample is good enough for a directional "best/worst
 *  next card" indicator, which doesn't need the full range's precision. */
function capRangeForLookahead(range: WeightedRange, max: number): WeightedRange {
  const entries = [...range.entries()];
  if (entries.length <= max) return range;
  const step = entries.length / max;
  const sampled: WeightedRange = new Map();
  for (let i = 0; i < max; i++) {
    const entry = entries[Math.floor(i * step)];
    if (entry) sampled.set(entry[0], entry[1]);
  }
  return sampled;
}

/** Expensive: enumerates every remaining card and computes hero's equity if it fell next.
 *  Only valid on the flop or turn (there's no "next card" on the river). Deliberately kept
 *  out of `runAnalysis` — call this lazily (e.g. only when the user opens Deep Analysis). */
export function computeNextCardOutlook(
  input: AnalysisInput,
  heroEquityPct: number
): { best: NextCardOutlook[]; worst: NextCardOutlook[] } {
  const heroCards = input.heroCards.filter(Boolean) as Card[];
  const board = input.board.filter(Boolean) as Card[];
  const street = streetFromBoard(board);
  if (street !== "flop" && street !== "turn") return { best: [], worst: [] };

  const combo: Combo = { c1: heroCards[0]!, c2: heroCards[1]! };
  const dead = [...heroCards, ...board];
  const villainRange = capRangeForLookahead(
    removeConflicts(parseRange(input.villainRangeText), dead),
    8
  );

  const deck = createDeck().filter((c) => !dead.includes(c));
  const outlooks: NextCardOutlook[] = deck.map((card) => {
    const nextBoard = [...board, card];
    const nextEquity = calculateEquity({ heroCards: combo, villainRange, board: nextBoard });
    return {
      card,
      heroEquityDelta: nextEquity.heroEquity * 100 - heroEquityPct,
      note: "",
    };
  });
  outlooks.sort((a, b) => b.heroEquityDelta - a.heroEquityDelta);
  return { best: outlooks.slice(0, 4), worst: outlooks.slice(-4).reverse() };
}

/** Very simplified EV-loss estimate for a chosen action, used to feed the leak finder.
 *  Only models call-vs-fold correctly (no bet-sizing/bluff model yet), so bet/raise/check
 *  are treated as EV-neutral for now. */
export function estimateEvLoss(
  result: AnalysisResult,
  action: "fold" | "check" | "call" | "bet" | "raise"
): number {
  const { ev, callProfitable } = result.potOdds;
  if (action === "fold") return callProfitable ? Math.max(0, ev) : 0;
  if (action === "call") return callProfitable ? 0 : Math.max(0, -ev);
  return 0;
}

export { rangeToCombos };

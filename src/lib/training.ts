import type { Card } from "@/lib/engine/types";
import { createDeck, shuffleDeck, cardRank, cardSuit } from "@/lib/engine/deck";
import { parseRange } from "@/lib/engine/range";
import { calculateEquity } from "@/lib/engine/equity";
import { classifyHand, type HandClassification } from "@/lib/engine/classify";
import { rankValue } from "@/lib/engine/evaluator";
import type { ActionTaken } from "@/lib/engine/leakFinder";
import { PRESET_RANGES, type PresetRangeKey } from "@/lib/presetRanges";
import { MADE_TIER_LABEL, drawsToHebrew } from "@/lib/labels";
import { incrementToday } from "@/lib/usageTracker";

/**
 * Training Mode — a spaced-repetition-style quiz built directly on top of the real equity
 * engine (src/lib/engine). Every scenario is dealt from a shuffled deck, run through
 * `calculateEquity`, and the "correct" action is derived with a simple, honest pot-odds
 * heuristic (required equity = toCall / (pot + toCall)). This is intentionally NOT a GTO
 * solver — it teaches equity/pot-odds reasoning in plain language, never money/EV framing.
 */

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

export type TrackId =
  | "preflop"
  | "range-reading"
  | "pot-odds"
  | "board-texture"
  | "common-leaks";

export interface TrackInfo {
  id: TrackId;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
}

export const TRACKS: TrackInfo[] = [
  {
    id: "preflop",
    label: "יסודות פרה-פלופ",
    shortLabel: "פרה-פלופ",
    description: "החלטות מול פתיחה/העלאה לפני שיוצא בורד — קול, פולד או 3-בט.",
    icon: "🂡",
  },
  {
    id: "range-reading",
    label: "קריאת טווחים",
    shortLabel: "קריאת טווחים",
    description: "תרגול לזהות איפה היד שלך עומדת מול טווח היריב על בורד גלוי.",
    icon: "🧠",
  },
  {
    id: "pot-odds",
    label: "יחסי סיכוי (פוט אודס)",
    shortLabel: "פוט אודס",
    description: "כל שאלה כוללת הימור לענות עליו — תרגלו אקוויטי נדרש מול אקוויטי אמיתי.",
    icon: "🎯",
  },
  {
    id: "board-texture",
    label: "קריאת מרקם בורד",
    shortLabel: "מרקם בורד",
    description: "בורדים זוגיים, חד-צבעיים ומחוברים — איך המרקם משנה את ההחלטה.",
    icon: "🃏",
  },
  {
    id: "common-leaks",
    label: "טעויות נפוצות",
    shortLabel: "טעויות נפוצות",
    description: "תרחישים שמדמים דפוסי טעות שכיחים, כמו הגנת יתר או רדיפה אחרי דרואו חלש.",
    icon: "⚠️",
  },
];

export function getTrack(id: TrackId): TrackInfo {
  return TRACKS.find((t) => t.id === id) ?? (TRACKS[0] as TrackInfo);
}

// ---------------------------------------------------------------------------
// Scenario model
// ---------------------------------------------------------------------------

export type TrainingAction = ActionTaken;

export const ACTION_LABEL_HE: Record<TrainingAction, string> = {
  fold: "פולד",
  check: "צ׳ק",
  call: "קול (השלמה)",
  bet: "בט (הימור)",
  raise: "רייז (העלאה)",
};

const PRESET_RANGE_LABEL_HE: Record<PresetRangeKey, string> = {
  UTG: "פתיחה מפוזיציה מוקדמת (UTG)",
  CO: "פתיחה מהקאט-אוף (CO)",
  BTN: "פתיחה מהכפתור (BTN)",
  SB: "פתיחה מהבליינד הקטן (SB)",
  BB_DEFENSE: "טווח הגנה של הביג-בליינד (BB)",
  "3BET": "טווח 3-בט",
  "4BET": "טווח 4-בט",
};

export interface BoardTextureInfo {
  tag: string;
  label: string;
  paired: boolean;
  monotone: boolean;
  twoTone: boolean;
  connected: boolean;
}

export interface TrainingScenario {
  id: string;
  trackId: TrackId;
  heroCards: [Card, Card];
  board: Card[];
  villainRangeKey: PresetRangeKey;
  villainRangeLabel: string;
  pot: number;
  toCall: number;
  facingBet: boolean;
  actionOptions: TrainingAction[];
  heroEquityPct: number;
  requiredEquityPct: number;
  marginPct: number;
  correctAction: TrainingAction;
  classification: HandClassification;
  boardTexture: BoardTextureInfo | null;
  leakFlavor?: string;
  iterations: number;
  exact: boolean;
  /** Coarse "kind of situation" key used for spaced-repetition weighting — not unique per deal. */
  signature: string;
}

export interface AnswerEvaluation {
  correct: boolean;
  userAction: TrainingAction;
  correctAction: TrainingAction;
  explanation: string;
  heroEquityPct: number;
  requiredEquityPct: number;
}

// ---------------------------------------------------------------------------
// Generation internals
// ---------------------------------------------------------------------------

const TRAINING_ITERATIONS = 3000;

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function oddsRatioLabel(pot: number, toCall: number): string {
  if (toCall <= 0) return "-";
  const g = gcd(Math.round(pot), Math.round(toCall)) || 1;
  return `${Math.round(pot / g)}:${Math.round(toCall / g)}`;
}

const BET_CONTEXTS: Array<{ pot: number; toCall: number }> = [
  { pot: 100, toCall: 50 },
  { pot: 100, toCall: 100 },
  { pot: 150, toCall: 50 },
  { pot: 80, toCall: 40 },
  { pot: 200, toCall: 50 },
  { pot: 60, toCall: 60 },
  { pot: 120, toCall: 30 },
  { pot: 90, toCall: 90 },
  { pot: 40, toCall: 20 },
];

const NO_BET_POTS = [40, 60, 80, 100, 150];

type FacingBetMode = "facing-bet" | "no-bet" | "random";

function randomBetContext(
  rng: () => number,
  mode: FacingBetMode
): { pot: number; toCall: number; facingBet: boolean } {
  const facingBet = mode === "random" ? rng() < 0.6 : mode === "facing-bet";
  if (!facingBet) {
    return { pot: pick(NO_BET_POTS, rng), toCall: 0, facingBet: false };
  }
  const ctx = pick(BET_CONTEXTS, rng);
  return { pot: ctx.pot, toCall: ctx.toCall, facingBet: true };
}

interface LeakPattern {
  id: string;
  boardLen: 0 | 3;
  villainKey: PresetRangeKey;
  facingBetMode: FacingBetMode;
  flavor: string;
}

const LEAK_PATTERNS: LeakPattern[] = [
  {
    id: "overvalue-top-pair",
    boardLen: 3,
    villainKey: "BTN",
    facingBetMode: "facing-bet",
    flavor:
      "טעות נפוצה: להתאהב מזוג עליון עם קיקר חלש ולשלם יותר מדי כשהיריב מראה כוח.",
  },
  {
    id: "ignore-position-open",
    boardLen: 0,
    villainKey: "UTG",
    facingBetMode: "facing-bet",
    flavor:
      "טעות נפוצה: להתעלם מכך שפתיחה מפוזיציה מוקדמת מייצגת טווח הדוק בהרבה מפתיחה מהכפתור.",
  },
  {
    id: "chase-weak-draw",
    boardLen: 3,
    villainKey: "CO",
    facingBetMode: "facing-bet",
    flavor:
      "טעות נפוצה: לרדוף אחרי דרואו חלש (כמו גוטשוט) בלי לבדוק אם הפוט בכלל משלם על זה.",
  },
  {
    id: "overdefend-bb",
    boardLen: 0,
    villainKey: "BTN",
    facingBetMode: "facing-bet",
    flavor:
      "טעות נפוצה: להגן יותר מדי על הביג-בליינד עם ידיים שלא שוות את הקריאה מול פתיחה מהכפתור.",
  },
  {
    id: "sunk-cost-calldown",
    boardLen: 3,
    villainKey: "CO",
    facingBetMode: "facing-bet",
    flavor:
      "טעות נפוצה: להמשיך להשקיע בפוט רק כי כבר השקעת בו, בלי לבדוק את האקוויטי מחדש בכל רחוב.",
  },
  {
    id: "missed-value-bet",
    boardLen: 3,
    villainKey: "SB",
    facingBetMode: "no-bet",
    flavor:
      "טעות נפוצה: לפחד להמר עם יד חזקה ולתת ליריב לראות קלף בחינם במקום לגבות ערך.",
  },
];

function classifyBoardTexture(board: Card[]): BoardTextureInfo {
  const ranks = board.map((c) => rankValue(cardRank(c)));
  const suits = board.map((c) => cardSuit(c));
  const suitCounts = new Map<string, number>();
  for (const s of suits) suitCounts.set(s, (suitCounts.get(s) ?? 0) + 1);
  const maxSuitCount = Math.max(...suitCounts.values());
  const uniqueRanks = new Set(ranks);
  const paired = uniqueRanks.size < ranks.length;
  const monotone = maxSuitCount >= 3;
  const twoTone = !monotone && maxSuitCount === 2 && board.length >= 3;
  const sortedRanks = [...uniqueRanks].sort((a, b) => a - b);
  const spread =
    sortedRanks.length > 1
      ? (sortedRanks[sortedRanks.length - 1] as number) - (sortedRanks[0] as number)
      : 0;
  const connected = spread <= 4;

  const labels: string[] = [];
  if (paired) labels.push("זוגי");
  if (monotone) labels.push("חד-צבעי");
  else if (twoTone) labels.push("דו-צבעי");
  if (connected) labels.push("מחובר");
  if (labels.length === 0) labels.push("יבש ומפוזר");

  const tag = [
    paired ? "paired" : "unpaired",
    monotone ? "mono" : twoTone ? "twotone" : "rainbow",
    connected ? "connected" : "disconnected",
  ].join("-");

  return { tag, label: labels.join(" · "), paired, monotone, twoTone, connected };
}

function oddsBucket(requiredEquityPct: number, facingBet: boolean): string {
  if (!facingBet) return "na";
  if (requiredEquityPct <= 25) return "<=25";
  if (requiredEquityPct <= 40) return "25-40";
  if (requiredEquityPct <= 55) return "40-55";
  return ">55";
}

const BET_THRESHOLD_PCT = 62;
const RAISE_MARGIN_PCT = 15;
const RAISE_MIN_EQUITY_PCT = 65;
const CLOSE_MARGIN_PCT = 4;

function deriveCorrectAction(
  heroEquityPct: number,
  requiredEquityPct: number,
  facingBet: boolean
): { action: TrainingAction; margin: number } {
  if (!facingBet) {
    const action: TrainingAction = heroEquityPct >= BET_THRESHOLD_PCT ? "bet" : "check";
    return { action, margin: heroEquityPct - BET_THRESHOLD_PCT };
  }
  const margin = heroEquityPct - requiredEquityPct;
  if (margin >= RAISE_MARGIN_PCT && heroEquityPct >= RAISE_MIN_EQUITY_PCT) {
    return { action: "raise", margin };
  }
  if (margin >= -CLOSE_MARGIN_PCT) {
    return { action: "call", margin };
  }
  return { action: "fold", margin };
}

function tryBuildScenario(trackId: TrackId, rng: () => number): TrainingScenario | null {
  const presetKeys = Object.keys(PRESET_RANGES) as PresetRangeKey[];

  let boardLen: 0 | 3 | 4;
  let villainKey: PresetRangeKey;
  let facingMode: FacingBetMode;
  let leakFlavor: string | undefined;

  switch (trackId) {
    case "preflop":
      boardLen = 0;
      villainKey = pick(presetKeys, rng);
      facingMode = "facing-bet";
      break;
    case "range-reading":
      boardLen = 3;
      villainKey = pick(presetKeys, rng);
      facingMode = "random";
      break;
    case "pot-odds":
      boardLen = rng() < 0.5 ? 3 : 4;
      villainKey = pick(presetKeys, rng);
      facingMode = "facing-bet";
      break;
    case "board-texture":
      boardLen = 3;
      villainKey = pick(presetKeys, rng);
      facingMode = "random";
      break;
    case "common-leaks": {
      const pattern = pick(LEAK_PATTERNS, rng);
      boardLen = pattern.boardLen;
      villainKey = pattern.villainKey;
      facingMode = pattern.facingBetMode;
      leakFlavor = pattern.flavor;
      break;
    }
    default:
      boardLen = 0;
      villainKey = pick(presetKeys, rng);
      facingMode = "random";
  }

  const villainRange = parseRange(PRESET_RANGES[villainKey].range);
  const deck = shuffleDeck(createDeck(), rng);
  const heroCards: [Card, Card] = [deck[0] as Card, deck[1] as Card];
  const board = deck.slice(2, 2 + boardLen) as Card[];

  const { pot, toCall, facingBet } = randomBetContext(rng, facingMode);

  const equity = calculateEquity({
    heroCards: { c1: heroCards[0], c2: heroCards[1] },
    villainRange,
    board,
    iterations: TRAINING_ITERATIONS,
  });

  if (Number.isNaN(equity.heroEquity)) return null;

  const heroEquityPct = equity.heroEquity * 100;
  const requiredEquityPct = facingBet ? (toCall / (pot + toCall)) * 100 : 0;
  const { action: correctAction, margin } = deriveCorrectAction(
    heroEquityPct,
    requiredEquityPct,
    facingBet
  );
  const actionOptions: TrainingAction[] = facingBet
    ? ["fold", "call", "raise"]
    : ["check", "bet"];
  const classification = classifyHand({ c1: heroCards[0], c2: heroCards[1] }, board);
  const boardTexture = board.length >= 3 ? classifyBoardTexture(board) : null;
  const bucket = oddsBucket(requiredEquityPct, facingBet);
  const signature = [
    trackId,
    classification.madeTier,
    facingBet ? "bet" : "check",
    boardTexture?.tag ?? "na",
    bucket,
  ].join("|");

  return {
    id: `scn_${Date.now()}_${Math.floor(rng() * 1e6)}`,
    trackId,
    heroCards,
    board,
    villainRangeKey: villainKey,
    villainRangeLabel: PRESET_RANGE_LABEL_HE[villainKey],
    pot,
    toCall,
    facingBet,
    actionOptions,
    heroEquityPct,
    requiredEquityPct,
    marginPct: margin,
    correctAction,
    classification,
    boardTexture,
    leakFlavor,
    iterations: equity.iterations,
    exact: equity.exact,
    signature,
  };
}

const CANDIDATES_PER_PICK = 5;
const MISS_WEIGHT_BOOST = 2.5;
const MAX_GENERATION_ATTEMPTS = 6;

function buildRawScenario(trackId: TrackId, rng: () => number): TrainingScenario | null {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const scenario = tryBuildScenario(trackId, rng);
    if (scenario) return scenario;
  }
  return null;
}

/**
 * Weighted-random pick among `items`, each with a parallel `weights[i]` (must be positive).
 * Split out from `generateScenario` so the selection math itself is unit-testable without
 * paying for real scenario generation (which runs a Monte Carlo equity calc per candidate).
 */
export function pickWeighted<T>(items: T[], weights: number[], rng: () => number): T {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let r = rng() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i] as number;
    if (r <= 0) return items[i] as T;
  }
  return items[items.length - 1] as T;
}

/**
 * Generates a new scenario for a track. Builds a handful of candidate deals and weights the
 * pick toward signatures the learner has missed before (a simple, honest stand-in for full
 * spaced repetition: wrong answers resurface more often, right answers cool off over time).
 *
 * Note on what this weighting can and can't do: each call only draws CANDIDATES_PER_PICK fresh
 * random candidates, so a specific missed signature reappearing in *this* candidate pool is
 * itself down to chance — the weighting only biases the pick *among whatever candidates come
 * up*, it doesn't search for a target signature (that would mean re-running the not-cheap
 * equity calc many times per call, which isn't worth the latency for a live user). Over many
 * calls across a session this still meaningfully skews resurfacing toward missed signatures;
 * see `pickWeighted`'s own test for a coverage of the actual selection math in isolation.
 */
export function generateScenario(
  trackId: TrackId,
  missCounts: Record<string, number> = {},
  rng: () => number = Math.random
): TrainingScenario {
  const candidates: TrainingScenario[] = [];
  for (let i = 0; i < CANDIDATES_PER_PICK; i++) {
    const s = buildRawScenario(trackId, rng);
    if (s) candidates.push(s);
  }
  if (candidates.length === 0) {
    throw new Error(`Failed to generate a training scenario for track "${trackId}"`);
  }

  const weights = candidates.map((c) => 1 + (missCounts[c.signature] ?? 0) * MISS_WEIGHT_BOOST);
  return pickWeighted(candidates, weights, rng);
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

function buildExplanation(s: TrainingScenario): string {
  const tierLabel = MADE_TIER_LABEL[s.classification.madeTier];
  const drawsSuffix =
    s.classification.draws.length > 0 ? ` ועם ${drawsToHebrew(s.classification.draws)}` : "";
  const handSentence =
    s.board.length >= 3
      ? `היד שלך על הבורד הזה מסווגת כ${tierLabel}${drawsSuffix}.`
      : s.classification.madeTier === "overpair"
        ? "לפני הבורד, יש לך זוג כיס."
        : "לפני הבורד, היד שלך לא זוגית.";

  const correctLabel = ACTION_LABEL_HE[s.correctAction];
  const openSentence = `לפי אקוויטי מול ${s.villainRangeLabel} (כ-${Math.round(
    s.heroEquityPct
  )}% אקוויטי מוערך), ההחלטה הכדאית ביותר הייתה ${correctLabel}.`;

  let reasonSentence: string;
  if (s.facingBet) {
    const ratio = oddsRatioLabel(s.pot, s.toCall);
    const oddsSentence = `כדי שקריאה תשתלם צריך אקוויטי של כ-${Math.round(
      s.requiredEquityPct
    )}% (הימור ${s.toCall} מול פוט ${s.pot}, יחס של בערך ${ratio}).`;
    if (s.correctAction === "raise") {
      reasonSentence = `${oddsSentence} האקוויטי שלך גבוה בהרבה מהנדרש, אז יש כאן מספיק כוח כדי להעלות ולדחוף את היתרון במקום רק להשלים.`;
    } else if (s.correctAction === "call") {
      reasonSentence =
        s.marginPct >= 0
          ? `${oddsSentence} האקוויטי שלך עובר את הסף הזה בנוחות, אז ההשלמה משתלמת בטווח הארוך.`
          : `${oddsSentence} זה תרחיש גבולי — האקוויטי שלך קרוב מספיק לסף כדי שההשלמה עדיין תהיה סבירה, גם בלי יתרון גדול.`;
    } else {
      reasonSentence = `${oddsSentence} האקוויטי שלך נמוך משמעותית מהנדרש, כך שהשלמה כאן מפסידה בטווח הארוך.`;
    }
  } else {
    reasonSentence =
      s.correctAction === "bet"
        ? "אין הימור לענות עליו כרגע, והיד שלך מספיק חזקה כדי לדרוש תשלום מהיריב במקום לתת לו קלף בחינם."
        : "אין הימור לענות עליו כרגע, אבל היד שלך עדיין לא מספיק חזקה כדי לדרוש ערך — עדיף לבדוק ולראות את הקלף הבא בחינם.";
  }

  const textureSentence =
    s.trackId === "board-texture" && s.boardTexture
      ? ` מרקם הבורד כאן (${s.boardTexture.label}) משפיע ישירות על כמה אפשר לסמוך על היד — בורדים כאלה משנים את התדירות שכדאי להמשיך בה.`
      : "";

  const leakSentence = s.leakFlavor ? ` ${s.leakFlavor}` : "";

  return `${openSentence} ${handSentence} ${reasonSentence}${textureSentence}${leakSentence}`;
}

export function evaluateAnswer(
  scenario: TrainingScenario,
  userAction: TrainingAction
): AnswerEvaluation {
  return {
    correct: userAction === scenario.correctAction,
    userAction,
    correctAction: scenario.correctAction,
    explanation: buildExplanation(scenario),
    heroEquityPct: scenario.heroEquityPct,
    requiredEquityPct: scenario.requiredEquityPct,
  };
}

// ---------------------------------------------------------------------------
// Progress / spaced repetition / gamification (localStorage)
// ---------------------------------------------------------------------------

const PROGRESS_KEY = "pra:training:v1";
const MAX_SIGNATURE_MISS_WEIGHT = 8;

export interface TrackStats {
  answered: number;
  correct: number;
}

export interface TrainingProgress {
  totalAnswered: number;
  totalCorrect: number;
  currentStreak: number;
  bestStreak: number;
  missCounts: Record<string, number>;
  perTrack: Record<TrackId, TrackStats>;
  earnedBadgeIds: string[];
  updatedAt: number;
}

function emptyPerTrack(): Record<TrackId, TrackStats> {
  const perTrack = {} as Record<TrackId, TrackStats>;
  for (const t of TRACKS) perTrack[t.id] = { answered: 0, correct: 0 };
  return perTrack;
}

function emptyProgress(): TrainingProgress {
  return {
    totalAnswered: 0,
    totalCorrect: 0,
    currentStreak: 0,
    bestStreak: 0,
    missCounts: {},
    perTrack: emptyPerTrack(),
    earnedBadgeIds: [],
    updatedAt: Date.now(),
  };
}

export function loadProgress(): TrainingProgress {
  if (typeof window === "undefined") return emptyProgress();
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as Partial<TrainingProgress>;
    const base = emptyProgress();
    return {
      ...base,
      ...parsed,
      perTrack: { ...base.perTrack, ...(parsed.perTrack ?? {}) },
      missCounts: parsed.missCounts ?? {},
      earnedBadgeIds: parsed.earnedBadgeIds ?? [],
    };
  } catch {
    return emptyProgress();
  }
}

function saveProgress(progress: TrainingProgress) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

export function resetProgress(): TrainingProgress {
  const fresh = emptyProgress();
  saveProgress(fresh);
  return fresh;
}

export interface BadgeDefinition {
  id: string;
  label: string;
  description: string;
  check: (p: TrainingProgress) => boolean;
}

export const BADGES: BadgeDefinition[] = [
  {
    id: "streak-5",
    label: "5 ברצף",
    description: "5 תשובות נכונות ברצף",
    check: (p) => p.bestStreak >= 5,
  },
  {
    id: "streak-10",
    label: "10 ברצף",
    description: "10 תשובות נכונות ברצף",
    check: (p) => p.bestStreak >= 10,
  },
  {
    id: "streak-25",
    label: "25 ברצף",
    description: "25 תשובות נכונות ברצף — רצף מרשים",
    check: (p) => p.bestStreak >= 25,
  },
  {
    id: "decisions-10",
    label: "10 החלטות",
    description: "10 תרגולים הושלמו",
    check: (p) => p.totalAnswered >= 10,
  },
  {
    id: "decisions-50",
    label: "50 החלטות",
    description: "50 תרגולים הושלמו",
    check: (p) => p.totalAnswered >= 50,
  },
  {
    id: "decisions-200",
    label: "200 החלטות",
    description: "200 תרגולים הושלמו — התמדה אמיתית",
    check: (p) => p.totalAnswered >= 200,
  },
  {
    id: "accuracy-80",
    label: "דיוק של 80%",
    description: "80% דיוק לפחות אחרי 20 תרגולים ומעלה",
    check: (p) => p.totalAnswered >= 20 && p.totalCorrect / p.totalAnswered >= 0.8,
  },
];

function computeEarnedBadges(p: TrainingProgress): string[] {
  return BADGES.filter((b) => b.check(p)).map((b) => b.id);
}

export interface RecordAnswerResult {
  progress: TrainingProgress;
  newlyEarnedBadges: BadgeDefinition[];
}

/**
 * Records one answered question: updates score/streak/per-track stats, and adjusts the
 * scenario signature's miss weight (up on a miss, down a notch on a correct repeat) so wrong
 * answers resurface sooner — a simple, honest spaced-repetition stand-in, not a full SRS.
 */
export function recordAnswer(
  progress: TrainingProgress,
  scenario: TrainingScenario,
  correct: boolean
): RecordAnswerResult {
  const prevTrackStats = progress.perTrack[scenario.trackId] ?? { answered: 0, correct: 0 };
  const next: TrainingProgress = {
    ...progress,
    totalAnswered: progress.totalAnswered + 1,
    totalCorrect: progress.totalCorrect + (correct ? 1 : 0),
    currentStreak: correct ? progress.currentStreak + 1 : 0,
    bestStreak: correct
      ? Math.max(progress.bestStreak, progress.currentStreak + 1)
      : progress.bestStreak,
    missCounts: { ...progress.missCounts },
    perTrack: {
      ...progress.perTrack,
      [scenario.trackId]: {
        answered: prevTrackStats.answered + 1,
        correct: prevTrackStats.correct + (correct ? 1 : 0),
      },
    },
    earnedBadgeIds: [...progress.earnedBadgeIds],
    updatedAt: Date.now(),
  };

  const cur = next.missCounts[scenario.signature] ?? 0;
  if (!correct) {
    next.missCounts[scenario.signature] = Math.min(MAX_SIGNATURE_MISS_WEIGHT, cur + 1);
  } else if (cur > 0) {
    next.missCounts[scenario.signature] = Math.max(0, cur - 1);
  }

  // Per-day/per-track counters, read by src/lib/coach/missions.ts to check today's training
  // missions (e.g. "10 reps in track X today") without duplicating a separate tracking system.
  incrementToday("training:answered");
  incrementToday(`training:${scenario.trackId}`);
  if (correct) incrementToday("training:correct");

  const earnedNow = computeEarnedBadges(next);
  const newlyEarnedBadges = BADGES.filter(
    (b) => earnedNow.includes(b.id) && !next.earnedBadgeIds.includes(b.id)
  );
  next.earnedBadgeIds = earnedNow;

  saveProgress(next);
  return { progress: next, newlyEarnedBadges };
}

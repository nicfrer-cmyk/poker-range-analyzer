"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PaywallModal } from "@/components/billing/PaywallModal";
import { RangeBuilder } from "@/components/range/RangeBuilder";
import { CardPicker } from "@/components/cards/CardPicker";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { EquityMeter } from "@/components/analysis/EquityMeter";
import { usePlan } from "@/lib/usePlan";
import { canPerformAction } from "@/lib/plan";
import { useTheme } from "@/lib/useTheme";
import type { StatusTone } from "@/lib/statusTone";
import { parseRange, rangeToCombos, removeConflicts } from "@/lib/engine/range";
import type { EquityInput, EquityResult } from "@/lib/engine/equity";
import { calculateEquityBatchInWorker } from "@/lib/engine/equityWorkerClient";
import type { Card, Combo, WeightedRange } from "@/lib/engine/types";

const PAYWALL_TITLE = "פתח ניתוח טווח מול טווח";
const PAYWALL_BODY =
  "השוואת טווח מלא מול טווח מלא — כולל עקומת התפלגות אקוויטי, לא רק מספר בודד — זמינה במנוי פרו.";

// Same iteration-count spirit as the rest of the deep-analysis surfaces (RangeExplorerPanel's
// EXPLORER_ITERATIONS, computeMatrixEquities' reduced per-cell count): the aggregate call gets
// decent precision since it only runs once per "Calculate" click.
const AGGREGATE_ITERATIONS = 6000;
// Per-combo iteration count for the distribution — deliberately much lower, since this runs once
// per sampled combo (see MAX_DISTRIBUTION_COMBOS below), mirroring how computeMatrixEquities
// trades precision for speed across ~169 heatmap cells.
const DISTRIBUTION_ITERATIONS = 500;
// Caps how many of the hero range's combos actually get their own equity calculation for the
// distribution chart — same "representative sample, not full precision" spirit the ROADMAP
// documents for the deep-analysis range heatmap (sampled to ~35 combos there too).
const MAX_DISTRIBUTION_COMBOS = 35;

// Mirrors globals.css's --color-status-* variables per theme (same values EquityMeter/Badge use)
// so the histogram bars read as the exact same "tone" language as the rest of the app.
const TONE_RGB: Record<"light" | "dark", Record<StatusTone, string>> = {
  light: { crushing: "11 122 62", ahead: "31 168 88", close: "201 154 18", risky: "224 123 34", behind: "220 61 69", neutral: "105 112 128" },
  dark: { crushing: "25 150 85", ahead: "47 190 107", close: "232 197 71", risky: "240 145 59", behind: "229 72 77", neutral: "150 158 170" },
};
const CHART_GRID: Record<"light" | "dark", { grid: string; axis: string; tooltipBg: string; tooltipBorder: string }> = {
  light: { grid: "rgb(226 229 235)", axis: "rgb(105 112 128)", tooltipBg: "rgb(255 255 255)", tooltipBorder: "rgb(226 229 235)" },
  dark: { grid: "rgb(44 49 58)", axis: "rgb(150 158 170)", tooltipBg: "rgb(13 15 19)", tooltipBorder: "rgb(44 49 58)" },
};

function sampleCombos<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = items.length / max;
  const sampled: T[] = [];
  for (let i = 0; i < max; i++) {
    const item = items[Math.floor(i * step)];
    if (item) sampled.push(item);
  }
  return sampled;
}

interface DistributionBucket {
  label: string;
  count: number;
  tone: StatusTone;
}

const BUCKET_DEFS: { label: string; min: number; max: number; tone: StatusTone }[] = [
  { label: "0-20%", min: 0, max: 20, tone: "behind" },
  { label: "20-40%", min: 20, max: 40, tone: "risky" },
  { label: "40-60%", min: 40, max: 60, tone: "close" },
  { label: "60-80%", min: 60, max: 80, tone: "ahead" },
  { label: "80-100%", min: 80, max: 100.001, tone: "crushing" },
];

/** Builds the sampled combo list + one EquityInput per combo — cheap, stays on the main thread.
 *  The actual equity math for each of these runs in the worker (see runCalculate), batched
 *  together with the aggregate calc in a single postMessage round trip. */
function buildDistributionInputs(heroRange: WeightedRange, villainRange: WeightedRange, board: Card[]) {
  const heroCombos = rangeToCombos(heroRange);
  const sampled = sampleCombos(heroCombos, MAX_DISTRIBUTION_COMBOS);
  const inputs: EquityInput[] = sampled.map((combo) => ({
    heroCards: combo,
    villainRange,
    board,
    iterations: DISTRIBUTION_ITERATIONS,
  }));
  return { heroCombos, sampled, inputs };
}

function bucketizeDistribution(sampled: Combo[], results: EquityResult[], totalCombos: number) {
  const samples = sampled
    .map((combo, i) => ({ combo, equityPct: (results[i]?.heroEquity ?? NaN) * 100 }))
    .filter((s) => !Number.isNaN(s.equityPct));

  const buckets: DistributionBucket[] = BUCKET_DEFS.map((d) => ({
    label: d.label,
    tone: d.tone,
    count: samples.filter((s) => s.equityPct >= d.min && s.equityPct < d.max).length,
  }));

  return { buckets, sampleCount: samples.length, totalCombos };
}

/** Plain-Hebrew, numbers-specific explanation — the actual point of this feature over a regular
 *  single-hand analysis: the aggregate number hides how uneven the range's equity really is. */
function rangeVsRangeExplanation(
  heroEquityPct: number,
  buckets: DistributionBucket[],
  sampleCount: number,
  board: Card[]
): string {
  if (sampleCount === 0) return "";
  const top = buckets[buckets.length - 1] as DistributionBucket;
  const bottom = buckets[0] as DistributionBucket;
  const topPct = (top.count / sampleCount) * 100;
  const bottomPct = (bottom.count / sampleCount) * 100;
  const boardText = board.length === 0 ? "פרה-פלופ" : `מול הבורד ${board.join(" ")}`;

  return (
    `${boardText}, לטווח שלך יש ${heroEquityPct.toFixed(1)}% אקוויטי כוללת מול טווח היריב. אבל המספר הזה ` +
    `מטשטש הבדלים גדולים בתוך הטווח: ${topPct.toFixed(0)}% מהקומבינציות בטווח שלך (מתוך המדגם שנבדק) ` +
    `נהנות מ-80% אקוויטי ומעלה מול הטווח הזה, בעוד ${bottomPct.toFixed(
      0
    )}% נמצאות מתחת ל-20% — הטווח שלך הוא לא גוש אחיד, יש בו גם קומבינציות ששולטות כמעט לגמרי וגם כאלה שכמעט תמיד מפסידות.`
  );
}

type BoardSlots = [string | undefined, string | undefined, string | undefined, string | undefined, string | undefined];

export default function RangeVsRangePage() {
  const { plan } = usePlan();
  const [theme] = useTheme();
  const [paywallOpen, setPaywallOpen] = useState(false);

  const [heroRangeText, setHeroRangeText] = useState("AA,KK,QQ,AKs,AKo");
  const [villainRangeText, setVillainRangeText] = useState("22+,ATs+,KQo+");

  const [board, setBoard] = useState<BoardSlots>([undefined, undefined, undefined, undefined, undefined]);
  const [pickerIndices, setPickerIndices] = useState<number[] | null>(null);
  const filledBoard = useMemo(() => board.filter((c): c is string => Boolean(c)), [board]);
  const usedCards = useMemo(() => new Set(filledBoard), [filledBoard]);

  const [results, setResults] = useState<{
    aggregate: EquityResult;
    distribution: ReturnType<typeof bucketizeDistribution>;
    board: Card[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);

  const openBoardPicker = () => {
    const filledCount = filledBoard.length;
    if (filledCount < 3) setPickerIndices([0, 1, 2]);
    else if (filledCount === 3) setPickerIndices([3]);
    else if (filledCount === 4) setPickerIndices([4]);
  };

  const pickBoardCard = (card: string) => {
    if (!pickerIndices) return;
    const nextIndex = pickerIndices.find((i) => !board[i]);
    if (nextIndex === undefined) {
      setPickerIndices(null);
      return;
    }
    setBoard((prev) => {
      const next = [...prev] as BoardSlots;
      next[nextIndex] = card;
      return next;
    });
    const remaining = pickerIndices.filter((i) => i !== nextIndex && !board[i]);
    setPickerIndices(remaining.length > 0 ? pickerIndices : null);
  };

  const removeBoardCard = (i: number) => {
    setBoard((prev) => {
      const next = [...prev] as BoardSlots;
      next[i] = undefined;
      return next;
    });
    setResults(null);
  };

  const runCalculate = async () => {
    setError(null);

    const gate = canPerformAction(plan, "useRangeVsRange");
    if (!gate.allowed) {
      setPaywallOpen(true);
      return;
    }

    const heroRange = parseRange(heroRangeText);
    const villainRange = parseRange(villainRangeText);
    if (heroRange.size === 0 || villainRange.size === 0) {
      setError("הזן טווח תקין לשני הצדדים.");
      return;
    }

    const boardCards = filledBoard as Card[];
    if (![0, 3, 4, 5].includes(boardCards.length)) {
      setError("הבורד חייב להכיל 0, 3, 4 או 5 קלפים.");
      return;
    }

    const cleanHero = removeConflicts(heroRange, boardCards);
    const cleanVillain = removeConflicts(villainRange, boardCards);
    if (cleanHero.size === 0 || cleanVillain.size === 0) {
      setError("אחרי הסרת התנגשויות עם קלפי הבורד, אחד הטווחים התרוקן — בדוק את הטווחים או הבורד.");
      return;
    }

    setCalculating(true);
    try {
      const aggregateInput: EquityInput = {
        heroRange: cleanHero,
        villainRange: cleanVillain,
        board: boardCards,
        iterations: AGGREGATE_ITERATIONS,
      };
      const { heroCombos, sampled, inputs: distributionInputs } = buildDistributionInputs(
        cleanHero,
        cleanVillain,
        boardCards
      );

      // One worker round trip for the aggregate + every distribution sample, off the main
      // thread — this used to run synchronously and could visibly block the UI for a moment.
      const [aggregate, ...distributionResults] = await calculateEquityBatchInWorker([
        aggregateInput,
        ...distributionInputs,
      ]);
      const distribution = bucketizeDistribution(sampled, distributionResults, heroCombos.length);

      setResults({ aggregate: aggregate as EquityResult, distribution, board: boardCards });
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בחישוב האקוויטי.");
    } finally {
      setCalculating(false);
    }
  };

  const boardSlots = [0, 1, 2, 3, 4];
  const remainingToPick = pickerIndices ? pickerIndices.filter((i) => !board[i]).length : 0;
  const toneColors = TONE_RGB[theme];
  const chartColors = CHART_GRID[theme];

  const explanation = results
    ? rangeVsRangeExplanation(
        results.aggregate.heroEquity * 100,
        results.distribution.buckets,
        results.distribution.sampleCount,
        results.board
      )
    : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">אקוויטי טווח מול טווח</h1>
          <p className="mt-1 text-sm text-base-muted">
            השווה את כל הטווח שלך מול כל הטווח של היריב — כולל עקומת התפלגות אקוויטי, לא רק מספר
            של יד בודדת.
          </p>
        </div>
        {plan === "FREE" && <Badge tone="neutral">תכונת פרו</Badge>}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RangeBuilder title="הטווח שלך" value={heroRangeText} onChange={setHeroRangeText} />
        <RangeBuilder title="הטווח של היריב" value={villainRangeText} onChange={setVillainRangeText} />
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>בורד (אופציונלי)</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-3">
          <div className="flex gap-2">
            {boardSlots.map((i) => {
              const filled = board[i];
              const isNextGroupStart =
                (i === 0 && filledBoard.length === 0) ||
                (i === 3 && filledBoard.length === 3) ||
                (i === 4 && filledBoard.length === 4);
              if (!filled && !isNextGroupStart && !(i < 3 && filledBoard.length < 3)) {
                return <div key={i} className="w-12" />;
              }
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => (filled ? removeBoardCard(i) : openBoardPicker())}
                  title={filled ? "לחץ להסרה" : "לחץ להוספה"}
                >
                  <PlayingCard card={filled} size="md" faceDown={!filled} />
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-base-muted/80">
            לחיצה על הפלופ פותחת בחירה של 3 קלפים ברצף אחד. ניתן להשאיר את הבורד ריק לניתוח
            פרה-פלופ.
          </p>

          {pickerIndices && (
            <div className="rounded-lg border border-base-border bg-base-panel2 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-base-muted">
                  {remainingToPick > 1 ? `בחר ${remainingToPick} קלפים לבורד` : "בחר קלף לבורד"}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setPickerIndices(null)}>
                  סגור
                </Button>
              </div>
              <CardPicker usedCards={usedCards} onPick={pickBoardCard} />
            </div>
          )}
        </PanelBody>
      </Panel>

      {error && (
        <Panel className="border-status-risky/40">
          <PanelBody className="py-3 text-sm text-status-risky">{error}</PanelBody>
        </Panel>
      )}

      <Button onClick={runCalculate} disabled={calculating}>
        {calculating ? "מחשב…" : "חשב אקוויטי טווח מול טווח"}
      </Button>

      {results && (
        <>
          <Panel>
            <PanelBody className="flex flex-col items-center gap-5 py-6 sm:flex-row sm:items-center sm:justify-between">
              <EquityMeter equityPct={results.aggregate.heroEquity * 100} />
              <div className="flex-1 space-y-3 text-center sm:text-start">
                <p className="text-sm text-base-muted">
                  {results.aggregate.exact
                    ? "חישוב מדויק"
                    : `${results.aggregate.iterations.toLocaleString()} סימולציות`}
                </p>
                <div className="flex justify-center gap-4 sm:justify-start">
                  <div className="text-center">
                    <p className="text-base font-bold text-status-ahead">
                      {(results.aggregate.heroEquity * 100).toFixed(1)}%
                    </p>
                    <p className="text-[11px] text-base-muted">הטווח שלך</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-base-muted">
                      {(results.aggregate.tieEquity * 100).toFixed(1)}%
                    </p>
                    <p className="text-[11px] text-base-muted">תיקו</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-status-behind">
                      {(results.aggregate.villainEquity * 100).toFixed(1)}%
                    </p>
                    <p className="text-[11px] text-base-muted">טווח היריב</p>
                  </div>
                </div>
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>התפלגות אקוויטי בטווח שלך</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-3">
              <p className="text-xs text-base-muted">
                מבוסס על מדגם של {results.distribution.sampleCount} מתוך {results.distribution.totalCombos}{" "}
                קומבינציות בטווח שלך (כדי לשמור על תגובתיות) — אינדיקציה כיוונית, לא דיוק מלא.
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={results.distribution.buckets}>
                    <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="label" stroke={chartColors.axis} fontSize={11} />
                    <YAxis stroke={chartColors.axis} fontSize={11} allowDecimals={false} />
                    <Tooltip
                      formatter={(value: number) => [`${value} קומבינציות`, "כמות"]}
                      contentStyle={{
                        background: chartColors.tooltipBg,
                        border: `1px solid ${chartColors.tooltipBorder}`,
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {results.distribution.buckets.map((b, i) => (
                        <Cell key={i} fill={`rgb(${toneColors[b.tone]})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </PanelBody>
          </Panel>

          {explanation && (
            <Panel>
              <PanelBody>
                <p className="text-sm leading-relaxed text-base-text/90">{explanation}</p>
              </PanelBody>
            </Panel>
          )}
        </>
      )}

      <PaywallModal
        open={paywallOpen}
        title={PAYWALL_TITLE}
        message={PAYWALL_BODY}
        primaryLabel="שדרג לפרו"
        secondaryLabel="המשך בחינם"
        onSecondaryClick={() => {}}
        hideFooterNote
        onClose={() => setPaywallOpen(false)}
      />
    </div>
  );
}

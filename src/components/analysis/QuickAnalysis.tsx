"use client";

import { useEffect, useState } from "react";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { CardPicker } from "@/components/cards/CardPicker";
import { Button } from "@/components/ui/Button";
import { ResultsSummaryBar, type ResultsSummaryStats } from "@/components/analysis/ResultsSummaryBar";
import { useAnalysisStore } from "@/lib/store/analysisStore";
import { runAnalysis, outsFromDraws } from "@/lib/analysisEngine";
import { classifyHand, type MadeTier } from "@/lib/engine/classify";
import { MADE_TIER_LABEL, drawsToHebrew } from "@/lib/labels";
import type { Card, Combo } from "@/lib/engine/types";
import type { AnalysisResult } from "@/lib/analysisTypes";
import type { StatusTone } from "@/lib/statusTone";
import { saveHand, listHands } from "@/lib/localHandStore";
import { canPerformAction } from "@/lib/plan";
import { useMockPlan } from "@/lib/useMockPlan";

type PickerTarget = { kind: "hero"; index: 0 | 1 } | { kind: "board"; indices: number[] };

/** Nut-ish tiers -> "crushing", strong made hands -> "ahead", marginal made hands -> "close",
 *  air -> "risky" if it at least has a live draw, otherwise "behind". This is a display-only
 *  heuristic for coloring the strength badge; it is not used anywhere in the actual equity math. */
const PREMIUM_TIERS = new Set<MadeTier>([
  "straight-flush",
  "quads",
  "full-house",
  "flush",
  "straight",
  "set",
  "trips",
]);
const GOOD_TIERS = new Set<MadeTier>(["two-pair", "overpair", "top-pair"]);

function tierTone(tier: MadeTier, hasDraw: boolean): StatusTone {
  if (PREMIUM_TIERS.has(tier)) return "crushing";
  if (GOOD_TIERS.has(tier)) return "ahead";
  if (tier === "air") return hasDraw ? "risky" : "behind";
  return "close"; // second-pair, bottom-pair, underpair, overcards
}

/**
 * Fast entry point: hero's 2 cards + the flop (turn/river optional), no villain range, no
 * position, no pot sizing. Auto-computes as soon as hero + flop are filled.
 *
 * Equity-vs-classification choice: Quick Analysis intentionally does NOT show a hero-vs-villain
 * equity percentage. There is no villain range for the user to type in this mode, so any
 * head-to-head number would have to be computed against either a made-up "default" range or an
 * unlabeled leftover value in the store — both are misleading since the user never chose an
 * opponent assumption. Instead we show a hand-strength classification (via classifyHand, which
 * only looks at hero cards + board, no opponent needed at all) plus live draw/outs — an honest
 * "what do I actually have" read. `runAnalysis` is still run under the hood (against whatever
 * villain range currently lives in the shared store, usually its untouched default) purely so
 * `saveHand` and "continue to advanced" get a fully-formed AnalysisResult to work with, exactly
 * like the advanced wizard produces — that hidden number is never surfaced in this mode's UI.
 */
export function QuickAnalysis({ onContinueToAdvanced }: { onContinueToAdvanced: () => void }) {
  const { input, setHeroCard, setBoardCard, removeBoardCard, usedCards } = useAnalysisStore();
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [computing, setComputing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [plan] = useMockPlan();

  const used = usedCards();
  const heroCard0 = input.heroCards[0];
  const heroCard1 = input.heroCards[1];
  const filledBoard = input.board.filter(Boolean) as Card[];
  const boardKey = input.board.join(",");
  const heroReady = !!heroCard0 && !!heroCard1;
  const flopReady = filledBoard.length >= 3;
  const readyForQuick = heroReady && flopReady;

  const heroCombo: Combo | null =
    heroCard0 && heroCard1 ? { c1: heroCard0 as Card, c2: heroCard1 as Card } : null;

  useEffect(() => {
    if (!readyForQuick || !heroCombo) {
      setResult(null);
      return;
    }
    // TODO(plan-limits): gate quick analysis usage here once "runQuickAnalysis" exists in plan.ts
    setComputing(true);
    setSaved(false);
    const timeout = setTimeout(() => {
      setResult(runAnalysis(input));
      setComputing(false);
    }, 200);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyForQuick, heroCard0, heroCard1, boardKey]);

  const classification =
    readyForQuick && heroCombo ? classifyHand(heroCombo, filledBoard) : null;
  const outs = classification ? outsFromDraws(classification.draws) : 0;
  const hasLiveDraw = !!classification && classification.draws.length > 0 && outs > 0;

  const stats: ResultsSummaryStats | null = classification
    ? {
        kind: "strength",
        label: MADE_TIER_LABEL[classification.madeTier],
        tone: tierTone(classification.madeTier, hasLiveDraw),
        outs: hasLiveDraw ? outs : undefined,
      }
    : null;

  const description = classification
    ? classification.draws.length > 0
      ? `היד שלך: ${MADE_TIER_LABEL[classification.madeTier]}, עם ${drawsToHebrew(
          classification.draws
        )} (כ-${outs} אאוטים לשיפור).`
      : `היד שלך: ${MADE_TIER_LABEL[classification.madeTier]}.`
    : null;

  const pick = (card: string) => {
    if (!pickerTarget) return;
    if (pickerTarget.kind === "hero") {
      setHeroCard(pickerTarget.index, card);
      setPickerTarget(null);
      return;
    }
    const nextIndex = pickerTarget.indices.find((i) => !input.board[i]);
    if (nextIndex === undefined) {
      setPickerTarget(null);
      return;
    }
    setBoardCard(nextIndex, card);
    const remaining = pickerTarget.indices.filter((i) => i !== nextIndex && !input.board[i]);
    setPickerTarget(remaining.length > 0 ? { kind: "board", indices: pickerTarget.indices } : null);
  };

  const openBoardPicker = () => {
    const filledCount = filledBoard.length;
    if (filledCount < 3) {
      setPickerTarget({ kind: "board", indices: [0, 1, 2] });
    } else if (filledCount === 3) {
      setPickerTarget({ kind: "board", indices: [3] });
    } else if (filledCount === 4) {
      setPickerTarget({ kind: "board", indices: [4] });
    }
  };

  const boardSlots = [0, 1, 2, 3, 4];
  const remainingToPick =
    pickerTarget?.kind === "board"
      ? pickerTarget.indices.filter((i) => !input.board[i]).length
      : 0;

  const handleSave = () => {
    if (!result) return;
    const gate = canPerformAction(plan, "saveHand", listHands().length);
    if (!gate.allowed) {
      setSaveMessage(gate.reason ?? "לא ניתן לשמור עוד ידיים במסלול הזה.");
      return;
    }
    setSaveMessage(null);
    saveHand({ input, result, action: input.actionTaken, position: input.heroPosition });
    setSaved(true);
  };

  return (
    <div className="space-y-4">
      {stats && (
        <ResultsSummaryBar input={input} stats={stats} />
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle>ניתוח מהיר · קלפים</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs text-base-muted">הקלפים שלי</p>
            <div className="flex gap-2">
              {[0, 1].map((i) => (
                <button key={i} onClick={() => setPickerTarget({ kind: "hero", index: i as 0 | 1 })}>
                  <PlayingCard card={input.heroCards[i]} size="md" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs text-base-muted">הפלופ (חובה) + טרן/ריבר (רשות)</p>
            <div className="flex gap-2">
              {boardSlots.map((i) => {
                const filled = input.board[i];
                const isNextGroupStart =
                  (i === 0 && filledBoard.length === 0) ||
                  (i === 3 && filledBoard.length === 3) ||
                  (i === 4 && filledBoard.length === 4);
                if (!filled && !isNextGroupStart && !(i < 3 && filledBoard.length < 3))
                  return <div key={i} className="w-12" />;
                return (
                  <button
                    key={i}
                    onClick={() => (filled ? removeBoardCard(i) : openBoardPicker())}
                    title={filled ? "לחץ להסרה" : "לחץ להוספה"}
                  >
                    <PlayingCard card={filled} size="md" faceDown={!filled} />
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-base-muted/80">
              בחר 2 קלפים ליד שלי ואת הפלופ (3 קלפים) לקבלת אחוזים ראשוניים מיד.
            </p>
          </div>

          {pickerTarget && (
            <div className="rounded-lg border border-base-border bg-base-panel2 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-base-muted">
                  {pickerTarget.kind === "hero"
                    ? `בחר קלף ליד שלי ${pickerTarget.index + 1}`
                    : remainingToPick > 1
                    ? `בחר ${remainingToPick} קלפים לבורד`
                    : "בחר קלף לבורד"}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setPickerTarget(null)}>
                  סגור
                </Button>
              </div>
              <CardPicker usedCards={used} onPick={pick} />
            </div>
          )}
        </PanelBody>
      </Panel>

      {!readyForQuick && (
        <Panel>
          <PanelBody className="py-6 text-center text-sm text-base-muted">
            בחר את שני הקלפים שלך ואת הפלופ כדי לקבל קריאה ראשונית.
          </PanelBody>
        </Panel>
      )}

      {readyForQuick && description && (
        <Panel>
          <PanelBody className="space-y-4">
            <p className="text-sm text-base-text">{description}</p>

            {saveMessage && <p className="text-sm text-status-risky">{saveMessage}</p>}

            <div className="flex flex-wrap items-center justify-end gap-2">
              {computing && !result && (
                <span className="text-xs text-base-muted">מכין נתונים לשמירה…</span>
              )}
              <Button variant="secondary" onClick={handleSave} disabled={!result}>
                {saved ? "נשמר ✓" : "שמור יד"}
              </Button>
              <Button onClick={onContinueToAdvanced}>המשך לניתוח מתקדם</Button>
            </div>
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}

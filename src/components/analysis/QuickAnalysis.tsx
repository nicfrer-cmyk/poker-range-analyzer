"use client";

import { useEffect, useRef, useState } from "react";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { CardPicker } from "@/components/cards/CardPicker";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ResultsSummaryBar, type ResultsSummaryStats } from "@/components/analysis/ResultsSummaryBar";
import { HeroSummary } from "@/components/analysis/HeroSummary";
import { PaywallModal } from "@/components/billing/PaywallModal";
import { useAnalysisStore } from "@/lib/store/analysisStore";
import { runAnalysis, outsFromDraws } from "@/lib/analysisEngine";
import { classifyHand } from "@/lib/engine/classify";
import { drawsToHebrew } from "@/lib/labels";
import { rangeSelectionPercent } from "@/lib/rangeStats";
import type { Card, Combo } from "@/lib/engine/types";
import type { AnalysisResult } from "@/lib/analysisTypes";
import { saveHand, listHands } from "@/lib/localHandStore";
import { canPerformAction, isNearLimit } from "@/lib/plan";
import { useMockPlan } from "@/lib/useMockPlan";
import { getTodayCount, incrementToday } from "@/lib/usageTracker";
import { track } from "@/lib/analytics";

type PickerTarget = { kind: "hero"; index: 0 | 1 } | { kind: "board"; indices: number[] };

/**
 * Fast entry point: hero's 2 cards + the flop (turn/river optional), no villain range, no
 * position, no pot sizing. Auto-computes as soon as hero + flop are filled.
 *
 * Equity display: computed against the store's default villain range (a standard opening range
 * — see `initialInput.villainRangeText` in analysisStore), not a range the user chose. That
 * assumption is called out explicitly in the caption above HeroSummary below, and "continue to
 * advanced" lets the user swap in the villain's real range. This replaces an earlier version
 * that hid the equity number entirely to avoid implying a tailored read — but a labeled
 * "vs. a typical range" number is honest AND gives the same rich equity-gauge/star-rating
 * readout the advanced flow produces (HeroSummary), instead of a bare made-hand-tier sentence.
 */
export function QuickAnalysis({ onContinueToAdvanced }: { onContinueToAdvanced: () => void }) {
  const { input, setHeroCard, setBoardCard, removeBoardCard, usedCards } = useAnalysisStore();
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [computing, setComputing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [plan] = useMockPlan();
  const [paywallMessage, setPaywallMessage] = useState<string | null>(null);
  const countedHandKey = useRef<string | null>(null);

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

  const nearQuickAnalysisLimit = isNearLimit(
    plan,
    "runQuickAnalysis",
    getTodayCount("quickAnalysis")
  );

  // Fires once when this component enters "quick analysis" mode (it's only ever rendered while
  // that mode is selected on the analyze page), not merely on module load.
  useEffect(() => {
    track("quick_analysis_started");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!readyForQuick || !heroCombo) {
      setResult(null);
      return;
    }
    const handKey = `${input.heroCards.join("")}-${input.board.join("")}`;
    const alreadyCounted = countedHandKey.current === handKey;
    const gate = canPerformAction(plan, "runQuickAnalysis", getTodayCount("quickAnalysis"));
    if (!gate.allowed && !alreadyCounted) {
      setPaywallMessage(gate.reason ?? "הגעת למגבלת הניתוחים המהירים היומית.");
      setResult(null);
      return;
    }
    setPaywallMessage(null);
    setComputing(true);
    setSaved(false);
    const timeout = setTimeout(() => {
      const r = runAnalysis(input);
      setResult(r);
      if (r) {
        track("quick_analysis_completed");
      }
      if (r && !alreadyCounted) {
        incrementToday("quickAnalysis");
        countedHandKey.current = handKey;
      }
      setComputing(false);
    }, 200);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyForQuick, heroCard0, heroCard1, boardKey]);

  const classification =
    readyForQuick && heroCombo ? classifyHand(heroCombo, filledBoard) : null;
  const outs = classification ? outsFromDraws(classification.draws) : 0;
  const hasLiveDraw = !!classification && classification.draws.length > 0 && outs > 0;

  const stats: ResultsSummaryStats | null = result
    ? {
        kind: "equity",
        heroEquityPct: result.heroEquityPct,
        villainEquityPct: result.villainEquityPct,
        outs: hasLiveDraw ? outs : undefined,
      }
    : null;

  const villainRangePercent = rangeSelectionPercent(input.villainRangeText);

  const pick = (card: string) => {
    if (!pickerTarget) return;
    if (pickerTarget.kind === "hero") {
      setHeroCard(pickerTarget.index, card);
      // Flow straight into the other hero slot if it's still empty, instead of closing —
      // filling one card almost always means the next click would just reopen this same picker.
      const otherIndex = pickerTarget.index === 0 ? 1 : 0;
      setPickerTarget(input.heroCards[otherIndex] ? null : { kind: "hero", index: otherIndex });
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

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const hands = await listHands();
      const gate = canPerformAction(plan, "saveHand", hands.length);
      if (!gate.allowed) {
        setSaveMessage(gate.reason ?? "לא ניתן לשמור עוד ידיים במסלול הזה.");
        return;
      }
      setSaveMessage(null);
      await saveHand({
        input,
        result,
        action: input.actionTaken,
        position: input.heroPosition,
        analysisMode: "quick",
      });
      track("hand_saved", { analysisMode: "quick" });
      setSaved(true);
    } catch {
      setSaveMessage("שגיאה בשמירת היד — נסה שוב.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PaywallModal
        open={!!paywallMessage}
        message={paywallMessage ?? ""}
        onClose={() => setPaywallMessage(null)}
      />

      {stats && <ResultsSummaryBar input={input} stats={stats} />}

      {!paywallMessage && nearQuickAnalysisLimit && (
        <div className="flex justify-end">
          <Badge tone="close">כמעט הגעת למגבלת הניתוחים המהירים היומית בתוכנית החינמית</Badge>
        </div>
      )}

      {readyForQuick && result && (
        <>
          <Panel className="border-accent/30">
            <PanelBody className="py-2.5 text-xs text-base-muted">
              מוצג מול טווח יריב סטנדרטי ({villainRangePercent.toFixed(0)}% מהידיים האפשריות) — לניתוח
              מדויק עם הטווח האמיתי של היריב שלך, המשך לניתוח מתקדם.
            </PanelBody>
          </Panel>

          <HeroSummary result={result} />

          {classification && classification.draws.length > 0 && (
            <Panel>
              <PanelBody className="text-sm text-base-text">
                יש לך גם דרואו חי ({drawsToHebrew(classification.draws)}) בשווי של כ-{outs} אאוטים לשיפור.
              </PanelBody>
            </Panel>
          )}

          {saveMessage && <p className="text-sm text-status-risky">{saveMessage}</p>}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onClick={handleSave} disabled={saving}>
              {saving ? "שומר…" : saved ? "נשמר ✓" : "שמור יד"}
            </Button>
            <Button onClick={onContinueToAdvanced}>המשך לניתוח מתקדם</Button>
          </div>
        </>
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

      {readyForQuick && computing && !result && (
        <Panel>
          <PanelBody className="py-8 text-center text-sm text-base-muted">מחשב אקוויטי…</PanelBody>
        </Panel>
      )}
    </div>
  );
}

"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Step1GameType } from "@/components/wizard/Step1GameType";
import { Step2Cards } from "@/components/wizard/Step2Cards";
import { Step3PotDecision } from "@/components/wizard/Step3PotDecision";
import { Step4VillainRange } from "@/components/wizard/Step4VillainRange";
import { StepIndicator } from "@/components/wizard/StepIndicator";
import { WizardNav } from "@/components/wizard/WizardNav";
import { HeroSummary } from "@/components/analysis/HeroSummary";
import { ResultsSummaryBar } from "@/components/analysis/ResultsSummaryBar";
import { QuickAnalysis } from "@/components/analysis/QuickAnalysis";
import { KeyInsights } from "@/components/analysis/KeyInsights";
import { PotOddsPanel } from "@/components/analysis/PotOddsPanel";
import { RangePieChart } from "@/components/range/RangePieChart";
import { RangeMatrix } from "@/components/range/RangeMatrix";
import { RangeExplorerPanel } from "@/components/range/RangeExplorerPanel";
import { WhatChanged } from "@/components/analysis/WhatChanged";
import { CardsToWatch } from "@/components/analysis/CardsToWatch";
import { BlockerPanel } from "@/components/analysis/BlockerPanel";
import { CoachPanel } from "@/components/analysis/CoachPanel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Panel, PanelBody } from "@/components/ui/Panel";
import { PaywallModal } from "@/components/billing/PaywallModal";
import { useAnalysisStore } from "@/lib/store/analysisStore";
import { runAnalysis, computeMatrixEquities, computeNextCardOutlook } from "@/lib/analysisEngine";
import { parseRange, removeConflicts } from "@/lib/engine/range";
import type { Card, Combo } from "@/lib/engine/types";
import type { AnalysisResult, NextCardOutlook } from "@/lib/analysisTypes";
import { saveHand, listHands } from "@/lib/localHandStore";
import { useMockPlan } from "@/lib/useMockPlan";
import { canPerformAction, isNearLimit } from "@/lib/plan";
import { getTodayCount, incrementToday } from "@/lib/usageTracker";
import { track } from "@/lib/analytics";

const TOTAL_STEPS = 5;

type EntryMode = "choice" | "quick" | "advanced";

function isEntryMode(value: string | null): value is Exclude<EntryMode, "choice"> {
  return value === "quick" || value === "advanced";
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={null}>
      <AnalyzePageInner />
    </Suspense>
  );
}

function AnalyzePageInner() {
  const { input } = useAnalysisStore();
  const searchParams = useSearchParams();
  // Deep-link from the dashboard ("?mode=quick" / "?mode=advanced") skips the choice screen and
  // drops the user straight into that mode; any other/missing value falls back to "choice" as before.
  const [mode, setMode] = useState<EntryMode>(() => {
    const requestedMode = searchParams.get("mode");
    return isEntryMode(requestedMode) ? requestedMode : "choice";
  });
  const [step, setStep] = useState(1);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [matrixEquities, setMatrixEquities] = useState<Record<string, number>>({});
  const [computing, setComputing] = useState(false);
  const [showDeep, setShowDeep] = useState(false);
  const [saved, setSaved] = useState(false);
  const [plan] = useMockPlan();
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const [nextCardOutlook, setNextCardOutlook] = useState<{
    best: NextCardOutlook[];
    worst: NextCardOutlook[];
  }>({ best: [], worst: [] });
  const [computingDeep, setComputingDeep] = useState(false);
  const [selectedComboLabel, setSelectedComboLabel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const countedHandKey = useRef<string | null>(null);

  const readyToAnalyze =
    input.heroCards.length >= 2 && !!input.heroCards[0] && !!input.heroCards[1];
  const heroCard0 = input.heroCards[0];
  const heroCard1 = input.heroCards[1];
  const boardKey = input.board.join(",");
  const heroCombo: Combo | null =
    heroCard0 && heroCard1 ? { c1: heroCard0 as Card, c2: heroCard1 as Card } : null;
  const boardCards = input.board.filter(Boolean) as Card[];

  const canGoNext =
    step === 2 ? readyToAnalyze : step === 4 ? input.villainRangeText.trim().length > 0 : true;

  const nearAnalysisLimit = isNearLimit(plan, "runAnalysis", getTodayCount("analysis"));

  // Fires whenever the user enters advanced mode (mirrors QuickAnalysis's mount-based
  // `quick_analysis_started`) — including a deep-link landing directly on `?mode=advanced`,
  // since `mode`'s initial state already reflects that on first render.
  useEffect(() => {
    if (mode === "advanced") track("advanced_analysis_started");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (step !== 5 || !readyToAnalyze) return;

    const handKey = `${input.heroCards.join("")}-${input.board.join("")}`;
    const alreadyCounted = countedHandKey.current === handKey;
    const gate = canPerformAction(plan, "runAnalysis", getTodayCount("analysis"));
    if (!gate.allowed && !alreadyCounted) {
      setGateMessage(gate.reason ?? "הגעת למגבלת הניתוחים היומית.");
      setResult(null);
      return;
    }
    setGateMessage(null);

    setComputing(true);
    setSaved(false);
    setShowDeep(false);
    const timeout = setTimeout(() => {
      const r = runAnalysis(input);
      setResult(r);
      if (r) {
        track("advanced_analysis_completed");
      }
      if (r && !alreadyCounted) {
        incrementToday("analysis");
        countedHandKey.current = handKey;
      }
      setComputing(false);
    }, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step,
    heroCard0,
    heroCard1,
    boardKey,
    input.villainRangeText,
    input.pot,
    input.toCall,
    input.heroStack,
    input.numPlayers,
  ]);

  useEffect(() => {
    if (!showDeep || !result || !readyToAnalyze) return;
    setComputingDeep(true);
    const timeout = setTimeout(() => {
      const heroCards = input.heroCards.filter(Boolean) as Card[];
      const board = input.board.filter(Boolean) as Card[];
      const villainRange = removeConflicts(parseRange(input.villainRangeText), [...heroCards, ...board]);
      setMatrixEquities(
        computeMatrixEquities({ c1: heroCards[0]!, c2: heroCards[1]! }, board, villainRange)
      );
      setNextCardOutlook(computeNextCardOutlook(input, result.heroEquityPct));
      setComputingDeep(false);
    }, 30);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeep, heroCard0, heroCard1, boardKey, input.villainRangeText]);

  const handleSaveAdvanced = async () => {
    if (!result) return;
    setSaving(true);
    setSaveError(null);
    try {
      const hands = await listHands();
      const gate = canPerformAction(plan, "saveHand", hands.length);
      if (!gate.allowed) {
        setGateMessage(gate.reason ?? "לא ניתן לשמור עוד ידיים במסלול הזה.");
        return;
      }
      await saveHand({
        input,
        result,
        action: input.actionTaken,
        position: input.heroPosition,
        analysisMode: "advanced",
      });
      track("hand_saved", { analysisMode: "advanced" });
      setSaved(true);
    } catch {
      setSaveError("שגיאה בשמירת הניתוח — נסה שוב.");
    } finally {
      setSaving(false);
    }
  };

  const tooltipFor = useMemo(
    () => (label: string) => {
      const eq = matrixEquities[label];
      return eq !== undefined ? `${label}: ${eq.toFixed(1)}% אקוויטי` : label;
    },
    [matrixEquities]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">ניתוח יד חדשה</h1>

      {mode === "choice" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Panel className="flex flex-col">
            <PanelBody className="flex flex-1 flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold">ניתוח מהיר</h2>
                <p className="mt-2 text-sm text-base-muted">
                  בחר את היד שלך ואת הפלופ וקבל אחוזים ראשוניים מיד.
                </p>
              </div>
              <Button className="mt-auto" onClick={() => setMode("quick")}>
                התחל ניתוח מהיר
              </Button>
            </PanelBody>
          </Panel>
          <Panel className="flex flex-col">
            <PanelBody className="flex flex-1 flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold">ניתוח מתקדם</h2>
                <p className="mt-2 text-sm text-base-muted">
                  הוסף טווח יריב, פוזיציות, קופה ומהלכים לניתוח עמוק יותר.
                </p>
              </div>
              <Button
                variant="secondary"
                className="mt-auto"
                onClick={() => {
                  setStep(1);
                  setMode("advanced");
                }}
              >
                התחל ניתוח מתקדם
              </Button>
            </PanelBody>
          </Panel>
        </div>
      )}

      {mode !== "choice" && (
        <div className="flex justify-start">
          <Button variant="ghost" onClick={() => setMode("choice")}>
            ← חזרה לבחירת סוג ניתוח
          </Button>
        </div>
      )}

      {mode === "quick" && (
        <QuickAnalysis
          onContinueToAdvanced={() => {
            setStep(2);
            setMode("advanced");
          }}
        />
      )}

      {mode === "advanced" && (
        <>
          <StepIndicator step={step} />

          {step === 1 && <Step1GameType />}
          {step === 2 && <Step2Cards />}
          {step === 3 && <Step3PotDecision />}
          {step === 4 && <Step4VillainRange />}

          {step === 4 && nearAnalysisLimit && (
            <div className="flex justify-end">
              <Badge tone="close">כמעט הגעת למגבלת הניתוחים היומית בתוכנית החינמית</Badge>
            </div>
          )}

          {step < 5 && (
            <WizardNav
              step={step}
              totalSteps={TOTAL_STEPS}
              canGoNext={canGoNext}
              onBack={() => setStep((s) => Math.max(1, s - 1))}
              onNext={() => setStep((s) => Math.min(TOTAL_STEPS, s + 1))}
              nextLabel={step === 4 ? "הצג ניתוח" : "המשך"}
            />
          )}

          {step === 5 && (
            <div className="space-y-6">
              <div className="flex justify-start">
                <Button variant="ghost" onClick={() => setStep(4)}>
                  ← חזרה לעריכה
                </Button>
              </div>

              <PaywallModal
                open={!!gateMessage}
                message={gateMessage ?? ""}
                onClose={() => setGateMessage(null)}
              />

              {computing && !result && (
                <Panel>
                  <PanelBody className="py-10 text-center text-sm text-base-muted">מחשב אקוויטי…</PanelBody>
                </Panel>
              )}

              {result && (
                <>
                  <ResultsSummaryBar
                    input={input}
                    stats={{
                      kind: "equity",
                      heroEquityPct: result.heroEquityPct,
                      villainEquityPct: result.villainEquityPct,
                      outs: result.heroDraw !== "none" ? result.spr.outs : undefined,
                    }}
                  />

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {saveError && <span className="text-sm text-status-risky">{saveError}</span>}
                    <Button variant="secondary" onClick={handleSaveAdvanced} disabled={saving}>
                      {saving ? "שומר…" : saved ? "נשמר ✓" : "שמור ניתוח"}
                    </Button>
                  </div>

                  <HeroSummary result={result} />
                  <PotOddsPanel result={result} />
                  <CoachPanel messages={result.coachMessages} />

                  <div className="grid gap-6 lg:grid-cols-2">
                    <KeyInsights insights={result.keyInsights} />
                    <RangePieChart buckets={result.rangeComposition} />
                  </div>

                  <div className="flex justify-center">
                    <Button variant="secondary" onClick={() => setShowDeep((s) => !s)}>
                      {showDeep ? "הסתר ניתוח מעמיק" : "הצג ניתוח מעמיק"}
                    </Button>
                  </div>

                  {showDeep && computingDeep && (
                    <Panel>
                      <PanelBody className="py-8 text-center text-sm text-base-muted">
                        מחשב ניתוח מעמיק…
                      </PanelBody>
                    </Panel>
                  )}
                  {showDeep && !computingDeep && (
                    <div className="space-y-6">
                      <Panel>
                        <PanelBody>
                          <p className="mb-3 text-sm font-semibold">
                            מטריצת טווח — האקוויטי שלי מול כל קומבינציה
                          </p>
                          <p className="mb-3 text-xs text-base-muted">
                            לחיצה על קומבינציה פותחת חקירה מעמיקה שלה מול הידיים שלך.
                          </p>
                          <RangeMatrix
                            equities={matrixEquities}
                            onTooltip={tooltipFor}
                            onCellClick={setSelectedComboLabel}
                          />
                        </PanelBody>
                      </Panel>
                      <div className="grid gap-6 lg:grid-cols-2">
                        <WhatChanged items={result.whatChanged} />
                        <CardsToWatch best={nextCardOutlook.best} worst={nextCardOutlook.worst} />
                      </div>
                      <BlockerPanel blockers={result.blockers} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {selectedComboLabel && heroCombo && (
        <RangeExplorerPanel
          label={selectedComboLabel}
          heroCombo={heroCombo}
          board={boardCards}
          onClose={() => setSelectedComboLabel(null)}
        />
      )}
    </div>
  );
}

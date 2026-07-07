"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HandSetupPanel } from "@/components/analysis/HandSetupPanel";
import { RangeBuilder } from "@/components/range/RangeBuilder";
import { HeroSummary } from "@/components/analysis/HeroSummary";
import { KeyInsights } from "@/components/analysis/KeyInsights";
import { PotOddsPanel } from "@/components/analysis/PotOddsPanel";
import { RangePieChart } from "@/components/range/RangePieChart";
import { RangeMatrix } from "@/components/range/RangeMatrix";
import { WhatChanged } from "@/components/analysis/WhatChanged";
import { CardsToWatch } from "@/components/analysis/CardsToWatch";
import { BlockerPanel } from "@/components/analysis/BlockerPanel";
import { CoachPanel } from "@/components/analysis/CoachPanel";
import { Button } from "@/components/ui/Button";
import { Panel, PanelBody } from "@/components/ui/Panel";
import { useAnalysisStore } from "@/lib/store/analysisStore";
import { runAnalysis, computeMatrixEquities, computeNextCardOutlook } from "@/lib/analysisEngine";
import { parseRange, removeConflicts } from "@/lib/engine/range";
import type { Card } from "@/lib/engine/types";
import type { AnalysisResult, NextCardOutlook } from "@/lib/analysisTypes";
import { saveHand, listHands } from "@/lib/localHandStore";
import { useMockPlan } from "@/lib/useMockPlan";
import { canPerformAction } from "@/lib/plan";
import { getTodayCount, incrementToday } from "@/lib/usageTracker";

export default function AnalyzePage() {
  const { input } = useAnalysisStore();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [matrixEquities, setMatrixEquities] = useState<Record<string, number>>({});
  const [computing, setComputing] = useState(false);
  const [showDeep, setShowDeep] = useState(false);
  const [saved, setSaved] = useState(false);
  const [action, setAction] = useState<"fold" | "check" | "call" | "bet" | "raise">("call");
  const [position, setPosition] = useState("BTN");
  const [plan] = useMockPlan();
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const [nextCardOutlook, setNextCardOutlook] = useState<{
    best: NextCardOutlook[];
    worst: NextCardOutlook[];
  }>({ best: [], worst: [] });
  const [computingDeep, setComputingDeep] = useState(false);
  const countedHandKey = useRef<string | null>(null);

  const readyToAnalyze =
    input.heroCards.length >= 2 && !!input.heroCards[0] && !!input.heroCards[1];
  const heroCard0 = input.heroCards[0];
  const heroCard1 = input.heroCards[1];
  const boardKey = input.board.join(",");

  useEffect(() => {
    if (!readyToAnalyze) {
      setResult(null);
      return;
    }

    const handKey = `${input.heroCards.join("")}-${input.board.join("")}`;
    const alreadyCounted = countedHandKey.current === handKey;
    const gate = canPerformAction(plan, "runAnalysis", getTodayCount("analysis"));
    if (!gate.allowed && !alreadyCounted) {
      setGateMessage(gate.reason ?? "Daily analysis limit reached.");
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
      if (r && !alreadyCounted) {
        incrementToday("analysis");
        countedHandKey.current = handKey;
      }
      setComputing(false);
    }, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    heroCard0,
    heroCard1,
    boardKey,
    input.villainRangeText,
    input.pot,
    input.toCall,
    input.heroStack,
    input.numPlayers,
  ]);

  // Deep Analysis (Layer 3) is expensive — the per-card lookahead needs exact enumeration —
  // so it's only computed once the user actually opens that layer, not on every keystroke.
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

  const tooltipFor = useMemo(
    () => (label: string) => {
      const eq = matrixEquities[label];
      return eq !== undefined ? `${label}: ${eq.toFixed(1)}% hero equity` : label;
    },
    [matrixEquities]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New Analysis</h1>
        {result && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="rounded-lg border border-base-border bg-base-panel2 px-2 py-1.5 text-xs"
            >
              {["UTG", "CO", "BTN", "SB", "BB"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as typeof action)}
              className="rounded-lg border border-base-border bg-base-panel2 px-2 py-1.5 text-xs"
            >
              {["fold", "check", "call", "bet", "raise"].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              onClick={() => {
                const gate = canPerformAction(plan, "saveHand", listHands().length);
                if (!gate.allowed) {
                  setGateMessage(gate.reason ?? "Cannot save another hand on this plan.");
                  return;
                }
                saveHand({ input, result, action, position });
                setSaved(true);
              }}
            >
              {saved ? "Saved ✓" : "Save Hand"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <HandSetupPanel />
        <RangeBuilder
          value={input.villainRangeText}
          onChange={(text) => useAnalysisStore.getState().setVillainRangeText(text)}
        />
      </div>

      {gateMessage && (
        <Panel className="border-status-risky/40">
          <PanelBody className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="text-sm text-status-risky">{gateMessage}</span>
            <a href="/billing">
              <Button size="sm">Upgrade to Pro</Button>
            </a>
          </PanelBody>
        </Panel>
      )}

      {!readyToAnalyze && (
        <Panel>
          <PanelBody className="py-10 text-center text-sm text-base-muted">
            Pick both hero cards above to see the analysis.
          </PanelBody>
        </Panel>
      )}

      {readyToAnalyze && computing && !result && (
        <Panel>
          <PanelBody className="py-10 text-center text-sm text-base-muted">Calculating equity…</PanelBody>
        </Panel>
      )}

      {result && (
        <>
          {/* Layer 1 — Decision */}
          <HeroSummary result={result} />
          <PotOddsPanel result={result} />

          {/* Layer 2 — Explanation */}
          <div className="grid gap-6 lg:grid-cols-2">
            <KeyInsights insights={result.keyInsights} />
            <RangePieChart buckets={result.rangeComposition} />
          </div>

          <div className="flex justify-center">
            <Button variant="secondary" onClick={() => setShowDeep((s) => !s)}>
              {showDeep ? "Hide Deep Analysis" : "Show Deep Analysis"}
            </Button>
          </div>

          {/* Layer 3 — Deep Analysis */}
          {showDeep && computingDeep && (
            <Panel>
              <PanelBody className="py-8 text-center text-sm text-base-muted">
                Computing deep analysis…
              </PanelBody>
            </Panel>
          )}
          {showDeep && !computingDeep && (
            <div className="space-y-6">
              <Panel>
                <PanelBody>
                  <p className="mb-3 text-sm font-semibold">
                    Range Matrix — hero equity vs each combo
                  </p>
                  <RangeMatrix equities={matrixEquities} onTooltip={tooltipFor} />
                </PanelBody>
              </Panel>
              <div className="grid gap-6 lg:grid-cols-2">
                <WhatChanged items={result.whatChanged} />
                <CardsToWatch best={nextCardOutlook.best} worst={nextCardOutlook.worst} />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <BlockerPanel blockers={result.blockers} />
                <CoachPanel messages={result.coachMessages} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

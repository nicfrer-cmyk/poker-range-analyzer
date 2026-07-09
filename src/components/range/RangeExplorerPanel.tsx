"use client";

import { useEffect, useMemo, useState } from "react";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge, equityTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { parseRange, rangeToCombos, comboKey } from "@/lib/engine/range";
import type { EquityResult } from "@/lib/engine/equity";
import { calculateEquityInWorker } from "@/lib/engine/equityWorkerClient";
import { classifyHand } from "@/lib/engine/classify";
import { outsFromDraws } from "@/lib/analysisEngine";
import type { Card, Combo } from "@/lib/engine/types";
import { MADE_TIER_LABEL, drawsToHebrew } from "@/lib/labels";

/** Same iteration count `runAnalysis` uses for its single hero-combo-vs-range equity call — this
 *  panel only ever computes one combo's equity at a time (unlike the ~169-cell matrix heatmap),
 *  so it can afford the same precision instead of the matrix's reduced iteration count. */
const EXPLORER_ITERATIONS = 6_000;

export function RangeExplorerPanel({
  label,
  heroCombo,
  board,
  onClose,
}: {
  /** Starting-hand label clicked in the matrix, e.g. "AQs", "77", "T9o". */
  label: string;
  heroCombo: Combo;
  board: Card[];
  onClose: () => void;
}) {
  const dead = useMemo(() => [heroCombo.c1, heroCombo.c2, ...board], [heroCombo, board]);

  // Reuses the engine's own label -> combos expansion (same parser the range builder/matrix
  // rely on) rather than re-deriving suits by hand. Picks the first combo that doesn't collide
  // with a card the hero or board already holds, e.g. "AQs" avoids "Ah Qh" when the hero holds Ah.
  const combo = useMemo<Combo | undefined>(() => {
    const combos = rangeToCombos(parseRange(label));
    return combos.find((c) => !dead.includes(c.c1) && !dead.includes(c.c2)) ?? combos[0];
  }, [label, dead]);

  // Keyed by the combo it was computed for, so `loadingEquity`/`equityResult` below can be
  // derived during render instead of needing their own separate `setState` calls at the top of
  // the effect (which a fresh combo's fetch-in-flight would otherwise require).
  const [resolvedEquity, setResolvedEquity] = useState<{ comboKey: string; result: EquityResult } | null>(null);

  useEffect(() => {
    if (!combo) return;
    let cancelled = false;
    const key = comboKey(combo);
    const singleRange = new Map([[key, 1]]);
    calculateEquityInWorker({
      heroCards: heroCombo,
      villainRange: singleRange,
      board,
      iterations: EXPLORER_ITERATIONS,
    }).then((result) => {
      if (!cancelled) setResolvedEquity({ comboKey: key, result });
    });
    return () => {
      cancelled = true;
    };
  }, [combo, heroCombo, board]);

  const currentComboKey = combo ? comboKey(combo) : null;
  const equityResult = resolvedEquity?.comboKey === currentComboKey ? resolvedEquity.result : null;
  const loadingEquity = Boolean(combo) && resolvedEquity?.comboKey !== currentComboKey;

  const classification = useMemo(
    () => (combo ? classifyHand(combo, board) : null),
    [combo, board]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <Panel className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <PanelHeader>
          <PanelTitle>חקירת קומבו — {label}</PanelTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            סגירה
          </Button>
        </PanelHeader>

        {loadingEquity ? (
          <PanelBody className="space-y-3 py-4">
            <div className="flex items-center justify-center gap-2">
              <Skeleton className="h-16 w-12" />
              <Skeleton className="h-16 w-12" />
            </div>
            <Skeleton className="mx-auto h-5 w-32" />
            <Skeleton className="mx-auto h-4 w-48" />
          </PanelBody>
        ) : !combo || !classification || !equityResult || Number.isNaN(equityResult.heroEquity) ? (
          <PanelBody className="space-y-3 py-8 text-center text-sm text-base-muted">
            <p>אי אפשר לחשב קומבו עבור {label} מול הקלפים הידועים ביד הזו — כל הצירופים מתנגשים.</p>
          </PanelBody>
        ) : (
          <PanelBody className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              <PlayingCard card={combo.c1} size="md" />
              <PlayingCard card={combo.c2} size="md" />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Badge tone="neutral">{MADE_TIER_LABEL[classification.madeTier]}</Badge>
              <Badge tone={equityTone(equityResult.heroEquity * 100)}>
                {(equityResult.heroEquity * 100).toFixed(1)}% אקוויטי
              </Badge>
              <span className="text-[11px] text-base-muted">
                {equityResult.exact
                  ? "חישוב מדויק"
                  : `${equityResult.iterations.toLocaleString()} סימולציות`}
              </span>
            </div>

            <p className="text-center text-sm leading-relaxed text-base-text/90">
              {classification.draws.length > 0
                ? `לקומבו הזה יש ${MADE_TIER_LABEL[classification.madeTier]}, ועוד ${drawsToHebrew(
                    classification.draws
                  )} בשווי של כ-${outsFromDraws(classification.draws)} אאוטים נוספים.`
                : `לקומבו הזה יש ${MADE_TIER_LABEL[classification.madeTier]}, בלי דרואו פעיל נוסף כרגע.`}
              {" "}מול הקלפים שלך, זה מתורגם ל-{(equityResult.heroEquity * 100).toFixed(1)}% אקוויטי.
            </p>

            <div className="flex items-center justify-center gap-2 border-t border-base-border pt-3">
              <span className="text-xs text-base-muted">מול הקלפים שלך:</span>
              <PlayingCard card={heroCombo.c1} size="sm" />
              <PlayingCard card={heroCombo.c2} size="sm" />
            </div>
          </PanelBody>
        )}
      </Panel>
    </div>
  );
}

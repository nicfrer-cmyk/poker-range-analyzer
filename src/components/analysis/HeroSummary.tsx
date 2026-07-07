import { Panel, PanelBody } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { EquityMeter } from "./EquityMeter";
import type { AnalysisResult } from "@/lib/analysisTypes";

const CATEGORY_LABEL: Record<string, string> = {
  "straight-flush": "Straight Flush",
  quads: "Four of a Kind",
  "full-house": "Full House",
  flush: "Flush",
  straight: "Straight",
  set: "Set",
  trips: "Trips",
  "two-pair": "Two Pair",
  overpair: "Overpair",
  "top-pair": "Top Pair",
  "second-pair": "Second Pair",
  "bottom-pair": "Bottom Pair",
  underpair: "Underpair",
  overcards: "Overcards",
  air: "Air",
};

export function HeroSummary({ result }: { result: AnalysisResult }) {
  return (
    <Panel>
      <PanelBody className="flex flex-col items-center gap-5 py-6 sm:flex-row sm:items-center sm:justify-between">
        <EquityMeter equityPct={result.heroEquityPct} />
        <div className="flex-1 space-y-3 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <Badge tone={result.verdictTone}>{CATEGORY_LABEL[result.heroCategory] ?? result.heroCategory}</Badge>
            {result.heroDraw !== "none" && (
              <Badge tone="close">{result.heroDraw.replace("-", " ")}</Badge>
            )}
            <span className="text-xs text-base-muted">
              {result.exact ? "exact calculation" : `${result.iterations.toLocaleString()} simulations`}
            </span>
          </div>
          <p className="text-lg font-semibold leading-snug">{result.verdictText}</p>
          <div className="flex items-center justify-center gap-1 sm:justify-start">
            {Array.from({ length: 5 }).map((_, i) => {
              const filled = result.starScore / 20 >= i + 1;
              const half = !filled && result.starScore / 20 > i;
              return (
                <span
                  key={i}
                  className={
                    filled
                      ? "text-accent-soft"
                      : half
                      ? "text-accent-soft/50"
                      : "text-base-border"
                  }
                >
                  ★
                </span>
              );
            })}
            <span className="ml-1 text-xs text-base-muted">{result.starScore}/100</span>
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}

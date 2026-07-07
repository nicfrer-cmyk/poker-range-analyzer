import { Panel, PanelBody } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { EquityMeter } from "./EquityMeter";
import type { AnalysisResult } from "@/lib/analysisTypes";
import { MADE_TIER_LABEL, DRAW_TYPE_LABEL } from "@/lib/labels";

export function HeroSummary({ result }: { result: AnalysisResult }) {
  return (
    <Panel>
      <PanelBody className="flex flex-col items-center gap-5 py-6 sm:flex-row sm:items-center sm:justify-between">
        <EquityMeter equityPct={result.heroEquityPct} />
        <div className="flex-1 space-y-3 text-center sm:text-start">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <Badge tone={result.verdictTone}>{MADE_TIER_LABEL[result.heroCategory] ?? result.heroCategory}</Badge>
            {result.heroDraw !== "none" && (
              <Badge tone="close">{DRAW_TYPE_LABEL[result.heroDraw] ?? result.heroDraw}</Badge>
            )}
            <span className="text-xs text-base-muted">
              {result.exact ? "חישוב מדויק" : `${result.iterations.toLocaleString()} סימולציות`}
            </span>
          </div>
          <p className="text-lg font-semibold leading-snug">{result.verdictText}</p>

          <div className="flex justify-center gap-4 sm:justify-start">
            <div className="text-center">
              <p className="text-base font-bold text-status-ahead">{result.heroEquityPct.toFixed(1)}%</p>
              <p className="text-[11px] text-base-muted">ניצחון</p>
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-base-muted">{result.tieEquityPct.toFixed(1)}%</p>
              <p className="text-[11px] text-base-muted">תיקו</p>
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-status-behind">{result.villainEquityPct.toFixed(1)}%</p>
              <p className="text-[11px] text-base-muted">הפסד</p>
            </div>
          </div>

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
            <span className="ms-1 text-xs text-base-muted">{result.starScore}/100</span>
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}

import { Panel, PanelBody } from "@/components/ui/Panel";
import { PlayingCard } from "@/components/cards/PlayingCard";
import type { AnalysisInput } from "@/lib/store/analysisStore";
import type { AnalysisResult } from "@/lib/analysisTypes";

function Stat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: "ahead" | "behind" | "neutral";
}) {
  const toneClass =
    tone === "ahead"
      ? "text-status-ahead"
      : tone === "behind"
      ? "text-status-behind"
      : "text-base-text";
  return (
    <div className="text-center">
      <p className={`text-base font-bold tabular-nums ${toneClass}`}>{value}</p>
      <p className="text-[10px] text-base-muted">{label}</p>
    </div>
  );
}

/**
 * Compact "at a glance" strip pinned to the top of step 5: hero/board cards + the 2-3 most
 * important numbers, all reusing values already computed by runAnalysis. This is intentionally
 * terser than HeroSummary (the fuller narrative panel rendered right below it) — it exists so
 * the user can see what they picked and how it's going without scrolling.
 */
export function ResultsSummaryBar({
  input,
  result,
}: {
  input: AnalysisInput;
  result: AnalysisResult;
}) {
  const board = input.board.filter(Boolean);
  const hasLiveDraw = result.heroDraw !== "none" && result.spr.outs > 0;

  return (
    <Panel className="border-accent/30">
      <PanelBody className="flex flex-col items-center gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-center gap-3">
          <div className="flex gap-1">
            {input.heroCards.map((card, i) => (
              <PlayingCard key={`hero-${i}`} card={card} size="sm" />
            ))}
          </div>
          {board.length > 0 && (
            <>
              <span className="h-8 w-px bg-base-border" aria-hidden />
              <div className="flex gap-1">
                {board.map((card, i) => (
                  <PlayingCard key={`board-${i}`} card={card} size="sm" />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-5">
          <Stat value={`${result.heroEquityPct.toFixed(1)}%`} label="שלי" tone="ahead" />
          <Stat value={`${result.villainEquityPct.toFixed(1)}%`} label="יריב" tone="behind" />
          {hasLiveDraw && <Stat value={`${result.spr.outs}`} label="אאוטים" />}
        </div>
      </PanelBody>
    </Panel>
  );
}

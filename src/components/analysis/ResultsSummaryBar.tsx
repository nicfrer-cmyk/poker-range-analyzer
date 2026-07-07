import { Panel, PanelBody } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { PlayingCard } from "@/components/cards/PlayingCard";
import type { AnalysisInput } from "@/lib/store/analysisStore";
import type { StatusTone } from "@/lib/statusTone";

/** Derived from board length, not stored separately — 0/3/4/5 board cards map 1:1 to a street. */
function streetLabel(boardLength: number): string {
  if (boardLength >= 5) return "ריבר";
  if (boardLength === 4) return "טרן";
  if (boardLength === 3) return "פלופ";
  return "פרה-פלופ";
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: StatusTone;
}) {
  const toneClass: Record<StatusTone, string> = {
    crushing: "text-status-crushing",
    ahead: "text-status-ahead",
    close: "text-status-close",
    risky: "text-status-risky",
    behind: "text-status-behind",
    neutral: "text-base-text",
  };
  return (
    <div className="text-center">
      <p className={`text-base font-bold tabular-nums ${toneClass[tone ?? "neutral"]}`}>{value}</p>
      <p className="text-[10px] text-base-muted">{label}</p>
    </div>
  );
}

/**
 * Discriminated stat shape so this header works for both analysis modes:
 * - "equity": the advanced wizard's hero-vs-villain equity split (a real villain range was
 *   provided, so a head-to-head percentage is meaningful).
 * - "strength": Quick Analysis's hand-strength read (no villain range was ever entered by the
 *   user, so we deliberately don't show a head-to-head equity number — see QuickAnalysis.tsx
 *   for why).
 * Both variants may optionally surface an outs count.
 */
export type ResultsSummaryStats =
  | { kind: "equity"; heroEquityPct: number; villainEquityPct: number; outs?: number }
  | { kind: "strength"; label: string; tone: StatusTone; outs?: number };

/**
 * Compact "at a glance" header: hero/board cards + the 2-3 most important numbers. Shared by
 * the advanced wizard's results step and Quick Analysis. Sticky so it stays visible while the
 * user scrolls through the rest of the results below it.
 *
 * z-index note: this app doesn't yet have a formal z-index scale. Known values in use today:
 * z-10 (matrix cell hover), z-40 (BottomNav, NotificationBell backdrop), z-50 (modals/dropdowns),
 * z-[60] (onboarding tour overlay). z-30 sits below all overlay/modal layers but above normal
 * scrolled content, which is what a sticky in-page header needs.
 */
export function ResultsSummaryBar({
  input,
  stats,
}: {
  input: AnalysisInput;
  stats: ResultsSummaryStats;
}) {
  const board = input.board.filter(Boolean);

  return (
    <Panel className="sticky top-0 z-30 border-accent/30 border-b shadow-sm">
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
          <Badge tone="neutral" className="shrink-0">
            {streetLabel(board.length)}
          </Badge>
        </div>

        <div className="flex items-center justify-center gap-5">
          {stats.kind === "equity" ? (
            <>
              <Stat value={`${stats.heroEquityPct.toFixed(1)}%`} label="שלי" tone="ahead" />
              <Stat value={`${stats.villainEquityPct.toFixed(1)}%`} label="יריב" tone="behind" />
              {!!stats.outs && stats.outs > 0 && <Stat value={`${stats.outs}`} label="אאוטים" />}
            </>
          ) : (
            <>
              <Stat value={stats.label} label="חוזק היד" tone={stats.tone} />
              {!!stats.outs && stats.outs > 0 && <Stat value={`${stats.outs}`} label="אאוטים" />}
            </>
          )}
        </div>
      </PanelBody>
    </Panel>
  );
}

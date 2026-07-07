import { Panel, PanelBody } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import type { TrackInfo, TrackStats } from "@/lib/training";

export function TrainingTrackCard({
  track,
  stats,
  onSelect,
}: {
  track: TrackInfo;
  stats?: TrackStats;
  onSelect: () => void;
}) {
  const accuracyPct =
    stats && stats.answered > 0 ? Math.round((stats.correct / stats.answered) * 100) : null;

  return (
    <button type="button" onClick={onSelect} className="text-start">
      <Panel className="h-full transition-colors hover:border-accent/60">
        <PanelBody className="flex h-full flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-2xl" aria-hidden>
              {track.icon}
            </span>
            {accuracyPct !== null && (
              <Badge tone={accuracyPct >= 70 ? "ahead" : accuracyPct >= 50 ? "close" : "risky"}>
                דיוק {accuracyPct}%
              </Badge>
            )}
          </div>
          <h3 className="text-sm font-semibold text-base-text">{track.label}</h3>
          <p className="flex-1 text-xs leading-relaxed text-base-muted">{track.description}</p>
          {stats && stats.answered > 0 && (
            <p className="text-[11px] text-base-muted">{stats.answered} תרגולים עד כה</p>
          )}
        </PanelBody>
      </Panel>
    </button>
  );
}

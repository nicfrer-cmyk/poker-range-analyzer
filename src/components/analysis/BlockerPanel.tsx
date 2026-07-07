import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { PlayingCard } from "@/components/cards/PlayingCard";
import type { BlockerInfo } from "@/lib/analysisTypes";

export function BlockerPanel({ blockers }: { blockers: BlockerInfo[] }) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Blocker Analysis</PanelTitle>
      </PanelHeader>
      <PanelBody className="space-y-3">
        {blockers.length === 0 && (
          <p className="text-sm text-base-muted">No blocker-relevant cards in hero&apos;s hand.</p>
        )}
        {blockers.map((b) => (
          <div key={b.card} className="flex items-center gap-3">
            <PlayingCard card={b.card} size="sm" />
            <div className="grid flex-1 grid-cols-3 gap-2 text-xs text-base-muted">
              <span>Value blocked: <b className="text-base-text">{b.valueCombosBlocked}</b></span>
              <span>Draws blocked: <b className="text-base-text">{b.drawCombosBlocked}</b></span>
              <span>Bluffs blocked: <b className="text-base-text">{b.bluffCombosBlocked}</b></span>
            </div>
          </div>
        ))}
      </PanelBody>
    </Panel>
  );
}

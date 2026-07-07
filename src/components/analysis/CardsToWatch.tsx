import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { PlayingCard } from "@/components/cards/PlayingCard";
import type { NextCardOutlook } from "@/lib/analysisTypes";

function Row({ items, positive }: { items: NextCardOutlook[]; positive: boolean }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => (
        <div key={item.card} className="flex flex-col items-center gap-1">
          <PlayingCard card={item.card} size="sm" />
          <span
            className={
              positive ? "text-xs font-semibold text-status-ahead" : "text-xs font-semibold text-status-behind"
            }
          >
            {item.heroEquityDelta > 0 ? "+" : ""}
            {item.heroEquityDelta.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function CardsToWatch({
  best,
  worst,
}: {
  best: NextCardOutlook[];
  worst: NextCardOutlook[];
}) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>קלפים לצפות להם</PanelTitle>
      </PanelHeader>
      <PanelBody className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium text-status-ahead">הקלפים הטובים ביותר</p>
          <Row items={best} positive />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-status-behind">הקלפים המסוכנים ביותר</p>
          <Row items={worst} positive={false} />
        </div>
      </PanelBody>
    </Panel>
  );
}

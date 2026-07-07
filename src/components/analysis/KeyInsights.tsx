import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import type { Insight } from "@/lib/analysisTypes";

export function KeyInsights({ insights }: { insights: Insight[] }) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>תובנות מרכזיות</PanelTitle>
      </PanelHeader>
      <PanelBody className="space-y-2.5">
        {insights.length === 0 && (
          <p className="text-sm text-base-muted">אין עדיין תובנות — הזן יד לניתוח.</p>
        )}
        {insights.map((insight) => (
          <div key={insight.id} className="flex items-start gap-2.5">
            <Badge tone={insight.tone} className="mt-0.5 h-2 w-2 rounded-full p-0" />
            <p className="text-sm text-base-text/90">{insight.text}</p>
          </div>
        ))}
      </PanelBody>
    </Panel>
  );
}

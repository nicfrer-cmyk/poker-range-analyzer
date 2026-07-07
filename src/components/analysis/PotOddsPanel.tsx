import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import type { AnalysisResult } from "@/lib/analysisTypes";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] text-base-muted">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function PotOddsPanel({ result }: { result: AnalysisResult }) {
  const { potOdds, spr } = result;
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>פוט אודס ו-EV</PanelTitle>
        <Badge tone={potOdds.callProfitable ? "ahead" : "behind"}>
          {potOdds.callProfitable ? "קול משתלם" : "קול לא משתלם"}
        </Badge>
      </PanelHeader>
      <PanelBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="קופה" value={`$${potOdds.pot.toFixed(0)}`} />
        <Stat label="להשלמה" value={`$${potOdds.toCall.toFixed(0)}`} />
        <Stat label="אקוויטי נדרש" value={`${potOdds.requiredEquityPct.toFixed(1)}%`} />
        <Stat label="EV של קול" value={`$${potOdds.ev.toFixed(1)}`} />
        <Stat label="אקוויטי רב-שחקני" value={`${potOdds.multiwayAdjustedEquityPct.toFixed(1)}%`} />
        <Stat label="SPR" value={spr.value.toFixed(1)} />
        <Stat label="אאוטים" value={`${spr.outs}`} />
        <Stat label="אאוטים (חוק 2/4)" value={`${spr.outsRuleOf2And4Pct.toFixed(1)}%`} />
      </PanelBody>
    </Panel>
  );
}

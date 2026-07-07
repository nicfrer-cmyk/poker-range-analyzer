import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import type { AnalysisResult } from "@/lib/analysisTypes";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] uppercase tracking-wide text-base-muted">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function PotOddsPanel({ result }: { result: AnalysisResult }) {
  const { potOdds, spr } = result;
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Pot Odds &amp; EV</PanelTitle>
        <Badge tone={potOdds.callProfitable ? "ahead" : "behind"}>
          {potOdds.callProfitable ? "Profitable call" : "Unprofitable call"}
        </Badge>
      </PanelHeader>
      <PanelBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Pot" value={`$${potOdds.pot.toFixed(0)}`} />
        <Stat label="To Call" value={`$${potOdds.toCall.toFixed(0)}`} />
        <Stat label="Required Equity" value={`${potOdds.requiredEquityPct.toFixed(1)}%`} />
        <Stat label="EV of Call" value={`$${potOdds.ev.toFixed(1)}`} />
        <Stat label="Multiway Equity" value={`${potOdds.multiwayAdjustedEquityPct.toFixed(1)}%`} />
        <Stat label="SPR" value={spr.value.toFixed(1)} />
        <Stat label="Outs" value={`${spr.outs}`} />
        <Stat label="Outs (rule 2/4)" value={`${spr.outsRuleOf2And4Pct.toFixed(1)}%`} />
      </PanelBody>
    </Panel>
  );
}

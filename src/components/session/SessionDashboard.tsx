"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge, equityTone } from "@/components/ui/Badge";
import { listHands } from "@/lib/localHandStore";
import { computeSessionStats, topLeaks } from "@/lib/engine/leakFinder";
import { MADE_TIER_LABEL } from "@/lib/labels";

const STREET_LABEL: Record<string, string> = {
  preflop: "פרה-פלופ",
  flop: "פלופ",
  turn: "טרן",
  river: "ריבר",
};

const DIMENSION_LABEL: Record<string, string> = {
  position: "פוזיציה",
  handCategory: "קטגוריית יד",
  street: "רחוב",
  potSizeBucket: "גודל הפוט",
};

function formatLeakKey(dimension: string, key: string): string {
  if (dimension === "handCategory") {
    return MADE_TIER_LABEL[key as keyof typeof MADE_TIER_LABEL] ?? key;
  }
  if (dimension === "street") return STREET_LABEL[key] ?? key;
  if (dimension === "potSizeBucket") {
    return key.replace("small", "נמוך").replace("medium", "בינוני").replace("large", "גבוה");
  }
  return key;
}

export function SessionDashboard() {
  const [records, setRecords] = useState(() => listHands());

  useEffect(() => {
    setRecords(listHands());
  }, []);

  const stats = useMemo(() => computeSessionStats(records), [records]);
  const leaks = useMemo(() => topLeaks(records, 3), [records]);

  if (records.length === 0) {
    return (
      <Panel>
        <PanelBody className="py-12 text-center text-sm text-base-muted">
          עדיין אין ידיים שמורות. שמור כמה ידיים מנותחות כדי לפתוח את סקירת הסשן וגילוי הדליפות.
        </PanelBody>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">ידיים שנותחו</p>
            <p className="text-2xl font-bold">{stats.handCount}</p>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">אקוויטי ממוצע</p>
            <p className="text-2xl font-bold">{(stats.avgEquity * 100).toFixed(1)}%</p>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">החלטות טובות</p>
            <p className="text-2xl font-bold text-status-ahead">
              {(stats.goodDecisionRate * 100).toFixed(0)}%
            </p>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">אובדן EV ממוצע</p>
            <p className="text-2xl font-bold text-status-behind">
              {stats.avgEvLoss.toFixed(2)}
            </p>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>התקדמות לאורך זמן</PanelTitle>
        </PanelHeader>
        <PanelBody className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.trend}>
              <CartesianGrid stroke="#E2E5EB" strokeDasharray="3 3" />
              <XAxis dataKey="bucket" stroke="#697080" fontSize={11} />
              <YAxis stroke="#697080" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E5EB",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="avgEquity" stroke="#5B5BE0" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="avgEvLoss" stroke="#DC3D45" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>3 הדליפות המובילות החודש</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-4">
          {leaks.length === 0 && (
            <p className="text-sm text-base-muted">לא זוהו דליפות משמעותיות — כל הכבוד.</p>
          )}
          {leaks.map((leak) => (
            <div key={`${leak.dimension}-${leak.key}`} className="rounded-lg border border-base-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge tone="behind">{DIMENSION_LABEL[leak.dimension] ?? leak.dimension}</Badge>
                  <span className="text-sm font-semibold">{formatLeakKey(leak.dimension, leak.key)}</span>
                </div>
                <span className="text-xs text-base-muted">
                  {leak.count} ידיים · אובדן EV ממוצע {leak.avgEvLoss.toFixed(2)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {leak.examples.map((ex, i) => (
                  <Badge key={i} tone={equityTone(ex.equityAtDecision * 100)}>
                    {ex.heroCards.join(" ")} מול {STREET_LABEL[ex.street] ?? ex.street} —{" "}
                    {(ex.equityAtDecision * 100).toFixed(0)}%
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </PanelBody>
      </Panel>
    </div>
  );
}

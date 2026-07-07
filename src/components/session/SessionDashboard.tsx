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
          No saved hands yet. Save a few analyzed hands to unlock session review and leak
          detection.
        </PanelBody>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">Hands analyzed</p>
            <p className="text-2xl font-bold">{stats.handCount}</p>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">Avg equity</p>
            <p className="text-2xl font-bold">{(stats.avgEquity * 100).toFixed(1)}%</p>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">Good decisions</p>
            <p className="text-2xl font-bold text-status-ahead">
              {(stats.goodDecisionRate * 100).toFixed(0)}%
            </p>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">Avg EV loss</p>
            <p className="text-2xl font-bold text-status-behind">
              {stats.avgEvLoss.toFixed(2)}
            </p>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>Progress Over Time</PanelTitle>
        </PanelHeader>
        <PanelBody className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.trend}>
              <CartesianGrid stroke="#242936" strokeDasharray="3 3" />
              <XAxis dataKey="bucket" stroke="#8A93A3" fontSize={11} />
              <YAxis stroke="#8A93A3" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "#12151C",
                  border: "1px solid #242936",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="avgEquity" stroke="#6C6CF2" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="avgEvLoss" stroke="#E5484D" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Top 3 Leaks This Month</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-4">
          {leaks.length === 0 && (
            <p className="text-sm text-base-muted">No significant leaks detected yet — nice.</p>
          )}
          {leaks.map((leak) => (
            <div key={`${leak.dimension}-${leak.key}`} className="rounded-lg border border-base-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge tone="behind">{leak.dimension}</Badge>
                  <span className="text-sm font-semibold">{leak.key}</span>
                </div>
                <span className="text-xs text-base-muted">
                  {leak.count} hands · avg EV loss {leak.avgEvLoss.toFixed(2)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {leak.examples.map((ex, i) => (
                  <Badge key={i} tone={equityTone(ex.equityAtDecision * 100)}>
                    {ex.heroCards.join(" ")} vs {ex.street} — {(ex.equityAtDecision * 100).toFixed(0)}%
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

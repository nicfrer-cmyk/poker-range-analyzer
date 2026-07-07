"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import type { ComboBucket } from "@/lib/analysisTypes";
import { MADE_TIER_LABEL } from "@/lib/labels";
import type { MadeTier } from "@/lib/engine/classify";

const COLORS = [
  "#1FA858",
  "#5B5BE0",
  "#C99A12",
  "#E07B22",
  "#DC3D45",
  "#8F8FF7",
  "#0B7A3E",
  "#697080",
];

export function RangePieChart({ buckets }: { buckets: ComboBucket[] }) {
  const data = buckets
    .filter((b) => b.weight > 0)
    .map((b) => ({
      name: MADE_TIER_LABEL[b.category as MadeTier] ?? b.category,
      value: Math.round(b.weight * 1000) / 10,
    }));

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>הרכב הטווח של היריב</PanelTitle>
      </PanelHeader>
      <PanelBody className="h-64">
        {data.length === 0 ? (
          <p className="text-sm text-base-muted">הזן טווח יריב כדי לראות את ההרכב שלו.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [`${value}%`, name]}
                contentStyle={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E5EB",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </PanelBody>
    </Panel>
  );
}

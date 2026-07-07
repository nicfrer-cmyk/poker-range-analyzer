"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import type { ComboBucket } from "@/lib/analysisTypes";

const COLORS = [
  "#2FBE6B",
  "#6C6CF2",
  "#E8C547",
  "#F0913B",
  "#E5484D",
  "#8F8FF7",
  "#0F6B3F",
  "#5B6472",
];

export function RangePieChart({ buckets }: { buckets: ComboBucket[] }) {
  const data = buckets
    .filter((b) => b.weight > 0)
    .map((b) => ({ name: b.category, value: Math.round(b.weight * 1000) / 10 }));

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Villain Range Composition</PanelTitle>
      </PanelHeader>
      <PanelBody className="h-64">
        {data.length === 0 ? (
          <p className="text-sm text-base-muted">Enter a villain range to see its composition.</p>
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
                  background: "#12151C",
                  border: "1px solid #242936",
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

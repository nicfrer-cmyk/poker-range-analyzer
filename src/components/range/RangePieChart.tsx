"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import type { ComboBucket } from "@/lib/analysisTypes";
import { MADE_TIER_LABEL } from "@/lib/labels";
import type { MadeTier } from "@/lib/engine/classify";
import { useTheme } from "@/lib/useTheme";

// Mirrors globals.css CSS variables per theme — recharts fills need plain rgb() strings,
// Tailwind classes don't apply to SVG fill/stroke attributes.
const COLORS_BY_THEME: Record<"light" | "dark", string[]> = {
  light: ["rgb(31 168 88)", "rgb(91 91 224)", "rgb(201 154 18)", "rgb(224 123 34)", "rgb(220 61 69)", "rgb(143 143 247)", "rgb(11 122 62)", "rgb(105 112 128)"],
  dark: ["rgb(47 190 107)", "rgb(138 138 244)", "rgb(232 197 71)", "rgb(240 145 59)", "rgb(229 72 77)", "rgb(168 168 248)", "rgb(25 150 85)", "rgb(150 158 170)"],
};
const TOOLTIP_BG: Record<"light" | "dark", { bg: string; border: string }> = {
  light: { bg: "rgb(255 255 255)", border: "rgb(226 229 235)" },
  dark: { bg: "rgb(13 15 19)", border: "rgb(44 49 58)" },
};

export function RangePieChart({ buckets }: { buckets: ComboBucket[] }) {
  const [theme] = useTheme();
  const colors = COLORS_BY_THEME[theme];
  const tooltipColors = TOOLTIP_BG[theme];
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
                  <Cell key={i} fill={colors[i % colors.length]} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [`${value}%`, name]}
                contentStyle={{
                  background: tooltipColors.bg,
                  border: `1px solid ${tooltipColors.border}`,
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

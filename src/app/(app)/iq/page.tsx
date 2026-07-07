"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { listHands, type StoredHand } from "@/lib/localHandStore";
import { loadProgress, type TrainingProgress } from "@/lib/training";
import { computeSkillTree } from "@/lib/coach/skillTree";
import { computePokerIQ, getIqHistory, recordIqSnapshotIfNeeded, getWeeklyDelta, type IqSnapshot } from "@/lib/coach/iq";
import { useTheme } from "@/lib/useTheme";

// Mirrors globals.css CSS variables per theme — recharts axis/grid/line colors need plain
// rgb() strings, Tailwind classes don't apply to SVG stroke attributes.
const CHART_COLORS: Record<"light" | "dark", { grid: string; axis: string; score: string; tooltipBg: string; tooltipBorder: string }> = {
  light: { grid: "rgb(226 229 235)", axis: "rgb(105 112 128)", score: "rgb(91 91 224)", tooltipBg: "rgb(255 255 255)", tooltipBorder: "rgb(226 229 235)" },
  dark: { grid: "rgb(44 49 58)", axis: "rgb(150 158 170)", score: "rgb(138 138 244)", tooltipBg: "rgb(13 15 19)", tooltipBorder: "rgb(44 49 58)" },
};

export default function PokerIqPage() {
  const [theme] = useTheme();
  const chartColors = CHART_COLORS[theme];
  const [hands, setHands] = useState<StoredHand[]>([]);
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [history, setHistory] = useState<IqSnapshot[]>([]);

  useEffect(() => {
    setHands(listHands());
    setProgress(loadProgress());
  }, []);

  const iq = useMemo(() => {
    if (!progress) return null;
    const skillTree = computeSkillTree(hands, progress);
    return computePokerIQ(hands, progress, skillTree);
  }, [hands, progress]);

  useEffect(() => {
    if (!iq || hands.length === 0) return;
    recordIqSnapshotIfNeeded(iq.score);
    setHistory(getIqHistory());
  }, [iq, hands.length]);

  const weeklyDelta = iq ? getWeeklyDelta(history, iq.score) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Poker IQ</h1>
        <p className="mt-1 text-sm text-base-muted">
          ציון כולל 0-1000, מבוסס על איכות ההחלטות שלך, שליטה באימון, כיסוי עץ המיומנויות ועקביות.
        </p>
      </div>

      {hands.length === 0 || !iq ? (
        <Panel>
          <PanelBody className="py-12 text-center text-sm text-base-muted">
            עדיין אין ידיים שמורות. נתח כמה ידיים כדי לקבל ציון Poker IQ ראשוני.
          </PanelBody>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Panel>
              <PanelBody>
                <p className="text-xs text-base-muted">הציון הנוכחי</p>
                <p className="text-3xl font-bold">{iq.score}</p>
              </PanelBody>
            </Panel>
            <Panel>
              <PanelBody>
                <p className="text-xs text-base-muted">שינוי מהשבוע שעבר</p>
                {weeklyDelta === null ? (
                  <Badge tone="neutral">עדיין אין היסטוריה של שבוע</Badge>
                ) : (
                  <p className={`text-2xl font-bold ${weeklyDelta >= 0 ? "text-status-ahead" : "text-status-behind"}`}>
                    {weeklyDelta >= 0 ? "+" : ""}
                    {weeklyDelta}
                  </p>
                )}
              </PanelBody>
            </Panel>
            <Panel>
              <PanelBody>
                <p className="text-xs text-base-muted">ידיים בבסיס הציון</p>
                <p className="text-3xl font-bold">{hands.length}</p>
              </PanelBody>
            </Panel>
          </div>

          <Panel>
            <PanelHeader>
              <PanelTitle>התקדמות הציון</PanelTitle>
            </PanelHeader>
            <PanelBody className="h-64">
              {history.length < 2 ? (
                <div className="flex h-full items-center justify-center text-sm text-base-muted">
                  עדיין אין מספיק היסטוריה כדי להציג גרף — חזור מחר כדי לראות התקדמות.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="date" stroke={chartColors.axis} fontSize={11} />
                    <YAxis stroke={chartColors.axis} fontSize={11} domain={[0, 1000]} />
                    <Tooltip
                      contentStyle={{
                        background: chartColors.tooltipBg,
                        border: `1px solid ${chartColors.tooltipBorder}`,
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Line type="monotone" dataKey="score" stroke={chartColors.score} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>מה משפיע על הציון</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-3">
              {iq.breakdown.map((b) => (
                <div key={b.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{b.label}</span>
                    <span className="text-base-muted">
                      {b.points} / {b.maxPoints}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-base-panel2">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(b.points / b.maxPoints) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </PanelBody>
          </Panel>
        </>
      )}
    </div>
  );
}

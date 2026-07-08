"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { Button } from "@/components/ui/Button";
import { Badge, equityTone } from "@/components/ui/Badge";
import { PaywallModal } from "@/components/billing/PaywallModal";
import { listHands, type StoredHand } from "@/lib/localHandStore";
import { computeSessionStats, topLeaks, leaksByStreet, type TopLeak, type DecisionStreet } from "@/lib/engine/leakFinder";
import { formatLeakKey, LEAK_DIMENSION_LABEL, STREET_LABEL } from "@/lib/labels";
import { trendFor, type TrendDirection } from "@/lib/coach/weeklyReview";
import { useTheme } from "@/lib/useTheme";
import { useMockPlan } from "@/lib/useMockPlan";
import { canPerformAction } from "@/lib/plan";
import { cn } from "@/lib/utils/cn";
import type { StatusTone } from "@/lib/statusTone";

const PAYWALL_TITLE = "פתח את המאמן האישי המלא שלך";
const PAYWALL_BODY =
  "כבר התחלת לנתח ידיים. שדרוג ל-Pro יפתח לך ניתוחים ללא הגבלה, דוחות מלאים, זיהוי דפוסים ותוכנית לימוד אישית.";

// Mirrors globals.css CSS variables per theme — recharts axis/grid/line colors need plain
// rgb() strings, Tailwind classes don't apply to SVG stroke attributes.
const CHART_COLORS: Record<"light" | "dark", { grid: string; axis: string; equity: string; evLoss: string; tooltipBg: string; tooltipBorder: string }> = {
  light: { grid: "rgb(226 229 235)", axis: "rgb(105 112 128)", equity: "rgb(91 91 224)", evLoss: "rgb(220 61 69)", tooltipBg: "rgb(255 255 255)", tooltipBorder: "rgb(226 229 235)" },
  dark: { grid: "rgb(44 49 58)", axis: "rgb(150 158 170)", equity: "rgb(138 138 244)", evLoss: "rgb(229 72 77)", tooltipBg: "rgb(13 15 19)", tooltipBorder: "rgb(44 49 58)" },
};

const TREND_LABEL: Record<TrendDirection, string> = {
  improving: "משתפר",
  worsening: "מחמיר",
  flat: "ללא שינוי",
  unknown: "עדיין אין מגמה",
};

const TREND_TONE: Record<TrendDirection, "crushing" | "behind" | "neutral"> = {
  improving: "crushing",
  worsening: "behind",
  flat: "neutral",
  unknown: "neutral",
};

const STREET_ORDER: DecisionStreet[] = ["preflop", "flop", "turn", "river"];

// Same tone tokens/ratios Badge.tsx uses — kept local since Badge doesn't export its class map.
const HEAT_TONE_CLASSES: Record<StatusTone, string> = {
  crushing: "bg-status-crushing/20 text-status-crushing border-status-crushing/40",
  ahead: "bg-status-ahead/20 text-status-ahead border-status-ahead/40",
  close: "bg-status-close/20 text-status-close border-status-close/40",
  risky: "bg-status-risky/20 text-status-risky border-status-risky/40",
  behind: "bg-status-behind/20 text-status-behind border-status-behind/40",
  neutral: "bg-base-panel2 text-base-muted border-base-border",
};

/** Reuses `equityTone`'s bucket thresholds, inverted: a high bad-decision-rate is "bad" the same
 *  way low equity is, so feeding it `100 - rate%` maps mistake severity onto the same five tones
 *  already used everywhere else on this page. */
function streetHeatTone(badDecisionRate: number): StatusTone {
  return equityTone(100 - badDecisionRate * 100);
}

function severityStars(leak: TopLeak): number {
  return Math.min(5, Math.max(1, Math.round(leak.badDecisionRate * 5)));
}

function leakExplanation(leak: TopLeak): string {
  const label = formatLeakKey(leak.dimension, leak.key);
  switch (leak.dimension) {
    case "position":
      return `בפוזיציית ${label} ההחלטות שלך סוטות מהממוצע שלך — שווה לבדוק את טווח המשחק מהפוזיציה הזו.`;
    case "handCategory":
      return `בידיים מסוג "${label}" נרשם אובדן EV גבוה מהרגיל — שווה לחזור על ההחלטות עם היד הזו ולבדוק אם הייתה עדיפות לפעולה אחרת.`;
    case "street":
      return `ב${label} נרשם אובדן EV גבוה מהממוצע — שווה לשים לב במיוחד להחלטות ברחוב הזה.`;
    case "potSizeBucket":
    default:
      return `בפוטים בגודל ${label} האובדן הממוצע היה גבוה מהממוצע הכללי — שווה לבדוק מחדש את ההחלטות שלך בפוטים מהסוג הזה.`;
  }
}

export default function LeaksPage() {
  const [theme] = useTheme();
  const chartColors = CHART_COLORS[theme];
  const [hands, setHands] = useState<StoredHand[]>([]);
  const [plan] = useMockPlan();
  const [paywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => {
    listHands().then(setHands);
  }, []);

  const stats = useMemo(() => computeSessionStats(hands), [hands]);
  const leaks = useMemo(() => topLeaks(hands, 8), [hands]);
  const streetGroups = useMemo(() => leaksByStreet(hands), [hands]);
  const fullLeakViewAllowed = canPerformAction(plan, "useLeakFinder").allowed;

  if (hands.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">גילוי דליפות</h1>
        <Panel>
          <PanelBody className="py-12 text-center text-sm text-base-muted">
            עדיין אין ידיים שמורות. שמור כמה ידיים מנותחות כדי לפתוח את גילוי הדליפות.
          </PanelBody>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">גילוי דליפות</h1>
        <p className="mt-1 text-sm text-base-muted">
          דפוסי טעות שחוזרים על עצמם, מזוהים מתוך כל הידיים ששמרת — ניתוח לאחר משחק בלבד.
        </p>
      </div>

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
            <p className="text-xs text-base-muted">דליפות שזוהו</p>
            <p className="text-2xl font-bold text-status-behind">{leaks.length}</p>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>מפת חום — אחוז טעויות לפי רחוב</PanelTitle>
        </PanelHeader>
        <PanelBody className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STREET_ORDER.map((street) => {
            const group = streetGroups.find((g) => g.key === street);
            const tone: StatusTone = group && group.count > 0 ? streetHeatTone(group.badDecisionRate) : "neutral";
            return (
              <div
                key={street}
                className={cn("rounded-lg border p-3 text-center", HEAT_TONE_CLASSES[tone])}
              >
                <p className="text-xs font-medium">{STREET_LABEL[street] ?? street}</p>
                <p className="mt-1 text-xl font-bold">
                  {group && group.count > 0 ? `${(group.badDecisionRate * 100).toFixed(0)}%` : "—"}
                </p>
                <p className="mt-0.5 text-[11px] opacity-80">
                  {group && group.count > 0 ? `${group.count} ידיים` : "אין נתונים"}
                </p>
              </div>
            );
          })}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>התקדמות לאורך זמן</PanelTitle>
        </PanelHeader>
        <PanelBody className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.trend}>
              <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
              <XAxis dataKey="bucket" stroke={chartColors.axis} fontSize={11} />
              <YAxis stroke={chartColors.axis} fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: chartColors.tooltipBg,
                  border: `1px solid ${chartColors.tooltipBorder}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="avgEquity" stroke={chartColors.equity} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="avgEvLoss" stroke={chartColors.evLoss} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>הדליפות שלך, מהחמורה לקלה</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-4">
          {leaks.length === 0 && <p className="text-sm text-base-muted">לא זוהו דליפות משמעותיות — כל הכבוד.</p>}

          {leaks.length > 0 && !fullLeakViewAllowed && (
            <>
              {/* Free teaser: reveal only the single most severe leak's dimension/key, without the
                  explanation text or example hands, so Free users see *that* there's a real finding
                  worth upgrading for rather than a generic placeholder. */}
              {(() => {
                const topLeak = leaks[0];
                if (!topLeak) return null;
                const trend = trendFor(hands, topLeak);
                return (
                  <div className="rounded-lg border border-base-border p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge tone="behind">{LEAK_DIMENSION_LABEL[topLeak.dimension] ?? topLeak.dimension}</Badge>
                        <span className="text-sm font-semibold">{formatLeakKey(topLeak.dimension, topLeak.key)}</span>
                        <span className="text-xs text-status-risky" title="חומרה">
                          {"★".repeat(severityStars(topLeak))}
                          <span className="text-base-border">{"★".repeat(5 - severityStars(topLeak))}</span>
                        </span>
                      </div>
                      <Badge tone={TREND_TONE[trend]}>{TREND_LABEL[trend]}</Badge>
                    </div>
                    <p className="text-sm text-base-muted">
                      זו הדליפה החמורה ביותר שזיהינו. שדרג לפרו כדי לראות את ההסבר המלא, ידיים לדוגמה,
                      ועד {Math.max(0, leaks.length - 1)} דליפות נוספות שזיהינו.
                    </p>
                  </div>
                );
              })()}
              <Panel className="border-accent/30 bg-accent/5">
                <PanelBody className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="text-sm text-base-text">שדרג לפרו לצפייה בכל הדליפות שזוהו</span>
                  <Button size="sm" onClick={() => setPaywallOpen(true)}>
                    שדרג לפרו
                  </Button>
                </PanelBody>
              </Panel>
            </>
          )}

          {leaks.length > 0 &&
            fullLeakViewAllowed &&
            leaks.map((leak) => {
              const trend = trendFor(hands, leak);
              return (
                <div key={`${leak.dimension}-${leak.key}`} className="rounded-lg border border-base-border p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge tone="behind">{LEAK_DIMENSION_LABEL[leak.dimension] ?? leak.dimension}</Badge>
                      <span className="text-sm font-semibold">{formatLeakKey(leak.dimension, leak.key)}</span>
                      <span className="text-xs text-status-risky" title="חומרה">
                        {"★".repeat(severityStars(leak))}
                        <span className="text-base-border">{"★".repeat(5 - severityStars(leak))}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral">{leak.count} ידיים</Badge>
                      <Badge tone={TREND_TONE[trend]}>{TREND_LABEL[trend]}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-base-text">{leakExplanation(leak)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {leak.examples.map((ex) => {
                      const stored = ex as StoredHand;
                      return (
                        <Link key={stored.id} href={`/hands/${stored.id}`}>
                          <Badge tone={equityTone(ex.equityAtDecision * 100)} className="cursor-pointer">
                            {ex.heroCards.join(" ")} · {STREET_LABEL[ex.street] ?? ex.street} ·{" "}
                            {(ex.equityAtDecision * 100).toFixed(0)}%
                          </Badge>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </PanelBody>
      </Panel>

      <PaywallModal
        open={paywallOpen}
        title={PAYWALL_TITLE}
        message={PAYWALL_BODY}
        primaryLabel="שדרג לפרו"
        secondaryLabel="המשך בחינם"
        onSecondaryClick={() => {}}
        hideFooterNote
        onClose={() => setPaywallOpen(false)}
      />
    </div>
  );
}

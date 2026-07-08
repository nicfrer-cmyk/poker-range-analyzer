"use client";

import { useMemo, useState } from "react";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PaywallModal } from "@/components/billing/PaywallModal";
import { calculateIcmEquity, icmEquityForStack } from "@/lib/engine/icm";
import { useMockPlan } from "@/lib/useMockPlan";
import { canPerformAction } from "@/lib/plan";
import type { StatusTone } from "@/lib/statusTone";

const PAYWALL_TITLE = "פתח את מחשבון ה-ICM";
const PAYWALL_BODY =
  "מחשבון ה-ICM ממיר את הערימה שלך בטורניר לערך כספי אמיתי, ומראה איך החלטות ליד הבועה או בשולחן הסופי משנות את השווי הזה. זמין במנוי פרו.";

const MAX_PLAYERS = 12;

interface PlayerRow {
  id: string;
  label: string;
  stack: string;
}

interface PayoutRow {
  id: string;
  amount: string;
}

let rowSeq = 0;
function nextId(prefix: string): string {
  rowSeq += 1;
  return `${prefix}${rowSeq}`;
}

function defaultPlayers(): PlayerRow[] {
  return [
    { id: nextId("p"), label: "אתה", stack: "5000" },
    { id: nextId("p"), label: "שחקן 2", stack: "3000" },
    { id: nextId("p"), label: "שחקן 3", stack: "2000" },
  ];
}

function defaultPayouts(): PayoutRow[] {
  return [
    { id: nextId("o"), amount: "50" },
    { id: nextId("o"), amount: "30" },
    { id: nextId("o"), amount: "20" },
  ];
}

function deltaTone(delta: number): StatusTone {
  if (delta > 0.01) return "ahead";
  if (delta < -0.01) return "behind";
  return "neutral";
}

function formatMoney(n: number): string {
  return n.toLocaleString("he-IL", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

interface ResultRow {
  id: string;
  label: string;
  stack: number;
  chipPct: number;
  equity: number;
  equityPct: number;
}

/** Plain-Hebrew, numbers-specific explanation of what the ICM result actually means for this
 *  exact field — contrasts the chip leader (whose $ share always lags their chip share once
 *  there's more than one paid position) against the short stack (whose $ share always leads
 *  their chip share), which is the concrete, teachable point of running an ICM calculation at
 *  all rather than just splitting the prize pool by chip count. */
function icmExplanation(rows: ResultRow[]): string {
  if (rows.length < 2) return "";
  const leader = [...rows].sort((a, b) => b.stack - a.stack)[0]!;
  const short = [...rows].sort((a, b) => a.stack - b.stack)[0]!;
  if (leader.id === short.id) return "";

  return (
    `ל${leader.label} יש ${leader.chipPct.toFixed(0)}% מהצ'יפים בשולחן, אבל רק ${leader.equityPct.toFixed(
      0
    )}% מהשווי הכספי בפועל — ה-ICM "מעניש" ערימה גדולה ליד הכסף, כי יש לה יותר מה להפסיד אם היא מסתבכת ` +
    `ומוציאה שחקנים חלשים מהמשחק. לעומת זאת ל${short.label} יש ${short.chipPct.toFixed(
      0
    )}% מהצ'יפים בלבד, אך ${short.equityPct.toFixed(
      0
    )}% מהשווי — יותר מהחלק היחסי בצ'יפים, כי ההישרדות עד כה כבר מבטיחה לה חלק מהמינימום-קאש בלי תלות במה שיקרה בהמשך.`
  );
}

export default function IcmPage() {
  const [plan] = useMockPlan();
  const [paywallOpen, setPaywallOpen] = useState(false);

  const [players, setPlayers] = useState<PlayerRow[]>(defaultPlayers);
  const [payouts, setPayouts] = useState<PayoutRow[]>(defaultPayouts);
  const [heroId, setHeroId] = useState<string>(() => players[0]?.id ?? "");
  const [heroNewStack, setHeroNewStack] = useState("");

  const [results, setResults] = useState<{ rows: ResultRow[]; totalChips: number; totalPrize: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updatePlayer = (id: string, patch: Partial<PlayerRow>) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const addPlayer = () => {
    if (players.length >= MAX_PLAYERS) return;
    setPlayers((prev) => [...prev, { id: nextId("p"), label: `שחקן ${prev.length + 1}`, stack: "" }]);
  };

  const removePlayer = (id: string) => {
    if (players.length <= 2) return;
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    if (heroId === id) setHeroId((prev) => players.find((p) => p.id !== id)?.id ?? prev);
  };

  const updatePayout = (id: string, amount: string) => {
    setPayouts((prev) => prev.map((p) => (p.id === id ? { ...p, amount } : p)));
  };

  const addPayout = () => {
    setPayouts((prev) => [...prev, { id: nextId("o"), amount: "" }]);
  };

  const removePayout = (id: string) => {
    if (payouts.length <= 1) return;
    setPayouts((prev) => prev.filter((p) => p.id !== id));
  };

  const runCalculate = () => {
    setError(null);

    const gate = canPerformAction(plan, "useIcmCalculator");
    if (!gate.allowed) {
      setPaywallOpen(true);
      return;
    }

    if (players.length < 2) {
      setError("הזן לפחות שני שחקנים.");
      return;
    }

    const stacks = players.map((p) => Number(p.stack));
    if (stacks.some((s) => !Number.isFinite(s) || s <= 0)) {
      setError("כל הערימות חייבות להיות מספרים חיוביים.");
      return;
    }

    const payoutAmounts = payouts.map((p) => Number(p.amount));
    if (payoutAmounts.some((a) => !Number.isFinite(a) || a < 0)) {
      setError("כל סכומי הפרסים חייבים להיות מספרים לא שליליים (0 מותר).");
      return;
    }

    try {
      const equities = calculateIcmEquity(stacks, payoutAmounts);
      const totalChips = stacks.reduce((s, v) => s + v, 0);
      const totalPrize = payoutAmounts.reduce((s, v) => s + v, 0);
      const rows: ResultRow[] = players.map((p, i) => ({
        id: p.id,
        label: p.label || `שחקן ${i + 1}`,
        stack: stacks[i] as number,
        chipPct: totalChips > 0 ? ((stacks[i] as number) / totalChips) * 100 : 0,
        equity: equities[i] as number,
        equityPct: totalPrize > 0 ? ((equities[i] as number) / totalPrize) * 100 : 0,
      }));
      setResults({ rows, totalChips, totalPrize });
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בחישוב ה-ICM — בדוק את הנתונים שהוזנו.");
    }
  };

  const heroIndex = players.findIndex((p) => p.id === heroId);

  const heroDelta = useMemo(() => {
    if (!results || heroIndex === -1 || heroNewStack.trim() === "") return null;
    const newStack = Number(heroNewStack);
    if (!Number.isFinite(newStack) || newStack < 0) return null;

    const stacks = players.map((p) => Number(p.stack));
    const payoutAmounts = payouts.map((p) => Number(p.amount));
    if (stacks.some((s) => !Number.isFinite(s) || s <= 0)) return null;
    if (payoutAmounts.some((a) => !Number.isFinite(a) || a < 0)) return null;

    try {
      const { heroEquity } = icmEquityForStack(stacks, payoutAmounts, heroIndex, newStack);
      const before = results.rows[heroIndex]?.equity ?? 0;
      return { before, after: heroEquity, delta: heroEquity - before };
    } catch {
      return null;
    }
  }, [results, heroIndex, heroNewStack, players, payouts]);

  const explanation = results ? icmExplanation(results.rows) : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">מחשבון ICM</h1>
          <p className="mt-1 text-sm text-base-muted">
            ממיר את הערימות בשולחן לערך כספי בפועל, לפי מבנה הפרסים בטורניר — לא רק מספר צ&apos;יפים.
          </p>
        </div>
        {plan === "FREE" && <Badge tone="neutral">תכונת פרו</Badge>}
      </div>

      <Panel>
        <PanelBody className="space-y-2 text-sm text-base-muted">
          <p>
            ה-ICM (Independent Chip Model) מחשב, לכל שחקן, את ההסתברות לסיים בכל מקום בטורניר לפי
            גודל הערימה שלו יחסית לשאר, ומכפיל בפרס הכספי של אותו מקום. ככל שמתקרבים לכסף או
            לשולחן הסופי, ערך הצ&apos;יפים מפסיק להיות ליניארי — ערימה גדולה שווה פחות $ ליחידת צ&apos;יפ
            מערימה קטנה, כי יש לה יותר מה להפסיד.
          </p>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>השחקנים הנותרים</PanelTitle>
          <Button size="sm" variant="secondary" onClick={addPlayer} disabled={players.length >= MAX_PLAYERS}>
            הוסף שחקן
          </Button>
        </PanelHeader>
        <PanelBody className="space-y-2">
          {players.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2">
              <input
                value={p.label}
                onChange={(e) => updatePlayer(p.id, { label: e.target.value })}
                placeholder={`שחקן ${i + 1}`}
                className="w-28 rounded-lg border border-base-border bg-base-panel2 px-2 py-1.5 text-sm outline-none focus:border-accent sm:w-40"
              />
              <input
                value={p.stack}
                onChange={(e) => updatePlayer(p.id, { stack: e.target.value })}
                inputMode="decimal"
                placeholder="גודל ערימה"
                className="flex-1 rounded-lg border border-base-border bg-base-panel2 px-2 py-1.5 text-sm outline-none focus:border-accent"
              />
              <label className="flex shrink-0 items-center gap-1 text-xs text-base-muted">
                <input type="radio" name="hero" checked={heroId === p.id} onChange={() => setHeroId(p.id)} />
                אני
              </label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removePlayer(p.id)}
                disabled={players.length <= 2}
                aria-label="הסר שחקן"
              >
                הסר
              </Button>
            </div>
          ))}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>מבנה הפרסים</PanelTitle>
          <Button size="sm" variant="secondary" onClick={addPayout}>
            הוסף מקום
          </Button>
        </PanelHeader>
        <PanelBody className="space-y-2">
          {payouts.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-sm text-base-muted">מקום {i + 1}</span>
              <input
                value={p.amount}
                onChange={(e) => updatePayout(p.id, e.target.value)}
                inputMode="decimal"
                placeholder="סכום הפרס"
                className="flex-1 rounded-lg border border-base-border bg-base-panel2 px-2 py-1.5 text-sm outline-none focus:border-accent"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removePayout(p.id)}
                disabled={payouts.length <= 1}
                aria-label="הסר מקום"
              >
                הסר
              </Button>
            </div>
          ))}
          <p className="text-[11px] text-base-muted/80">
            שחקנים שיסיימו מעבר למספר המקומות שהוגדרו כאן ייחשבו כמי שסיימו מחוץ לכסף (0$).
          </p>
        </PanelBody>
      </Panel>

      {error && (
        <Panel className="border-status-risky/40">
          <PanelBody className="py-3 text-sm text-status-risky">{error}</PanelBody>
        </Panel>
      )}

      <Button onClick={runCalculate}>חשב ICM</Button>

      {results && (
        <Panel>
          <PanelHeader>
            <PanelTitle>שווי ה-ICM לכל שחקן</PanelTitle>
          </PanelHeader>
          <PanelBody className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-base-border text-right text-xs text-base-muted">
                    <th className="py-1.5 pe-3 font-medium">שחקן</th>
                    <th className="py-1.5 pe-3 font-medium">צ&apos;יפים</th>
                    <th className="py-1.5 pe-3 font-medium">% מהצ&apos;יפים</th>
                    <th className="py-1.5 pe-3 font-medium">שווי ICM ($)</th>
                    <th className="py-1.5 font-medium">% מהפרסים</th>
                  </tr>
                </thead>
                <tbody>
                  {results.rows.map((r) => (
                    <tr key={r.id} className="border-b border-base-border/50 last:border-0">
                      <td className="py-1.5 pe-3 font-medium">{r.label}</td>
                      <td className="py-1.5 pe-3">{r.stack.toLocaleString()}</td>
                      <td className="py-1.5 pe-3">{r.chipPct.toFixed(1)}%</td>
                      <td className="py-1.5 pe-3 font-semibold">${formatMoney(r.equity)}</td>
                      <td className="py-1.5">{r.equityPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {explanation && <p className="text-sm leading-relaxed text-base-text/90">{explanation}</p>}
          </PanelBody>
        </Panel>
      )}

      {results && heroIndex !== -1 && (
        <Panel>
          <PanelHeader>
            <PanelTitle>איך החלטה משנה את השווי שלי</PanelTitle>
          </PanelHeader>
          <PanelBody className="space-y-3">
            <p className="text-sm text-base-muted">
              הזן מה תהיה הערימה שלך (בצ&apos;יפים) אחרי החלטה — למשל אחרי קול/פולד על ה-All-in — כדי
              לראות כמה $ שווי ה-ICM שלך משתנה, לפני שאתה מקבל את ההחלטה בפועל. הזן 0 כדי לדמות
              יציאה מהטורניר (הפסד ה-All-in).
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-base-muted">הערימה שלי אחרי ההחלטה:</span>
              <input
                value={heroNewStack}
                onChange={(e) => setHeroNewStack(e.target.value)}
                inputMode="decimal"
                placeholder="לדוגמה: 0 או 9000"
                className="w-40 rounded-lg border border-base-border bg-base-panel2 px-2 py-1.5 text-sm outline-none focus:border-accent"
              />
            </div>

            {heroDelta && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-base-border p-3">
                <span className="text-sm text-base-muted">
                  לפני: <span className="font-semibold text-base-text">${formatMoney(heroDelta.before)}</span>
                </span>
                <span className="text-sm text-base-muted">
                  אחרי: <span className="font-semibold text-base-text">${formatMoney(heroDelta.after)}</span>
                </span>
                <Badge tone={deltaTone(heroDelta.delta)}>
                  {heroDelta.delta > 0 ? "+" : ""}
                  {formatMoney(heroDelta.delta)}$
                </Badge>
              </div>
            )}
          </PanelBody>
        </Panel>
      )}

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

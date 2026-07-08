"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  addEntry,
  currentBalance,
  deleteEntry,
  listEntries,
  runningBalance,
  signedAmount,
  BANKROLL_TYPE_LABEL,
  type BankrollEntryType,
  type StoredBankrollEntry,
} from "@/lib/localBankrollStore";
import { useTheme } from "@/lib/useTheme";
import type { StatusTone } from "@/lib/statusTone";
import { cn } from "@/lib/utils/cn";

// Mirrors globals.css CSS variables per theme — recharts axis/grid/line colors need plain
// rgb() strings, Tailwind classes don't apply to SVG stroke attributes. Same pattern as
// leaks/page.tsx's CHART_COLORS.
const CHART_COLORS: Record<"light" | "dark", { grid: string; axis: string; balance: string; tooltipBg: string; tooltipBorder: string }> = {
  light: { grid: "rgb(226 229 235)", axis: "rgb(105 112 128)", balance: "rgb(91 91 224)", tooltipBg: "rgb(255 255 255)", tooltipBorder: "rgb(226 229 235)" },
  dark: { grid: "rgb(44 49 58)", axis: "rgb(150 158 170)", balance: "rgb(138 138 244)", tooltipBg: "rgb(13 15 19)", tooltipBorder: "rgb(44 49 58)" },
};

const STAKE_KEY = "pra:bankroll:stakeBuyIn";
const ENTRY_TYPES: BankrollEntryType[] = ["buy-in", "cash-out", "deposit", "withdrawal"];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(n: number): string {
  return n.toLocaleString("he-IL", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

function bankrollTone(buyIns: number): StatusTone {
  if (buyIns >= 30) return "crushing";
  if (buyIns >= 20) return "ahead";
  if (buyIns >= 10) return "close";
  if (buyIns >= 5) return "risky";
  return "behind";
}

function bankrollGuidance(buyIns: number, stake: number): string {
  const buyInsText = buyIns.toFixed(1);
  if (buyIns >= 20) {
    return `${buyInsText} באיינים בסטייק של ${formatMoney(stake)}₪ נחשב שמרני ובריא — יש לך כרית ביטחון סבירה מול ווריאנס רגילה.`;
  }
  if (buyIns >= 10) {
    return `${buyInsText} באיינים בסטייק הזה זה סביר אך לא שמרני — כדאי לשקול לבנות רזרבה גדולה יותר (סביב 20+ באיינים) לפני שמעלים בסטייק.`;
  }
  if (buyIns >= 0) {
    return `${buyInsText} באיינים בלבד בסטייק הזה נחשב חשוף לסיכון — פחות מ-10 באיינים משאיר מעט מרווח לרצף הפסדים רגיל. שווה לשקול ירידה בסטייק או הפקדה לבנקרול.`;
  }
  return "היתרה הנוכחית שלילית — לפני שממשיכים לשחק בסטייק הזה כדאי לעצור ולהעריך מחדש את הבנקרול.";
}

export default function BankrollPage() {
  const [theme] = useTheme();
  const chartColors = CHART_COLORS[theme];

  const [entries, setEntries] = useState<StoredBankrollEntry[]>([]);
  const [date, setDate] = useState(todayIso);
  const [type, setType] = useState<BankrollEntryType>("buy-in");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [stakeBuyIn, setStakeBuyInState] = useState("");

  useEffect(() => {
    setEntries(listEntries());
    const storedStake = window.localStorage.getItem(STAKE_KEY);
    if (storedStake) setStakeBuyInState(storedStake);
  }, []);

  const setStakeBuyIn = (value: string) => {
    setStakeBuyInState(value);
    window.localStorage.setItem(STAKE_KEY, value);
  };

  const balance = useMemo(() => currentBalance(entries), [entries]);
  const chartData = useMemo(() => runningBalance(entries), [entries]);
  const stakeNumber = Number(stakeBuyIn);
  const buyInsRepresented = Number.isFinite(stakeNumber) && stakeNumber > 0 ? balance / stakeNumber : null;

  const handleAdd = () => {
    setFormError(null);
    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setFormError("הזן סכום חיובי.");
      return;
    }
    if (!date) {
      setFormError("בחר תאריך.");
      return;
    }
    addEntry({ date, type, amount: amountNumber, note: note.trim() || undefined });
    setEntries(listEntries());
    setAmount("");
    setNote("");
  };

  const handleDelete = (entry: StoredBankrollEntry) => {
    const confirmed = window.confirm("למחוק את הרשומה הזו? הפעולה אינה הפיכה.");
    if (!confirmed) return;
    deleteEntry(entry.id);
    setEntries(listEntries());
  };

  const displayEntries = useMemo(() => [...entries].reverse(), [entries]); // newest first for the list

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">מעקב בנקרול</h1>
        <p className="mt-1 text-sm text-base-muted">
          יומן ידני של תנועות בבנקרול שלך — באיינים, קאשאאוטים, הפקדות ומשיכות — עם גרף יתרה
          לאורך זמן והנחיית ניהול בנקרול. יומן זה עצמאי לחלוטין ואינו קשור לידיים שנשמרו.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">יתרה נוכחית</p>
            <p className={cn("text-2xl font-bold", balance < 0 ? "text-status-behind" : "text-base-text")}>
              {formatMoney(balance)}₪
            </p>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">רשומות ביומן</p>
            <p className="text-2xl font-bold">{entries.length}</p>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>ניהול בנקרול</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-base-muted">גודל באיין טיפוסי בסטייק שלך:</span>
            <input
              value={stakeBuyIn}
              onChange={(e) => setStakeBuyIn(e.target.value)}
              inputMode="decimal"
              placeholder="לדוגמה: 200"
              className="w-32 rounded-lg border border-base-border bg-base-panel2 px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
            <span className="text-sm text-base-muted">₪</span>
          </div>

          {buyInsRepresented !== null ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-base-border p-3">
              <Badge tone={bankrollTone(buyInsRepresented)}>{buyInsRepresented.toFixed(1)} באיינים</Badge>
              <p className="flex-1 text-sm leading-relaxed text-base-text/90">
                {bankrollGuidance(buyInsRepresented, stakeNumber)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-base-muted">
              הזן גודל באיין טיפוסי כדי לראות כמה באיינים היתרה שלך מייצגת, והאם זה שמרני או
              מסוכן לסטייק הזה.
            </p>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>יתרה לאורך זמן</PanelTitle>
        </PanelHeader>
        <PanelBody className="h-64">
          {chartData.length === 0 ? (
            <p className="text-sm text-base-muted">הוסף רשומה כדי לראות את גרף היתרה.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke={chartColors.axis} fontSize={11} />
                <YAxis stroke={chartColors.axis} fontSize={11} />
                <Tooltip
                  formatter={(value: number) => [`${formatMoney(value)}₪`, "יתרה"]}
                  contentStyle={{
                    background: chartColors.tooltipBg,
                    border: `1px solid ${chartColors.tooltipBorder}`,
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="balance" stroke={chartColors.balance} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>הוספת רשומה</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-base-border bg-base-panel2 px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as BankrollEntryType)}
              className="rounded-lg border border-base-border bg-base-panel2 px-2 py-1.5 text-sm outline-none focus:border-accent"
            >
              {ENTRY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {BANKROLL_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="סכום (₪)"
              className="rounded-lg border border-base-border bg-base-panel2 px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="הערה (לא חובה)"
              className="rounded-lg border border-base-border bg-base-panel2 px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
          </div>
          {formError && <p className="text-sm text-status-risky">{formError}</p>}
          <Button onClick={handleAdd}>הוסף רשומה</Button>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>כל הרשומות</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-2">
          {displayEntries.length === 0 ? (
            <p className="text-sm text-base-muted">עדיין אין רשומות ביומן הבנקרול.</p>
          ) : (
            displayEntries.map((entry) => {
              const signed = signedAmount(entry);
              return (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-base-border p-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-base-muted">{entry.date}</span>
                    <Badge tone="neutral">{BANKROLL_TYPE_LABEL[entry.type]}</Badge>
                    {entry.note && <span className="text-xs text-base-muted">{entry.note}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-semibold", signed >= 0 ? "text-status-ahead" : "text-status-behind")}>
                      {signed >= 0 ? "+" : ""}
                      {formatMoney(signed)}₪
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(entry)}>
                      מחק
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}

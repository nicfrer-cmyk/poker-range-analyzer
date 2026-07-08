"use client";

import { useEffect, useState } from "react";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PaywallModal } from "@/components/billing/PaywallModal";
import { listHands, type StoredHand } from "@/lib/localHandStore";
import { buildHandSummary } from "@/lib/handSummary";
import { useMockPlan } from "@/lib/useMockPlan";
import { canPerformAction } from "@/lib/plan";
import { getTodayCount, incrementToday } from "@/lib/usageTracker";
import { track } from "@/lib/analytics";

const PAYWALL_TITLE = "פתח את המאמן האישי המלא שלך";
const PAYWALL_BODY =
  "כבר התחלת לנתח ידיים. שדרוג ל-Pro יפתח לך ניתוחים ללא הגבלה, דוחות מלאים, זיהוי דפוסים ותוכנית לימוד אישית.";

function ReviewText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h3 key={i} className="pt-2 text-sm font-semibold text-accent-soft">
              {line.replace("## ", "")}
            </h3>
          );
        }
        if (!line.trim()) return null;
        return (
          <p key={i} className="text-sm leading-relaxed text-base-text/90">
            {line}
          </p>
        );
      })}
    </div>
  );
}

export default function AiReviewPage() {
  const [hands, setHands] = useState<StoredHand[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [pastedText, setPastedText] = useState("");
  const [mode, setMode] = useState<"saved" | "paste">("saved");
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [plan] = useMockPlan();

  useEffect(() => {
    listHands().then(setHands);
  }, []);

  const runReview = async () => {
    setError(null);
    setReview(null);

    const gate = canPerformAction(plan, "runAiReview", getTodayCount("ai-review"));
    if (!gate.allowed) {
      setPaywallOpen(true);
      return;
    }

    const body =
      mode === "paste"
        ? { handHistoryText: pastedText }
        : { handSummary: hands.find((h) => h.id === selectedId) ? buildHandSummary(hands.find((h) => h.id === selectedId)!) : "" };

    if (mode === "paste" && !pastedText.trim()) {
      setError("הדבק היסטוריית יד לניתוח.");
      return;
    }
    if (mode === "saved" && !selectedId) {
      setError("בחר יד שמורה לניתוח.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/ai/hand-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { review?: string; error?: string };
      if (!res.ok || !data.review) {
        setError(data.error ?? "שגיאה בניתוח היד.");
        return;
      }
      incrementToday("ai-review");
      setReview(data.review);
    } catch {
      setError("שגיאת רשת — נסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">ניתוח יד נרטיבי עם AI</h1>
      <Panel>
        <PanelBody className="space-y-2 text-sm text-base-muted">
          <p>
            סקירה מלאה של היד בשפה פשוטה, המבוססת על ניתוח שכבר בוצע. זהו ניתוח לימודי
            לאחר סיום היד בלבד — לעולם לא בזמן משחק.
          </p>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>בחר מקור ליד</PanelTitle>
          <div className="flex gap-2">
            <Button size="sm" variant={mode === "saved" ? "primary" : "secondary"} onClick={() => setMode("saved")}>
              יד שמורה
            </Button>
            <Button size="sm" variant={mode === "paste" ? "primary" : "secondary"} onClick={() => setMode("paste")}>
              הדבקת היסטוריה
            </Button>
          </div>
        </PanelHeader>
        <PanelBody className="space-y-3">
          {mode === "saved" ? (
            hands.length === 0 ? (
              <p className="text-sm text-base-muted">אין עדיין ידיים שמורות לניתוח.</p>
            ) : (
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full rounded-lg border border-base-border bg-base-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
              >
                <option value="">בחר יד...</option>
                {hands.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.heroCards.join(" ")} · {h.board.join(" ") || "פרה-פלופ"} ·{" "}
                    {(h.equityAtDecision * 100).toFixed(0)}%
                  </option>
                ))}
              </select>
            )
          ) : (
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={8}
              placeholder="הדבק כאן היסטוריית יד גולמית..."
              className="w-full rounded-lg border border-base-border bg-base-panel2 p-3 font-mono text-xs outline-none focus:border-accent"
            />
          )}
          <Button onClick={runReview} disabled={loading}>
            {loading ? "מנתח…" : "נתח עם AI"}
          </Button>
        </PanelBody>
      </Panel>

      {error && (
        <Panel className="border-status-risky/40">
          <PanelBody className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="text-sm text-status-risky">{error}</span>
            {error.includes("מפתח") ? null : (
              <a href="/billing" onClick={() => track("upgrade_clicked", { source: "ai_review" })}>
                <Button size="sm">שדרוג לפרו</Button>
              </a>
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

      {review && (
        <Panel className="border-accent/30 bg-gradient-to-br from-accent/5 to-transparent">
          <PanelHeader>
            <PanelTitle>הסקירה</PanelTitle>
            <Badge tone="neutral">לימודי · לאחר משחק בלבד</Badge>
          </PanelHeader>
          <PanelBody>
            <ReviewText text={review} />
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}

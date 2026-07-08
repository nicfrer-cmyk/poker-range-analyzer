"use client";

import { useEffect, useRef, useState } from "react";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PaywallModal } from "@/components/billing/PaywallModal";
import { listHands, type StoredHand } from "@/lib/localHandStore";
import { buildHandSummary } from "@/lib/handSummary";
import { useMockPlan } from "@/lib/useMockPlan";
import { canPerformAction } from "@/lib/plan";
import { getTodayCount, incrementToday } from "@/lib/usageTracker";
import { fileToBase64 } from "@/lib/utils/file";
import { track } from "@/lib/analytics";

const PAYWALL_TITLE = "פתח את המאמן האישי המלא שלך";
const PAYWALL_BODY =
  "כבר התחלת לנתח ידיים. שדרוג ל-Pro יפתח לך ניתוחים ללא הגבלה, דוחות מלאים, זיהוי דפוסים ותוכנית לימוד אישית.";

const STEPS = [
  { n: 1, label: "מעלים תמונה של השולחן" },
  { n: 2, label: "ה-AI מזהה את הקלפים, הבורד והפוט" },
  { n: 3, label: "מקבלים סקירה מקצועית שלב אחר שלב" },
];

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
  const [mode, setMode] = useState<"image" | "saved" | "paste">("image");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [plan] = useMockPlan();
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    listHands().then(setHands);
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const handleImageSelect = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImageFile(file);
    setImagePreviewUrl(url);
    setError(null);
  };

  const runReview = async () => {
    setError(null);
    setReview(null);

    const gate = canPerformAction(plan, "runAiReview", getTodayCount("ai-review"));
    if (!gate.allowed) {
      setPaywallOpen(true);
      return;
    }

    if (mode === "image" && !imageFile) {
      setError("העלה תמונה של שולחן המשחק לניתוח.");
      return;
    }
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
      const body =
        mode === "image" && imageFile
          ? { imageBase64: await fileToBase64(imageFile), mediaType: imageFile.type }
          : mode === "paste"
          ? { handHistoryText: pastedText }
          : {
              handSummary: hands.find((h) => h.id === selectedId)
                ? buildHandSummary(hands.find((h) => h.id === selectedId)!)
                : "",
            };

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
      track("hand_review_completed", { source: mode });
      setReview(data.review);
    } catch {
      setError("שגיאת רשת — נסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ניתוח יד נרטיבי עם AI</h1>
        <p className="mt-1 text-sm text-base-muted">
          העלה תמונה של שולחן המשחק בסיום היד — Claude יזהה את הקלפים, הבורד והפוט, ויכתוב סקירה
          מקצועית שלב אחר שלב בעברית פשוטה. אפשר גם לבחור יד שמורה או להדביק היסטוריית יד כטקסט.
          זהו ניתוח לימודי לאחר סיום היד בלבד — לעולם לא בזמן משחק.
        </p>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>בחר מקור ליד</PanelTitle>
          <div className="flex gap-2">
            <Button size="sm" variant={mode === "image" ? "primary" : "secondary"} onClick={() => setMode("image")}>
              תמונה
            </Button>
            <Button size="sm" variant={mode === "saved" ? "primary" : "secondary"} onClick={() => setMode("saved")}>
              יד שמורה
            </Button>
            <Button size="sm" variant={mode === "paste" ? "primary" : "secondary"} onClick={() => setMode("paste")}>
              הדבקת היסטוריה
            </Button>
          </div>
        </PanelHeader>
        <PanelBody className="space-y-4">
          {mode === "image" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                {STEPS.map((step, i) => (
                  <div key={step.n} className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent-soft">
                      {step.n}
                    </span>
                    <span className="text-xs text-base-muted">{step.label}</span>
                    {i < STEPS.length - 1 && <span className="hidden text-base-muted/50 sm:inline">←</span>}
                  </div>
                ))}
              </div>

              <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-base-border bg-base-panel2 p-8 text-center">
                {imagePreviewUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreviewUrl}
                      alt="תצוגה מקדימה של השולחן שהועלה"
                      className="max-h-56 rounded-lg border border-base-border object-contain"
                    />
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer text-xs text-accent-soft underline">
                        החלפת תמונה
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/gif,image/webp"
                          className="hidden"
                          onChange={(e) => handleImageSelect(e.target.files)}
                        />
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-10 w-10 text-base-muted">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10.5M4 16.5l4.5-4.5a2 2 0 0 1 2.8 0l1.7 1.7a2 2 0 0 0 2.8 0L19 11m-15 5.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium">העלאת תמונה של שולחן המשחק</p>
                      <p className="mt-1 text-xs text-base-muted">JPEG, PNG, GIF או WebP</p>
                    </div>
                    <label className="cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">
                      בחירת תמונה
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        className="hidden"
                        onChange={(e) => handleImageSelect(e.target.files)}
                      />
                    </label>
                  </>
                )}
              </div>
            </div>
          )}

          {mode === "saved" &&
            (hands.length === 0 ? (
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
            ))}

          {mode === "paste" && (
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

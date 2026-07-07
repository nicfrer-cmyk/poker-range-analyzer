"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { parseBulkHandHistories, type ParsedHand } from "@/lib/engine/handHistoryParser";
import { parsedHandToBoard, parsedHandToAnalysisInput } from "@/lib/importAdapter";
import { useAnalysisStore } from "@/lib/store/analysisStore";
import { useMockPlan } from "@/lib/useMockPlan";
import { canPerformAction } from "@/lib/plan";
import { getTodayCount, incrementToday } from "@/lib/usageTracker";

export function HandHistoryImporter() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedHand[]>([]);
  const [showScreenshotStub, setShowScreenshotStub] = useState(false);
  const [plan] = useMockPlan();
  const [gateMessage, setGateMessage] = useState<string | null>(null);

  const handleParse = () => {
    const gate = canPerformAction(plan, "importHand", getTodayCount("import"));
    if (!gate.allowed) {
      setGateMessage(gate.reason ?? "הגעת למגבלת הייבוא היומית.");
      return;
    }
    setGateMessage(null);
    incrementToday("import");
    setParsed(parseBulkHandHistories(text));
  };

  const handleFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const bulkGate = canPerformAction(plan, "bulkImportHands");
    if (files.length > 1 && !bulkGate.allowed) {
      setGateMessage(bulkGate.reason ?? "ייבוא מרובה זמין רק במנוי פרו.");
      return;
    }
    const contents = await Promise.all(Array.from(files).map((f) => f.text()));
    const combined = contents.join("\n\n");
    setText((prev) => (prev ? `${prev}\n\n${combined}` : combined));
    setParsed(parseBulkHandHistories(combined));
  };

  const loadIntoAnalyzer = (hand: ParsedHand) => {
    const partial = parsedHandToAnalysisInput(hand);
    const store = useAnalysisStore.getState();
    if (partial.heroCards) {
      partial.heroCards.forEach((c, i) => c && store.setHeroCard(i as 0 | 1, c));
    }
    if (partial.board) {
      partial.board.forEach((c, i) => c && store.setBoardCard(i, c));
    }
    if (partial.pot !== undefined) store.setField("pot", partial.pot);
    if (partial.villainRangeText) store.setVillainRangeText(partial.villainRangeText);
    router.push("/analyze");
  };

  return (
    <div className="space-y-6">
      {gateMessage && (
        <Panel className="border-status-risky/40">
          <PanelBody className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="text-sm text-status-risky">{gateMessage}</span>
            <a href="/billing">
              <Button size="sm">שדרוג לפרו</Button>
            </a>
          </PanelBody>
        </Panel>
      )}
      <Panel>
        <PanelHeader>
          <PanelTitle>הדבקת היסטוריית יד</PanelTitle>
          <Button size="sm" variant="ghost" onClick={() => setShowScreenshotStub(true)}>
            ניתוח מצילום מסך
          </Button>
        </PanelHeader>
        <PanelBody className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder="הדבק כאן היסטוריית יד אחת או כמה (בפורמט PokerStars / GGPoker / ClubGG)…"
            className="w-full rounded-lg border border-base-border bg-base-panel2 p-3 font-mono text-xs outline-none focus:border-accent"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleParse}>פענוח</Button>
            <label className="cursor-pointer text-xs text-accent-soft underline">
              העלאת קובץ(ים)
              <input
                type="file"
                multiple
                accept=".txt"
                className="hidden"
                onChange={(e) => handleFile(e.target.files)}
              />
            </label>
            <span className="text-xs text-base-muted">
              ייבוא מרובה — הדבק כמה ידיים, כל אחת מופרדת בשורה ריקה.
            </span>
          </div>
        </PanelBody>
      </Panel>

      {showScreenshotStub && (
        <Panel>
          <PanelBody className="space-y-2 py-6 text-center">
            <Badge tone="neutral">בקרוב</Badge>
            <p className="text-sm text-base-muted">
              ניתוח מצילום מסך דורש מודל ראייה שיודע לזהות קלפים מתוך תמונה. נקודת הכניסה הזו כבר
              מוכנה — צריך רק לחבר API של ראייה כדי להפעיל אותה. בינתיים, הדבק את טקסט היסטוריית
              היד למעלה.
            </p>
            <Button size="sm" variant="ghost" onClick={() => setShowScreenshotStub(false)}>
              סגירה
            </Button>
          </PanelBody>
        </Panel>
      )}

      {parsed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-base-muted">
            {parsed.length === 1 ? "פוענחה יד אחת" : `פוענחו ${parsed.length} ידיים`}
          </h3>
          {parsed.map((hand, i) => (
            <Panel key={i}>
              <PanelBody className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Badge tone="neutral">{hand.format}</Badge>
                  <div className="flex gap-1">
                    {(hand.heroCards ?? []).map((c, j) => (
                      <PlayingCard key={j} card={c} size="sm" />
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {parsedHandToBoard(hand).map((c, j) => (
                      <PlayingCard key={j} card={c} size="sm" />
                    ))}
                  </div>
                  <span className="text-xs text-base-muted">
                    פוט: ${hand.potSize ?? "?"} · {hand.heroPosition ?? "פוזיציה לא ידועה"}
                  </span>
                </div>
                <Button size="sm" onClick={() => loadIntoAnalyzer(hand)}>
                  טעינה לכלי הניתוח
                </Button>
              </PanelBody>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

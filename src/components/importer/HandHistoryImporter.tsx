"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PlayingCard } from "@/components/cards/PlayingCard";
import type { ActionTaken } from "@/lib/engine/leakFinder";
import { parseBulkHandHistories, type ParsedHand } from "@/lib/engine/handHistoryParser";
import { parsedHandToBoard, parsedHandToAnalysisInput } from "@/lib/importAdapter";
import { useAnalysisStore, type AnalysisInput } from "@/lib/store/analysisStore";
import { runAnalysis } from "@/lib/analysisEngine";
import { saveHand } from "@/lib/localHandStore";
import { createSession } from "@/lib/localSessionStore";
import { useMockPlan } from "@/lib/useMockPlan";
import { canPerformAction, isNearLimit } from "@/lib/plan";
import { getTodayCount, incrementToday } from "@/lib/usageTracker";
import { track } from "@/lib/analytics";

function defaultSessionName(): string {
  return `ייבוא מ-${new Date().toLocaleDateString("he-IL")}`;
}

/** Display label for a detected hand-history format. `parseHandHistory` is format-agnostic
 *  beyond the header-line heuristic, so a hand can still parse successfully even when the
 *  format itself wasn't recognized — the "unknown" label makes that explicit rather than
 *  showing the bare, potentially confusing word "unknown". */
const FORMAT_LABEL: Record<ParsedHand["format"], string> = {
  pokerstars: "PokerStars",
  ggpoker: "GGPoker",
  clubgg: "ClubGG",
  "888poker": "888poker",
  unknown: "פורמט לא מזוהה — ניסיון פענוח כללי",
};

/** Hero's last recorded action in the hand, mapped to the analyzer's ActionTaken type.
 *  Falls back to "call" when nothing usable was parsed (e.g. hero folded pre-parse or the
 *  action verb isn't one the analyzer tracks) — mirrors the "reasonable guess" approach the
 *  importer already uses for villain range. */
function heroLastAction(hand: ParsedHand): ActionTaken {
  const heroActions = hand.actions.filter((a) => a.player === hand.heroName);
  const last = [...heroActions].reverse().find((a) =>
    (["fold", "check", "call", "bet", "raise"] as const).includes(a.action as ActionTaken)
  );
  return (last?.action as ActionTaken) ?? "call";
}

/** Builds a best-effort AnalysisInput from a parsed hand so it can be run through the engine
 *  and saved to the library without the user manually opening each hand in the analyzer. */
function parsedHandToFullInput(hand: ParsedHand): AnalysisInput {
  const partial = parsedHandToAnalysisInput(hand);
  const numPlayers = hand.seats.length || 2;
  return {
    gameType: "cash",
    tableSize: numPlayers,
    smallBlind: 1,
    bigBlind: 2,
    heroPosition: hand.heroPosition ?? "BTN",
    villainPosition: "BB",
    heroCards: partial.heroCards ?? [],
    board: partial.board ?? [],
    villainRangeText: partial.villainRangeText ?? "22+,A2s+,K7s+,Q9s+,J9s+,T8s+,98s,A7o+,KTo+,QJo",
    pot: partial.pot ?? 100,
    toCall: 0,
    heroStack: 1000,
    numPlayers,
    actionTaken: heroLastAction(hand),
    betSize: 0,
  };
}

export function HandHistoryImporter() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedHand[]>([]);
  const [showScreenshotStub, setShowScreenshotStub] = useState(false);
  const [plan] = useMockPlan();
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState(defaultSessionName());
  const [sessionSavedMessage, setSessionSavedMessage] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [savingSession, setSavingSession] = useState(false);
  const nearImportLimit = isNearLimit(plan, "importHand", getTodayCount("import"));

  const handleParse = () => {
    const gate = canPerformAction(plan, "importHand", getTodayCount("import"));
    if (!gate.allowed) {
      setGateMessage(gate.reason ?? "הגעת למגבלת הייבוא היומית.");
      return;
    }
    setGateMessage(null);
    setSessionSavedMessage(null);
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
    setSessionSavedMessage(null);
    setParsed(parseBulkHandHistories(combined));
  };

  /** Saves every currently-parsed hand to the hand library and groups the resulting hand IDs
   *  into a new session, so a batch import shows up as one session in Session Review rather
   *  than a pile of unrelated hands. */
  const saveAllAsSession = async () => {
    setSavingSession(true);
    setSessionError(null);
    setSessionSavedMessage(null);
    try {
      const results = await Promise.all(
        parsed.map(async (hand) => {
          const input = parsedHandToFullInput(hand);
          const result = runAnalysis(input);
          if (!result) return null;
          const stored = await saveHand({
            input,
            result,
            action: input.actionTaken,
            position: hand.heroPosition,
            source: "imported",
            streetActions: hand.actions,
          });
          return stored.id;
        })
      );
      const handIds = results.filter((id): id is string => Boolean(id));

      if (handIds.length === 0) {
        setSessionSavedMessage("לא נמצאו ידיים תקינות לשמירה (חסרים קלפי הירו).");
        return;
      }
      const name = sessionName.trim() || defaultSessionName();
      createSession(name, handIds);
      setSessionSavedMessage(`נשמרו ${handIds.length} ידיים לספרייה תחת הסשן "${name}".`);
    } catch {
      setSessionError("שגיאה בשמירת הידיים — נסה שוב.");
    } finally {
      setSavingSession(false);
    }
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
            <a href="/billing" onClick={() => track("upgrade_clicked", { source: "importer" })}>
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
            {nearImportLimit && (
              <Badge tone="close">כמעט הגעת למגבלת הייבוא היומית בתוכנית החינמית</Badge>
            )}
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

          <Panel>
            <PanelBody className="flex flex-wrap items-center gap-3">
              <input
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="שם הסשן"
                className="min-w-[200px] flex-1 rounded-lg border border-base-border bg-base-panel2 px-2.5 py-1.5 text-sm outline-none focus:border-accent"
              />
              <Button size="sm" onClick={saveAllAsSession} disabled={savingSession}>
                {savingSession ? "שומר…" : "שמירת כל הידיים לספרייה כסשן חדש"}
              </Button>
              {sessionSavedMessage && (
                <span className="text-xs text-base-muted">{sessionSavedMessage}</span>
              )}
              {sessionError && <span className="text-xs text-status-risky">{sessionError}</span>}
            </PanelBody>
          </Panel>

          {parsed.map((hand, i) => (
            <Panel key={i}>
              <PanelBody className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Badge tone="neutral">{FORMAT_LABEL[hand.format]}</Badge>
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

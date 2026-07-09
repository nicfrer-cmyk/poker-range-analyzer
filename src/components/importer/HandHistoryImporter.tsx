"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { CardPicker } from "@/components/cards/CardPicker";
import type { ActionTaken } from "@/lib/engine/leakFinder";
import type { Card } from "@/lib/engine/types";
import { parseBulkHandHistories, type ParsedHand } from "@/lib/engine/handHistoryParser";
import { parsedHandToBoard, parsedHandToAnalysisInput } from "@/lib/importAdapter";
import { useAnalysisStore, type AnalysisInput } from "@/lib/store/analysisStore";
import { runAnalysis } from "@/lib/analysisEngine";
import { saveHand } from "@/lib/localHandStore";
import { createSession } from "@/lib/localSessionStore";
import { usePlan } from "@/lib/usePlan";
import { canPerformAction, isNearLimit } from "@/lib/plan";
import { getTodayCount, incrementToday } from "@/lib/usageTracker";
import { fileToBase64 } from "@/lib/utils/file";
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

interface ScreenshotParseResult {
  heroCards?: string[];
  board?: { flop?: string[]; turn?: string; river?: string };
  potSize?: number;
  heroPosition?: string;
  error?: string;
}

const POSITION_OPTIONS = ["UTG", "UTG+1", "MP", "MP+1", "HJ", "CO", "BTN", "SB", "BB"];

/** Editable draft the AI's screenshot reading gets loaded into — nothing from here reaches the
 *  parsed-hands list (and therefore the analyzer) until the user explicitly reviews and confirms
 *  it via "אישור והמשך לניתוח". Every field the model didn't return starts out null/empty and is
 *  shown as "לא זוהה", never guessed. */
interface ScreenshotDraft {
  heroCards: [string | null, string | null];
  board: (string | null)[];
  potSize: string;
  heroPosition: string;
}

type ScreenshotPickerTarget = { kind: "hero"; index: 0 | 1 } | { kind: "board"; index: number };

function draftFromParseResult(data: ScreenshotParseResult): ScreenshotDraft {
  return {
    heroCards: [data.heroCards?.[0] ?? null, data.heroCards?.[1] ?? null],
    board: [
      data.board?.flop?.[0] ?? null,
      data.board?.flop?.[1] ?? null,
      data.board?.flop?.[2] ?? null,
      data.board?.turn ?? null,
      data.board?.river ?? null,
    ],
    potSize: data.potSize !== undefined ? String(data.potSize) : "",
    heroPosition: data.heroPosition ?? "",
  };
}

export function HandHistoryImporter() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedHand[]>([]);
  const [showScreenshotPanel, setShowScreenshotPanel] = useState(false);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [postGameConfirmed, setPostGameConfirmed] = useState(false);
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState<string | null>(null);
  const [screenshotDraft, setScreenshotDraft] = useState<ScreenshotDraft | null>(null);
  const [screenshotPicker, setScreenshotPicker] = useState<ScreenshotPickerTarget | null>(null);
  const { plan } = usePlan();
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState(defaultSessionName());
  const [sessionSavedMessage, setSessionSavedMessage] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [savingSession, setSavingSession] = useState(false);
  const nearImportLimit = isNearLimit(plan, "importHand", getTodayCount("import"));

  const handleScreenshot = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !postGameConfirmed) return;

    const gate = canPerformAction(plan, "runAiReview", getTodayCount("ai-review"));
    if (!gate.allowed) {
      setScreenshotError(gate.reason ?? "הגעת למגבלת ניתוחי ה-AI היומית בתוכנית החינמית.");
      return;
    }

    if (screenshotPreviewUrl) URL.revokeObjectURL(screenshotPreviewUrl);
    setScreenshotPreviewUrl(URL.createObjectURL(file));
    setScreenshotDraft(null);
    setScreenshotError(null);
    setScreenshotLoading(true);
    try {
      const imageBase64 = await fileToBase64(file);
      const res = await fetch("/api/ai/parse-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mediaType: file.type }),
      });
      const data = (await res.json()) as ScreenshotParseResult;
      if (!res.ok) {
        setScreenshotError(data.error ?? "ניתוח התמונה נכשל.");
        return;
      }
      incrementToday("ai-review");
      track("screenshot_parsed", { hasHeroCards: Boolean(data.heroCards) });
      // Always drop into the review/edit draft below — even a fully-empty result — so the user
      // can fill in anything the AI missed by hand rather than getting a dead end. Nothing here
      // reaches the parsed-hands list (and therefore the analyzer) until they explicitly confirm.
      setScreenshotDraft(draftFromParseResult(data));
      if (!data.heroCards && !data.board && data.potSize === undefined) {
        setScreenshotError("לא זוהה מידע אוטומטית בתמונה — אפשר להזין את הפרטים ידנית למטה.");
      }
    } catch {
      setScreenshotError("שגיאת רשת בניתוח התמונה.");
    } finally {
      setScreenshotLoading(false);
    }
  };

  const setDraftHeroCard = (index: 0 | 1, card: string | null) => {
    setScreenshotDraft((prev) => {
      if (!prev) return prev;
      const heroCards: [string | null, string | null] = [...prev.heroCards];
      heroCards[index] = card;
      return { ...prev, heroCards };
    });
  };

  const setDraftBoardCard = (index: number, card: string | null) => {
    setScreenshotDraft((prev) => {
      if (!prev) return prev;
      const board = [...prev.board];
      board[index] = card;
      return { ...prev, board };
    });
  };

  const draftUsedCards = (): Set<string> =>
    new Set([...(screenshotDraft?.heroCards ?? []), ...(screenshotDraft?.board ?? [])].filter(
      (c): c is string => Boolean(c)
    ));

  const cancelScreenshotReview = () => {
    if (screenshotPreviewUrl) URL.revokeObjectURL(screenshotPreviewUrl);
    setScreenshotPreviewUrl(null);
    setScreenshotDraft(null);
    setScreenshotPicker(null);
    setScreenshotError(null);
  };

  const confirmScreenshotDraft = () => {
    if (!screenshotDraft) return;
    const board: ParsedHand["board"] = {};
    const flop = screenshotDraft.board.slice(0, 3).filter(Boolean) as Card[];
    if (flop.length > 0) board.flop = flop;
    if (screenshotDraft.board[3]) board.turn = screenshotDraft.board[3] as Card;
    if (screenshotDraft.board[4]) board.river = screenshotDraft.board[4] as Card;

    setParsed((prev) => [
      {
        format: "unknown",
        seats: [],
        heroCards: screenshotDraft.heroCards.filter(Boolean) as ParsedHand["heroCards"],
        heroPosition: screenshotDraft.heroPosition || undefined,
        board,
        actions: [],
        potSize: screenshotDraft.potSize ? Number(screenshotDraft.potSize) : undefined,
        raw: "",
      },
      ...prev,
    ]);
    track("screenshot_review_confirmed");
    setShowScreenshotPanel(false);
    cancelScreenshotReview();
    setPostGameConfirmed(false);
  };

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
      await createSession(name, handIds);
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
          <Button size="sm" variant="ghost" onClick={() => setShowScreenshotPanel(true)}>
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

      {showScreenshotPanel && (
        <Panel>
          <PanelHeader>
            <PanelTitle>ניתוח צילום מסך</PanelTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowScreenshotPanel(false);
                cancelScreenshotReview();
                setPostGameConfirmed(false);
              }}
            >
              סגירה
            </Button>
          </PanelHeader>
          <PanelBody className="space-y-4">
            <div className="rounded-lg border border-status-close/40 bg-status-close/10 px-3 py-2 text-xs text-base-text">
              העלאת צילום מסך מיועדת לניתוח ולמידה לאחר משחק בלבד — לא ככלי סיוע בזמן משחק חי.
            </div>

            {!screenshotDraft && (
              <>
                <label className="flex items-start gap-2 text-sm text-base-text">
                  <input
                    type="checkbox"
                    checked={postGameConfirmed}
                    onChange={(e) => setPostGameConfirmed(e.target.checked)}
                    className="mt-0.5"
                  />
                  אני מאשר/ת שהתמונה מיועדת לניתוח לאחר סיום היד, לצורך לימוד בלבד.
                </label>
                <div className="text-center">
                  <label
                    className={`inline-block cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white ${
                      screenshotLoading || !postGameConfirmed ? "pointer-events-none opacity-50" : ""
                    }`}
                  >
                    {screenshotLoading ? "מנתח…" : "בחירת תמונה"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      className="hidden"
                      disabled={screenshotLoading || !postGameConfirmed}
                      onChange={(e) => handleScreenshot(e.target.files)}
                    />
                  </label>
                  {!postGameConfirmed && (
                    <p className="mt-2 text-xs text-base-muted">יש לאשר את התיבה למעלה כדי להעלות תמונה.</p>
                  )}
                </div>
                {screenshotError && <p className="text-center text-xs text-status-risky">{screenshotError}</p>}
              </>
            )}

            {screenshotDraft && (
              <div className="space-y-4">
                <p className="text-xs text-base-muted">
                  אלה הפרטים שזוהו מהתמונה. בדוק ותקן כל שדה לפני שממשיכים לניתוח — שום דבר לא
                  נשלח לניתוח בלי אישור.
                </p>
                {screenshotError && <p className="text-xs text-status-risky">{screenshotError}</p>}

                <div className="flex flex-wrap items-start gap-4">
                  {screenshotPreviewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={screenshotPreviewUrl}
                      alt="תצוגה מקדימה של צילום המסך שהועלה"
                      className="h-24 w-auto rounded-lg border border-base-border object-cover"
                    />
                  )}

                  <div className="space-y-1">
                    <p className="text-xs text-base-muted">קלפי ההירו</p>
                    <div className="flex gap-2">
                      {[0, 1].map((i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setScreenshotPicker({ kind: "hero", index: i as 0 | 1 })}
                          >
                            <PlayingCard card={screenshotDraft.heroCards[i]} size="md" />
                          </button>
                          {!screenshotDraft.heroCards[i] && (
                            <span className="text-[10px] text-status-risky">לא זוהה</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-base-muted">הבורד</p>
                    <div className="flex gap-2">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <button type="button" onClick={() => setScreenshotPicker({ kind: "board", index: i })}>
                            <PlayingCard card={screenshotDraft.board[i]} size="md" />
                          </button>
                          {!screenshotDraft.board[i] && (
                            <span className="text-[10px] text-base-muted">
                              {i < 3 ? "פלופ" : i === 3 ? "טרן" : "ריבר"} — לא זוהה
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {screenshotPicker && (
                  <div className="rounded-lg border border-base-border bg-base-panel2 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs text-base-muted">
                        {screenshotPicker.kind === "hero"
                          ? `בחירת קלף ליד ${screenshotPicker.index + 1}`
                          : "בחירת קלף לבורד"}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (screenshotPicker.kind === "hero") setDraftHeroCard(screenshotPicker.index, null);
                            else setDraftBoardCard(screenshotPicker.index, null);
                            setScreenshotPicker(null);
                          }}
                        >
                          ניקוי
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setScreenshotPicker(null)}>
                          סגירה
                        </Button>
                      </div>
                    </div>
                    <CardPicker
                      usedCards={draftUsedCards()}
                      onPick={(card) => {
                        if (screenshotPicker.kind === "hero") setDraftHeroCard(screenshotPicker.index, card);
                        else setDraftBoardCard(screenshotPicker.index, card);
                        setScreenshotPicker(null);
                      }}
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-base-muted">גודל הפוט</label>
                    <input
                      type="number"
                      min={0}
                      value={screenshotDraft.potSize}
                      onChange={(e) =>
                        setScreenshotDraft((prev) => (prev ? { ...prev, potSize: e.target.value } : prev))
                      }
                      placeholder="לא זוהה"
                      className="w-28 rounded-lg border border-base-border bg-base-panel2 px-2.5 py-2 text-sm outline-none focus:border-accent"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-base-muted">פוזיציית ההירו</label>
                    <select
                      value={screenshotDraft.heroPosition}
                      onChange={(e) =>
                        setScreenshotDraft((prev) => (prev ? { ...prev, heroPosition: e.target.value } : prev))
                      }
                      className="rounded-lg border border-base-border bg-base-panel2 px-2.5 py-2 text-sm outline-none focus:border-accent"
                    >
                      <option value="">לא זוהה</option>
                      {POSITION_OPTIONS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={confirmScreenshotDraft}>אישור והמשך לניתוח</Button>
                  <Button variant="ghost" onClick={cancelScreenshotReview}>
                    ביטול
                  </Button>
                </div>
              </div>
            )}
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

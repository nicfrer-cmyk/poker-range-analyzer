"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TrainingTrackCard } from "@/components/training/TrainingTrackCard";
import { TrainingQuestion } from "@/components/training/TrainingQuestion";
import {
  TRACKS,
  BADGES,
  generateScenario,
  evaluateAnswer,
  loadProgress,
  recordAnswer,
  getTrack,
  type TrackId,
  type TrainingScenario,
  type AnswerEvaluation,
  type TrainingProgress,
  type BadgeDefinition,
  type TrainingAction,
} from "@/lib/training";

function isTrackId(value: string | null): value is TrackId {
  return !!value && TRACKS.some((t) => t.id === value);
}

type Phase = "select" | "quiz" | "summary";

function emptySessionStats() {
  return { answered: 0, correct: 0, bestStreak: 0 };
}

export default function TrainingPage() {
  return (
    <Suspense fallback={null}>
      <TrainingPageInner />
    </Suspense>
  );
}

function TrainingPageInner() {
  const searchParams = useSearchParams();
  const [hydrated, setHydrated] = useState(false);
  const [progress, setProgress] = useState<TrainingProgress>(() => loadProgress());
  const [phase, setPhase] = useState<Phase>("select");
  const [trackId, setTrackId] = useState<TrackId | null>(null);
  const [scenario, setScenario] = useState<TrainingScenario | null>(null);
  const [answer, setAnswer] = useState<AnswerEvaluation | null>(null);
  const [session, setSession] = useState(emptySessionStats());
  const [sessionStreak, setSessionStreak] = useState(0);
  const [toastBadges, setToastBadges] = useState<BadgeDefinition[]>([]);
  const [autoStartAttempted, setAutoStartAttempted] = useState(false);

  useEffect(() => {
    setProgress(loadProgress());
    setHydrated(true);
  }, []);

  // Deep-link from the coach dashboard/skill tree/roadmap ("?track=range-reading") auto-starts
  // that track once, so the "start a personalized session" CTAs land the user directly in a
  // quiz instead of the track-picker.
  useEffect(() => {
    if (!hydrated || autoStartAttempted || phase !== "select") return;
    setAutoStartAttempted(true);
    const requestedTrack = searchParams.get("track");
    if (isTrackId(requestedTrack)) handleSelectTrack(requestedTrack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, autoStartAttempted, phase, searchParams]);

  useEffect(() => {
    if (toastBadges.length === 0) return;
    const timeout = setTimeout(() => setToastBadges([]), 4000);
    return () => clearTimeout(timeout);
  }, [toastBadges]);

  const overallAccuracy =
    progress.totalAnswered > 0
      ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100)
      : 0;

  function handleSelectTrack(id: TrackId) {
    const s = generateScenario(id, progress.missCounts);
    setTrackId(id);
    setScenario(s);
    setAnswer(null);
    setSession(emptySessionStats());
    setSessionStreak(0);
    setPhase("quiz");
  }

  function handleAnswer(action: TrainingAction) {
    if (!scenario) return;
    const evaluation = evaluateAnswer(scenario, action);
    setAnswer(evaluation);

    const { progress: nextProgress, newlyEarnedBadges } = recordAnswer(
      progress,
      scenario,
      evaluation.correct
    );
    setProgress(nextProgress);
    setSession((prev) => ({
      answered: prev.answered + 1,
      correct: prev.correct + (evaluation.correct ? 1 : 0),
      bestStreak: Math.max(prev.bestStreak, evaluation.correct ? sessionStreak + 1 : 0),
    }));
    setSessionStreak((prev) => (evaluation.correct ? prev + 1 : 0));
    if (newlyEarnedBadges.length > 0) setToastBadges(newlyEarnedBadges);
  }

  function handleNext() {
    if (!trackId) return;
    const s = generateScenario(trackId, progress.missCounts);
    setScenario(s);
    setAnswer(null);
  }

  function handleFinishSession() {
    setPhase("summary");
  }

  function handleBackToTracks() {
    setPhase("select");
    setTrackId(null);
    setScenario(null);
    setAnswer(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">מצב אימון</h1>
          <p className="mt-1 text-sm text-base-muted">
            חידון תרגול לאחר משחק — מקבלים תרחיש, בוחרים פעולה, ומקבלים משוב מיידי לפי אקוויטי
            ויחסי סיכוי. לא כלי GTO ולא סיוע בזמן אמת.
          </p>
        </div>
        {hydrated && progress.totalAnswered > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{progress.totalAnswered} תרגולים בסך הכול</Badge>
            <Badge tone={overallAccuracy >= 70 ? "ahead" : "close"}>דיוק {overallAccuracy}%</Badge>
            {progress.currentStreak > 0 && (
              <Badge tone="ahead">🔥 רצף {progress.currentStreak}</Badge>
            )}
          </div>
        )}
      </div>

      {toastBadges.length > 0 && (
        <Panel className="border-accent/40">
          <PanelBody className="flex flex-wrap items-center gap-2 py-3">
            <span className="text-sm font-medium">הישג חדש נפתח:</span>
            {toastBadges.map((b) => (
              <Badge key={b.id} tone="ahead">
                🏅 {b.label}
              </Badge>
            ))}
          </PanelBody>
        </Panel>
      )}

      {phase === "select" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TRACKS.map((track) => (
              <TrainingTrackCard
                key={track.id}
                track={track}
                stats={hydrated ? progress.perTrack[track.id] : undefined}
                onSelect={() => handleSelectTrack(track.id)}
              />
            ))}
          </div>

          {hydrated && progress.earnedBadgeIds.length > 0 && (
            <Panel>
              <PanelHeader>
                <PanelTitle>ההישגים שלי</PanelTitle>
              </PanelHeader>
              <PanelBody className="flex flex-wrap gap-2">
                {BADGES.filter((b) => progress.earnedBadgeIds.includes(b.id)).map((b) => (
                  <Badge key={b.id} tone="ahead" title={b.description}>
                    🏅 {b.label}
                  </Badge>
                ))}
              </PanelBody>
            </Panel>
          )}
        </div>
      )}

      {phase === "quiz" && trackId && scenario && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleBackToTracks}>
                → בחירת נושא
              </Button>
              <Badge tone="neutral">{getTrack(trackId).shortLabel}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="neutral">
                {session.answered} תרגולים בסבב זה · {session.correct} נכונות
              </Badge>
              <Button variant="secondary" size="sm" onClick={handleFinishSession}>
                סיום וסיכום
              </Button>
            </div>
          </div>

          <TrainingQuestion
            scenario={scenario}
            answer={answer}
            onAnswer={handleAnswer}
            onNext={handleNext}
          />
        </div>
      )}

      {phase === "summary" && (
        <div className="space-y-4">
          <Panel>
            <PanelHeader>
              <PanelTitle>סיכום הסבב</PanelTitle>
            </PanelHeader>
            <PanelBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-base-muted">תרגולים בסבב</p>
                <p className="text-2xl font-bold">{session.answered}</p>
              </div>
              <div>
                <p className="text-xs text-base-muted">נכונות</p>
                <p className="text-2xl font-bold">{session.correct}</p>
              </div>
              <div>
                <p className="text-xs text-base-muted">דיוק בסבב</p>
                <p className="text-2xl font-bold">
                  {session.answered > 0
                    ? Math.round((session.correct / session.answered) * 100)
                    : 0}
                  %
                </p>
              </div>
              <div>
                <p className="text-xs text-base-muted">הרצף הכי טוב בסבב</p>
                <p className="text-2xl font-bold">{session.bestStreak}</p>
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>סך הכול (כל הזמנים)</PanelTitle>
            </PanelHeader>
            <PanelBody className="flex flex-wrap gap-2">
              <Badge tone="neutral">{progress.totalAnswered} תרגולים</Badge>
              <Badge tone={overallAccuracy >= 70 ? "ahead" : "close"}>
                דיוק {overallAccuracy}%
              </Badge>
              <Badge tone="ahead">🔥 הרצף הכי טוב: {progress.bestStreak}</Badge>
            </PanelBody>
          </Panel>

          <div className="flex justify-center gap-2">
            <Button variant="secondary" onClick={handleBackToTracks}>
              חזרה לבחירת נושא
            </Button>
            {trackId && <Button onClick={() => handleSelectTrack(trackId)}>עוד סבב באותו נושא</Button>}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge, equityTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SkeletonPanelRows } from "@/components/ui/Skeleton";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { listHands, type StoredHand } from "@/lib/localHandStore";
import { weekStats, currentStreak } from "@/lib/leaderboard";
import { formatLeakKey, STREET_LABEL, LEAK_DIMENSION_LABEL } from "@/lib/labels";
import { topLeaks } from "@/lib/engine/leakFinder";
import { loadProgress, type TrainingProgress } from "@/lib/training";
import { computeSkillTree } from "@/lib/coach/skillTree";
import { computePokerDNA } from "@/lib/coach/dna";
import { computePokerIQ, recordIqSnapshotIfNeeded, getIqHistory, getWeeklyDelta } from "@/lib/coach/iq";
import { generateDailyMissions, type Mission } from "@/lib/coach/missions";
import { buildWeeklyReview } from "@/lib/coach/weeklyReview";
import {
  computeNotifications,
  visibleNotifications,
  getNotificationSettings,
  type AppNotification,
} from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";
import { getTipOfTheDay } from "@/lib/tipOfTheDay";
import { getTodayCount } from "@/lib/usageTracker";
import { usePlan } from "@/lib/usePlan";
import { track } from "@/lib/analytics";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "לילה טוב";
  if (hour < 12) return "בוקר טוב";
  if (hour < 18) return "צהריים טובים";
  return "ערב טוב";
}

/** Secondary tools surfaced from the dashboard's "כלים נוספים" row — all fully built, also
 *  reachable from the sidebar/bottom-nav (src/lib/nav.ts), just called out here too since
 *  they're easy to miss among the coach-focused surfaces above. */
const MORE_TOOLS = [
  { href: "/range-vs-range", label: "טווח מול טווח" },
  { href: "/icm", label: "מחשבון ICM" },
  { href: "/bankroll", label: "מעקב בנקרול" },
];

export default function DashboardPage() {
  const [hands, setHands] = useState<StoredHand[]>([]);
  const [handsLoaded, setHandsLoaded] = useState(false);
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const { plan } = usePlan();

  useEffect(() => {
    listHands().then((h) => {
      setHands(h);
      setHandsLoaded(true);
    });
    setProgress(loadProgress());
  }, []);

  // Same computeNotifications/visibleNotifications reuse as NotificationBell, so the dashboard's
  // "התראות אחרונות" card always agrees with the bell's dropdown for the same underlying data.
  useEffect(() => {
    const settings = getNotificationSettings();
    const items = visibleNotifications(
      computeNotifications(hands, {
        plan,
        todayAnalysisCount: getTodayCount("analysis"),
        ...settings,
      })
    );
    setNotifications(items);
  }, [hands, plan]);

  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        const user = data.user;
        if (!user) return;
        const metaName =
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          null;
        const emailLocalPart = user.email ? user.email.split("@")[0] ?? null : null;
        setDisplayName(metaName || emailLocalPart);
      });
    } catch {
      // Supabase not configured yet (local dev) — nothing to show.
    }
  }, []);

  const tip = useMemo(() => getTipOfTheDay(), []);

  const week = useMemo(() => weekStats(hands), [hands]);
  const streak = useMemo(() => currentStreak(hands), [hands]);
  const leaks = useMemo(() => topLeaks(hands, 3), [hands]);
  const latestHand = hands[0];
  const recent = hands.slice(1, 6);

  const skillTree = useMemo(() => (progress ? computeSkillTree(hands, progress) : null), [hands, progress]);
  const dna = useMemo(() => computePokerDNA(hands), [hands]);
  const iq = useMemo(() => (progress && skillTree ? computePokerIQ(hands, progress, skillTree) : null), [hands, progress, skillTree]);
  const missions: Mission[] = useMemo(
    () => (skillTree ? generateDailyMissions(hands, skillTree).slice(0, 1) : []),
    [hands, skillTree]
  );

  useEffect(() => {
    if (iq && hands.length > 0) recordIqSnapshotIfNeeded(iq.score);
  }, [iq, hands.length]);

  const weeklyDelta = iq ? getWeeklyDelta(getIqHistory(), iq.score) : null;
  // Same buildWeeklyReview() call the /weekly-review page makes, with the same iqWeeklyDelta
  // input, so the dashboard's headline numbers always match the full report.
  const weeklyReview = useMemo(() => buildWeeklyReview(hands, weeklyDelta), [hands, weeklyDelta]);
  const topMission = missions[0];
  const weakestTrackId = skillTree?.weakestDomain?.recommendationTrackId ?? null;

  const hasData = hands.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {greeting()}
          {displayName ? `, ${displayName}` : ""}
          {hasData ? ` — מוכן להמשיך להשתפר?` : ""}
        </h1>
        <p className="mt-1 text-sm text-base-muted">
          המאמן האישי שלך — לומד מהידיים שלך, מזהה דפוסים ובונה לך תוכנית שיפור. ניתוח לאחר משחק
          בלבד, לא כלי לזמן משחק חי.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/analyze?mode=quick">
          <Button size="lg">ניתוח מהיר</Button>
        </Link>
        <Link href="/analyze?mode=advanced">
          <Button variant="secondary" size="lg">
            ניתוח מתקדם
          </Button>
        </Link>
        <Link href="/hands/import">
          <Button variant="secondary" size="lg">
            ייבוא היסטוריה
          </Button>
        </Link>
      </div>

      <Panel>
        <PanelBody className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
          <Badge tone="neutral" className="shrink-0">
            טיפ היום
          </Badge>
          <span className="text-base-muted">{tip}</span>
        </PanelBody>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2">
        {notifications.length > 0 && (
          <Panel>
            <PanelHeader>
              <PanelTitle>התראות אחרונות</PanelTitle>
              <Link href="/notifications" className="text-xs text-accent-soft">
                לכל ההתראות ←
              </Link>
            </PanelHeader>
            <PanelBody className="space-y-2">
              {notifications.slice(0, 3).map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  className="block rounded-lg border border-base-border px-3 py-2 text-sm text-base-text transition-colors hover:border-accent/60 hover:bg-base-panel2"
                >
                  {n.message}
                </Link>
              ))}
            </PanelBody>
          </Panel>
        )}

        <Panel>
          <PanelHeader>
            <PanelTitle>דוח שבועי</PanelTitle>
            <Link href="/weekly-review" className="text-xs text-accent-soft">
              לצפייה בדוח המלא ←
            </Link>
          </PanelHeader>
          <PanelBody className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs text-base-muted">ידיים השבוע</p>
              <p className="text-2xl font-bold">{weeklyReview.weekHandCount}</p>
            </div>
            <div>
              <p className="text-xs text-base-muted">דיוק החלטות השבוע</p>
              <p className="text-2xl font-bold text-status-ahead">{Math.round(weeklyReview.weekAccuracyPct)}%</p>
            </div>
          </PanelBody>
        </Panel>
      </div>

      {!hasData ? (
        handsLoaded ? (
          <Panel>
            <PanelBody className="py-10 text-center">
              <p className="text-sm text-base-muted">
                עדיין אין מספיק נתונים כדי לבנות לך פרופיל אישי. נתח 3 ידיים ראשונות כדי להתחיל.
              </p>
            </PanelBody>
          </Panel>
        ) : (
          <SkeletonPanelRows rows={4} />
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Panel>
              <PanelBody>
                <p className="text-xs text-base-muted">Poker IQ</p>
                <p className="text-2xl font-bold">{iq?.score ?? "—"}</p>
                {weeklyDelta !== null && (
                  <p className={`text-xs ${weeklyDelta >= 0 ? "text-status-ahead" : "text-status-behind"}`}>
                    {weeklyDelta >= 0 ? "+" : ""}
                    {weeklyDelta} מהשבוע שעבר
                  </p>
                )}
              </PanelBody>
            </Panel>
            <Panel>
              <PanelBody>
                <p className="text-xs text-base-muted">ידיים השבוע</p>
                <p className="text-2xl font-bold">{week.handCount}</p>
              </PanelBody>
            </Panel>
            <Panel>
              <PanelBody>
                <p className="text-xs text-base-muted">דיוק החלטות השבוע</p>
                <p className="text-2xl font-bold text-status-ahead">{Math.round(week.accuracyPct)}%</p>
              </PanelBody>
            </Panel>
            <Panel>
              <PanelBody>
                <p className="text-xs text-base-muted">רצף ימים פעילים</p>
                <p className="text-2xl font-bold">{streak > 0 ? `🔥 ${streak}` : "0"}</p>
              </PanelBody>
            </Panel>
          </div>

          <Panel className="border-accent/40">
            <PanelBody className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div>
                <p className="text-xs text-base-muted">מה כדאי ללמוד היום</p>
                <p className="text-lg font-semibold">
                  {skillTree?.weakestDomain ? skillTree.weakestDomain.label : "עדיין אין מספיק נתונים לתחום ברור"}
                </p>
                {topMission && <p className="mt-1 text-sm text-base-muted">משימת היום: {topMission.title}</p>}
              </div>
              <Link href={weakestTrackId ? `/training?track=${weakestTrackId}` : "/training"}>
                <Button>התחל אימון מותאם אישית</Button>
              </Link>
            </PanelBody>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <PanelHeader>
                <PanelTitle>חוזקות וחולשות</PanelTitle>
                <Link href="/dna" className="text-xs text-accent-soft">
                  ה-DNA המלא ←
                </Link>
              </PanelHeader>
              <PanelBody className="space-y-3">
                <div>
                  <p className="mb-1 text-xs text-base-muted">חוזקות</p>
                  <div className="flex flex-wrap gap-2">
                    {dna.strengths.length === 0 ? (
                      <span className="text-sm text-base-muted">עדיין אין מספיק נתונים.</span>
                    ) : (
                      dna.strengths.map((m) => (
                        <Badge key={m.id} tone="crushing">
                          {m.label}: {m.valuePct}%
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-base-muted">נקודות לשיפור</p>
                  <div className="flex flex-wrap gap-2">
                    {dna.weaknesses.length === 0 ? (
                      <span className="text-sm text-base-muted">עדיין אין מספיק נתונים.</span>
                    ) : (
                      dna.weaknesses.map((m) => (
                        <Badge key={m.id} tone="behind">
                          {m.label}: {m.valuePct}%
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader>
                <PanelTitle>דליפות מובילות</PanelTitle>
                <Link href="/leaks" className="text-xs text-accent-soft">
                  דוח מלא ←
                </Link>
              </PanelHeader>
              <PanelBody className="space-y-2">
                {leaks.length === 0 ? (
                  <p className="text-sm text-base-muted">שמור עוד כמה ידיים כדי לפתוח את גילוי הדליפות.</p>
                ) : (
                  leaks.map((leak) => (
                    <div
                      key={`${leak.dimension}-${leak.key}`}
                      className="flex items-center justify-between rounded-lg border border-base-border px-3 py-2"
                    >
                      <span className="text-sm">
                        {LEAK_DIMENSION_LABEL[leak.dimension] ?? leak.dimension}:{" "}
                        <b>{formatLeakKey(leak.dimension, leak.key)}</b>
                      </span>
                      <span className="text-xs text-base-muted">{leak.count} ידיים</span>
                    </div>
                  ))
                )}
              </PanelBody>
            </Panel>
          </div>

          {latestHand && (
            <Panel className="border-accent/40">
              <PanelBody className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {latestHand.heroCards.map((c, i) => (
                      <PlayingCard key={i} card={c} size="sm" />
                    ))}
                  </div>
                  <div>
                    <p className="text-xs text-base-muted">המשך מאיפה שעצרת</p>
                    <p className="text-sm font-medium">
                      {STREET_LABEL[latestHand.street] ?? latestHand.street} · אקוויטי{" "}
                      {(latestHand.equityAtDecision * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
                <Link href={`/hands/${latestHand.id}`}>
                  <Button>המשך</Button>
                </Link>
              </PanelBody>
            </Panel>
          )}

          <Panel>
            <PanelHeader>
              <PanelTitle>ניתוחים אחרונים</PanelTitle>
              <Link href="/hands" className="text-xs text-accent-soft">
                לכל הידיים
              </Link>
            </PanelHeader>
            <PanelBody className="space-y-3">
              {recent.length === 0 ? (
                <p className="text-sm text-base-muted">זה כל מה שיש כרגע — נתחו עוד ידיים כדי לבנות היסטוריה.</p>
              ) : (
                recent.map((h) => (
                <Link key={h.id} href={`/hands/${h.id}`} className="flex items-center gap-3 rounded-lg hover:bg-base-panel2">
                  <div className="flex gap-1">
                    {h.heroCards.map((c, i) => (
                      <PlayingCard key={i} card={c} size="xs" />
                    ))}
                  </div>
                  <Badge tone={equityTone(h.equityAtDecision * 100)}>{(h.equityAtDecision * 100).toFixed(0)}%</Badge>
                  <span className="text-xs text-base-muted">{STREET_LABEL[h.street] ?? h.street}</span>
                </Link>
                ))
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>כלים נוספים</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Link href="/ai-review">
                  <Button variant="secondary" size="sm">
                    ניתוח יד עם AI (כולל העלאת תמונה)
                  </Button>
                </Link>
                {MORE_TOOLS.map((tool) => (
                  <Link key={tool.href} href={tool.href}>
                    <Button variant="secondary" size="sm">
                      {tool.label}
                    </Button>
                  </Link>
                ))}
              </div>
            </PanelBody>
          </Panel>

          {plan === "FREE" && (
            <Panel>
              <PanelBody className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div>
                  <p className="text-sm font-medium">
                    רוצה ניתוחים ללא הגבלה, AI Review מלא ותכונות מתקדמות נוספות?
                  </p>
                  <p className="mt-1 text-xs text-base-muted">
                    שדרוג לפרו פותח ניתוחים בלתי מוגבלים, טווח מול טווח, ICM ועוד.
                  </p>
                </div>
                <Link
                  href="/billing"
                  onClick={() => track("upgrade_clicked", { source: "dashboard_upsell" })}
                >
                  <Button variant="secondary">שדרוג לפרו</Button>
                </Link>
              </PanelBody>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

"use client";

// ---------------------------------------------------------------------------
// First-time interactive onboarding tour (Phase 2).
//
// Rendered by `OnboardingTrigger` (see sibling file) only when the current
// user has no `pra:onboarded:${userId}` localStorage flag yet. Shows a series
// of static screens introducing the app (count driven by the `screens` array
// built in `buildScreens`, currently 7), then marks the flag and unmounts —
// either because the user finished the last screen or hit "דלג" (skip). Both
// paths end in the exact same state, per spec.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { NavIcon } from "@/components/layout/NavIcon";
import type { NavItem } from "@/lib/nav";

function onboardedFlag(userId: string) {
  return `pra:onboarded:${userId}`;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function MiniStep({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex flex-1 min-w-[5.5rem] flex-col items-center gap-1.5 rounded-lg border border-base-border bg-base-panel2 px-2 py-3 text-center">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
        {n}
      </span>
      <span className="text-[11px] leading-tight text-base-muted">{label}</span>
    </div>
  );
}

function MiniCard({ label, red }: { label: string; red?: boolean }) {
  return (
    <span
      className={
        "flex h-10 w-7 items-center justify-center rounded-md border border-base-border bg-base-panel text-xs font-bold shadow-soft " +
        (red ? "text-status-behind" : "text-base-text")
      }
    >
      {label}
    </span>
  );
}

function RangeGridPreview() {
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      let tone = "bg-status-close/20";
      if (r === c) tone = "bg-accent/70";
      else if (r < c) tone = "bg-status-ahead/40";
      cells.push(<div key={`${r}-${c}`} className={`aspect-square rounded-[1.5px] ${tone}`} />);
    }
  }
  return (
    <div
      className="mx-auto grid w-40 gap-[1.5px] sm:w-48"
      style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}
      aria-hidden
    >
      {cells}
    </div>
  );
}

function CoachFeature({ icon, title, desc }: { icon: NavItem["icon"]; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-base-border bg-base-panel2 p-3">
      <NavIcon icon={icon} className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-base-muted">{desc}</p>
      </div>
    </div>
  );
}

type Screen = {
  title: string;
  content: React.ReactNode;
};

function buildScreens(onCta: () => void): Screen[] {
  return [
    {
      title: "ברוכים הבאים",
      content: (
        <div className="space-y-4 text-center">
          <div className="text-5xl" aria-hidden>
            ♠️
          </div>
          <p className="text-sm leading-relaxed text-base-text/90">
            מנתח טווחי הפוקר עוזר לך להבין ולשפר את המשחק שלך <b>אחרי</b> שהסשן נגמר — לא תוך כדי
            משחק. מעלים יד, בודקים אותה לעומק, ולומדים ממנה לקראת הפעם הבאה.
          </p>
          <p className="text-sm leading-relaxed text-base-muted">
            אין כאן שום סיוע בזמן משחק חי, בכוונה תחילה. זהו כלי לימוד וניתוח שלאחר המשחק בלבד.
          </p>
        </div>
      ),
    },
    {
      title: "ניתוח מהיר",
      content: (
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
              <NavIcon icon="target" className="h-7 w-7 text-accent" />
            </div>
          </div>
          <p className="text-sm leading-relaxed text-base-text/90">
            הכנס את הקלפים שלך ואת הפלופ וקבל מיד אחוזים בסיסיים ותמונה ראשונית.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <MiniCard label="A♠" />
            <MiniCard label="K♥" red />
          </div>
        </div>
      ),
    },
    {
      title: "ניתוח מתקדם",
      content: (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-base-text/90">
            הוסף טווח יריב, קופה, פוזיציות ומהלכים כדי לקבל ניתוח עמוק יותר. הניתוח המתקדם עובר
            אשף קצר של 5 שלבים — מסוג המשחק ועד לתוצאות המלאות:
          </p>
          <div className="flex flex-wrap gap-2">
            <MiniStep n={1} label="סוג משחק" />
            <MiniStep n={2} label="קלפים" />
            <MiniStep n={3} label="פוט והחלטה" />
            <MiniStep n={4} label="טווח היריב" />
            <MiniStep n={5} label="תוצאות" />
          </div>
        </div>
      ),
    },
    {
      title: "בניית טווחים",
      content: (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-base-text/90">
            כדי לנתח יד לעומק, בונים טווח ליריב על גבי רשת 13×13 שמייצגת את כל צירופי הקלפים
            האפשריים — זוגות, ידיים מתאימות ולא מתאימות.
          </p>
          <RangeGridPreview />
          <p className="text-center text-xs text-base-muted">
            כל תא ברשת מייצג צירוף ידיים אחד — סימון פשוט וויזואלי של הטווח שהיריב עשוי לשחק איתו.
          </p>
        </div>
      ),
    },
    {
      title: "המאמן האישי",
      content: (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-base-text/90">
            עם כל יד ש<b>את/ה</b> שומר/ת, המאמן האישי לומד ומצטבר לאורך זמן — זה לא ציון חד-פעמי,
            אלא תמונה שמתעדכנת ומתחדדת ככל שתנתחו יותר ידיים:
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <CoachFeature icon="target" title="דליפות" desc="זיהוי דפוסי טעויות חוזרים" />
            <CoachFeature icon="dna" title="DNA שלי" desc="פרופיל הסגנון שלך" />
            <CoachFeature icon="brain" title="Poker IQ" desc="ציון הבנה שמתעדכן" />
            <CoachFeature icon="checklist" title="משימות יומיות" desc="תרגול ממוקד לשיפור" />
          </div>
        </div>
      ),
    },
    {
      title: "ניתוח יד עם AI",
      content: (
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
              <NavIcon icon="book" className="h-7 w-7 text-accent" />
            </div>
          </div>
          <p className="text-sm leading-relaxed text-base-text/90">
            עבור יד ספציפית ששמרת, ה-AI כותב עבורך סקירה מפורטת בכתב — מה היה טוב בהחלטות, מה היה
            אפשר לשפר, ולמה.
          </p>
          <p className="text-sm leading-relaxed text-base-muted">
            גם כאן — זו תמיד סקירה שלאחר המשחק. לעולם לא ייעוץ או המלצה בזמן אמת תוך כדי יד חיה.
          </p>
        </div>
      ),
    },
    {
      title: "מוכנים להתחיל?",
      content: (
        <div className="space-y-5 text-center">
          <div className="text-5xl" aria-hidden>
            🚀
          </div>
          <p className="text-sm leading-relaxed text-base-text/90">
            עכשיו כשהכרתם את הכלים, הדרך הכי טובה להתחיל היא לנתח יד אחת אמיתית ולראות איך זה
            עובד.
          </p>
          <Button variant="primary" size="lg" onClick={onCta} className="w-full">
            נתח את היד הראשונה שלי
          </Button>
        </div>
      ),
    },
  ];
}

const variants: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * -24 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction * 24 }),
};

export function OnboardingTour({ userId, onDone }: { userId: string; onDone: () => void }) {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const [screen, setScreen] = useState(0);
  const [direction, setDirection] = useState(1);
  const dialogRef = useRef<HTMLDivElement>(null);

  const finish = () => {
    try {
      window.localStorage.setItem(onboardedFlag(userId), "1");
    } catch {
      // localStorage unavailable — nothing to persist, just close.
    }
    onDone();
  };

  const goToAnalyze = () => {
    finish();
    router.push("/analyze");
  };

  // Total screen count is derived from the screens array itself (not hardcoded) so the progress
  // indicator ("X/N" + dot row) automatically stays correct as screens are added or removed.
  const screens = useMemo(() => buildScreens(goToAnalyze), []); // eslint-disable-line react-hooks/exhaustive-deps
  const total = screens.length;
  const last = total - 1;

  const handleNext = () => {
    if (screen === last) {
      goToAnalyze();
      return;
    }
    setDirection(1);
    setScreen((s) => Math.min(s + 1, last));
  };

  const handlePrev = () => {
    if (screen === 0) return;
    setDirection(-1);
    setScreen((s) => Math.max(s - 1, 0));
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // RTL: reading flows right-to-left, so ArrowLeft continues forward
      // and ArrowRight goes back — the mirror of an LTR app's arrow mapping.
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "Escape") {
        e.preventDefault();
        finish();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const current = screens[screen] ?? screens[0]!;
  const transition = reducedMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" as const };

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-base-bg/95 p-3 backdrop-blur-sm focus:outline-none sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="סיור היכרות עם המערכת"
    >
      <Panel className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden sm:max-h-[85vh]">
        <div className="flex items-center justify-between gap-3 border-b border-base-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums text-base-muted">
              {screen + 1}/{total}
            </span>
            <div className="flex items-center gap-1">
              {Array.from({ length: total }).map((_, i) => (
                <span
                  key={i}
                  className={
                    "h-1.5 w-4 rounded-full transition-colors " +
                    (i <= screen ? "bg-accent" : "bg-base-border")
                  }
                  aria-hidden
                />
              ))}
            </div>
          </div>
          {screen < last && (
            <Button variant="ghost" size="sm" onClick={finish} className="text-base-muted">
              דלג
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={screen}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
            >
              <h2 className="mb-4 text-center text-lg font-semibold">{current.title}</h2>
              {current.content}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-base-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button variant="secondary" size="sm" onClick={handlePrev} disabled={screen === 0}>
            הקודם
          </Button>
          <Button variant="primary" size="md" onClick={handleNext}>
            {screen === last ? "בואו נתחיל" : "הבא"}
          </Button>
        </div>
      </Panel>
    </div>
  );
}

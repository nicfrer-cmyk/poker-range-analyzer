import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Panel, PanelBody } from "@/components/ui/Panel";
import { PLAN_LIMITS } from "@/lib/plan";
import { PRO_PRICING_ILS } from "@/lib/grow/plans";
import { SUPPORT_EMAIL } from "@/lib/support";

export const metadata = {
  title: "מנתח טווחי פוקר — הבינו איפה היד שלך עמדה באמת",
  description:
    "כלי לימודי לניתוח ידיים וטווחים בפוקר אחרי המשחק: מאמן AI, גילוי דליפות, ומצב אימון — לא הימורים, אין משחק בכסף אמיתי.",
};

const FEATURES = [
  {
    icon: "🃏",
    title: "יד מול טווח",
    body: "הזינו את הקלפים והבורד, ותראו בדיוק כמה אקוויטי היד שלכם קיבלה מול טווח היריב — עם פירוט פוט אודס, EV וחוסמים.",
  },
  {
    icon: "✨",
    title: "מאמן AI",
    body: "סקירת יד בעברית פשוטה וברורה מבינה מלאכותית — מה קרה, מה היה הסיכון, ומה אפשר ללמוד להבא.",
  },
  {
    icon: "🎯",
    title: "מעקב דליפות",
    body: "המערכת מזהה דפוסים חוזרים בטעויות שלכם — לפי פוזיציה, סוג יד ורחוב — כדי שתדעו בדיוק על מה לעבוד.",
  },
  {
    icon: "♠",
    title: "מצב אימון",
    body: "תרגול ממוקד בקבלת החלטות לפי אקוויטי ופוט אודס, עם מסלולים לפי נושא ומעקב התקדמות אישי.",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "האם זה אתר הימורים?",
    a: "לא. מנתח טווחי פוקר הוא כלי לימודי בלבד לניתוח ידיים לאחר סיום המשחק — אין בו משחק בכסף אמיתי, הימורים, או כל סיוע בזמן אמת במהלך יד חיה.",
  },
  {
    q: "אני צריך/ה ניסיון בפוקר כדי להשתמש בזה?",
    a: "לא — הכלי בנוי כך שגם שחקנים חדשים יבינו את ההסברים, ושחקנים מנוסים יקבלו את הפירוט המספרי המלא.",
  },
  {
    q: "אפשר להתחיל בחינם?",
    a: "כן, יש מסלול חינמי מלא עם מגבלות שימוש יומיות — לא נדרש כרטיס אשראי כדי להתחיל.",
  },
  {
    q: "מה קורה לנתונים שאני שומר/ת?",
    a: "הידיים, הטווחים והסשנים שלך מאוחסנים בחשבון האישי שלך בענן, נגישים רק לך, וניתנים למחיקה מלאה בכל עת דרך ההגדרות.",
  },
];

function formatLimit(limit: number, unit: string): string {
  return limit === -1 ? `${unit} ללא הגבלה` : `${limit} ${unit} ביום`;
}

export default function WelcomePage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6">
        <span className="flex items-center gap-2 text-lg font-semibold">
          <span className="text-xl">♠</span> מנתח טווחי פוקר
        </span>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              התחברות
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">הרשמה</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          הבינו איפה היד שלך עמדה באמת — אחרי המשחק, לא בזמנו
        </h1>
        <p className="mt-4 text-base text-base-muted">
          כלי לימודי לניתוח ידיים וטווחים בפוקר: אקוויטי, פוט אודס, מאמן AI וגילוי דליפות — כדי
          שתשתפרו החלטה אחרי החלטה.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/signup">
            <Button size="lg">התחילו בחינם</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary" size="lg">
              כבר יש לי חשבון
            </Button>
          </Link>
        </div>
        <p className="mt-3 text-xs text-base-muted">
          ניתוח לימודי לאחר המשחק בלבד — לא אתר הימורים, אין משחק בכסף אמיתי. מיועד לבני 18
          ומעלה.
        </p>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Panel key={f.title}>
              <PanelBody className="space-y-2">
                <span className="text-2xl">{f.icon}</span>
                <h3 className="text-sm font-semibold">{f.title}</h3>
                <p className="text-sm text-base-muted">{f.body}</p>
              </PanelBody>
            </Panel>
          ))}
        </div>
      </section>

      {/* Free vs Pro */}
      <section className="mx-auto max-w-5xl px-4 py-8">
        <h2 className="mb-4 text-center text-2xl font-semibold">חינמי מול פרו</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Panel>
            <PanelBody>
              <h3 className="text-lg font-semibold">חינמי</h3>
              <p className="mt-1 text-2xl font-bold">₪0</p>
              <ul className="mt-4 space-y-2 text-sm text-base-text/90">
                <li>{formatLimit(PLAN_LIMITS.FREE.dailyQuickAnalysisLimit, "ניתוחים מהירים")}</li>
                <li>{formatLimit(PLAN_LIMITS.FREE.dailyAnalysisLimit, "ניתוחים מתקדמים")}</li>
                <li>עד {PLAN_LIMITS.FREE.maxSavedHands} ניתוחים שמורים</li>
                <li>{formatLimit(PLAN_LIMITS.FREE.dailyAiReviewLimit, "סקירות AI")}</li>
                <li>מצב אימון בסיסי, מאמן אישי וגילוי דליפות (תצוגת תקציר)</li>
              </ul>
            </PanelBody>
          </Panel>
          <Panel className="border-accent/40">
            <PanelBody>
              <h3 className="text-lg font-semibold">פרו</h3>
              <p className="mt-1 text-2xl font-bold">
                ₪{PRO_PRICING_ILS.monthly.amountIls}
                <span className="text-sm font-normal text-base-muted">/לחודש</span>
              </p>
              <p className="text-xs text-base-muted">
                או ₪{PRO_PRICING_ILS.annual.amountIls}/לשנה — מחיר זמני, בהמתנה למחקר שוק
              </p>
              <ul className="mt-4 space-y-2 text-sm text-base-text/90">
                <li>ניתוחים, שמירה וסקירות AI ללא הגבלה</li>
                <li>טווח מול טווח ומחשבון ICM</li>
                <li>גילוי דליפות ודוח שבועי מלאים</li>
                <li>מצב אימון מלא, ייבוא מרובה וייצוא נתונים</li>
                <li>תמיכה מועדפת</li>
              </ul>
            </PanelBody>
          </Panel>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-8">
        <h2 className="mb-4 text-center text-2xl font-semibold">שאלות נפוצות</h2>
        <div className="space-y-3">
          {FAQ.map((item) => (
            <Panel key={item.q}>
              <PanelBody>
                <h3 className="text-sm font-semibold">{item.q}</h3>
                <p className="mt-1 text-sm text-base-muted">{item.a}</p>
              </PanelBody>
            </Panel>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-3xl px-4 py-10 text-center">
        <Link href="/signup">
          <Button size="lg">התחילו לנתח את הידיים שלכם — בחינם</Button>
        </Link>
      </section>

      <footer className="border-t border-base-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-6 text-center text-xs text-base-muted">
          <p>מיועד לבני 18 ומעלה. ניתוח לימודי לאחר המשחק בלבד — לא אתר הימורים.</p>
          <div className="flex items-center gap-3">
            <Link href="/terms" className="text-accent-soft underline">
              תנאי שימוש
            </Link>
            <Link href="/privacy" className="text-accent-soft underline">
              מדיניות פרטיות
            </Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent-soft underline">
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

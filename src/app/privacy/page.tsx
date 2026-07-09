// DRAFT — pending legal review by the owner before launch.
// Placeholder legal copy written to unblock the signup consent checkbox linking somewhere
// real; do not treat as reviewed/binding until the owner (or counsel) signs off.

import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/support";

export const metadata = {
  title: "מדיניות פרטיות — מנתח טווחי פוקר",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="text-xs text-accent-soft">
        ← חזרה לעמוד הראשי
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-base-text">מדיניות פרטיות</h1>
      <p className="mt-1 text-xs text-base-muted">עודכן לאחרונה: 9 ביולי 2026 (טיוטה)</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-base-text/90">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-base-text">1. מבוא</h2>
          <p>
            מנתח טווחי פוקר הוא כלי לימודי לניתוח ידיים וטווחים בפוקר לאחר סיום המשחק בלבד —
            לא אתר הימורים, ואין בו משחק בכסף אמיתי. מסמך זה מסביר אילו נתונים אנחנו אוספים,
            לשם מה, ואילו זכויות יש לך לגביהם.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-base-text">2. גיל מינימלי</h2>
          <p>השירות מיועד לבני 18 ומעלה בלבד, ואיננו אוספים ביודעין מידע ממשתמשים מתחת לגיל זה.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-base-text">3. אילו נתונים אנחנו אוספים</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>כתובת אימייל, לצורך יצירת חשבון והתחברות.</li>
            <li>
              ידיים, טווחים, סשנים ופרופילי יריבים שאתה/את שומר/ת בשירות — מאוחסנים בחשבונך
              בענן כדי שיהיו זמינים מכל מכשיר שבו אתה/את מתחבר/ת.
            </li>
            <li>יומן בנקרול (Bankroll) — נשמר רק במכשיר ובדפדפן המקומיים, לא בענן שלנו.</li>
            <li>
              נתוני שימוש בסיסיים לצורך תפעול השירות (למשל מכסת ניתוחי AI יומית), ואנליטיקס
              מצטבר ואנונימי ככל האפשר, כשמופעל.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-base-text">4. עיבוד תוכן על ידי AI</h2>
          <p>
            כשאתה/את מבקש/ת סקירת AI ליד, תקציר היד הרלוונטי (קלפים, פעולות, תוצאה) נשלח לספק
            מודל השפה שלנו (Anthropic) לצורך יצירת הסקירה בלבד, ואינו נשמר בצד אותו ספק מעבר
            לזמן הנדרש לעיבוד הבקשה.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-base-text">5. עם מי אנחנו משתפים מידע</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>Supabase — אחסון בסיס הנתונים והזדהות המשתמשים.</li>
            <li>Anthropic — עיבוד תוכן יד לצורך סקירות AI, כמפורט לעיל.</li>
            <li>ספק סליקת תשלומים (Grow) — לצורך עיבוד תשלום מנוי הפרו בלבד.</li>
          </ul>
          <p>איננו מוכרים מידע אישי לצדדים שלישיים.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-base-text">6. שמירה ומחיקה</h2>
          <p>
            הנתונים שמורים בחשבונך כל עוד החשבון פעיל. ניתן למחוק את החשבון ואת כל הנתונים
            המשויכים לו לצמיתות בכל עת דרך עמוד ההגדרות — פעולה זו אינה הפיכה.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-base-text">7. אבטחה</h2>
          <p>
            הגישה לנתוני המשתמשים מוגבלת ברמת בסיס הנתונים כך שכל משתמש רואה רק את הנתונים
            שלו. עם זאת, אין שיטת אבטחה שהיא חסינה לחלוטין, ואיננו יכולים להבטיח הגנה מוחלטת.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-base-text">8. הזכויות שלך</h2>
          <p>
            יש לך זכות לעיין במידע שנשמר עליך, לתקן אותו, ולבקש מחיקה מלאה של חשבונך ונתוניו
            (ראו סעיף 6). לכל בקשה או שאלה בנוגע לזכויותיך, ניתן לפנות אלינו בכתובת{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent-soft underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-base-text">9. שינויים במדיניות</h2>
          <p>
            אנו עשויים לעדכן מדיניות זו מעת לעת. המשך השימוש בשירות לאחר עדכון מהווה הסכמה
            למדיניות המעודכנת.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-base-text">10. יצירת קשר</h2>
          <p>
            לשאלות בנוגע למדיניות הפרטיות ניתן לפנות אלינו בכתובת{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent-soft underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

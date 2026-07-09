// DRAFT — pending legal review by the owner before launch.
// Placeholder legal copy written to unblock the signup consent checkbox linking somewhere
// real; do not treat as reviewed/binding until the owner (or counsel) signs off.

import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/support";

export const metadata = {
  title: "תנאי שימוש — מנתח טווחי פוקר",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="text-xs text-accent-soft">
        ← חזרה לעמוד הראשי
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-base-text">תנאי שימוש</h1>
      <p className="mt-1 text-xs text-base-muted">עודכן לאחרונה: 9 ביולי 2026 (טיוטה)</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-base-text/90">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-base-text">1. מה זה מנתח טווחי פוקר</h2>
          <p>
            מנתח טווחי פוקר הוא כלי לימודי לניתוח ידיים וטווחים בפוקר <strong>לאחר</strong> סיום
            המשחק בלבד. השירות אינו אתר הימורים, אינו מאפשר משחק בכסף אמיתי, ואינו מספק כל
            סיוע בזמן אמת במהלך יד חיה. מטרתו היחידה היא עזרה בהבנת החלטות שכבר התקבלו, לצורך
            שיפור ולמידה.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-base-text">2. גיל מינימלי</h2>
          <p>
            השימוש בשירות מיועד לבני 18 ומעלה בלבד. בהרשמה ובשימוש בשירות אתה/את מצהיר/ה כי
            גילך 18 שנים או יותר.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-base-text">3. חשבון משתמש</h2>
          <p>
            השימוש בשירות דורש הרשמה עם כתובת אימייל וסיסמה (או התחברות דרך גוגל, כשמוגדר).
            אתה/את אחראי/ת לשמירה על סודיות פרטי הכניסה לחשבונך ולכל פעילות המתבצעת דרכו.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-base-text">4. תוכנית חינמית ותוכנית פרו</h2>
          <p>
            השירות מציע מסלול שימוש חינמי עם מגבלות שימוש, ומסלול פרו בתשלום המסיר את רוב
            המגבלות — ראו את פרטי התוכניות בעמוד{" "}
            <Link href="/billing" className="text-accent-soft underline">
              המנוי והחיוב
            </Link>
            . עסקאות תשלום מעובדות דרך ספק סליקה חיצוני. ביטול מנוי או שאלות לגבי חיוב — פנו
            אלינו בכתובת{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent-soft underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-base-text">5. שימוש הוגן</h2>
          <p>
            אין להשתמש בשירות למטרה בלתי חוקית, לניסיון פריצה או עומס מכוון על המערכת, להעתקת
            תוכן השירות למטרות מסחריות ללא אישור, או לכל שימוש שפוגע במשתמשים אחרים או בשירות
            עצמו.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-base-text">6. קניין רוחני</h2>
          <p>
            כל הזכויות בקוד, בעיצוב, בלוגו ובתוכן השירות (למעט התוכן שאתה/את מזין/ה, כגון ידיים
            ופרופילי יריבים) שייכות למפעילי השירות.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-base-text">7. הגבלת אחריות</h2>
          <p>
            השירות מסופק כפי שהוא (&quot;AS IS&quot;), ללא כל התחייבות לדיוק מוחלט של חישובי
            האקוויטי, המלצות המאמן, או סקירות ה-AI. אין להסתמך על השירות כעצה מקצועית פיננסית
            או משפטית. השימוש בתובנות השירות לצורך משחק בכסף אמיתי הוא באחריותך הבלעדית, ומפעילי
            השירות לא יישאו באחריות לכל הפסד שייגרם כתוצאה משימוש כאמור.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-base-text">8. שינויים בתנאים</h2>
          <p>
            אנו עשויים לעדכן תנאים אלה מעת לעת. המשך השימוש בשירות לאחר עדכון מהווה הסכמה
            לתנאים המעודכנים.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-base-text">9. יצירת קשר</h2>
          <p>
            לשאלות בנוגע לתנאי השימוש ניתן לפנות אלינו בכתובת{" "}
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

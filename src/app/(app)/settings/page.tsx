"use client";

import { useState } from "react";
import Link from "next/link";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useMockPlan } from "@/lib/useMockPlan";
import { useTheme } from "@/lib/useTheme";
import { listHands, clearAllHands, downloadTextFile } from "@/lib/localHandStore";
import { listOpponents, clearAllOpponents } from "@/lib/localOpponentStore";
import { listSessions, clearAllSessions } from "@/lib/localSessionStore";
import { listRanges, clearAllRanges } from "@/lib/localRangeStore";

function exportAllData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    hands: listHands(),
    opponents: listOpponents(),
    sessions: listSessions(),
    ranges: listRanges(),
  };
  downloadTextFile(
    `poker-range-analyzer-export-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(payload, null, 2),
    "application/json"
  );
}

function deleteAllData() {
  clearAllHands();
  clearAllOpponents();
  clearAllSessions();
  clearAllRanges();
}

export default function SettingsPage() {
  const [plan, setPlan] = useMockPlan();
  const [theme, setTheme] = useTheme();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const handleDeleteAll = () => {
    deleteAllData();
    setConfirmingDelete(false);
    setDeleted(true);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">הגדרות</h1>

      <Panel>
        <PanelHeader>
          <PanelTitle>תוכנית</PanelTitle>
          <Badge tone={plan === "PRO" ? "ahead" : "neutral"}>{plan === "PRO" ? "פרו" : "חינמי"}</Badge>
        </PanelHeader>
        <PanelBody className="space-y-3">
          <p className="text-sm text-base-muted">
            עד שהחיוב האמיתי יחובר, אפשר להשתמש במתג הזה כדי להדגים באופן מקומי את ההבדל בין
            חינמי לפרו.
          </p>
          <div className="flex gap-2">
            <Button variant={plan === "FREE" ? "primary" : "secondary"} size="sm" onClick={() => setPlan("FREE")}>
              חינמי
            </Button>
            <Button variant={plan === "PRO" ? "primary" : "secondary"} size="sm" onClick={() => setPlan("PRO")}>
              פרו
            </Button>
            <Link href="/billing">
              <Button variant="ghost" size="sm">
                ניהול המנוי ←
              </Button>
            </Link>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>תצוגה</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-3">
          <p className="text-sm text-base-muted">
            התצוגה הבהירה היא ברירת המחדל המומלצת של המערכת. מצב כהה זמין כאופציה נוספת לשימוש
            בתאורה חלשה.
          </p>
          <div className="flex gap-2">
            <Button variant={theme === "light" ? "primary" : "secondary"} size="sm" onClick={() => setTheme("light")}>
              בהיר (מומלץ)
            </Button>
            <Button variant={theme === "dark" ? "primary" : "secondary"} size="sm" onClick={() => setTheme("dark")}>
              כהה
            </Button>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>הנתונים שלי</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">ייצוא כל הנתונים</p>
              <p className="text-sm text-base-muted">
                קובץ JSON אחד עם כל הידיים, הטווחים, הסשנים ופרופילי היריבים ששמרת.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={exportAllData}>
              ייצוא הכל
            </Button>
          </div>

          <div className="border-t border-base-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-status-risky">מחיקת כל הנתונים שלי</p>
                <p className="text-sm text-base-muted">
                  מוחק לצמיתות את כל הידיים, הטווחים, הסשנים והיריבים השמורים במכשיר הזה. לא ניתן
                  לבטל פעולה זו — מומלץ לייצא קודם.
                </p>
              </div>
              {!confirmingDelete ? (
                <Button variant="danger" size="sm" onClick={() => setConfirmingDelete(true)}>
                  מחיקת כל הנתונים
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                    ביטול
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleDeleteAll}>
                    אישור מחיקה סופית
                  </Button>
                </div>
              )}
            </div>
            {deleted && (
              <p className="mt-2 text-sm text-status-ahead">כל הנתונים נמחקו מהמכשיר הזה.</p>
            )}
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>פרטיות ואבטחת מידע</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-2 text-sm text-base-muted">
          <p>ניתוח לאחר המשחק בלבד — אין בכלי הזה סיוע בזמן אמת במשחק, בכוונה תחילה.</p>
          <p>
            הידיים, הטווחים, הסשנים ופרופילי היריבים ששמרת מאוחסנים מקומית בדפדפן הזה (localStorage)
            ואינם נשלחים לשרת אלא אם תבחר לחבר חשבון מסונכרן. ניתוח AI (כשמופעל) שולח רק את תקציר
            היד הרלוונטי לצורך קבלת הסקירה, ואינו שומר אותו בצד השרת.
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useMockPlan } from "@/lib/useMockPlan";
import { useTheme } from "@/lib/useTheme";
import { useNotificationSettings } from "@/lib/useNotificationSettings";
import { NOTIFICATION_CATEGORY_LABEL, type NotificationCategory, type NotificationFrequency } from "@/lib/notifications";
import { getPushPermission, requestPushPermission, type PushPermission } from "@/lib/notificationsPush";
import { listHands, clearAllHands, downloadTextFile } from "@/lib/localHandStore";
import { listOpponents, clearAllOpponents } from "@/lib/localOpponentStore";
import { listSessions, clearAllSessions } from "@/lib/localSessionStore";
import { listRanges, clearAllRanges } from "@/lib/localRangeStore";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/supabase/auth-actions";
import { canPerformAction } from "@/lib/plan";
import { track } from "@/lib/analytics";

async function exportAllData() {
  const [hands, ranges, opponents, sessions] = await Promise.all([
    listHands(),
    listRanges(),
    listOpponents(),
    listSessions(),
  ]);
  const payload = {
    exportedAt: new Date().toISOString(),
    hands,
    opponents,
    sessions,
    ranges,
  };
  downloadTextFile(
    `poker-range-analyzer-export-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(payload, null, 2),
    "application/json"
  );
}

const PUSH_PERMISSION_LABEL: Record<PushPermission, string> = {
  unsupported: "לא נתמך בדפדפן זה",
  default: "לא הופעלו עדיין",
  granted: "פעילות",
  denied: "חסומות",
};

async function deleteAllData() {
  await Promise.all([clearAllHands(), clearAllRanges(), clearAllOpponents(), clearAllSessions()]);
}

export default function SettingsPage() {
  const [plan, setPlan] = useMockPlan();
  const [theme, setTheme] = useTheme();
  const [notificationSettings, setNotificationSettings] = useNotificationSettings();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exportGateMessage, setExportGateMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [pushPermission, setPushPermission] = useState<PushPermission>("default");

  useEffect(() => {
    setPushPermission(getPushPermission());
  }, []);

  const handleRequestPush = async () => {
    const result = await requestPushPermission();
    setPushPermission(result);
  };

  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        setEmail(data.user?.email ?? null);
        setUserId(data.user?.id ?? null);
      });
    } catch {
      // Supabase not configured yet (local dev) — nothing to show.
    }
  }, []);

  const handleReplayOnboarding = () => {
    if (!userId) return;
    try {
      window.localStorage.removeItem(`pra:onboarded:${userId}`);
    } catch {
      // localStorage unavailable — nothing to clear.
    }
    window.location.reload();
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAllData();
      setConfirmingDelete(false);
      setDeleted(true);
    } catch {
      setDeleteError("שגיאה במחיקת הנתונים — נסה שוב.");
    } finally {
      setDeleting(false);
    }
  };

  const handleExportAll = async () => {
    const gate = canPerformAction(plan, "exportData");
    if (!gate.allowed) {
      setExportGateMessage(gate.reason ?? "ייצוא נתונים זמין רק במסלול פרו.");
      return;
    }
    setExportGateMessage(null);
    setExportError(null);
    setExporting(true);
    try {
      await exportAllData();
    } catch {
      setExportError("שגיאה בייצוא הנתונים — נסה שוב.");
    } finally {
      setExporting(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  const toggleNotificationsEnabled = () => {
    setNotificationSettings({ ...notificationSettings, enabled: !notificationSettings.enabled });
  };

  const setNotificationFrequency = (frequency: NotificationFrequency) => {
    setNotificationSettings({ ...notificationSettings, frequency });
  };

  const toggleNotificationCategory = (category: NotificationCategory) => {
    setNotificationSettings({
      ...notificationSettings,
      categories: { ...notificationSettings.categories, [category]: !notificationSettings.categories[category] },
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">הגדרות</h1>

      <Panel>
        <PanelHeader>
          <PanelTitle>חשבון</PanelTitle>
        </PanelHeader>
        <PanelBody className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{email ?? "…"}</p>
            <p className="text-sm text-base-muted">מחובר/ת למנתח טווחי פוקר.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? "מתנתק/ת…" : "התנתקות"}
          </Button>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>התוכנית שלי</PanelTitle>
          <Badge tone={plan === "PRO" ? "ahead" : "neutral"}>{plan === "PRO" ? "פרו" : "חינמי"}</Badge>
        </PanelHeader>
        <PanelBody className="space-y-3">
          {plan === "PRO" ? (
            <p className="text-sm text-base-muted">
              לניהול המנוי או ביטולו, פנה לתמיכה — עדיין אין חיבור אמיתי לספק תשלומים, כך
              שהניהול כרגע נעשה ידנית מולנו ולא דרך פורטל עצמאי.
            </p>
          ) : (
            <p className="text-sm text-base-muted">
              אין לך מנוי פרו פעיל כרגע.{" "}
              <Link
                href="/billing"
                className="text-accent-soft underline"
                onClick={() => track("upgrade_clicked", { source: "settings_manage_plan" })}
              >
                אפשר לשדרג לפרו כאן
              </Link>
              .
            </p>
          )}
          <div className="border-t border-base-border pt-3">
            <p className="mb-2 text-xs text-base-muted">
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

          <div className="border-t border-base-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">סיור ההיכרות</p>
                <p className="text-sm text-base-muted">
                  רוצים לעבור שוב על ההסבר הראשוני על המערכת? אפשר להציג אותו מחדש בכל רגע.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleReplayOnboarding} disabled={!userId}>
                הצג את סיור ההיכרות מחדש
              </Button>
            </div>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>התראות</PanelTitle>
          <Badge tone={notificationSettings.enabled ? "ahead" : "neutral"}>
            {notificationSettings.enabled ? "פעיל" : "כבוי"}
          </Badge>
        </PanelHeader>
        <PanelBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">הפעלת התראות</p>
              <p className="text-sm text-base-muted">כיבוי מוחלט מסתיר גם את מספר ההתראות שלא נקראו בפעמון.</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={notificationSettings.enabled ? "primary" : "secondary"}
                size="sm"
                onClick={() => notificationSettings.enabled || toggleNotificationsEnabled()}
              >
                הפעל
              </Button>
              <Button
                variant={!notificationSettings.enabled ? "primary" : "secondary"}
                size="sm"
                onClick={() => notificationSettings.enabled && toggleNotificationsEnabled()}
              >
                כבה
              </Button>
            </div>
          </div>

          <div className="border-t border-base-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">פופ-אפ במכשיר</p>
                <p className="text-sm text-base-muted">
                  התראות כפופ-אפ אמיתי של המכשיר (התראת מערכת), במקום להסתמך רק על הפעמון בתוך
                  האפליקציה. עובד כשהאפליקציה פתוחה או פועלת ברקע בדפדפן — לא כשהיא סגורה לגמרי.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={pushPermission === "granted" ? "ahead" : pushPermission === "denied" ? "behind" : "neutral"}>
                  {PUSH_PERMISSION_LABEL[pushPermission]}
                </Badge>
                {pushPermission !== "granted" && pushPermission !== "unsupported" && (
                  <Button size="sm" onClick={handleRequestPush} disabled={pushPermission === "denied"}>
                    הפעלה
                  </Button>
                )}
              </div>
            </div>
            {pushPermission === "denied" && (
              <p className="mt-2 text-xs text-status-risky">
                ההתראות נחסמו ברמת הדפדפן. כדי להפעיל, יש לאשר ידנית דרך הגדרות האתר בדפדפן (סמל
                המנעול ליד שורת הכתובת).
              </p>
            )}
          </div>

          <div className="border-t border-base-border pt-4">
            <p className="text-sm font-medium">תדירות</p>
            <p className="mt-1 text-sm text-base-muted">
              נמוכה מציגה רק אירועים משמעותיים (רצפים, הישגים ודליפות חמורות). רגילה וגבוהה מציגות
              את כל סוגי ההתראות שמופעלים למטה.
            </p>
            <div className="mt-2 flex gap-2">
              {(
                [
                  { value: "low", label: "נמוכה" },
                  { value: "normal", label: "רגילה" },
                  { value: "high", label: "גבוהה" },
                ] as { value: NotificationFrequency; label: string }[]
              ).map((f) => (
                <Button
                  key={f.value}
                  variant={notificationSettings.frequency === f.value ? "primary" : "secondary"}
                  size="sm"
                  disabled={!notificationSettings.enabled}
                  onClick={() => setNotificationFrequency(f.value)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="border-t border-base-border pt-4">
            <p className="text-sm font-medium">לפי קטגוריה</p>
            <div className="mt-2 space-y-2">
              {(Object.keys(NOTIFICATION_CATEGORY_LABEL) as NotificationCategory[]).map((category) => (
                <div key={category} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-base-text">{NOTIFICATION_CATEGORY_LABEL[category]}</span>
                  <Button
                    variant={notificationSettings.categories[category] ? "primary" : "secondary"}
                    size="sm"
                    disabled={!notificationSettings.enabled}
                    onClick={() => toggleNotificationCategory(category)}
                  >
                    {notificationSettings.categories[category] ? "מופעל" : "כבוי"}
                  </Button>
                </div>
              ))}
            </div>
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
            <Button variant="secondary" size="sm" onClick={handleExportAll} disabled={exporting}>
              {exporting ? "מייצא…" : "ייצוא הכל"}
            </Button>
          </div>
          {exportGateMessage && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-status-risky/40 bg-status-risky/10 px-3 py-2">
              <span className="text-sm text-status-risky">{exportGateMessage}</span>
              <Link
                href="/billing"
                onClick={() => track("upgrade_clicked", { source: "settings_export_gate" })}
              >
                <Button size="sm">שדרוג לפרו</Button>
              </Link>
            </div>
          )}
          {exportError && <p className="text-sm text-status-risky">{exportError}</p>}

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
                  <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                    ביטול
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleDeleteAll} disabled={deleting}>
                    {deleting ? "מוחק…" : "אישור מחיקה סופית"}
                  </Button>
                </div>
              )}
            </div>
            {deleted && (
              <p className="mt-2 text-sm text-status-ahead">כל הנתונים נמחקו מהמכשיר הזה.</p>
            )}
            {deleteError && <p className="mt-2 text-sm text-status-risky">{deleteError}</p>}
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
            הידיים, הטווחים, הסשנים ופרופילי היריבים ששמרת מאוחסנים בחשבון שלך בענן (מוגנים
            ונגישים רק לך), כדי שיהיו זמינים מכל מכשיר שבו אתה מחובר. ניתוח AI (כשמופעל) שולח רק
            את תקציר היד הרלוונטי לצורך קבלת הסקירה, ואינו שומר אותו בצד השרת.
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}

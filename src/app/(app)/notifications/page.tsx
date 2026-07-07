"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { listHands } from "@/lib/localHandStore";
import {
  computeNotifications,
  markAllRead,
  unreadNotifications,
  visibleNotifications,
  dismissNotification,
  getNotificationSettings,
  NOTIFICATION_KIND_LABEL,
  type AppNotification,
  type NotificationKind,
} from "@/lib/notifications";
import { useMockPlan } from "@/lib/useMockPlan";
import { getTodayCount } from "@/lib/usageTracker";
import { track } from "@/lib/analytics";

/** Small local Hebrew relative-time helper — day-granularity ("היום"/"אתמול"/"לפני X ימים"),
 *  distinct from NotificationBell.tsx's minute/hour-granularity version since this page is meant
 *  for a slower glance-back rather than "just now" freshness in a live dropdown. */
function relativeDayHe(ts: number): string {
  const startOfDay = (d: number) => new Date(new Date(d).toDateString()).getTime();
  const diffDays = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "היום";
  if (diffDays === 1) return "אתמול";
  return `לפני ${diffDays} ימים`;
}

type KindFilter = "all" | NotificationKind;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [plan] = useMockPlan();

  const refresh = () => {
    const settings = getNotificationSettings();
    const items = visibleNotifications(
      computeNotifications(listHands(), {
        plan,
        todayAnalysisCount: getTodayCount("analysis"),
        ...settings,
      })
    ).sort((a, b) => b.createdAt - a.createdAt);
    setNotifications(items);
    const unread = new Set(unreadNotifications(items).map((n) => n.id));
    setReadIds(new Set(items.filter((n) => !unread.has(n.id)).map((n) => n.id)));
    // Viewing the full list marks everything currently shown as read, same as opening the bell.
    markAllRead(items.map((n) => n.id));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const handleDismiss = (id: string) => {
    dismissNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const filtered = kindFilter === "all" ? notifications : notifications.filter((n) => n.kind === kindFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">התראות</h1>
          <p className="mt-1 text-sm text-base-muted">כל ההתראות הפעילות כרגע, לא רק האחרונות שבתפריט הנפתח.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-base-muted" htmlFor="notification-kind-filter">
            סוג
          </label>
          <select
            id="notification-kind-filter"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as KindFilter)}
            className="rounded-lg border border-base-border bg-base-panel2 px-2.5 py-1.5 text-sm text-base-text outline-none focus:border-accent"
          >
            <option value="all">הכול</option>
            {(Object.keys(NOTIFICATION_KIND_LABEL) as NotificationKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {NOTIFICATION_KIND_LABEL[kind]}
              </option>
            ))}
          </select>
          <Badge tone="neutral">{filtered.length}</Badge>
        </div>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>הכל</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-2">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-base-muted">
              {notifications.length === 0 ? "אין התראות פעילות כרגע." : "אין התראות מהסוג הזה כרגע."}
            </p>
          ) : (
            filtered.map((n) => {
              const isRead = readIds.has(n.id);
              return (
                <div
                  key={n.id}
                  className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-sm transition-colors ${
                    isRead ? "border-base-border" : "border-accent/50 bg-accent/5"
                  }`}
                >
                  <Link
                    href={n.href}
                    className="min-w-0 flex-1"
                    onClick={() => track("notification_opened", { kind: n.kind, id: n.id })}
                  >
                    <div className="flex items-center gap-2">
                      {!isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />}
                      <p className="text-base-text">{n.message}</p>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge tone="neutral" className="px-1.5 py-0 text-[10px]">
                        {NOTIFICATION_KIND_LABEL[n.kind]}
                      </Badge>
                      <p className="text-[11px] text-base-muted">{relativeDayHe(n.createdAt)}</p>
                    </div>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => handleDismiss(n.id)}>
                    מחיקה
                  </Button>
                </div>
              );
            })
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}

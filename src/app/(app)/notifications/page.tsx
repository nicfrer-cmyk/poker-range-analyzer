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
  type AppNotification,
} from "@/lib/notifications";
import { useMockPlan } from "@/lib/useMockPlan";
import { getTodayCount } from "@/lib/usageTracker";

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

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">התראות</h1>
          <p className="mt-1 text-sm text-base-muted">כל ההתראות הפעילות כרגע, לא רק האחרונות שבתפריט הנפתח.</p>
        </div>
        <Badge tone="neutral">{notifications.length}</Badge>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>הכל</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-2">
          {notifications.length === 0 ? (
            <p className="py-8 text-center text-sm text-base-muted">אין התראות פעילות כרגע.</p>
          ) : (
            notifications.map((n) => {
              const isRead = readIds.has(n.id);
              return (
                <div
                  key={n.id}
                  className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-sm transition-colors ${
                    isRead ? "border-base-border" : "border-accent/50 bg-accent/5"
                  }`}
                >
                  <Link href={n.href} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />}
                      <p className="text-base-text">{n.message}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-base-muted">{relativeDayHe(n.createdAt)}</p>
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

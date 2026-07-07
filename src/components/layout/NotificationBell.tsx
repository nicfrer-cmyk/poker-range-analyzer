"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { listHands } from "@/lib/localHandStore";
import { computeNotifications, markAllRead, unreadNotifications, type AppNotification } from "@/lib/notifications";

function relativeTimeHe(ts: number): string {
  const diffMs = Date.now() - ts;
  if (diffMs < 60 * 1000) return "עכשיו";
  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  // Recompute fresh from local data on mount — no push notifications, no stored event log.
  useEffect(() => {
    const items = computeNotifications(listHands());
    setNotifications(items);
    setUnreadCount(unreadNotifications(items).length);
  }, []);

  const handleToggle = () => {
    if (!open) {
      // Opening the panel marks everything currently visible as read.
      markAllRead(notifications.map((n) => n.id));
      setUnreadCount(0);
    }
    setOpen((o) => !o);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="התראות"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-base-muted transition-colors hover:bg-base-panel2 hover:text-base-text"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-status-behind px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-full z-50 mt-2 w-80 max-w-[90vw]">
            <Panel className="max-h-[70vh] overflow-hidden">
              <PanelHeader>
                <PanelTitle>התראות</PanelTitle>
                <Badge tone="neutral">{notifications.length}</Badge>
              </PanelHeader>
              <PanelBody className="max-h-[55vh] space-y-2 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="py-6 text-center text-sm text-base-muted">אין התראות חדשות כרגע.</p>
                ) : (
                  notifications.map((n) => (
                    <Link
                      key={n.id}
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-lg border border-base-border p-2.5 text-sm transition-colors hover:border-accent/60 hover:bg-base-panel2"
                    >
                      <p className="text-base-text">{n.message}</p>
                      <p className="mt-1 text-[11px] text-base-muted">{relativeTimeHe(n.createdAt)}</p>
                    </Link>
                  ))
                )}
              </PanelBody>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

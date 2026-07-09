import { readJson, writeJson } from "@/lib/coach/coachStorage";
import { computeNotifications, getNotificationSettings, visibleNotifications, type AppNotification } from "@/lib/notifications";
import { listHands } from "@/lib/localHandStore";
import { getTodayCount } from "@/lib/usageTracker";
import type { Plan } from "@/lib/plan";

/**
 * Real device (OS-level) notification popups — separate from the in-app bell/`/notifications`
 * page, which stays as a history log. This never fires unless the browser has actually granted
 * `Notification` permission (requested explicitly from Settings, never auto-prompted on load).
 *
 * "Push" here means *locally triggered* while the app/service worker is running, not server-sent
 * Web Push — there's no backend yet that can wake a fully-closed app, so this only covers the
 * open-tab / backgrounded-PWA case.
 */

export type PushPermission = NotificationPermission | "unsupported";

const PUSHED_IDS_KEY = "pra:notifications:pushed:v1";
const MAX_PUSHED_IDS = 200;

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getPushPermission(): PushPermission {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestPushPermission(): Promise<PushPermission> {
  if (!isPushSupported()) return "unsupported";
  return Notification.requestPermission();
}

async function showPopup(title: string, body: string, tag: string, href?: string): Promise<void> {
  const registration =
    "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (registration) {
    registration.showNotification(title, {
      body,
      tag,
      data: href ? { href } : undefined,
      icon: "/icons/icon-192.png",
    }).catch(() => {
      // Registration exists but isn't "active" yet (e.g. right after a fresh install) — fall
      // back to the plain Notification constructor so the popup still appears.
      const popup = new Notification(title, { body, tag });
      if (href) popup.onclick = () => { window.focus(); window.location.href = href; };
    });
  } else {
    const popup = new Notification(title, { body, tag });
    if (href) popup.onclick = () => { window.focus(); window.location.href = href; };
  }
}

/**
 * Fires an immediate, real device-notification popup, bypassing the pushed/seen-id dedup —
 * for the "שלח התראת בדיקה" button in Settings, so a user can confirm the OS-popup path
 * actually works on their device/browser right after granting permission, independent of
 * whether any real notification condition happens to be true today.
 */
export async function sendTestNotification(): Promise<boolean> {
  if (getPushPermission() !== "granted") return false;
  await showPopup("מנתח טווחי פוקר", "זו התראת בדיקה — אם ראית אותה, ההתראות שלך פעילות.", "test-notification");
  return true;
}

function getPushedIds(): string[] {
  return readJson<string[]>(PUSHED_IDS_KEY, []);
}

function markPushed(ids: string[]): void {
  if (ids.length === 0) return;
  const merged = [...getPushedIds().filter((id) => !ids.includes(id)), ...ids];
  writeJson(PUSHED_IDS_KEY, merged.slice(-MAX_PUSHED_IDS));
}

/**
 * Fires a native device-notification popup for every notification not yet pushed, once each —
 * mirrors the read/dismissed id-based "seen" tracking in lib/notifications.ts so the same
 * underlying condition never pops up twice. No-ops entirely unless permission is "granted".
 */
export async function pushNewNotifications(notifications: AppNotification[]): Promise<void> {
  if (getPushPermission() !== "granted") return;

  const pushedIds = new Set(getPushedIds());
  const fresh = notifications.filter((n) => !pushedIds.has(n.id));
  if (fresh.length === 0) return;

  for (const n of fresh) {
    await showPopup("מנתח טווחי פוקר", n.message, n.id, n.href);
  }

  markPushed(fresh.map((n) => n.id));
}

/**
 * Full compute-then-push cycle: reads saved hands + notification settings, recomputes today's
 * notifications, and pushes any not-yet-seen ones as real device popups. This is the single
 * shared entry point both `NotificationBell` (on mount) and Settings (right after a user grants
 * permission) call — granting permission alone used to do nothing until the next full page
 * reload, because the bell's own check had already run *before* permission existed. Calling
 * this immediately after a successful `requestPushPermission()` closes that gap.
 */
export async function checkAndPushNotifications(plan: Plan): Promise<void> {
  if (getPushPermission() !== "granted") return;
  const hands = await listHands();
  const settings = getNotificationSettings();
  const items = visibleNotifications(
    computeNotifications(hands, {
      plan,
      todayAnalysisCount: getTodayCount("analysis"),
      ...settings,
    })
  );
  await pushNewNotifications(items);
}

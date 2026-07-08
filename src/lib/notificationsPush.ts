import { readJson, writeJson } from "@/lib/coach/coachStorage";
import type { AppNotification } from "@/lib/notifications";

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

  const registration =
    "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;

  for (const n of fresh) {
    if (registration) {
      registration.showNotification("מנתח טווחי פוקר", {
        body: n.message,
        tag: n.id,
        data: { href: n.href },
        icon: "/icons/icon-192.png",
      });
    } else {
      const popup = new Notification("מנתח טווחי פוקר", { body: n.message, tag: n.id });
      popup.onclick = () => {
        window.focus();
        window.location.href = n.href;
      };
    }
  }

  markPushed(fresh.map((n) => n.id));
}

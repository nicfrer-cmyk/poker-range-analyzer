// ---------------------------------------------------------------------------
// Product analytics event plumbing.
//
// Every call site in the app calls `track(event, props)` regardless of whether a real provider
// is configured — the same "degrade gracefully, never fake" pattern used by every other
// not-yet-configured integration in this codebase (see `src/lib/stripe/client.ts`,
// `src/lib/grow/client.ts`, `src/lib/supabase/auth-actions.ts`): call sites never need to know
// whether a real provider is wired up, and nothing ever crashes because one isn't.
//
// LOCAL-ONLY NOTE: until `NEXT_PUBLIC_ANALYTICS_PROVIDER` is set (see `.env.example`), `track()`
// just `console.debug()`s the event instead of sending it anywhere — visible in dev tools,
// harmless in production, and deliberately *not* a silent no-op that could be mistaken for "not
// wired up at all". Set `NEXT_PUBLIC_ANALYTICS_PROVIDER="posthog"` + `NEXT_PUBLIC_POSTHOG_KEY`
// (+ optionally `NEXT_PUBLIC_POSTHOG_HOST`) to turn on the real PostHog send below — remember to
// also add that host to `connect-src` in `next.config.mjs` (already done for the default host;
// only matters if you point `NEXT_PUBLIC_POSTHOG_HOST` somewhere else).
// ---------------------------------------------------------------------------

import posthog from "posthog-js";

export type AnalyticsEvent =
  | "signup_started"
  | "signup_completed"
  | "login_completed"
  | "onboarding_started"
  | "onboarding_completed"
  | "onboarding_skipped"
  | "quick_analysis_started"
  | "quick_analysis_completed"
  | "advanced_analysis_started"
  | "advanced_analysis_completed"
  | "hand_saved"
  | "hand_review_completed"
  | "tag_added"
  | "notification_opened"
  | "screenshot_parsed"
  | "screenshot_review_confirmed"
  | "paywall_viewed"
  | "upgrade_clicked"
  | "subscription_started"
  | "user_returned";

const SESSION_ID_KEY = "pra:analyticsSessionId";

/**
 * Anonymous, per-browser id — generated once and reused via `localStorage` (same pattern as
 * `pra:theme` in `useTheme.ts`), so events fired from the
 * same browser can be grouped together without any real user identity attached. Browser-only:
 * returns `undefined` for events fired from the server (e.g. `subscription_started`, tracked
 * from the `billing/page.tsx` Server Action) — there's no equivalent durable anonymous id to use
 * server-side without inventing a cookie, which is more than this needs right now.
 */
function getSessionId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    let id = window.localStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (e.g. private browsing edge cases) — the event still fires below,
    // just without a stable session id attached.
    return undefined;
  }
}

let posthogInitialized = false;

/** Lazily initializes the PostHog client on first use, client-side only — posthog-js reaches
 *  for `window`/`document` internally, so this must never run during SSR. Returns whether
 *  PostHog is actually ready to receive a `capture()` call. */
function ensurePosthogReady(): boolean {
  if (typeof window === "undefined") return false;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return false;
  if (!posthogInitialized) {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      // This file already fires its own well-defined event set with explicit props — PostHog's
      // autocapture/pageview features would just duplicate that with noisier, less meaningful
      // events.
      autocapture: false,
      capture_pageview: false,
    });
    posthogInitialized = true;
  }
  return true;
}

/**
 * Forwards an event to the configured analytics provider. Compiled into the app bundle via the
 * `posthog-js` package (no external `<script src="...">` tag), active only when
 * `NEXT_PUBLIC_ANALYTICS_PROVIDER="posthog"` and `NEXT_PUBLIC_POSTHOG_KEY` are both set — no-ops
 * otherwise (including server-side, where posthog-js can't run at all) and every event still
 * reaches `console.debug` in `track()` below regardless.
 */
function sendToProvider(event: AnalyticsEvent, payload: Record<string, unknown>): void {
  if (process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER !== "posthog") return;
  if (!ensurePosthogReady()) return;
  posthog.capture(event, payload);
}

/**
 * Fires an analytics event. Safe to call from client components, server components, and Server
 * Actions alike — never throws, and never crashes during SSR (the only browser-only piece,
 * `getSessionId`, guards itself with `typeof window !== "undefined"`).
 *
 * Every event automatically gets a timestamp and (when available) the anonymous session id.
 *
 * - No `NEXT_PUBLIC_ANALYTICS_PROVIDER` configured (the current state, everywhere, always):
 *   every event is `console.debug`-logged — both client- and server-side — so instrumentation is
 *   visibly "real and ready" rather than a silent no-op, and server-fired events (like
 *   `subscription_started`) still leave a trace in server logs even though there's nowhere else
 *   for them to go yet.
 * - `NEXT_PUBLIC_ANALYTICS_PROVIDER` configured: additionally forwarded to `sendToProvider`
 *   (currently a stub — implement it once a provider is chosen).
 */
export function track(event: AnalyticsEvent, props?: Record<string, unknown>): void {
  const payload: Record<string, unknown> = {
    ...props,
    event,
    ts: new Date().toISOString(),
    sessionId: getSessionId(),
  };

  console.debug(`[analytics] ${event}`, payload);

  const provider = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER;
  if (provider) {
    sendToProvider(event, payload);
  }
}

// ---------------------------------------------------------------------------
// Product analytics event plumbing.
//
// No real analytics provider (PostHog / GA4 / Mixpanel / Segment) is connected
// yet. Every call site in the app calls `track(event, props)` regardless —
// the same "degrade gracefully, never fake" pattern used by every other
// not-yet-configured integration in this codebase (see
// `src/lib/stripe/client.ts`, `src/lib/grow/client.ts`,
// `src/lib/supabase/auth-actions.ts`): call sites never need to know whether
// a real provider is wired up, and nothing ever crashes because one isn't.
//
// LOCAL-ONLY NOTE: until `NEXT_PUBLIC_ANALYTICS_PROVIDER` is set (see
// `.env.example`), `track()` just `console.debug()`s the event instead of
// sending it anywhere — visible in dev tools, harmless in production, and
// deliberately *not* a silent no-op that could be mistaken for "not wired up
// at all". Once a provider is chosen: set `NEXT_PUBLIC_ANALYTICS_PROVIDER`
// and implement `sendToProvider` below — that is the only place that should
// need to change; every `track(...)` call site elsewhere in the app stays
// exactly as-is.
// ---------------------------------------------------------------------------

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

/**
 * TODO: wire a real analytics provider here once one is chosen (PostHog / GA4 / Mixpanel /
 * Segment, ...). E.g. `window.posthog?.capture(event, payload)` for a client-side snippet, or a
 * `fetch("/api/analytics", ...)` relay if server-fired events need to reach it too. This is the
 * only function that should need to change — every `track()` call site in the app stays as-is.
 */
function sendToProvider(event: AnalyticsEvent, payload: Record<string, unknown>): void {
  void event;
  void payload;
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

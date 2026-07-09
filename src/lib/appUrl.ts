// ---------------------------------------------------------------------------
// Canonical public base URL, for anything where trusting a client-controlled
// header would be unsafe: payment redirect/notify URLs, metadata, sitemap,
// robots. The `origin`/`host` request headers are set by whoever sends the
// HTTP request, not by us — fine for "where do I redirect this browser back
// to" in general, but not for URLs that get sent to a third-party payment
// processor or embedded in crawl directives.
//
// Prefer `NEXT_PUBLIC_APP_URL`. Falls back to the request's own origin only
// when that env var isn't set yet (local dev before it's configured).
// ---------------------------------------------------------------------------

export function getAppUrl(requestOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return requestOrigin ?? "http://localhost:3000";
}

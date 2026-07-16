// `'unsafe-inline'` on script-src is required by the small theme-flash-prevention inline
// script in `src/app/layout.tsx` (a fixed, static string — no user input ever reaches it).
// `'unsafe-eval'` is added in development only — Next's dev-mode bundler evaluates modules
// via `eval()` for Fast Refresh/HMR (confirmed live: without it, every page throws
// "EvalError: ... violates ... 'unsafe-eval' is not an allowed source"). `next build`/`next
// start` don't use eval-based bundling, so production stays without it, matching Next's own
// documented CSP guidance. Everything else here is a real restriction with no known
// functional cost: fonts are self-hosted via next/font (no external font-src needed), and the
// only cross-origin browser calls are to Supabase's own REST/Auth API.
const isDev = process.env.NODE_ENV !== "production";
// challenges.cloudflare.com: Cloudflare Turnstile CAPTCHA (src/components/auth/Turnstile.tsx) —
// script-src loads its widget script, frame-src is the challenge iframe it renders, connect-src
// is the verification call it makes on submit. Inert (script never loads) when
// NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set, but the CSP has to allow it either way since it's
// static config, not conditional on that env var.
//
// PostHog (src/lib/analytics.ts) ships compiled into our own bundle (no external <script> tag),
// so it only needs connect-src for its capture-event network calls — added only when analytics
// is actually turned on, since NEXT_PUBLIC_POSTHOG_HOST is a real (if defaulted) env var here,
// unlike the Turnstile case above.
const analyticsProvider = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
// AdSense (src/components/ads/AdSlot.tsx) loads an external script, renders ads inside
// cross-origin iframes, and calls out for impression/click tracking — all three need their own
// CSP directive. Conditional on the client id being set (unlike Turnstile's always-on entries
// above) since these are a lot of extra third-party domains to trust for a feature that, unlike
// Turnstile, isn't part of this app's own security posture.
const adsenseEnabled = Boolean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID);
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${adsenseEnabled ? " https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.doubleclick.net https://*.googletagservices.com" : ""}${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${adsenseEnabled ? " https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com" : ""}`,
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com${analyticsProvider === "posthog" ? ` ${posthogHost}` : ""}${adsenseEnabled ? " https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net https://*.googleadservices.com https://*.adtrafficquality.google" : ""}`,
  `frame-src https://challenges.cloudflare.com${adsenseEnabled ? " https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://googleads.g.doubleclick.net https://*.adtrafficquality.google" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Excludes /_next/static and /_next/image — matches this project's own
        // middleware.ts matcher. Applying these headers (CSP in particular) to Next's
        // internal static-chunk responses interferes with the dev server's on-demand
        // asset serving (observed: chunk requests 404 only when this source matched
        // everything). Not a loss in production either way — those responses are
        // immutable, hashed static files, not top-level documents, so they don't need
        // page-level security headers.
        source: "/((?!_next/static|_next/image).*)",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;

# Roadmap / Project Status

Source spec: `poker-analyzer-spec.pdf` (Hebrew, v1.0, July 2026). This file tracks what's
actually built vs. what's still blocked on a real decision or credential — read this before
assuming something is "done."

## Phase 1 of paid-SaaS roadmap — mandatory auth gate — 2026-07-07

Product decision: registration is now required before using the app at all (no more
free-without-account usage). This is Phase 1 of an 8-phase roadmap; the rest of the app's
features are untouched.

**Shipped:**
- `middleware.ts` / `src/lib/supabase/middleware.ts`: every route now requires a signed-in
  Supabase user except `/login`, `/signup`, `/auth/*`, `/forgot-password`, `/reset-password`,
  `/api/*` (has its own per-route auth needs — the Stripe webhook in particular must stay
  reachable with no user session), `/_next/*`, and static files. Unauthenticated visits to a
  gated page redirect to `/login?next=<original-path>`; already-authenticated visits to
  `/login`/`/signup` redirect to `/`. Still falls through unchanged when Supabase env vars
  aren't set, so local dev before Supabase is wired up keeps working.
- `/login` now honors `?next=` after a successful sign-in (validated same-origin relative path
  only — no open redirect), via a new optional third `redirectTo` param on `signInWithEmail`
  (`src/lib/supabase/auth-actions.ts`) — existing 2-arg callers are unaffected.
- Forgot/reset password: `/forgot-password` + `/reset-password` pages (outside `(app)`), new
  `requestPasswordReset` / `updatePassword` Server Actions. The reset page is a Client
  Component because the recovery session Supabase encodes in the emailed link only exists in
  the browser URL — constructing the Supabase browser client there is what actually parses it
  and persists a session (via cookies) before the password-update Server Action runs.
- "Remember me" checkbox added to `/login`, default-checked. **Does not currently change
  behavior** — the installed `@supabase/ssr@0.4.0` hardcodes both `auth.persistSession: true`
  and the session cookie's `maxAge` (always 1 year) inside `createBrowserClient`/its cookie
  storage adapter, ignoring whatever is passed for either. There's no version-correct way to
  make an individual sign-in session-only without a custom cookie storage adapter. Revisit if
  `@supabase/ssr` is upgraded past 0.4.0 — see the code comment on the checkbox in
  `src/app/login/page.tsx` for the exact mechanism.
- Signup polish: client-side password-strength meter (`src/components/auth/PasswordField.tsx`,
  `PasswordStrengthMeter.tsx` — length + character-variety heuristic, no external library), and
  a Hebrew translation map for Supabase Auth's English error messages
  (`src/lib/authErrors.ts`) wired into every action in `auth-actions.ts` — no raw English
  string reaches the UI anymore.
- Post-login welcome toast: `src/components/layout/AuthSync.tsx` (rendered from `AppShell`)
  detects a one-shot `?justLoggedIn=1` flag set by the login redirect, shows "שלום
  {email}, ברוך הבא בחזרה" for ~3s (framer-motion fade), then strips the flag from the URL.
- **Anonymous local-data claiming**: `StoredHand`/`StoredOpponent`/`StoredSession`/`StoredRange`
  (the four `localStorage`-backed stores) all gained an optional `userId?: string` field.
  Existing pre-Phase-1 records simply have it `undefined`. Each store file exports an
  idempotent `claimAnonymous*(userId)` that tags only unowned records; `src/lib/claimLocalData.ts`
  calls all four. `AuthSync` runs this once per authenticated user per browser (guarded by a
  `pra:claimed:<userId>` localStorage flag) on `(app)` mount. Nothing is synced to Supabase in
  this phase — data stays local, just tagged with an owner; cross-device sync is an explicitly
  later phase.
- `src/app/(app)/settings/page.tsx` gained an "חשבון" section: shows the signed-in user's email
  and a "התנתקות" button wired to `signOut()`. No other restructuring of that page.

**Still needed before this is fully live:**
- Google/Apple OAuth still need real credentials from the product owner (Google Cloud OAuth
  app + Supabase provider config; Apple Developer + Supabase provider config) before "המשך עם
  גוגל" actually completes sign-in — right now the button correctly kicks off the OAuth flow
  code-path but Supabase has no provider configured, so it errors gracefully (translated to
  Hebrew) instead of crashing.
- The forgot/reset-password email flow hasn't been tested end-to-end against the live Supabase
  project + Netlify domain yet (needs the Auth redirect-URL allowlist entry mentioned below).
- Supabase's Auth redirect-URL allowlist (Authentication → URL Configuration) needs
  `https://poker-range-analyzer.netlify.app` added — same still-open item as the OAuth
  callback note further down this file.

## UI overhaul — 2026-07-07 (second pass)

Per user request, the whole app was converted from English/dark-theme to **Hebrew/RTL/light-
theme**, plus several UX changes:
- `<html lang="he" dir="rtl">` app-wide; every user-facing string translated to Hebrew (see
  `src/lib/labels.ts` for the shared hand-category/draw-type Hebrew label dictionary — reuse
  it rather than inventing new terms if you add more poker-term UI text).
- Light theme: `tailwind.config.ts` color tokens flipped to white/light-gray backgrounds with
  dark text (was near-black with light text). If you add new components, use the `base-*`/
  `status-*`/`accent` Tailwind tokens, never hardcode hex — that's what made this flip
  possible in ~10 files instead of ~60.
- Analyze page restructured: entering the flop now opens one continuous 3-card picker
  session (was one card at a time); results (equity/win-tie-lose, pot odds, the Coach) render
  in a column that's sticky beside the inputs on desktop and appears immediately after hero-
  card entry on mobile, instead of requiring a scroll past the range builder.
- The Coach panel is now part of the always-visible results (previously buried inside the
  collapsed Deep Analysis section).
- Hero Summary now shows an explicit win/tie/lose % breakdown, not just the headline equity
  number.
- New **אתגרים/Leaderboard** page (`/leaderboard`, `src/lib/leaderboard.ts`) — daily/weekly/
  monthly personal challenge tracking (hands analyzed, decision accuracy, a day-streak
  counter) computed from locally-saved hands. Deliberately framed as personal
  challenges, not a real multiplayer leaderboard — there's no cross-user comparison since hand
  data is still local-only per browser (see the Supabase data-layer-swap item below). A real
  social leaderboard is a natural follow-up once that swap happens.
- Sidebar/bottom-nav rebuilt: sidebar is `sticky h-screen` (was relying on flex-stretch, which
  could gap on short pages), bottom nav uses a `grid-cols-5` (was flex, which could leave
  around uneven-width gaps) and now includes the leaderboard tab.
- Google OAuth button exists and is wired to Supabase, but does not yet work — the user needs
  to create a Google Cloud OAuth app and add its credentials in Supabase (Authentication →
  Providers → Google) before it will function. Email/password auth is fully live.

## Shipped (this build)

**Core engine** (`src/lib/engine/`) — pure TypeScript, fully unit-tested (35 tests):
- Hand evaluator (5–7 cards, all categories, wheel straight handled correctly)
- Equity calculator: exact enumeration on turn/river, Monte Carlo on flop/preflop
- Range parser (`22+`, `ATs+`, `AKo`, comma lists, dash ranges, weighted combos)
- Hand classifier (made-hand tier + draws, used for range composition & blockers)
- Hand history parser (targets the PokerStars format precisely; also covers GGPoker/ClubGG
  exports since they mirror it closely — see the file header for the exact reference format)
- Leak finder (session stats, leak detection by position/category/street/pot-size, progress
  trends over time)

**App** (Next.js 14 App Router + TypeScript + Tailwind):
- Full 3-layer analysis screen (Decision / Explanation / Deep Analysis) with card picker,
  13×13 range matrix (builder + equity-heatmap modes), animated equity meter, hero summary,
  key insights, pot odds/EV/SPR/outs, range composition pie chart, blocker analysis, cards-to-
  watch, what-changed, and coach messages
- Hand History Importer: paste + bulk file upload + parse preview + load into analyzer;
  "analyze from screenshot" is a wired-up stub (needs a vision API — see below)
- Leak Finder & Session Review dashboard (Pro-gated)
- Hand library + range library with local save/load
- Dashboard home, Settings, placeholder pages for every Wave 2–4 feature (Training, Range vs
  Range, ICM, AI Hand Review, Opponent Profiles, Bankroll Tracker) so the sitemap is complete
- Auth pages (login/signup) wired to Supabase Auth server actions (email + Google OAuth)
- Free/Pro plan gating wired through actual UI flows (daily analysis limit, saved-hand limit,
  import limit/bulk lock, leak finder lock) — see `src/lib/plan.ts` for the limits table
- Billing page + Stripe Checkout/webhook routes (scaffolded, no real Stripe account yet)
- PWA: manifest + service worker (network-first/cache-fallback) + placeholder icons

**Data layer**: hands/ranges are stored in `localStorage` right now (`src/lib/localHandStore.ts`,
`src/lib/localRangeStore.ts`) — the app is fully usable without Supabase. A real Supabase
Postgres project IS now connected and migrated (see below); the local-storage layer just
hasn't been swapped for real Supabase-backed calls yet (that swap is the next real step).

**Supabase — connected 2026-07-07**: real project provisioned, schema migrated
(`prisma/migrations/20260707083717_init`), RLS enabled + auth-trigger migration applied
(`prisma/migrations/20260707090000_auth_trigger_and_rls`). Notes for next time:
- Project's **direct connection** (`db.<ref>.supabase.co:5432`) is IPv6-only and unreachable
  from this network — use the **Session pooler** connection string (IPv4,
  `aws-0-<region>.pooler.supabase.com:5432`, username `postgres.<project-ref>`) for
  `DIRECT_URL`, and the **Transaction pooler** (`:6543`, `?pgbouncer=true`) for `DATABASE_URL`.
  Both are on the Database settings page, different tabs.
- `prisma migrate dev` refuses to run non-interactively (this environment). Workflow used
  instead: `prisma migrate diff --from-empty --to-schema-datamodel ... --script` to generate
  the SQL, hand-write a `migration_lock.toml`, then `prisma migrate deploy` to apply — same
  end state, just skips the interactive wizard.
- New Supabase projects come with one pre-existing placeholder table in `public` (named after
  the project) that blocks `migrate deploy`'s "schema not empty" check — drop it first.
- `public.users.id` is **not** a Prisma-generated cuid in practice — a Postgres trigger
  (`handle_new_auth_user`, in the RLS migration) mirrors every new `auth.users` row into
  `public.users` using the *same* UUID, which is what makes `auth.uid() = user_id` RLS
  policies actually work. Don't let application code insert `users` rows with a fresh cuid;
  the trigger is the only thing that should create them.
- RLS is enabled on all 6 tables with owner-only policies (`ranges` also allows reading
  `is_preset = true` rows for everyone). `subscriptions` is read-only from the client — all
  writes go through the service-role key in the Stripe webhook handler.

**Netlify — deployed 2026-07-07**: live at https://poker-range-analyzer.netlify.app (site
name/project ID: `poker-range-analyzer`, team "YARIN ASHUAL"). Deployed via `netlify.toml` +
`@netlify/plugin-nextjs` (Next.js Runtime v5, auto SSR/API-route/middleware support — no
static export). The 5 Supabase env vars (`DATABASE_URL`, `DIRECT_URL`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are
set on the Netlify site (`netlify env:list` to check, `netlify env:set` to update). Stripe/
Anthropic vars are NOT set yet — add them the same way once those services are connected.

**Still needed for auth to fully work on the live domain**: Supabase's Auth settings have an
allowlist for redirect URLs (Authentication → URL Configuration in the Supabase dashboard) —
add `https://poker-range-analyzer.netlify.app` as the Site URL (or to Additional Redirect
URLs) or email-confirmation links / OAuth callbacks will be rejected. Not done yet.

## Explicitly deferred / stubbed (by design, per spec's own wave plan)

These have a nav entry + "coming soon" screen but no logic yet: Training Mode, Range vs Range
equity distribution, ICM calculator, AI narrative hand review, Opponent profiles, Bankroll
tracker. Building these is the natural "Wave 2/3/4" next step per the spec's own roadmap
(section 8).

## Blocked on the user — cannot proceed without these

- ~~**GitHub**~~ — done: pushed to https://github.com/nicfrer-cmyk/poker-range-analyzer.
- ~~**Supabase project**~~ — done: real project connected, migrated, RLS enabled (see above).
  `localHandStore`/`localRangeStore` still need to be swapped for real Supabase calls as a
  follow-up (currently everything still runs on `localStorage` even though the DB is live).
- **Payment provider — open decision, not just a credentials gap**: the app is scaffolded
  against Stripe (`src/lib/stripe/`, `src/app/api/stripe/*`, `src/app/(app)/billing/page.tsx`),
  but the user doesn't have a Stripe account and actually processes payments through **Grow**
  (formerly Meshulam, an Israeli payment gateway — docs at grow-il.readme.io) for other work.
  Explicitly decided (2026-07-07) to leave the Stripe scaffolding in place for now and revisit
  which provider to actually use later, rather than guess-porting to Grow. If/when that
  decision happens:
  - **If staying on Stripe**: needs a real account, two Price IDs
    (`STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`), and a webhook signing secret from
    the Stripe dashboard. Pricing shown ($14/mo, $118/yr) is a placeholder per the spec's own
    note — real pricing needs competitor research.
  - **If switching to Grow**: this is a real re-architecture, not a config swap — Grow's
    webhook model has no HMAC/signature verification (just a `webhookKey` field in the
    payload body to match against), webhooks need to be manually enabled by Grow support per
    account, and the concrete "create a payment page" API request/response shape wasn't fully
    extractable from their docs site (readme.io renders parts of it client-side) — get the
    exact API reference (or a working code sample) from the user's Grow dashboard/support
    before writing the integration, don't guess field names for a payments flow.
- ~~**Netlify**~~ — done: live at https://poker-range-analyzer.netlify.app (see above). Still
  need to add that domain to Supabase's Auth redirect-URL allowlist.
- **Anthropic API key**: reserved in `.env.example` for the future AI Hand Review feature;
  not implemented yet.
- **Vision API** (for "analyze from screenshot"): entry point exists in the importer UI but
  is a stub — needs a vision-capable model wired server-side once decided.

## Known residual risk

- `npm audit` still flags `next`'s current 14.x line for a handful of advisories whose fix
  requires jumping to Next 15/16 — a breaking major-version change I did not do blind. Bumped
  to the latest available 14.2.x patch (14.2.35) instead. Revisit this as a deliberate,
  tested upgrade later, not a drive-by dependency bump.
- Dev-only tooling (`vitest`/`vite`/`esbuild`) has a few audit findings that only matter if
  the dev server is exposed publicly — not a production runtime risk.
- The "range vs range heatmap" and "next card outlook" deep-analysis features sample down
  the villain range (to ~35 and ~8 representative combos respectively) to keep response times
  reasonable in-browser — they're directional indicators, not full-precision equity. The
  headline hero-equity number (Layer 1) uses the full range with no sampling.
- `estimateEvLoss` (feeds the leak finder) only models call-vs-fold correctly; bet/raise/check
  are treated as EV-neutral for now since there's no bet-sizing/bluff model yet.

## Next steps once the user is ready

1. ~~Create/connect a GitHub repo, push.~~ Done.
2. ~~Create a Supabase project, set env vars, run migrations, write RLS policies.~~ Done.
   Remaining: swap `localHandStore`/`localRangeStore` for real Supabase-backed calls.
3. **Decide Stripe vs. Grow first** (see above — open decision, not yet made). Then either
   create a Stripe account (test mode first), set Price IDs + webhook secret, test the
   checkout → webhook → plan-upgrade flow end to end, and set the same vars via
   `netlify env:set` — or get Grow's real API reference and rebuild the billing integration
   against it.
4. ~~Deploy to Netlify.~~ Done. Remaining: add the live domain to Supabase's Auth redirect-URL
   allowlist so email confirmation / OAuth callbacks work end to end.
5. Build the deferred Wave 2 features (Training Mode, AI Hand Review) — the retention engine
   the spec calls the real business justification for the Pro subscription.

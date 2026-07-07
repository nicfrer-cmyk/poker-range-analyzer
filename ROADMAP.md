# Roadmap / Project Status

Source spec: `poker-analyzer-spec.pdf` (Hebrew, v1.0, July 2026). This file tracks what's
actually built vs. what's still blocked on a real decision or credential — read this before
assuming something is "done."

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

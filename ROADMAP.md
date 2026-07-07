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
`src/lib/localRangeStore.ts`) so the app is fully usable before Supabase is connected. Prisma
schema (`prisma/schema.prisma`) mirrors the spec's table design and is ready to migrate once a
real database exists.

## Explicitly deferred / stubbed (by design, per spec's own wave plan)

These have a nav entry + "coming soon" screen but no logic yet: Training Mode, Range vs Range
equity distribution, ICM calculator, AI narrative hand review, Opponent profiles, Bankroll
tracker. Building these is the natural "Wave 2/3/4" next step per the spec's own roadmap
(section 8).

## Blocked on the user — cannot proceed without these

- **GitHub**: no remote connected yet. Repo is git-initialized locally with one commit.
- **Supabase project**: `.env` needs `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from a real project, then run
  `npx prisma migrate dev` to create the tables and enable RLS policies (not yet written —
  do this alongside connecting the real project, since RLS policies need a live schema to
  test against).
- **Stripe**: needs a real account, two Price IDs (`STRIPE_PRICE_PRO_MONTHLY`,
  `STRIPE_PRICE_PRO_ANNUAL`), and a webhook signing secret, all created from the Stripe
  dashboard. Pricing shown ($14/mo, $118/yr) is a placeholder per the spec's own note — real
  pricing needs competitor research.
- **Netlify (or chosen host)**: not deployed yet.
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

1. Create/connect a GitHub repo, push.
2. Create a Supabase project, set env vars, run migrations, write RLS policies, swap
   `localHandStore`/`localRangeStore` for real Supabase-backed calls.
3. Create a Stripe account (test mode first), set Price IDs + webhook secret, test the
   checkout → webhook → plan-upgrade flow end to end.
4. Deploy to Netlify (or chosen host), point Stripe webhook + Supabase Auth redirect URLs at
   the real domain.
5. Build the deferred Wave 2 features (Training Mode, AI Hand Review) — the retention engine
   the spec calls the real business justification for the Pro subscription.

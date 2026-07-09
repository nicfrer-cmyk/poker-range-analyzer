# Poker Range Analyzer

A post-game poker hand and range analysis tool: pick a hand, see where it stood against a
villain's range, and what the right play was — never live-play assistance, always after the
hand is over. Hebrew/RTL UI.

See `ROADMAP.md` for what's built vs. what's still blocked on a real decision or credential.

## Stack

Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind CSS + Framer Motion + Zustand +
React Query + Zod + Supabase (Postgres + Auth, connected and migrated) + Prisma + Grow
(Meshulam, the active payment provider — Stripe scaffolding is kept but inactive) + Anthropic
API (AI hand review). The equity engine (`src/lib/engine/`) is pure TypeScript with no
React/Next dependency; the heavier calculations (range-vs-range, range explorer) run in a Web
Worker (`src/lib/engine/equity.worker.ts`, pre-bundled by esbuild — see Scripts below).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in what you have; the app runs locally without any of it
npm run dev
```

Open http://localhost:3000. Most features work without any env vars set (pages render, forms
show clear "not configured yet" errors) — see the environment variables table below for what
each one unlocks.

## Scripts

- `npm run dev` / `npm run build` / `npm start` — dev server / production build / serve. Both
  `dev` and `build` first run a `predev`/`prebuild` step that bundles the equity Web Worker
  (`scripts/build-equity-worker.mjs`, via esbuild) into `public/equity-worker.js` — generated,
  gitignored, never hand-edited.
- `npm test` / `npm run test:watch` — engine + integration tests (Vitest)
- `npm run lint` — ESLint
- `npm run prisma:generate` — regenerate the Prisma client after schema changes (also runs
  automatically on `npm install` via `postinstall`)
- `node scripts/set-plan.mjs <email-or-userId> <FREE|PRO> --yes` — manual plan override, for use
  until the Grow webhook is verified against a real sandbox account (see
  `src/app/api/grow/webhook/route.ts`). Requires `DATABASE_URL` in the environment.
- `node scripts/generate-icons.mjs` — regenerates the PWA icons (`public/icons/*.png`) and
  `src/app/favicon.ico` from the hand-rolled pixel-art generator. Run by hand after changing the
  icon design; output is committed, not generated on every build.
- `node scripts/generate-og-image.mjs` — regenerates `public/og.png` (1200×630 social-preview
  image), same "run by hand, commit the output" convention as the icons above.

## Environment variables

Full reference lives in `.env.example` (every var has a comment there explaining where to get
it and what breaks without it). Summary by area:

| Area | Variables | Notes |
| --- | --- | --- |
| App URL | `NEXT_PUBLIC_APP_URL` | Canonical base URL — payment redirect/notify URLs, metadata, sitemap, robots. Falls back to request origin in local dev. |
| Database | `DATABASE_URL`, `DIRECT_URL` | Supabase Postgres — pooled (runtime) vs direct (migrations). |
| Supabase Auth | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Service role key is required for self-service account deletion (`/api/account/delete`); everything else works without it. |
| Payments (Grow) | `GROW_USER_ID`, `GROW_PAGE_CODE_CREDIT_CARD`, `GROW_API_BASE_URL`, `GROW_WEBHOOK_SHARED_SECRET` | Checkout returns a clear 501 until the first two are set. The webhook shared secret is a self-verification token embedded in `notifyUrl` — see `src/app/api/grow/webhook/route.ts`. |
| Payments (Stripe, inactive) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL` | Kept in case of a future switch back; safe to leave unset. |
| AI | `ANTHROPIC_API_KEY` | Powers AI hand review + screenshot parsing (`claude-sonnet-4-6`). Both routes return 501 without it. |
| CAPTCHA | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile on signup/login. Widget doesn't render and forms behave normally when unset. |
| Support | `NEXT_PUBLIC_SUPPORT_EMAIL` | Shown on billing/legal/settings screens. |
| Analytics | `NEXT_PUBLIC_ANALYTICS_PROVIDER`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Only `"posthog"` is implemented. Unset = every event still fires, just to `console.debug` instead of a real provider. |

Adding a new external domain (a new CAPTCHA/analytics/error-tracking provider, etc.)? Update
`connect-src`/`script-src`/`frame-src` in `next.config.mjs`'s CSP in the same change, or the
feature will silently fail in production with no console hint beyond a CSP violation.

## Project layout

```
src/lib/engine/         pure poker engine (evaluator, equity, range parser, classifier,
                        hand-history parser, leak finder) — no React/Next dependencies
src/lib/engine/equity.worker.ts   Web Worker entry point for the heavier equity calcs;
                        bundled to public/equity-worker.js by scripts/build-equity-worker.mjs
src/lib/analysisEngine.ts   adapts the engine into the UI's AnalysisResult shape
src/lib/supabase/       Supabase client/server/middleware/auth-actions/admin (service-role)
src/lib/grow/           Grow (Meshulam) payment client + plan pricing — the active payment
                        provider; src/lib/stripe/ is kept but inactive
src/lib/plan.ts          Free vs Pro limits + gating checks (also mirrored at the DB level for
                        maxSavedHands/maxOpponentProfiles — see prisma/migrations)
src/lib/training.ts     Training Mode scenario generation (spaced-repetition-style quiz)
src/components/          UI components (cards, range matrix, analysis panels, layout)
src/app/welcome/         public marketing landing page
src/app/(app)/           the authenticated app shell (dashboard, analyze, hands, session, ...)
prisma/schema.prisma    database schema — connected to a real Supabase Postgres project
```

## Known deferrals

- **Sentry (`@sentry/nextjs`)**: not integrated. It's a reasonable next step for error tracking,
  but its setup wizard modifies `next.config.mjs` and adds instrumentation files in ways that
  have a real chance of friction with `@netlify/plugin-nextjs` (this app's Netlify build
  adapter) — deferred rather than risking a build breakage to add observability tooling. If you
  pick this up: add `SENTRY_DSN` behind the same "unset = inert" pattern every other integration
  in this repo follows, and update `connect-src` in `next.config.mjs`'s CSP.

# Poker Range Analyzer

A post-game poker hand and range analysis tool: pick a hand, see where it stood against a
villain's range, and what the right play was — never live-play assistance, always after the
hand is over.

See `ROADMAP.md` for what's built vs. what's blocked on real credentials (Supabase, Stripe,
GitHub, Netlify).

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind CSS + Framer Motion + Zustand + React Query +
Zod + Supabase (Postgres + Auth) + Prisma + Stripe. Equity engine is pure TypeScript, runs
entirely client-side.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in what you have; the app runs locally without any of it
npm run dev
```

Open http://localhost:3000. Hands/ranges save to `localStorage` until a real Supabase project
is connected (see `.env.example` and `ROADMAP.md`).

## Scripts

- `npm run dev` — dev server
- `npm run build` / `npm start` — production build/serve
- `npm test` — engine unit tests (Vitest)
- `npm run lint` — ESLint
- `npm run prisma:generate` — regenerate the Prisma client after schema changes
- `node scripts/set-plan.mjs <email-or-userId> <FREE|PRO> --yes` — manual plan override, for use
  until the Grow webhook is verified against a real sandbox account (see
  `src/app/api/grow/webhook/route.ts`). Requires `DATABASE_URL` in the environment.

## Project layout

```
src/lib/engine/       pure poker engine (evaluator, equity, range parser, classifier,
                      hand-history parser, leak finder) — no React/Next dependencies
src/lib/analysisEngine.ts   adapts the engine into the UI's AnalysisResult shape
src/lib/supabase/     Supabase client/server/middleware/auth-actions
src/lib/stripe/       Stripe client + plan pricing
src/lib/plan.ts        Free vs Pro limits + gating checks
src/components/        UI components (cards, range matrix, analysis panels, layout)
src/app/(app)/         the authenticated app shell (dashboard, analyze, hands, session, ...)
prisma/schema.prisma   database schema (not yet migrated to a real database)
```

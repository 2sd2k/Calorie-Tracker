# Calorie Tracker — Project Guide

A personal Notion-backed dashboard for calories/macros and body weight. A Next.js app
(deployed on Vercel) reads live from two Notion databases and renders charts. Data is
logged in Notion; the app itself is read-only.

## Architecture

```
Notion "Meals Log" + "Weight Log"  ──Notion API──►  Next.js (app/page.tsx)  ──►  charts
   (one row per meal / weigh-in)      (v5 data sources)   aggregates by day      (Recharts)
```

Push to `main` auto-deploys on Vercel. Every page load reads live from Notion
(`export const dynamic = "force-dynamic"`).

## Data model (column names are case-sensitive; the app validates them)

- **Meals Log** — `Meal` (title), `Date` (date), `Calories`, `Protein (g)`, `Carbs (g)`,
  `Fat (g)` (numbers), `Notes` (text)
- **Weight Log** — `Entry` (title), `Date` (date), `Weight (lbs)` (number), `Notes` (text)

## Logging data

- **Meal:** add a row to the Meals Log, set `Date` + the macro numbers.
- **Weigh-in:** add a row to the Weight Log, set `Date` + `Weight (lbs)`.
- Refresh the dashboard to see updated charts.
- Sample rows created by the seed scripts are tagged `· sample` in `Notes`.

## Environment variables

Set in `.env.local` (local, gitignored) and in Vercel project settings. Values are **not**
committed to the repo.

- `NOTION_TOKEN` — Notion internal integration token. **Secret** — never commit or paste it.
- `NOTION_DATA_SOURCE_ID` — data source ID of the Meals Log.
- `NOTION_WEIGHT_DATA_SOURCE_ID` — data source ID of the Weight Log (optional; the weight
  graph is hidden if unset).
- `TRACKER_TIMEZONE` — IANA timezone (e.g. `America/Los_Angeles`) so "today" is correct on
  Vercel, whose servers run in UTC. Locally it falls back to the machine's timezone.

## Key files

- `lib/notion.ts` — Notion fetch, per-day aggregation, and error handling (returns
  classified, actionable errors and validates the Notion schema instead of showing silent zeros).
- `app/page.tsx` — dashboard (server component).
- `components/MacroCharts.tsx`, `components/WeightChart.tsx` — Recharts client charts.
- `app/error.tsx`, `app/loading.tsx` — route error boundary and loading skeleton.
- `scripts/` — `setup-notion-db`, `setup-weight-db`, `seed-sample-meals`,
  `seed-sample-weights`, `delete-sample-meals` (each reads env vars from `.env.local`).

## Conventions & gotchas

- **Modified Next.js:** this repo runs a customized Next.js 16 — before writing Next.js code,
  read the relevant guide in `node_modules/next/dist/docs/` (see `AGENTS.md`). APIs can differ
  from the public docs (e.g. error boundaries use `unstable_retry`, not `reset`).
- Tailwind CSS v4, `@notionhq/client` v5 (uses "data sources", not legacy databases).
- Never commit `.env.local` or stage secrets.
- Verify changes with `npm run lint` and `npx tsc --noEmit` before calling them done.
- If the dev server stops reflecting edits, Turbopack may have wedged — stop it,
  `rm -rf .next`, then restart `npm run dev`.

## Common tasks

- **Deploy:** push to `main` (auto-deploys on Vercel). Add any new env vars in Vercel first.
- **Add sample data:** `node scripts/seed-sample-meals.mjs` / `node scripts/seed-sample-weights.mjs`.
- **Remove sample data:** `node scripts/delete-sample-meals.mjs`, or filter `Notes` by
  `· sample` in Notion and delete.
